// Text helpers: chunking for Pangram, scoring aggregation.

export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() === "" ? 0 : words.length;
}

/**
 * Split text into chunks of at most `maxChars`, packing whole paragraphs.
 * Caps the number of chunks to bound Pangram cost on huge docs (10-Ks).
 */
export function chunkText(text: string, maxChars = 12_000, maxChunks = 20): string[] {
  const paras = text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur) chunks.push(cur);
    cur = "";
  };
  for (const p of paras) {
    if (p.length > maxChars) {
      push();
      // Hard-split oversized paragraph.
      for (let i = 0; i < p.length && chunks.length < maxChunks; i += maxChars) {
        chunks.push(p.slice(i, i + maxChars));
      }
      continue;
    }
    if ((cur + "\n\n" + p).length > maxChars) push();
    if (chunks.length >= maxChunks) break;
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  push();
  return chunks.slice(0, maxChunks);
}

/** Length-weighted mean of chunk fractions. */
export function aggregateFraction(chunks: { fractionAi: number; chars: number }[]): number | null {
  let num = 0;
  let den = 0;
  for (const c of chunks) {
    if (!Number.isFinite(c.fractionAi)) continue;
    num += c.fractionAi * c.chars;
    den += c.chars;
  }
  return den > 0 ? num / den : null;
}

export function slopLabel(fractionAi: number | null): string {
  if (fractionAi === null) return "unscored";
  if (fractionAi < 0.25) return "human";
  if (fractionAi < 0.5) return "likely human";
  if (fractionAi < 0.75) return "likely AI";
  return "AI slop";
}
