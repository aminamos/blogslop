// Minimal Firecrawl v2 REST client (fetch-based, Workers-safe).
// Docs: https://docs.firecrawl.dev/api-reference/endpoint/crawl-post

const BASE = "https://api.firecrawl.dev/v2";

export class FirecrawlError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req(apiKey: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
  } | null;
  if (!res.ok) {
    const hint =
      res.status === 402
        ? " (out of Firecrawl credits — top up or wait for reset)"
        : "";
    throw new FirecrawlError(
      res.status,
      `Firecrawl ${path} failed: ${res.status} ${body?.error ?? res.statusText}${hint}`,
    );
  }
  return body;
}

export interface StartCrawlOptions {
  url: string;
  limit?: number;
  maxDiscoveryDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
}

export async function startCrawl(
  apiKey: string,
  opts: StartCrawlOptions,
): Promise<{ id: string; url: string }> {
  const body = (await req(apiKey, "/crawl", {
    method: "POST",
    body: JSON.stringify({
      url: opts.url,
      limit: opts.limit ?? 25,
      maxDiscoveryDepth: opts.maxDiscoveryDepth ?? 2,
      includePaths: opts.includePaths,
      excludePaths: opts.excludePaths,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  })) as { id?: string; url?: string };
  if (!body.id) throw new FirecrawlError(502, "Firecrawl /crawl returned no job id");
  return { id: body.id, url: body.url ?? opts.url };
}

export interface CrawlPage {
  markdown?: string;
  metadata?: {
    title?: string;
    sourceURL?: string;
    publishedTime?: string;
    [k: string]: unknown;
  };
}

export interface CrawlStatus {
  status: string;
  completed: number;
  total: number;
  creditsUsed?: number;
  data?: CrawlPage[];
}

export async function getCrawlStatus(apiKey: string, jobId: string): Promise<CrawlStatus> {
  const body = (await req(apiKey, `/crawl/${jobId}`)) as {
    status?: string;
    completed?: number;
    total?: number;
    creditsUsed?: number;
    data?: CrawlPage[];
  };
  return {
    status: body.status ?? "unknown",
    completed: body.completed ?? 0,
    total: body.total ?? 0,
    creditsUsed: body.creditsUsed,
    data: body.data,
  };
}

export async function scrapeUrl(
  apiKey: string,
  url: string,
): Promise<{ markdown: string; title?: string; publishedTime?: string }> {
  const body = (await req(apiKey, "/scrape", {
    method: "POST",
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  })) as { data?: CrawlPage };
  return {
    markdown: body.data?.markdown ?? "",
    title: body.data?.metadata?.title,
    publishedTime: body.data?.metadata?.publishedTime,
  };
}

export async function mapSite(
  apiKey: string,
  url: string,
  opts?: { limit?: number; search?: string },
): Promise<string[]> {
  const body = (await req(apiKey, "/map", {
    method: "POST",
    body: JSON.stringify({ url, limit: opts?.limit ?? 100, search: opts?.search }),
  })) as { links?: Array<string | { url?: string }> };
  return (body.links ?? [])
    .map((l) => (typeof l === "string" ? l : l.url))
    .filter((u): u is string => typeof u === "string");
}
