import { createLogger } from "../util/logger.js";
import type { JobPost } from "../model.js";
import { createTransport } from "../internal/http/transport.js";
import { applyLogLevel } from "../internal/logging.js";

import type { CompiledSearchRequest, SiteProvider, SiteSearchResult } from "./contracts.js";
import { SiteExecutionError } from "./errors.js";
import { runResultPipeline } from "./result-pipeline.js";

const log = createLogger("engine");

function buildProviderMap(providers: SiteProvider[]): Map<SiteProvider["site"], SiteProvider> {
  const map = new Map<SiteProvider["site"], SiteProvider>();
  for (const provider of providers) {
    map.set(provider.site, provider);
  }
  return map;
}

export async function executeSearch(
  compiled: CompiledSearchRequest,
  providers: SiteProvider[]
): Promise<JobPost[]> {
  applyLogLevel(compiled.config.logging.level);

  const providerMap = buildProviderMap(providers);
  const transport = createTransport(compiled.config.transport.http);

  try {
    const results = await Promise.all(
      compiled.siteRequests.map(async (siteRequest): Promise<SiteSearchResult> => {
        const provider = providerMap.get(siteRequest.site);
        if (!provider) {
          throw new SiteExecutionError(siteRequest.site, "No provider registered for site.");
        }

        try {
          const jobs = await provider.search(siteRequest, {
            transport,
            config: compiled.config
          });

          log.info(`${siteRequest.site} finished scraping`);
          return {
            site: siteRequest.site,
            jobs
          };
        } catch (error) {
          throw new SiteExecutionError(siteRequest.site, "Site scrape failed.", error);
        }
      })
    );

    return runResultPipeline(results, {
      country: compiled.country,
      annualizeSalary: compiled.config.output.annualizeSalary,
      salaryFallback: compiled.config.output.salaryFallback
    });
  } finally {
    await transport.close();
  }
}
