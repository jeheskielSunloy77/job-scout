import type { EnrichmentConfidence } from "@/core/model";
import { extractEmailsFromText } from "@/util/format";

import { isLinkedInDomain, normalizeUrlDomain } from "@/scrapers/linkedin/enrichment/config";
import type { EnrichmentDocument, EnrichmentExtraction } from "@/scrapers/linkedin/enrichment/types";

const SKILL_PATTERNS = [
  { label: "TypeScript", regex: /\btypescript\b/i },
  { label: "JavaScript", regex: /\bjavascript\b/i },
  { label: "Node.js", regex: /\bnode(?:\.js)?\b/i },
  { label: "React", regex: /\breact\b/i },
  { label: "Python", regex: /\bpython\b/i },
  { label: "Java", regex: /\bjava\b/i },
  { label: "Golang", regex: /\bgolang\b|\bgo\b/i },
  { label: "Docker", regex: /\bdocker\b/i },
  { label: "Kubernetes", regex: /\bkubernetes\b/i },
  { label: "AWS", regex: /\baws\b/i },
  { label: "Azure", regex: /\bazure\b/i },
  { label: "GCP", regex: /\bgcp\b|\bgoogle cloud\b/i },
  { label: "SQL", regex: /\bsql\b/i },
  { label: "PostgreSQL", regex: /\bpostgresql\b|\bpostgres\b/i },
  { label: "MySQL", regex: /\bmysql\b/i },
  { label: "MongoDB", regex: /\bmongodb\b/i },
  { label: "Redis", regex: /\bredis\b/i },
  { label: "GraphQL", regex: /\bgraphql\b/i },
  { label: "REST API", regex: /\brest api\b|\brestful\b/i },
  { label: "Terraform", regex: /\bterraform\b/i },
  { label: "CI/CD", regex: /\bci\/cd\b|\bcontinuous integration\b/i },
  { label: "Git", regex: /\bgit\b/i }
] as const;

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

function extractObfuscatedEmails(text: string): string[] {
  const matches: string[] = [];
  const regex =
    /([a-zA-Z0-9._%+-]+)\s*(?:@|\(at\)|\[at\]|\sat\s)\s*([a-zA-Z0-9.-]+)\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*([a-zA-Z]{2,})/gi;

  let match = regex.exec(text);
  while (match) {
    const local = match[1] ?? "";
    const domain = match[2] ?? "";
    const tld = match[3] ?? "";
    if (local && domain && tld) {
      matches.push(`${local}@${domain}.${tld}`);
    }
    match = regex.exec(text);
  }

  return matches;
}

function extractEmailsFromHtml(html: string | null): string[] {
  if (!html) {
    return [];
  }

  const matches: string[] = [];
  const regex = /mailto:([^"'?\s>]+)/gi;
  let match = regex.exec(html);
  while (match) {
    const raw = match[1]?.trim();
    if (raw) {
      matches.push(raw);
    }
    match = regex.exec(html);
  }

  return matches;
}

function extractEmails(documents: EnrichmentDocument[]): {
  values: string[] | null;
  confidence: EnrichmentConfidence | null;
} {
  const fromPlain = documents.flatMap((document) => extractEmailsFromText(document.text) ?? []);
  const fromObfuscated = documents.flatMap((document) => extractObfuscatedEmails(document.text));
  const fromMailto = documents.flatMap((document) => extractEmailsFromHtml(document.html));

  const all = dedupeStrings([...fromPlain, ...fromObfuscated, ...fromMailto]);
  if (all.length === 0) {
    return {
      values: null,
      confidence: null
    };
  }

  return {
    values: all,
    confidence: fromMailto.length > 0 ? "high" : fromPlain.length > 0 ? "medium" : "low"
  };
}

function extractSkills(documents: EnrichmentDocument[]): string[] | null {
  const combinedText = documents.map((document) => document.text).join(" ");
  const matched = SKILL_PATTERNS.filter((skill) => skill.regex.test(combinedText)).map(
    (skill) => skill.label
  );
  if (matched.length === 0) {
    return null;
  }

  return dedupeStrings(matched);
}

function extractSeniority(combinedText: string): {
  value: string | null;
  confidence: EnrichmentConfidence | null;
} {
  const normalized = combinedText.toLowerCase();

  if (/seniority level|executive|chief|vice president|vp\b/.test(normalized)) {
    return { value: "executive", confidence: "high" };
  }
  if (/seniority level|director\b/.test(normalized)) {
    return { value: "director", confidence: "high" };
  }
  if (/seniority level|principal\b/.test(normalized)) {
    return { value: "principal", confidence: "high" };
  }
  if (/seniority level|staff\b/.test(normalized)) {
    return { value: "staff", confidence: "high" };
  }
  if (/seniority level|senior|sr\./.test(normalized)) {
    return { value: "senior", confidence: "high" };
  }
  if (/mid[- ]level|intermediate/.test(normalized)) {
    return { value: "mid", confidence: "medium" };
  }
  if (/junior|jr\./.test(normalized)) {
    return { value: "junior", confidence: "medium" };
  }
  if (/entry level|intern|graduate/.test(normalized)) {
    return { value: "entry", confidence: "medium" };
  }

  return { value: null, confidence: null };
}

function canonicalizeWebsite(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) {
      return null;
    }
    const domain = parsed.hostname.trim().toLowerCase();
    if (!domain || isLinkedInDomain(domain)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function extractCompanyWebsite(documents: EnrichmentDocument[]): string | null {
  for (const document of documents) {
    const fromUrl = canonicalizeWebsite(document.url);
    if (fromUrl) {
      return fromUrl;
    }

    const urlMatches = document.text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    for (const raw of urlMatches) {
      const candidate = canonicalizeWebsite(raw);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function extractWorkMode(combinedText: string): string | null {
  const normalized = combinedText.toLowerCase();
  if (/hybrid/.test(normalized)) {
    return "Hybrid";
  }
  if (/on[- ]site|onsite/.test(normalized)) {
    return "On-site";
  }
  if (/remote|work from home|\bwfh\b/.test(normalized)) {
    return "Remote";
  }
  return null;
}

function extractCompanySize(combinedText: string): string | null {
  const normalized = combinedText.toLowerCase();
  const rangeMatch = normalized.match(/\b\d{1,3}(?:,\d{3})?\s*-\s*\d{1,3}(?:,\d{3})?\s+employees?\b/i);
  if (rangeMatch?.[0]) {
    return rangeMatch[0].replace(/\s+employees?$/i, "").trim();
  }

  const plusMatch = normalized.match(/\b\d{1,3}(?:,\d{3})?\+?\s+employees?\b/i);
  if (plusMatch?.[0]) {
    return plusMatch[0].replace(/\s+employees?$/i, "").trim();
  }

  const overMatch = normalized.match(/\b(?:over|more than)\s+\d{1,3}(?:,\d{3})?\s+employees?\b/i);
  if (overMatch?.[0]) {
    return overMatch[0].trim();
  }

  return null;
}

export function mergeUniqueValues(
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined
): string[] | null {
  const merged = dedupeStrings([...(existing ?? []), ...(incoming ?? [])]);
  return merged.length > 0 ? merged : null;
}

export function extractEnrichmentValues(
  documents: EnrichmentDocument[],
  seedText: string
): EnrichmentExtraction {
  const combinedText = `${seedText}\n${documents.map((document) => document.text).join("\n")}`;
  const emails = extractEmails(documents);
  const skills = extractSkills(documents);
  const seniority = extractSeniority(combinedText);
  const companyWebsite = extractCompanyWebsite(documents);
  const workMode = extractWorkMode(combinedText);
  const companySize = extractCompanySize(combinedText);
  const fieldConfidence: EnrichmentExtraction["fieldConfidence"] = {};

  if (emails.confidence) {
    fieldConfidence.emails = emails.confidence;
  }
  if (skills) {
    fieldConfidence.skills = "medium";
  }
  if (seniority.confidence) {
    fieldConfidence.seniority = seniority.confidence;
  }
  if (companyWebsite) {
    const domain = normalizeUrlDomain(companyWebsite);
    fieldConfidence.companyWebsite = domain ? "high" : "medium";
  }
  if (workMode) {
    fieldConfidence.workMode = "medium";
  }
  if (companySize) {
    fieldConfidence.companySize = "low";
  }

  return {
    emails: emails.values,
    skills,
    seniority: seniority.value,
    companyWebsite,
    workMode,
    companySize,
    fieldConfidence
  };
}
