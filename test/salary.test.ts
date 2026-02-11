import { describe, expect, it } from "bun:test";

import { CompensationInterval } from "../src/model.js";
import { convertToAnnual, extractSalary } from "../src/util/salary.js";

describe("extractSalary", () => {
  it("extracts yearly salary ranges", () => {
    const result = extractSalary("Compensation: $120,000 - $160,000");
    expect(result).toEqual({
      interval: CompensationInterval.YEARLY,
      minAmount: 120000,
      maxAmount: 160000,
      currency: "USD"
    });
  });

  it("extracts hourly salary ranges", () => {
    const result = extractSalary("Pay: $55 - $75 per hour");
    expect(result).toEqual({
      interval: CompensationInterval.HOURLY,
      minAmount: 55,
      maxAmount: 75,
      currency: "USD"
    });
  });

  it("returns null fields when no salary is found", () => {
    const result = extractSalary("Compensation not listed");
    expect(result).toEqual({
      interval: null,
      minAmount: null,
      maxAmount: null,
      currency: null
    });
  });
});

describe("convertToAnnual", () => {
  it("converts hourly pay to annual", () => {
    const compensation = {
      interval: CompensationInterval.HOURLY,
      min_amount: 50,
      max_amount: 70,
      currency: "USD"
    };

    convertToAnnual(compensation);

    expect(compensation).toEqual({
      interval: CompensationInterval.YEARLY,
      min_amount: 104000,
      max_amount: 145600,
      currency: "USD"
    });
  });
});
