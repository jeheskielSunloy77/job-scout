import type { HttpClient } from "@/util/http";
import { plainConverter } from "@/util/format";
import { Site } from "@/core/model";
import type { ScraperOptions } from "@/core/model";
import { createLogger } from "@/util/logger";

import {
  COMPANY_PAGE_PATH_HINTS,
  isLinkedInDomain,
  normalizeUrlDomain
} from "@/scrapers/linkedin/enrichment/config";
import { EnrichmentBudgetController } from "@/scrapers/linkedin/enrichment/budget-controller";
import type { EnrichmentDocument } from "@/scrapers/linkedin/enrichment/types";

const log = createLogger("LinkedInEnrichmentCollector");

interface FetchDocumentInput {
  url: string;
  source: EnrichmentDocument["source"];
  http: HttpClient;
  options: ScraperOptions;
  timeoutMs: number;
  budget: EnrichmentBudgetController;
}

function toAbsoluteUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

function toOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function fetchDocument({
  url,
  source,
  http,
  options,
  timeoutMs,
  budget
}: FetchDocumentInput): Promise<EnrichmentDocument | null> {
  const domain = normalizeUrlDomain(url);
  if (!domain) {
    return null;
  }

  if (!budget.consumeRequest(domain)) {
    return null;
  }

  let responseText: string;
  let finalUrl: string;
  try {
    const response = await http.requestText(url, {
      method: "GET",
      timeoutMs,
      headers: {
        ...(options.userAgent ? { "user-agent": options.userAgent } : {})
      },
      site: Site.LINKEDIN,
      kind: "detail"
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("text/html")) {
      return null;
    }

    responseText = response.text;
    finalUrl = response.url;
  } catch (error) {
    log.debug(`Failed to fetch enrichment document ${url}: ${String(error)}`);
    return null;
  }

  const text = plainConverter(responseText);
  if (!text) {
    return null;
  }

  budget.recordCollectedPage();
  return {
    source,
    url: finalUrl,
    domain: normalizeUrlDomain(finalUrl) ?? domain,
    text,
    html: responseText
  };
}

async function fetchCompanyPages(
  domainOrigin: string,
  http: HttpClient,
  options: ScraperOptions,
  timeoutMs: number,
  budget: EnrichmentBudgetController
): Promise<EnrichmentDocument[]> {
  const documents: EnrichmentDocument[] = [];
  for (const path of COMPANY_PAGE_PATH_HINTS) {
    const targetUrl = toAbsoluteUrl(domainOrigin, path);
    const document = await fetchDocument({
      url: targetUrl,
      source: "companyPages",
      http,
      options,
      timeoutMs,
      budget
    });
    if (document) {
      documents.push(document);
    }
  }
  return documents;
}

export interface CollectEnrichmentDocumentsInput {
  existingDetailDocument: EnrichmentDocument | null;
  jobUrlDirect: string | null;
  companyUrl: string | null;
  sources: {
    externalApplyPage: boolean;
    companyPages: boolean;
  };
  timeoutMs: number;
  http: HttpClient;
  options: ScraperOptions;
  budget: EnrichmentBudgetController;
  companyPageCache: Map<string, Promise<EnrichmentDocument[]>>;
}

export async function collectEnrichmentDocuments(
  input: CollectEnrichmentDocumentsInput
): Promise<EnrichmentDocument[]> {
  const documents: EnrichmentDocument[] = [];
  if (input.existingDetailDocument) {
    documents.push(input.existingDetailDocument);
  }

  if (input.sources.externalApplyPage && input.jobUrlDirect) {
    const external = await fetchDocument({
      url: input.jobUrlDirect,
      source: "externalApplyPage",
      http: input.http,
      options: input.options,
      timeoutMs: input.timeoutMs,
      budget: input.budget
    });
    if (external) {
      documents.push(external);
    }
  }

  if (!input.sources.companyPages) {
    return documents;
  }

  const domainCandidate =
    normalizeUrlDomain(input.jobUrlDirect) ?? normalizeUrlDomain(input.companyUrl);
  if (!domainCandidate || isLinkedInDomain(domainCandidate)) {
    return documents;
  }

  const originCandidate = toOrigin(input.jobUrlDirect ?? input.companyUrl ?? "");
  if (!originCandidate) {
    return documents;
  }

  const cached = input.companyPageCache.get(domainCandidate);
  if (cached) {
    const cachedDocuments = await cached;
    documents.push(...cachedDocuments);
    return documents;
  }

  const loader = fetchCompanyPages(
    originCandidate,
    input.http,
    input.options,
    input.timeoutMs,
    input.budget
  );
  input.companyPageCache.set(domainCandidate, loader);
  const companyDocuments = await loader;
  documents.push(...companyDocuments);
  return documents;
}

