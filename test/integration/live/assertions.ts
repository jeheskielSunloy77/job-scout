import { expect } from "bun:test";

import type { Job, JobRow, JobSite } from "../../../src/index";

export function assertBasicJobSchema(job: Job, expectedSite: JobSite): void {
  expect(typeof job.id).toBe("string");
  expect((job.id ?? "").length).toBeGreaterThan(0);

  expect(typeof job.title).toBe("string");
  expect(job.title.length).toBeGreaterThan(0);

  expect(typeof job.jobUrl).toBe("string");
  expect(() => new URL(job.jobUrl)).not.toThrow();

  expect(job.site).toBe(expectedSite);

  if (job.location) {
    expect(typeof job.location.display).toBe("string");
  }

  if (job.compensation) {
    if (job.compensation.minAmount != null) {
      expect(Number.isFinite(job.compensation.minAmount)).toBe(true);
    }
    if (job.compensation.maxAmount != null) {
      expect(Number.isFinite(job.compensation.maxAmount)).toBe(true);
    }
  }

  if (job.datePosted != null) {
    expect(job.datePosted instanceof Date).toBe(true);
    expect(Number.isNaN(job.datePosted.getTime())).toBe(false);
  }

  if (job.emails != null) {
    expect(Array.isArray(job.emails)).toBe(true);
    for (const email of job.emails) {
      expect(typeof email).toBe("string");
    }
  }
}

export function assertSortedBySiteAndDate(jobs: Job[]): void {
  for (let i = 1; i < jobs.length; i += 1) {
    const prev = jobs[i - 1];
    const current = jobs[i];

    const prevSite = prev?.site ?? "bayt";
    const currentSite = current?.site ?? "bayt";

    if (prevSite === currentSite) {
      const prevDate = prev?.datePosted?.getTime() ?? Number.NEGATIVE_INFINITY;
      const currentDate = current?.datePosted?.getTime() ?? Number.NEGATIVE_INFINITY;
      expect(prevDate).toBeGreaterThanOrEqual(currentDate);
    } else {
      expect(prevSite <= currentSite).toBe(true);
    }
  }
}

export function assertRowBasics(rows: JobRow[]): void {
  for (const row of rows) {
    expect(typeof row.site === "string" || row.site === null).toBe(true);
    expect(typeof row.title === "string" || row.title === null).toBe(true);
    expect(typeof row.jobUrl === "string" || row.jobUrl === null).toBe(true);
  }
}
