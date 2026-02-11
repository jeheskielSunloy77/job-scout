import { describe, expect, it } from "bun:test";

import type { Job } from "../src/index.js";
import { toJobRows } from "../src/index.js";

describe("toJobRows", () => {
  it("normalizes jobs to row shape", () => {
    const jobs: Job[] = [
      {
        id: "li-123",
        site: "linkedin",
        title: "Software Engineer",
        companyName: "Example Co",
        jobUrl: "https://www.linkedin.com/jobs/view/123",
        jobUrlDirect: "https://company.com/jobs/123",
        location: {
          city: "Austin",
          state: "TX",
          country: "USA",
          display: "Austin, TX, USA"
        },
        datePosted: new Date("2026-02-10T00:00:00.000Z"),
        employmentTypes: ["fullTime"],
        salarySource: "directData",
        compensation: {
          interval: "yearly",
          minAmount: 120000,
          maxAmount: 160000,
          currency: "USD"
        },
        isRemote: true,
        jobLevel: "senior",
        jobFunction: "Engineering",
        listingType: "premium",
        emails: ["jobs@example.com"],
        description: "Great role",
        companyIndustry: "Software",
        companyUrl: "https://company.com",
        companyLogo: "https://company.com/logo.png",
        companyUrlDirect: "https://company.com",
        companyAddresses: "Austin, TX",
        companyNumEmployees: "100-500",
        companyRevenue: "$10M",
        companyDescription: "Builds products",
        skills: ["TypeScript", "Node.js"],
        experienceRange: "4-8 years",
        companyRating: 4.2,
        companyReviewsCount: 123,
        vacancyCount: 2,
        workFromHomeType: "Remote",
        bannerPhotoUrl: null
      }
    ];

    expect(toJobRows(jobs)).toEqual([
      {
        id: "li-123",
        site: "linkedin",
        jobUrl: "https://www.linkedin.com/jobs/view/123",
        jobUrlDirect: "https://company.com/jobs/123",
        title: "Software Engineer",
        company: "Example Co",
        location: "Austin, TX, USA",
        datePosted: "2026-02-10",
        employmentTypes: "fullTime",
        salarySource: "directData",
        interval: "yearly",
        minAmount: 120000,
        maxAmount: 160000,
        currency: "USD",
        isRemote: true,
        jobLevel: "senior",
        jobFunction: "Engineering",
        listingType: "premium",
        emails: "jobs@example.com",
        description: "Great role",
        companyIndustry: "Software",
        companyUrl: "https://company.com",
        companyLogo: "https://company.com/logo.png",
        companyUrlDirect: "https://company.com",
        companyAddresses: "Austin, TX",
        companyNumEmployees: "100-500",
        companyRevenue: "$10M",
        companyDescription: "Builds products",
        skills: "TypeScript, Node.js",
        experienceRange: "4-8 years",
        companyRating: 4.2,
        companyReviewsCount: 123,
        vacancyCount: 2,
        workFromHomeType: "Remote"
      }
    ]);
  });
});
