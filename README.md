# blogslop

Crawl VC/startup blogs, investor-relations pages, and SEC 10-Ks, then score
each document for AI-generated slop with Pangram. Leaderboard answers: who
posts slop.

Stack: Hono on Cloudflare Workers, D1 + Drizzle, Firecrawl for blogs/IR,
SEC EDGAR direct for filings, Pangram for AI detection.

## Pipeline

1. `POST /api/crawl {"source":"yc-blog"}` — blog/IR sources start an async
   Firecrawl crawl; `sec-*` sources fetch EDGAR directly (free, no credits).
2. `GET /api/crawl/:id` — poll a crawl; completed pages persist as documents.
3. `POST /api/score {"document_id":n}` — chunk text, create Pangram tasks.
4. `POST /api/tasks/poll` — poll pending Pangram tasks into `pangram_tasks`.
5. `GET /api/scores/leaderboard` — avg AI fraction per source + verdict.
6. `GET /` — dashboard with leaderboard and latest documents.

Hourly cron (`17 * * * *`) runs steps 2+4 automatically.

## Setup

Prereqs: Node 18+, wrangler authenticated (`wrangler whoami`).

```bash
cd /Users/amin/development/blogslop
npm install
cp .dev.vars.example .dev.vars   # fill in keys (local dev only)
```

Secrets (local `.dev.vars`, remote via `wrangler secret put <NAME>`):

- `FIRECRAWL_API_KEY` — from firecrawl.dev (or `firecrawl view-config`)
- `PANGRAM_API_KEY` — from pangram.com

Migrate + run:

```bash
npm run db:migrate:local
npm run dev
curl -X POST localhost:8787/api/sources/seed
curl -X POST localhost:8787/api/crawl -H 'Content-Type: application/json' \
  -d '{"source":"sec-nvda"}'
```

Deploy:

```bash
npm run db:migrate:remote
wrangler secret put FIRECRAWL_API_KEY
wrangler secret put PANGRAM_API_KEY
npm run deploy
```

## API

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/` | Dashboard |
| GET | `/api/health` | Health check |
| GET | `/api/sources` | List sources |
| POST | `/api/sources/seed` | Insert seed sources (idempotent) |
| POST | `/api/crawl` | `{"source":"<slug>","limit"?:n}` start crawl |
| GET | `/api/crawl/:id` | Poll crawl job, persist pages when done |
| GET | `/api/jobs?status=` | List crawl jobs |
| POST | `/api/score` | `{"document_id":n}` create Pangram tasks |
| POST | `/api/tasks/poll` | `{"limit"?:n}` poll pending Pangram tasks |
| GET | `/api/scores/leaderboard` | Per-source avg AI fraction + verdict |
| GET | `/api/documents?source=&status=&limit=` | List documents with avg AI |

## Cost notes

- Firecrawl: 1 credit/page crawled or scraped. Check `firecrawl credit-usage`
  before large crawls. Seed limits are 15–25 pages per source.
- Pangram: per-word billing; long docs (10-Ks) chunk into ≤20 × 12k-char
  windows to bound cost. Scoring a full 10-K ≈ 20 tasks.
- SEC EDGAR: free. Fetched directly, never through Firecrawl.

## Layout

- `src/index.ts` — Hono routes, dashboard, cron handler
- `src/lib/pipeline.ts` — crawl/score/poll orchestration
- `src/lib/firecrawl.ts` — Firecrawl v2 REST client
- `src/lib/pangram.ts` — Pangram async detection client
- `src/lib/sec.ts` — SEC EDGAR client
- `src/lib/sources.ts` — seed sources
- `src/lib/text.ts` — chunking, aggregation, labels
- `src/db/schema.ts` + `migrations/` — D1 schema

## v1 limits

- Firecrawl crawl results arrive only via polling (no webhook).
- Pangram short texts (<~50 words) score unreliably; tiny pages may mislead.
- `stripHtmlToText` is regex-based; complex filings lose table structure.
