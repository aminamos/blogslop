// SEC EDGAR client (free, no key). Fetched directly — no Firecrawl credits.
// Requires a descriptive User-Agent per SEC fair-access rules.

export interface SecFiling {
  accessionNumber: string;
  primaryDocument: string;
  filingDate: string;
  reportDate: string;
  form: string;
}

interface SubmissionsJson {
  filings?: {
    recent?: {
      accessionNumber?: string[];
      primaryDocument?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
    };
  };
}

/** Zero-pad a CIK to 10 digits for data.sec.gov URLs. */
export function cik10(cik: string): string {
  return cik.replace(/^0+/, "").padStart(10, "0");
}

/** Numeric CIK path segment for Archives URLs (no leading zeros). */
export function cikNum(cik: string): string {
  return String(Number(cik));
}

export function submissionsUrl(cik: string): string {
  return `https://data.sec.gov/submissions/CIK${cik10(cik)}.json`;
}

export function filingIndexUrl(cik: string, accessionNumber: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cikNum(cik)}/${accessionNumber.replace(/-/g, "")}/`;
}

export function filingDocUrl(cik: string, f: SecFiling): string {
  return filingIndexUrl(cik, f.accessionNumber) + f.primaryDocument;
}

function headers(userAgent: string): Record<string, string> {
  return { "User-Agent": userAgent, Accept: "application/json", "Accept-Encoding": "gzip" };
}

export async function fetchSubmissions(cik: string, userAgent: string): Promise<SubmissionsJson> {
  const res = await fetch(submissionsUrl(cik), { headers: headers(userAgent) });
  if (!res.ok) throw new Error(`EDGAR submissions failed for ${cik}: ${res.status}`);
  return (await res.json()) as SubmissionsJson;
}

/** Latest filings matching any of `forms` (e.g. ["10-K"]), newest first. */
export function latestFilings(sub: SubmissionsJson, forms: string[], limit = 3): SecFiling[] {
  const r = sub.filings?.recent;
  if (!r?.accessionNumber) return [];
  const out: SecFiling[] = [];
  const n = r.accessionNumber.length;
  for (let i = 0; i < n && out.length < limit; i++) {
    const form = r.form?.[i] ?? "";
    if (!forms.includes(form)) continue;
    out.push({
      accessionNumber: r.accessionNumber[i],
      primaryDocument: r.primaryDocument?.[i] ?? "",
      filingDate: r.filingDate?.[i] ?? "",
      reportDate: r.reportDate?.[i] ?? "",
      form,
    });
  }
  return out;
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Crude HTML→text for filing documents. Strips scripts/styles/tags, collapses whitespace. */
export function stripHtmlToText(html: string, maxChars = 300_000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m) => ENTITY_MAP[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

export async function fetchFilingText(
  url: string,
  userAgent: string,
  maxChars = 300_000,
): Promise<string> {
  const res = await fetch(url, { headers: headers(userAgent) });
  if (!res.ok) throw new Error(`EDGAR filing fetch failed: ${res.status} ${url}`);
  const html = await res.text();
  return stripHtmlToText(html, maxChars);
}
