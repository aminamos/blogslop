import { describe, expect, it } from "vitest";
import { aggregateFraction, chunkText, slopLabel, wordCount } from "./text";

describe("wordCount", () => {
  it("counts words", () => {
    expect(wordCount("hello world")).toBe(2);
  });
  it("returns 0 for blank text", () => {
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("")).toBe(0);
  });
});

describe("chunkText", () => {
  it("packs paragraphs under maxChars", () => {
    const chunks = chunkText("aaa\n\nbbb\n\nccc", 8, 10);
    expect(chunks).toEqual(["aaa\n\nbbb", "ccc"]);
  });
  it("hard-splits an oversized paragraph", () => {
    const chunks = chunkText("abcdefghij", 4, 10);
    expect(chunks).toEqual(["abcd", "efgh", "ij"]);
  });
  it("caps the number of chunks", () => {
    const chunks = chunkText("a\n\nb\n\nc\n\nd", 3, 2);
    expect(chunks.length).toBe(2);
  });
  it("returns [] for blank text", () => {
    expect(chunkText("  ", 100, 10)).toEqual([]);
  });
});

describe("aggregateFraction", () => {
  it("computes length-weighted mean", () => {
    expect(
      aggregateFraction([
        { fractionAi: 1, chars: 100 },
        { fractionAi: 0, chars: 300 },
      ]),
    ).toBeCloseTo(0.25);
  });
  it("returns null when empty", () => {
    expect(aggregateFraction([])).toBeNull();
  });
});

describe("slopLabel", () => {
  it("maps thresholds", () => {
    expect(slopLabel(null)).toBe("unscored");
    expect(slopLabel(0)).toBe("human");
    expect(slopLabel(0.24)).toBe("human");
    expect(slopLabel(0.25)).toBe("likely human");
    expect(slopLabel(0.5)).toBe("likely AI");
    expect(slopLabel(0.75)).toBe("AI slop");
  });
});
