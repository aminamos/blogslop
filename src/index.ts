import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { crawlJobs, documents, pangramTasks, sources } from "./db/schema";
import { openDb } from "./lib/db";
import type { Env } from "./lib/env";
import {
  HttpError,
  leaderboard,
  pollCrawlJob,
  pollPangramTasks,
  scoreDocument,
  triggerCrawl,
} from "./lib/pipeline";
import { SEED_SOURCES } from "./lib/sources";
import { slopLabel } from "./lib/text";

const app = new Hono<{ Bindings: Env }>();

app.onError((e, c) => {
  if (e instanceof HttpError) return c.json({ error: e.message }, e.status as 400);
  console.error(e);
  return c.json({ error: "internal error" }, 500);
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/sources", (c) => {
  const d = openDb(c.env);
  return c.json(d.select().from(sources));
});

app.post("/api/sources/seed", async (c) => {
  const d = openDb(c.env);
  const now = Date.now();
  for (const s of SEED_SOURCES) {
    await d
      .insert(sources)
      .values({
        slug: s.slug,
        name: s.name,
        kind: s.kind,
        baseUrl: s.baseUrl,
        config: JSON.stringify(s.config),
        createdAt: now,
      })
      .onConflictDoNothing({ target: sources.slug });
  }
  const all = await d.select().from(sources);
  return c.json({ sources: all.length });
});

app.post("/api/crawl", async (c) => {
  const d = openDb(c.env);
  const body = (await c.req.json().catch(() => null)) as {
    source?: unknown;
    limit?: unknown;
  } | null;
  if (!body || typeof body.source !== "string") {
    throw new HttpError(400, 'body must be {"source": "<slug>", "limit"?: n}');
  }
  const limit = typeof body.limit === "number" ? body.limit : undefined;
  const job = await triggerCrawl(d, c.env, body.source, limit);
  return c.json(job);
});

app.get("/api/crawl/:id", async (c) => {
  const d = openDb(c.env);
  const job = await pollCrawlJob(d, c.env, Number(c.req.param("id")));
  return c.json(job);
});

app.get("/api/jobs", async (c) => {
  const d = openDb(c.env);
  const status = c.req.query("status");
  const rows = status
    ? await d
        .select()
        .from(crawlJobs)
        .where(eq(crawlJobs.status, status))
        .orderBy(desc(crawlJobs.id))
        .limit(50)
    : await d.select().from(crawlJobs).orderBy(desc(crawlJobs.id)).limit(50);
  return c.json(rows);
});

app.post("/api/score", async (c) => {
  const d = openDb(c.env);
  const body = (await c.req.json().catch(() => null)) as { document_id?: unknown } | null;
  if (!body || typeof body.document_id !== "number") {
    throw new HttpError(400, 'body must be {"document_id": n}');
  }
  return c.json(await scoreDocument(d, c.env, body.document_id));
});

app.post("/api/tasks/poll", async (c) => {
  const d = openDb(c.env);
  const body = (await c.req.json().catch(() => null)) as { limit?: unknown } | null;
  const limit = typeof body?.limit === "number" ? Math.min(body.limit, 100) : 25;
  return c.json(await pollPangramTasks(d, c.env, limit));
});

app.get("/api/scores/leaderboard", async (c) => {
  const d = openDb(c.env);
  return c.json(await leaderboard(d));
});

app.get("/api/documents", async (c) => {
  const d = openDb(c.env);
  const slug = c.req.query("source");
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const conds = [];
  if (slug) conds.push(eq(sources.slug, slug));
  if (status) conds.push(eq(documents.status, status));
  const rows = await d
    .select({
      id: documents.id,
      url: documents.url,
      title: documents.title,
      source: sources.slug,
      sourceName: sources.name,
      status: documents.status,
      wordCount: documents.wordCount,
      publishedAt: documents.publishedAt,
      avgAi: sql<number | null>`avg(case when ${pangramTasks.status} = 'success' then ${pangramTasks.fractionAi} end)`,
    })
    .from(documents)
    .innerJoin(sources, eq(documents.sourceId, sources.id))
    .leftJoin(pangramTasks, eq(pangramTasks.documentId, documents.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .groupBy(documents.id)
    .orderBy(desc(documents.id))
    .limit(limit);
  return c.json(
    rows.map((r) => ({
      ...r,
      avgAi: r.avgAi === null ? null : Number(r.avgAi),
      label: slopLabel(r.avgAi === null ? null : Number(r.avgAi)),
    })),
  );
});

function esc(s: string | null): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.get("/", async (c) => {
  const d = openDb(c.env);
  const board = await leaderboard(d);
  const docs = await d
    .select({
      id: documents.id,
      url: documents.url,
      title: documents.title,
      sourceName: sources.name,
      status: documents.status,
      wordCount: documents.wordCount,
    })
    .from(documents)
    .innerJoin(sources, eq(documents.sourceId, sources.id))
    .orderBy(desc(documents.id))
    .limit(20);
  const rows = board
    .map(
      (r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.kind)}</td>
        <td>${r.docsStored}</td><td>${r.docsScored}</td>
        <td>${r.avgAi === null ? "—" : r.avgAi.toFixed(3)}</td>
        <td><strong>${esc(r.label)}</strong></td></tr>`,
    )
    .join("");
  const docRows = docs
    .map(
      (x) => `<tr><td><a href="${esc(x.url)}">${esc(x.title ?? x.url)}</a></td>
        <td>${esc(x.sourceName)}</td><td>${esc(x.status)}</td><td>${x.wordCount}</td></tr>`,
    )
    .join("");
  return c.html(`<!doctype html><html><head><meta charset="utf-8">
<title>blogslop — who posts slop</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}
table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{border:1px solid #ccc;padding:.4rem .6rem;text-align:left}
code{background:#f4f4f4;padding:.1rem .3rem}</style></head><body>
<h1>blogslop</h1>
<p>Crawl VC/startup blogs + 10-Ks, score AI slop via Pangram.</p>
<h2>Slop leaderboard</h2>
<table><tr><th>Source</th><th>Kind</th><th>Docs</th><th>Scored</th><th>Avg AI</th><th>Verdict</th></tr>${rows}</table>
<h2>Latest documents</h2>
<table><tr><th>Doc</th><th>Source</th><th>Status</th><th>Words</th></tr>${docRows}</table>
<h2>API</h2>
<p><code>POST /api/sources/seed</code> · <code>POST /api/crawl {"source":"&lt;slug&gt;"}</code> ·
<code>GET /api/crawl/:id</code> · <code>POST /api/score {"document_id":n}</code> ·
<code>POST /api/tasks/poll</code> · <code>GET /api/scores/leaderboard</code></p>
</body></html>`);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const d = openDb(env);
    const active = await d
      .select()
      .from(crawlJobs)
      .where(sql`${crawlJobs.status} in ('pending','running')`)
      .limit(5);
    for (const j of active) {
      try {
        await pollCrawlJob(d, env, j.id);
      } catch (e) {
        console.error(`poll crawl job ${j.id} failed:`, e);
      }
    }
    try {
      await pollPangramTasks(d, env, 25);
    } catch (e) {
      console.error("poll pangram tasks failed:", e);
    }
  },
} satisfies ExportedHandler<Env>;
