import type { EnrichmentConfidence } from "@/core/model";

export type EnrichmentFieldName =
  | "emails"
  | "skills"
  | "seniority"
  | "companyWebsite"
  | "workMode"
  | "companySize";

export type EnrichmentSourceName =
  | "jobDetailPage"
  | "externalApplyPage"
  | "companyPages";

export interface EnrichmentDocument {
  source: EnrichmentSourceName;
  url: string;
  domain: string;
  text: string;
  html: string | null;
}

export interface EnrichmentExtraction {
  emails: string[] | null;
  skills: string[] | null;
  seniority: string | null;
  companyWebsite: string | null;
  workMode: string | null;
  companySize: string | null;
  fieldConfidence: Partial<Record<EnrichmentFieldName, EnrichmentConfidence>>;
}

