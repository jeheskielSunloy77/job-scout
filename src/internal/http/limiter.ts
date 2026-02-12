import type { Site } from "@/core/model";

import type { JobSite } from "@/domain/types";
import { toScraperSite } from "@/domain/site-mapping";

export function toScraperSiteConcurrencyMap(
  input: Partial<Record<JobSite, number>> | undefined
): Partial<Record<Site, number>> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input) as Array<[JobSite, number]>;
  const mapped: Partial<Record<Site, number>> = {};

  for (const [site, limit] of entries) {
    mapped[toScraperSite(site)] = limit;
  }

  return mapped;
}
