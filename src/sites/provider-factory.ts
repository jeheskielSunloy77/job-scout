import { createLogger } from "@/util/logger";
import type { Scraper, Site } from "@/core/model";

import type { SiteProvider } from "@/core/contracts";

type ScraperConstructor = new (
  http: Scraper["http"],
  options?: Scraper["options"]
) => Scraper;

export function createSiteProvider(site: Site, ScraperClass: ScraperConstructor): SiteProvider {
  const log = createLogger(`provider:${site}`);

  return {
    site,
    async search(request, context) {
      const scraper = new ScraperClass(context.transport, request.scraperOptions);
      const response = await scraper.scrape(request.scraperInput);
      log.debug(`Provider returned ${response.jobs.length} jobs`);
      return response.jobs;
    }
  };
}
