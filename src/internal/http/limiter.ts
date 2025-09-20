import type { Site } from "../../model.js";

import type { JobSite } from "../../domain/types.js";
import { toLegacySite } from "../../domain/site-mapping.js";

export function toLegacySiteConcurrencyMap(
  input: Partial<Record<JobSite, number>> | undefined
): Partial<Record<Site, number>> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input) as Array<[JobSite, number]>;
  const mapped: Partial<Record<Site, number>> = {};

  for (const [site, limit] of entries) {
    mapped[toLegacySite(site)] = limit;
  }

  return mapped;
}
