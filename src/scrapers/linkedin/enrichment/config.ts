export const COMPANY_PAGE_PATH_HINTS = ["/careers", "/about", "/contact"] as const;

const LINKEDIN_DOMAINS = new Set(["linkedin.com", "www.linkedin.com"]);

export function isLinkedInDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (LINKEDIN_DOMAINS.has(normalized)) {
    return true;
  }

  return normalized.endsWith(".linkedin.com");
}

export function normalizeUrlDomain(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

