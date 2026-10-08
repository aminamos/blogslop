// Crawl → store → score → poll orchestration. Shared by API routes and cron.

import { and, avg, eq, sql } from "drizzle-orm";
import { crawlJobs, documents, pangramTasks, sources } from "../db/schema";
import type { Db } from "./db";
import type { Env } from "./env";
import { getCrawlStatus, startCrawl } from "./firecrawl";
import { createTask, getTask } from "./pangram";
import {
  fetchFilingText,
  fetchSubmissions,
  filingDocUrl,
  latestFilings,
} from "./sec";
import { chunkText, slopLabel, wordCount } from "./text";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type SourceRow = typeof sources.$inferSelect;

async function getSource(d: Db, slug: string): Promise<SourceRow> {
  const src = await d.select().from(sources).where(eq(sources.slug, slug)).get();
  if (!src) throw new HttpError(404, `unknown source: ${slug}`);
  return src;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function triggerCrawl(d: Db, env: Env, slug: string, limitOverride?: number) {
  const src = await getSource(d, slug);
  const config = JSON.parse(src.config ?? "{}") as Record<string, unknown>;
  const now = Date.now();

  if (src.kind === "sec") {
    const rows = await d
      .insert(crawlJobs)
      .values({
        sourceId: src.id,
        provider: "sec",
        status: "running",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: crawlJobs.id });
    const jobId = rows[0].id;
    try {
      const stored = await runSecCrawl(d, env, src.id, config);
      await d
        .update(crawlJobs)
        .set({ status: "completed", pagesFound: stored, pagesStored: stored, updatedAt: Date.now() })
        .where(eq(crawlJobs.id, jobId));
      return { jobId, provider: "sec", status: "completed", pagesStored: stored };
    } catch (e) {
      await d
        .update(crawlJobs)
        .set({ status: "failed", error: String(e), updatedAt: Date.now() })
        .where(eq(crawlJobs.id, jobId));
      throw e;
    }
  }

  if (!env.FIRECRAWL_API_KEY) throw new HttpError(500, "FIRECRAWL_API_KEY not configured");
  const job = await startCrawl(env.FIRECRAWL_API_KEY, {
    url: src.baseUrl,
    limit: limitOverride ?? num(config["limit"], 25),
    maxDiscoveryDepth: num(config["maxDiscoveryDepth"], 2),
    includePaths: Array.isArray(config["includePaths"])
      ? (config["includePaths"] as string[])
      : undefined,
    excludePaths: Array.isArray(config["excludePaths"])
      ? (config["excludePaths"] as string[])
      : undefined,
  });
  const rows = await d
    .insert(crawlJobs)
    .values({
      sourceId: src.id,
      provider: "firecrawl",
      providerJobId: job.id,
      status: "running",
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: crawlJobs.id });
  return { jobId: rows[0].id, provider: "firecrawl", providerJobId: job.id, status: "running" };
}

async function runSecCrawl(
  d: Db,
  env: Env,
  sourceId: number,
  config: Record<string, unknown>,
): Promise<number> {
  const cik = String(config["cik"] ?? "");
  if (!cik) throw new HttpError(400, "sec source missing config.cik");
  const forms = Array.isArray(config["forms"]) ? (config["forms"] as string[]) : ["10-K"];
  const nFilings = num(config["filings"], 1);
  const sub = await fetchSubmissions(cik, env.SEC_USER_AGENT);
  const filings = latestFilings(sub, forms, nFilings);
  let stored = 0;
  for (const f of filings) {
    const url = filingDocUrl(cik, f);
    const existing = await d
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.url, url))
      .get();
    if (existing) continue;
    const text = await fetchFilingText(url, env.SEC_USER_AGENT);
    await d.insert(documents).values({
      sourceId,
      url,
      title: `${f.form} filed ${f.filingDate} (period ${f.reportDate})`,
      publishedAt: f.filingDate,
      textContent: text,
      wordCount: wordCount(text),
      status: "crawled",
      createdAt: Date.now(),
    });
    stored++;
  }
  return stored;
}

export async function pollCrawlJob(d: Db, env: Env, jobId: number) {
  const job = await d.select().from(crawlJobs).where(eq(crawlJobs.id, jobId)).get();
  if (!job) throw new HttpError(404, `unknown job: ${jobId}`);
  if (job.provider !== "firecrawl" || !job.providerJobId) return job;
  if (job.status === "completed" || job.status === "failed") return job;
  if (!env.FIRECRAWL_API_KEY) throw new HttpError(500, "FIRECRAWL_API_KEY not configured");

  const st = await getCrawlStatus(env.FIRECRAWL_API_KEY, job.providerJobId);
  if (st.status === "completed") {
    let stored = 0;
    for (const page of st.data ?? []) {
      const url = page.metadata?.sourceURL;
      const md = page.markdown ?? "";
      if (!url || !md.trim()) continue;
      const existing = await d
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.url, url))
        .get();
      if (existing) continue;
      await d.insert(documents).values({
        sourceId: job.sourceId,
        url,
        title: page.metadata?.title ?? null,
        publishedAt: page.metadata?.publishedTime ?? null,
        textContent: md,
        wordCount: wordCount(md),
        status: "crawled",
        createdAt: Date.now(),
      });
      stored++;
    }
    await d
      .update(crawlJobs)
      .set({ status: "completed", pagesFound: st.completed, pagesStored: stored, updatedAt: Date.now() })
      .where(eq(crawlJobs.id, jobId));
  } else if (st.status === "failed" || st.status === "cancelled") {
    await d
      .update(crawlJobs)
      .set({ status: "failed", error: `firecrawl status: ${st.status}`, updatedAt: Date.now() })
      .where(eq(crawlJobs.id, jobId));
  } else {
    await d
      .update(crawlJobs)
      .set({ status: "running", pagesFound: st.completed, updatedAt: Date.now() })
      .where(eq(crawlJobs.id, jobId));
  }
  return (await d.select().from(crawlJobs).where(eq(crawlJobs.id, jobId)).get()) ?? job;
}

export async function scoreDocument(d: Db, env: Env, docId: number) {
  const doc = await d.select().from(documents).where(eq(documents.id, docId)).get();
  if (!doc) throw new HttpError(404, `unknown document: ${docId}`);
  if (!env.PANGRAM_API_KEY) throw new HttpError(500, "PANGRAM_API_KEY not configured");
  const chunks = chunkText(doc.textContent);
  if (chunks.length === 0) {
    await d.update(documents).set({ status: "failed" }).where(eq(documents.id, docId));
    throw new HttpError(422, `document ${docId} has no scorable text`);
  }
  await d.update(documents).set({ status: "scoring" }).where(eq(documents.id, docId));
  const now = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    const { taskId } = await createTask(env.PANGRAM_API_KEY, chunks[i], env.PANGRAM_MODEL);
    await d.insert(pangramTasks).values({
      documentId: docId,
      chunkIndex: i,
      chunkChars: chunks[i].length,
      taskId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }
  return { documentId: docId, chunks: chunks.length };
}

export async function pollPangramTasks(d: Db, env: Env, limit = 25) {
  if (!env.PANGRAM_API_KEY) throw new HttpError(500, "PANGRAM_API_KEY not configured");
  const pending = await d
    .select()
    .from(pangramTasks)
    .where(eq(pangramTasks.status, "pending"))
    .limit(limit);
  let ok = 0;
  let failed = 0;
  let waiting = 0;
  const docIds = new Set<number>();
  for (const t of pending) {
    docIds.add(t.documentId);
    let r;
    try {
      r = await getTask(env.PANGRAM_API_KEY, t.taskId);
    } catch {
      waiting++; // transient — leave pending for next tick
      continue;
    }
    if (r.stage === "STAGE_SUCCESS") {
      await d
        .update(pangramTasks)
        .set({
          status: "success",
          fractionAi: r.fractionAi ?? null,
          fractionAiAssisted: r.fractionAiAssisted ?? null,
          prediction: r.prediction ?? null,
          predictionShort: r.predictionShort ?? null,
          raw: JSON.stringify(r),
          updatedAt: Date.now(),
        })
        .where(eq(pangramTasks.id, t.id));
      ok++;
    } else if (r.stage === "STAGE_FAILED") {
      await d
        .update(pangramTasks)
        .set({ status: "failed", updatedAt: Date.now() })
        .where(eq(pangramTasks.id, t.id));
      failed++;
    } else {
      waiting++;
    }
  }
  for (const docId of docIds) {
    const remaining = await d
      .select({ id: pangramTasks.id })
      .from(pangramTasks)
      .where(and(eq(pangramTasks.documentId, docId), eq(pangramTasks.status, "pending")))
      .limit(1);
    if (remaining.length === 0) {
      const succeeded = await d
        .select({ id: pangramTasks.id })
        .from(pangramTasks)
        .where(and(eq(pangramTasks.documentId, docId), eq(pangramTasks.status, "success")))
        .limit(1);
      await d
        .update(documents)
        .set({ status: succeeded.length > 0 ? "scored" : "failed" })
        .where(eq(documents.id, docId));
    }
  }
  return { polled: pending.length, ok, failed, waiting };
}

export interface LeaderboardRow {
  slug: string;
  name: string;
  kind: string;
  docsStored: number;
  docsScored: number;
  avgAi: number | null;
  label: string;
}

export async function leaderboard(d: Db): Promise<LeaderboardRow[]> {
  const rows = await d
    .select({
      slug: sources.slug,
      name: sources.name,
      kind: sources.kind,
      docsStored: sql<number>`count(distinct ${documents.id})`,
      docsScored: sql<number>`count(distinct case when ${pangramTasks.id} is not null then ${documents.id} end)`,
      avgAi: avg(pangramTasks.fractionAi),
    })
    .from(sources)
    .leftJoin(documents, eq(documents.sourceId, sources.id))
    .leftJoin(
      pangramTasks,
      and(eq(pangramTasks.documentId, documents.id), eq(pangramTasks.status, "success")),
    )
    .groupBy(sources.id);
  return rows.map((r) => {
    const avgAi = r.avgAi === null ? null : Number(r.avgAi);
    return {
      slug: r.slug,
      name: r.name,
      kind: r.kind,
      docsStored: Number(r.docsStored),
      docsScored: Number(r.docsScored),
      avgAi,
      label: slopLabel(avgAi),
    };
  });
}
