export interface EnrichmentBudgetLimits {
  maxExtraRequestsPerJob: number;
  maxPagesPerDomain: number;
}

export interface EnrichmentBudgetUsage {
  requests: number;
  domains: number;
  pages: number;
  exhausted: boolean;
}

export class EnrichmentBudgetController {
  private requestCount = 0;
  private pageCount = 0;
  private requestCapReached = false;
  private readonly domainRequestCounts = new Map<string, number>();

  constructor(private readonly limits: EnrichmentBudgetLimits) {}

  consumeRequest(domain: string): boolean {
    if (this.requestCount >= this.limits.maxExtraRequestsPerJob) {
      this.requestCapReached = true;
      return false;
    }

    const normalizedDomain = domain.trim().toLowerCase();
    if (!normalizedDomain) {
      return false;
    }

    const currentDomainRequests = this.domainRequestCounts.get(normalizedDomain) ?? 0;
    if (currentDomainRequests >= this.limits.maxPagesPerDomain) {
      return false;
    }

    this.requestCount += 1;
    this.domainRequestCounts.set(normalizedDomain, currentDomainRequests + 1);
    return true;
  }

  recordCollectedPage(): void {
    this.pageCount += 1;
  }

  usage(): EnrichmentBudgetUsage {
    return {
      requests: this.requestCount,
      domains: this.domainRequestCounts.size,
      pages: this.pageCount,
      exhausted: this.requestCapReached
    };
  }
}

