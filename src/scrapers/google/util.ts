import { createLogger } from "@/util/logger";

export const log = createLogger("Google");

export function findJobInfo(jobsData: unknown): unknown[] | null {
  if (Array.isArray(jobsData)) {
    for (const item of jobsData) {
      const result = findJobInfo(item);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (jobsData && typeof jobsData === "object") {
    for (const [key, value] of Object.entries(jobsData)) {
      if (key === "520084652" && Array.isArray(value)) {
        return value;
      }
      const result = findJobInfo(value);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

export function findJobInfoInitialPage(htmlText: string): unknown[] {
  const pattern = /520084652":(\[.*?\]\s*])\s*}\s*]\s*]\s*]\s*]\s*]/g;
  const results: unknown[] = [];
  for (const match of htmlText.matchAll(pattern)) {
    const segment = match[1];
    if (!segment) {
      continue;
    }

    try {
      results.push(JSON.parse(segment));
    } catch (error) {
      log.error(`Failed to parse match: ${String(error)}`);
      results.push({ raw_match: match[0], error: String(error) });
    }
  }
  return results;
}
