import * as cheerio from "cheerio";

import { JobType, Location } from "@/core/model";
import { getEnumFromJobTypeValue } from "@/util/site";

export function parseJobType(html: string): JobType[] | null {
  const $ = cheerio.load(html);
  const value = $("span.job-type").first().text().trim().toLowerCase().replace(/-/g, "");
  if (!value) {
    return null;
  }
  const parsed = getEnumFromJobTypeValue(value);
  return parsed ? [parsed] : null;
}

export function parseCompanyIndustry(html: string): string | null {
  const $ = cheerio.load(html);
  const value = $("span.industry").first().text().trim();
  return value || null;
}

export function isJobRemote(title: string, description: string, location: Location): boolean {
  const remoteKeywords = ["remote", "work from home", "wfh"];
  const full = `${title} ${description} ${location.displayLocation()}`.toLowerCase();
  return remoteKeywords.some((keyword) => full.includes(keyword));
}
