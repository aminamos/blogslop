import { describe, expect, it } from "vitest";
import {
  cik10,
  cikNum,
  filingDocUrl,
  filingIndexUrl,
  latestFilings,
  stripHtmlToText,
  submissionsUrl,
} from "./sec";

describe("CIK helpers", () => {
  it("pads CIK to 10 digits", () => {
    expect(cik10("1045810")).toBe("0001045810");
    expect(cik10("320193")).toBe("0000320193");
  });
  it("strips leading zeros for archive paths", () => {
    expect(cikNum("0001045810")).toBe("1045810");
  });
  it("builds submissions URL", () => {
    expect(submissionsUrl("1045810")).toBe("https://data.sec.gov/submissions/CIK0001045810.json");
  });
  it("builds filing index URL without dashes", () => {
    expect(filingIndexUrl("1045810", "0001045810-25-000023")).toBe(
      "https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/",
    );
  });
  it("builds filing doc URL", () => {
    expect(
      filingDocUrl("1045810", {
        accessionNumber: "0001045810-25-000023",
        primaryDocument: "nvda-20250126.htm",
        filingDate: "2025-02-26",
        reportDate: "2025-01-26",
        form: "10-K",
      }),
    ).toBe(
      "https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm",
    );
  });
});

describe("latestFilings", () => {
  it("filters by form, newest first", () => {
    const out = latestFilings(
      {
        filings: {
          recent: {
            accessionNumber: ["a1", "a2", "a3"],
            primaryDocument: ["d1", "d2", "d3"],
            filingDate: ["2025-01-01", "2024-01-01", "2023-01-01"],
            reportDate: ["2024-12-31", "2023-12-31", "2022-12-31"],
            form: ["10-K", "8-K", "10-K"],
          },
        },
      },
      ["10-K"],
      5,
    );
    expect(out.map((f) => f.accessionNumber)).toEqual(["a1", "a3"]);
  });
  it("returns [] when no recent filings", () => {
    expect(latestFilings({}, ["10-K"])).toEqual([]);
  });
});

describe("stripHtmlToText", () => {
  it("strips tags, scripts, styles; decodes entities", () => {
    const text = stripHtmlToText(
      "<html><head><style>p{color:red}</style></head><body><script>alert(1)</script><p>Fish &amp; Chips&nbsp;are &lt;great&gt;</p></body></html>",
    );
    expect(text).toBe("Fish & Chips are <great>");
  });
  it("truncates to maxChars", () => {
    expect(stripHtmlToText("<p>abcdef</p>", 4)).toBe("abcd");
  });
});
