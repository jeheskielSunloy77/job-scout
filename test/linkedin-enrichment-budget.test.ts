import { describe, expect, it } from "bun:test";

import { EnrichmentBudgetController } from "../src/scrapers/linkedin/enrichment/budget-controller";

describe("EnrichmentBudgetController", () => {
  it("tracks request and page usage within limits", () => {
    const budget = new EnrichmentBudgetController({
      maxExtraRequestsPerJob: 3,
      maxPagesPerDomain: 2
    });

    expect(budget.consumeRequest("example.com")).toBe(true);
    expect(budget.consumeRequest("example.com")).toBe(true);
    expect(budget.consumeRequest("another.com")).toBe(true);
    budget.recordCollectedPage();
    budget.recordCollectedPage();

    expect(budget.usage()).toEqual({
      requests: 3,
      domains: 2,
      pages: 2,
      exhausted: false
    });
  });

  it("cuts off when max requests per job is reached", () => {
    const budget = new EnrichmentBudgetController({
      maxExtraRequestsPerJob: 1,
      maxPagesPerDomain: 5
    });

    expect(budget.consumeRequest("example.com")).toBe(true);
    expect(budget.consumeRequest("another.com")).toBe(false);
    expect(budget.usage().exhausted).toBe(true);
  });

  it("cuts off by per-domain page limit without exhausting global budget", () => {
    const budget = new EnrichmentBudgetController({
      maxExtraRequestsPerJob: 5,
      maxPagesPerDomain: 1
    });

    expect(budget.consumeRequest("example.com")).toBe(true);
    expect(budget.consumeRequest("example.com")).toBe(false);
    expect(budget.consumeRequest("another.com")).toBe(true);

    expect(budget.usage()).toEqual({
      requests: 2,
      domains: 2,
      pages: 0,
      exhausted: false
    });
  });
});

