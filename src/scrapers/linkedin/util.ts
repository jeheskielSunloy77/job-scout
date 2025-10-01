import * as cheerio from "cheerio";

import { JobType, Location } from "../../model.js";
import { getEnumFromJobTypeValue } from "../../util/site.js";

export function jobTypeCode(jobTypeEnum: JobType): string {
  return (
    {
      [JobType.FULL_TIME]: "F",
      [JobType.PART_TIME]: "P",
      [JobType.INTERNSHIP]: "I",
      [JobType.CONTRACT]: "C",
      [JobType.TEMPORARY]: "T"
    } as Partial<Record<JobType, string>>
  )[jobTypeEnum] ?? "";
}

export function parseJobType(html: string): JobType[] | null {
  const $ = cheerio.load(html);
  const h3 = $("h3.description__job-criteria-subheader")
    .filter((_idx, node) => $(node).text().includes("Employment type"))
    .first();

  if (h3.length === 0) {
    return null;
  }

  const employmentType = h3
    .next("span.description__job-criteria-text.description__job-criteria-text--criteria")
    .text()
    .trim()
    .toLowerCase()
    .replace(/-/g, "");

  if (!employmentType) {
    return null;
  }

  const parsed = getEnumFromJobTypeValue(employmentType);
  return parsed ? [parsed] : null;
}

export function parseJobLevel(html: string): string | null {
  const $ = cheerio.load(html);
  const h3 = $("h3.description__job-criteria-subheader")
    .filter((_idx, node) => $(node).text().includes("Seniority level"))
    .first();

  if (h3.length === 0) {
    return null;
  }

  const value = h3
    .next("span.description__job-criteria-text.description__job-criteria-text--criteria")
    .text()
    .trim();

  return value || null;
}

export function parseCompanyIndustry(html: string): string | null {
  const $ = cheerio.load(html);
  const h3 = $("h3.description__job-criteria-subheader")
    .filter((_idx, node) => $(node).text().includes("Industries"))
    .first();

  if (h3.length === 0) {
    return null;
  }

  const value = h3
    .next("span.description__job-criteria-text.description__job-criteria-text--criteria")
    .text()
    .trim();

  return value || null;
}

export function isJobRemote(title: string, description: string | null, location: Location): boolean {
  const remoteKeywords = ["remote", "work from home", "wfh"];
  const fullString = `${title} ${description ?? ""} ${location.displayLocation()}`.toLowerCase();
  return remoteKeywords.some((keyword) => fullString.includes(keyword));
}
