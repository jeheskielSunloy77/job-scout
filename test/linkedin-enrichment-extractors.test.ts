import { describe, expect, it } from "bun:test";

import {
  extractEnrichmentValues,
  mergeUniqueValues
} from "../src/scrapers/linkedin/enrichment/extractors";
import type { EnrichmentDocument } from "../src/scrapers/linkedin/enrichment/types";

function doc(overrides: Partial<EnrichmentDocument>): EnrichmentDocument {
  return {
    source: "externalApplyPage",
    url: "https://company.example/jobs/123",
    domain: "company.example",
    text: "",
    html: null,
    ...overrides
  };
}

describe("LinkedIn enrichment extractors", () => {
  it("extracts plain, obfuscated, and mailto emails", () => {
    const result = extractEnrichmentValues(
      [
        doc({
          text: "Reach us via jobs@example.com or talent [at] example [dot] org",
          html: '<a href="mailto:hiring@example.com">Email</a>'
        })
      ],
      ""
    );

    expect(result.emails).toEqual([
      "jobs@example.com",
      "talent@example.org",
      "hiring@example.com"
    ]);
    expect(result.fieldConfidence.emails).toBe("high");
  });

  it("extracts skills, seniority, work mode, and company size hints", () => {
    const result = extractEnrichmentValues(
      [
        doc({
          text: "Senior backend engineer. TypeScript, Node.js, AWS. Hybrid role. Team size: 51-200 employees."
        })
      ],
      "Senior Software Engineer"
    );

    expect(result.skills?.includes("TypeScript")).toBe(true);
    expect(result.skills?.includes("Node.js")).toBe(true);
    expect(result.skills?.includes("AWS")).toBe(true);
    expect(result.seniority).toBe("senior");
    expect(result.workMode).toBe("Hybrid");
    expect(result.companySize).toBe("51-200");
  });

  it("extracts non-linkedin company website", () => {
    const result = extractEnrichmentValues(
      [
        doc({ url: "https://company.example/careers" }),
        doc({ url: "https://www.linkedin.com/company/acme" })
      ],
      ""
    );

    expect(result.companyWebsite).toBe("https://company.example");
  });

  it("deduplicates merged string arrays case-insensitively", () => {
    expect(mergeUniqueValues(["jobs@example.com"], ["Jobs@Example.com", "hr@example.com"])).toEqual(
      ["jobs@example.com", "hr@example.com"]
    );
  });
});
