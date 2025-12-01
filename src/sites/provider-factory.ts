import { createLogger } from "../util/logger.js";
import type { Scraper, Site } from "../model.js";

import type { SiteProvider } from "../core/contracts.js";

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
