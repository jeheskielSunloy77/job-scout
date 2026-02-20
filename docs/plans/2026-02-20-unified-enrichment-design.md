# Unified Enrichment Design (LinkedIn First)

Date: 2026-02-20
Status: Approved for planning

## Objective
Improve `scoutJobs` enrichment quality (especially emails) while supporting future enrichments through one configurable system with strict performance controls.

## Decisions Locked
1. Enrichment is disabled by default.
2. If enrichment is enabled and `fields` is omitted, all known enrichments are enabled.
3. Enrichment metadata is exposed as opt-in only.
4. Configuration supports global defaults and per-site override (`linkedin` first).
5. Budget must be adjustable via parameters.

## API Design
Add unified enrichment settings:

```ts
request.enrichment?: EnrichmentConfig
request.linkedin?.enrichment?: EnrichmentConfig // overrides global

type EnrichmentConfig = {
  enabled?: boolean // default false
  mode?: 'off' | 'low' | 'medium' | 'high'
  budget?: {
    maxExtraRequestsPerJob?: number
    maxPagesPerDomain?: number
    requestTimeoutMs?: number
  }
  sources?: {
    jobDetailPage?: boolean
    externalApplyPage?: boolean
    companyPages?: boolean
  }
  fields?: {
    emails?: boolean
    skills?: boolean
    seniority?: boolean
    companyWebsite?: boolean
    workMode?: boolean
    companySize?: boolean
  }
  exposeMeta?: boolean // default false
}
```

Resolution rules:
1. Default `enabled=false`.
2. Merge order: internal defaults -> `request.enrichment` -> `request.linkedin.enrichment`.
3. If `enabled=true` and `fields` is absent, auto-enable all known fields.

## Enrichment Pipeline
For each LinkedIn job:
1. Build base job result (existing scraper behavior).
2. If enrichment disabled, return immediately.
3. Initialize budget controller.
4. Gather documents in priority order (if enabled and budget allows):
   - LinkedIn job detail
   - external apply page (`jobUrlDirect`)
   - company pages (contact/careers/about)
5. Run enabled field enrichers on collected documents.
6. Normalize and deduplicate extracted values.
7. Populate existing output fields (backward-compatible).
8. If `exposeMeta=true`, attach `enrichmentMeta`.

## Output Strategy
Keep current fields (`emails`, `skills`, etc.) unchanged in shape.

Add optional metadata block:

```ts
enrichmentMeta?: {
  enabled: boolean
  sourcesUsed: string[]
  budgetUsed: {
    requests: number
    domains: number
    pages: number
    exhausted: boolean
  }
  fieldConfidence: Record<string, 'high' | 'medium' | 'low'>
}
```

## Error Handling and Performance
1. Enrichment must be fail-soft: never fail whole scrape for enrichment errors.
2. Enforce per-request timeout and budget caps.
3. Stop enrichment early when budget is exhausted.
4. Cache company-domain fetches within a scrape run to reduce duplicate requests.

## Initial Enricher Focus
1. `emails`: description text, `mailto:`, external apply pages, company pages.
2. `skills`: description and criteria block extraction.
3. `seniority`: normalized from job criteria and text hints.
4. `companyWebsite`, `workMode`, `companySize`: parse where available.

## Testing Plan
1. Unit: config resolution, override precedence, and default-all-fields behavior.
2. Unit: budget controller cutoff logic.
3. Unit: extractor behavior for each source type (including obfuscated email patterns).
4. Integration: enrichment off vs on, and metadata opt-in behavior.
5. Integration (live): verify non-zero enrichment fill-rate improvements without breaking baseline fields.

## Non-Goals (This Phase)
1. No third-party paid enrichment providers.
2. No breaking changes to existing public `Job` field types.
3. No cross-site rollout before LinkedIn validates architecture.
