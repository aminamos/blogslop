// Seed sources: VC/startup blogs (Firecrawl) + SEC filers (EDGAR direct).

export interface SeedSource {
  slug: string;
  name: string;
  kind: "blog" | "ir" | "sec";
  baseUrl: string;
  config: Record<string, unknown>;
}

export const SEED_SOURCES: SeedSource[] = [
  {
    slug: "yc-blog",
    name: "Y Combinator Blog",
    kind: "blog",
    baseUrl: "https://www.ycombinator.com/blog",
    config: { includePaths: ["blog.*"], limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "a16z",
    name: "Andreessen Horowitz",
    kind: "blog",
    baseUrl: "https://a16z.com/news-content/",
    config: { limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "sequoia",
    name: "Sequoia Capital",
    kind: "blog",
    baseUrl: "https://www.sequoiacap.com/article/",
    config: { includePaths: ["article.*"], limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "firstround-review",
    name: "First Round Review",
    kind: "blog",
    baseUrl: "https://review.firstround.com/",
    config: { limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "usv",
    name: "Union Square Ventures",
    kind: "blog",
    baseUrl: "https://www.usv.com/writing",
    config: { includePaths: ["writing.*"], limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "digitalocean-blog",
    name: "DigitalOcean Blog",
    kind: "blog",
    baseUrl: "https://www.digitalocean.com/blog",
    config: { includePaths: ["blog.*"], limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "databricks-blog",
    name: "Databricks Blog",
    kind: "blog",
    baseUrl: "https://www.databricks.com/blog",
    config: { includePaths: ["blog.*"], limit: 25, maxDiscoveryDepth: 2 },
  },
  {
    slug: "nvidia-ir",
    name: "NVIDIA Investor Relations",
    kind: "ir",
    baseUrl: "https://investor.nvidia.com/",
    config: { limit: 15, maxDiscoveryDepth: 2 },
  },
  // SEC filers: config { cik, forms }
  {
    slug: "sec-nvda",
    name: "NVIDIA 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1045810",
    config: { cik: "1045810", forms: ["10-K"], filings: 1 },
  },
  {
    slug: "sec-aapl",
    name: "Apple 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=320193",
    config: { cik: "320193", forms: ["10-K"], filings: 1 },
  },
  {
    slug: "sec-msft",
    name: "Microsoft 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=789019",
    config: { cik: "789019", forms: ["10-K"], filings: 1 },
  },
  {
    slug: "sec-tsla",
    name: "Tesla 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1318605",
    config: { cik: "1318605", forms: ["10-K"], filings: 1 },
  },
  {
    slug: "sec-googl",
    name: "Alphabet 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1652044",
    config: { cik: "1652044", forms: ["10-K"], filings: 1 },
  },
  {
    slug: "sec-meta",
    name: "Meta 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1326801",
    config: { cik: "1326801", forms: ["10-K"], filings: 1 },
  },
  {
    slug: "sec-amzn",
    name: "Amazon 10-K (SEC)",
    kind: "sec",
    baseUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=1018724",
    config: { cik: "1018724", forms: ["10-K"], filings: 1 },
  },
];
