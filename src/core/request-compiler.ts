import { z } from 'zod'
import { toScraperJobType } from '@/domain/employment-type'
import { toScraperSite } from '@/domain/site-mapping'
import type {
	JobScoutConfig,
	JobSearchRequestForSites,
	JobSite,
} from '@/domain/types'
import { toScraperSiteConcurrencyMap } from '@/internal/http/limiter'
import { normalizeRetryPolicy } from '@/internal/http/retry'
import {
	Country,
	DescriptionFormat,
	type EnrichmentMode,
	type ResolvedEnrichmentConfig,
	type ScraperInput,
	type Site,
} from '@/core/model'
import type {
	CompiledSearchRequest,
	ResolvedJobScoutConfig,
} from '@/core/contracts'
import { JobScoutValidationError } from '@/core/errors'

const jobSiteSchema = z.enum([
	'linkedin',
	'indeed',
	'zipRecruiter',
	'glassdoor',
	'google',
	'bayt',
	'naukri',
	'bdjobs',
])

const experimentalJobSites: JobSite[] = [
	'zipRecruiter',
	'glassdoor',
	'google',
	'bdjobs',
]

const employmentTypeSchema = z.enum([
	'fullTime',
	'partTime',
	'contract',
	'internship',
	'temporary',
	'other',
])

const enrichmentModeSchema = z.enum(['off', 'low', 'medium', 'high'])

const enrichmentConfigSchema = z
	.object({
		enabled: z.boolean().optional(),
		mode: enrichmentModeSchema.optional(),
		budget: z
			.object({
				maxExtraRequestsPerJob: z.number().int().positive().max(50).optional(),
				maxPagesPerDomain: z.number().int().positive().max(20).optional(),
				requestTimeoutMs: z.number().int().positive().max(60_000).optional(),
			})
			.strict()
			.optional(),
		sources: z
			.object({
				jobDetailPage: z.boolean().optional(),
				externalApplyPage: z.boolean().optional(),
				companyPages: z.boolean().optional(),
			})
			.strict()
			.optional(),
		fields: z
			.object({
				emails: z.boolean().optional(),
				skills: z.boolean().optional(),
				seniority: z.boolean().optional(),
				companyWebsite: z.boolean().optional(),
				workMode: z.boolean().optional(),
				companySize: z.boolean().optional(),
			})
			.strict()
			.optional(),
		exposeMeta: z.boolean().optional(),
	})
	.strict()

const requestSchema = z
	.object({
		sites: z.array(jobSiteSchema).min(1),
		query: z.string().trim().min(1).optional(),
		location: z.string().trim().min(1).optional(),
		pagination: z
			.object({
				limitPerSite: z.number().int().positive().max(1000).optional(),
				offset: z.number().int().min(0).optional(),
			})
			.strict()
			.optional(),
		filters: z
			.object({
				distanceMiles: z.number().int().positive().max(1000).optional(),
				remote: z.boolean().optional(),
				easyApply: z.boolean().optional(),
				employmentType: employmentTypeSchema.optional(),
				postedWithinHours: z
					.number()
					.int()
					.positive()
					.max(24 * 60)
					.optional(),
			})
			.strict()
			.optional(),
		enrichment: enrichmentConfigSchema.optional(),
		linkedin: z
			.object({
				fetchDescription: z.boolean().optional(),
				companyIds: z.array(z.number().int().positive()).optional(),
				enrichment: enrichmentConfigSchema.optional(),
			})
			.strict()
			.optional(),
		indeed: z
			.object({
				country: z.string().trim().min(1).optional(),
			})
			.strict()
			.optional(),
		google: z
			.object({
				query: z.string().trim().min(1).optional(),
			})
			.strict()
			.optional(),
	})
	.strict()

const configSchema = z
	.object({
		transport: z
			.object({
				proxies: z.array(z.string().trim().min(1)).optional(),
				userAgent: z.string().trim().min(1).optional(),
				caCertPath: z.string().trim().min(1).nullable().optional(),
				timeoutMs: z.number().int().positive().optional(),
			})
			.strict()
			.optional(),
		performance: z
			.object({
				maxGlobalConcurrency: z.number().int().positive().optional(),
				maxConcurrencyPerSite: z
					.record(jobSiteSchema, z.number().int().positive())
					.optional(),
				retry: z
					.object({
						listPages: z.number().int().min(0).optional(),
						detailPages: z.number().int().min(0).optional(),
						baseDelayMs: z.number().int().positive().optional(),
						maxDelayMs: z.number().int().positive().optional(),
					})
					.strict()
					.optional(),
				adaptiveConcurrency: z.boolean().optional(),
			})
			.strict()
			.optional(),
		experimental: z
			.object({
				experimentalSites: z
					.object({
						linkedin: z.boolean().optional(),
						indeed: z.boolean().optional(),
						zipRecruiter: z.boolean().optional(),
						glassdoor: z.boolean().optional(),
						google: z.boolean().optional(),
						bayt: z.boolean().optional(),
						naukri: z.boolean().optional(),
						bdjobs: z.boolean().optional(),
					})
					.strict()
					.optional(),
			})
			.strict()
			.optional(),
		output: z
			.object({
				descriptionFormat: z.enum(['markdown', 'html', 'plain']).optional(),
				annualizeSalary: z.boolean().optional(),
				salaryFallback: z.literal('usOnly').optional(),
			})
			.strict()
			.optional(),
		logging: z
			.object({
				level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
			})
			.strict()
			.optional(),
	})
	.strict()

type ParsedJobSearchRequest = z.infer<typeof requestSchema>
type ParsedJobScoutConfig = z.infer<typeof configSchema>
type ParsedEnrichmentConfig = z.infer<typeof enrichmentConfigSchema>

const ENRICHMENT_FIELDS = {
	emails: true,
	skills: true,
	seniority: true,
	companyWebsite: true,
	workMode: true,
	companySize: true,
} as const

const ENRICHMENT_SOURCES = {
	jobDetailPage: true,
	externalApplyPage: true,
	companyPages: true,
} as const

const ENRICHMENT_MODE_BUDGETS: Record<
	Exclude<EnrichmentMode, 'off'>,
	ResolvedEnrichmentConfig['budget']
> = {
	low: {
		maxExtraRequestsPerJob: 1,
		maxPagesPerDomain: 1,
		requestTimeoutMs: 3000,
	},
	medium: {
		maxExtraRequestsPerJob: 2,
		maxPagesPerDomain: 2,
		requestTimeoutMs: 5000,
	},
	high: {
		maxExtraRequestsPerJob: 4,
		maxPagesPerDomain: 3,
		requestTimeoutMs: 7000,
	},
}

const ENRICHMENT_OFF_BUDGET: ResolvedEnrichmentConfig['budget'] = {
	maxExtraRequestsPerJob: 0,
	maxPagesPerDomain: 0,
	requestTimeoutMs: 0,
}

function zodErrorToMessage(error: z.ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
			return `${path}: ${issue.message}`
		})
		.join('; ')
}

function resolveDescriptionFormat(
	value: 'markdown' | 'html' | 'plain',
): DescriptionFormat {
	if (value === 'html') {
		return DescriptionFormat.HTML
	}

	if (value === 'plain') {
		return DescriptionFormat.PLAIN
	}

	return DescriptionFormat.MARKDOWN
}

function mergeEnrichmentConfig(
	globalConfig: ParsedEnrichmentConfig | undefined,
	linkedInConfig: ParsedEnrichmentConfig | undefined,
): ParsedEnrichmentConfig {
	const mergedBudget = {
		...(globalConfig?.budget ?? {}),
		...(linkedInConfig?.budget ?? {}),
	}
	const mergedSources = {
		...(globalConfig?.sources ?? {}),
		...(linkedInConfig?.sources ?? {}),
	}
	const mergedFields = {
		...(globalConfig?.fields ?? {}),
		...(linkedInConfig?.fields ?? {}),
	}

	return {
		...(globalConfig ?? {}),
		...(linkedInConfig ?? {}),
		...(Object.keys(mergedBudget).length > 0 ? { budget: mergedBudget } : {}),
		...(Object.keys(mergedSources).length > 0
			? { sources: mergedSources }
			: {}),
		...(Object.keys(mergedFields).length > 0 ? { fields: mergedFields } : {}),
	}
}

function resolveLinkedInEnrichmentConfig(
	request: ParsedJobSearchRequest,
): ResolvedEnrichmentConfig {
	const merged = mergeEnrichmentConfig(
		request.enrichment,
		request.linkedin?.enrichment,
	)

	const modeFromRequest = merged.mode
	let enabled = false

	if (modeFromRequest === 'off') {
		enabled = false
	} else if (merged.enabled !== undefined) {
		enabled = merged.enabled
	} else if (modeFromRequest !== undefined) {
		enabled = true
	}

	const resolvedMode: EnrichmentMode = enabled
		? modeFromRequest && modeFromRequest !== 'off'
			? modeFromRequest
			: 'medium'
		: 'off'

	const modeBudget =
		resolvedMode === 'off'
			? ENRICHMENT_OFF_BUDGET
			: ENRICHMENT_MODE_BUDGETS[resolvedMode]

	const budget: ResolvedEnrichmentConfig['budget'] = {
		maxExtraRequestsPerJob:
			merged.budget?.maxExtraRequestsPerJob ?? modeBudget.maxExtraRequestsPerJob,
		maxPagesPerDomain:
			merged.budget?.maxPagesPerDomain ?? modeBudget.maxPagesPerDomain,
		requestTimeoutMs:
			merged.budget?.requestTimeoutMs ?? modeBudget.requestTimeoutMs,
	}

	const sources: ResolvedEnrichmentConfig['sources'] = enabled
		? {
				jobDetailPage:
					merged.sources?.jobDetailPage ?? ENRICHMENT_SOURCES.jobDetailPage,
				externalApplyPage:
					merged.sources?.externalApplyPage ??
					ENRICHMENT_SOURCES.externalApplyPage,
				companyPages:
					merged.sources?.companyPages ?? ENRICHMENT_SOURCES.companyPages,
			}
		: {
				jobDetailPage: false,
				externalApplyPage: false,
				companyPages: false,
			}

	const fields: ResolvedEnrichmentConfig['fields'] = !enabled
		? {
				emails: false,
				skills: false,
				seniority: false,
				companyWebsite: false,
				workMode: false,
				companySize: false,
			}
		: merged.fields
			? {
					emails: merged.fields.emails === true,
					skills: merged.fields.skills === true,
					seniority: merged.fields.seniority === true,
					companyWebsite: merged.fields.companyWebsite === true,
					workMode: merged.fields.workMode === true,
					companySize: merged.fields.companySize === true,
				}
			: {
					...ENRICHMENT_FIELDS,
				}

	return {
		enabled,
		mode: resolvedMode,
		budget,
		sources,
		fields,
		exposeMeta: merged.exposeMeta ?? false,
	}
}

function resolveCountry(countryInput: string | undefined): Country {
	try {
		return Country.fromString(countryInput ?? 'usa')
	} catch (error) {
		throw new JobScoutValidationError(`Invalid indeed.country: ${String(error)}`)
	}
}

function enforceSiteFilterRules(
	request: ParsedJobSearchRequest,
	sites: JobSite[],
): void {
	const hasIndeed = sites.includes('indeed')
	const hasLinkedIn = sites.includes('linkedin')
	const hasGoogle = sites.includes('google')

	const hasHours = request.filters?.postedWithinHours !== undefined
	const hasEasyApply = request.filters?.easyApply === true
	const hasJobTypeOrRemote =
		request.filters?.employmentType !== undefined ||
		request.filters?.remote === true

	if (hasIndeed) {
		const active = [hasHours, hasEasyApply, hasJobTypeOrRemote].filter(
			Boolean,
		).length
		if (active > 1) {
			throw new JobScoutValidationError(
				'Indeed only supports one filter group at a time: filters.postedWithinHours OR filters.easyApply OR (filters.employmentType/filters.remote).',
			)
		}
	}

	if (hasLinkedIn && hasHours && hasEasyApply) {
		throw new JobScoutValidationError(
			'LinkedIn only supports one of filters.postedWithinHours or filters.easyApply.',
		)
	}

	if (hasGoogle && !request.google?.query) {
		throw new JobScoutValidationError(
			"google.query is required when sites includes 'google'.",
		)
	}
}

function resolveExperimentalSiteFlags(
	config: ParsedJobScoutConfig,
): Record<JobSite, boolean> {
	const defaults: Record<JobSite, boolean> = {
		linkedin: false,
		indeed: false,
		zipRecruiter: false,
		glassdoor: false,
		google: false,
		bayt: false,
		naukri: false,
		bdjobs: false,
	}

	const overrides = config.experimental?.experimentalSites
	if (!overrides) {
		return defaults
	}

	for (const site of Object.keys(overrides) as JobSite[]) {
		defaults[site] = overrides[site] === true
	}

	return defaults
}

function enforceExperimentalSiteRules(
	sites: JobSite[],
	experimentalSitesEnabled: Record<JobSite, boolean>,
): void {
	const blockedSites = sites.filter(
		(site) =>
			experimentalJobSites.includes(site) &&
			experimentalSitesEnabled[site] !== true,
	)

	if (blockedSites.length === 0) {
		return
	}

	const enableHints = blockedSites
		.map((site) => `config.experimental.experimentalSites.${site} = true`)
		.join(', ')
	throw new JobScoutValidationError(
		`Experimental sites require explicit opt-in. Blocked sites: ${blockedSites.join(', ')}. Enable with ${enableHints}.`,
	)
}

function resolveConfig(config: JobScoutConfig): ResolvedJobScoutConfig {
	const parsedConfig = configSchema.safeParse(config)
	if (!parsedConfig.success) {
		throw new JobScoutValidationError(
			`Invalid JobScoutConfig: ${zodErrorToMessage(parsedConfig.error)}`,
		)
	}

	const parsed = parsedConfig.data
	const proxies = parsed.transport?.proxies ?? []
	const mappedConcurrency = parsed.performance?.maxConcurrencyPerSite
		? toScraperSiteConcurrencyMap(parsed.performance.maxConcurrencyPerSite)
		: undefined
	const retryPolicy = parsed.performance?.retry
		? normalizeRetryPolicy(parsed.performance.retry)
		: undefined

	return {
		raw: parsed,
		experimental: {
			experimentalSites: resolveExperimentalSiteFlags(parsed),
		},
		logging: {
			level: parsed.logging?.level ?? 'error',
		},
		transport: {
			http: {
				...(proxies.length > 0 ? { proxies } : { proxies: null }),
				...(parsed.transport?.timeoutMs !== undefined
					? { requestTimeoutMs: parsed.transport.timeoutMs }
					: {}),
				...(parsed.performance?.maxGlobalConcurrency !== undefined
					? { maxGlobalConcurrency: parsed.performance.maxGlobalConcurrency }
					: {}),
				...(mappedConcurrency ? { maxConcurrencyPerSite: mappedConcurrency } : {}),
				...(retryPolicy ? { retryPolicy } : {}),
				...(parsed.performance?.adaptiveConcurrency !== undefined
					? { enableAdaptiveConcurrency: parsed.performance.adaptiveConcurrency }
					: {}),
			},
			scraperOptions: {
				proxies: proxies.length > 0 ? proxies : null,
				caCert: parsed.transport?.caCertPath ?? null,
				userAgent: parsed.transport?.userAgent ?? null,
			},
		},
		output: {
			descriptionFormat: resolveDescriptionFormat(
				parsed.output?.descriptionFormat ?? 'markdown',
			),
			annualizeSalary: parsed.output?.annualizeSalary ?? false,
			salaryFallback: parsed.output?.salaryFallback ?? 'usOnly',
		},
	}
}

function compileScraperInput(
	site: Site,
	request: ParsedJobSearchRequest,
	country: Country,
	config: ResolvedJobScoutConfig,
	linkedInEnrichment: ResolvedEnrichmentConfig,
): ScraperInput {
	return {
		siteType: [site],
		country,
		searchTerm: request.query ?? null,
		googleSearchTerm: request.google?.query ?? null,
		location: request.location ?? null,
		distance: request.filters?.distanceMiles ?? 50,
		isRemote: request.filters?.remote ?? false,
		jobType: toScraperJobType(request.filters?.employmentType),
		easyApply: request.filters?.easyApply ?? null,
		offset: request.pagination?.offset ?? 0,
		linkedinFetchDescription: request.linkedin?.fetchDescription ?? false,
		linkedinCompanyIds: request.linkedin?.companyIds ?? null,
		linkedinEnrichment: linkedInEnrichment,
		descriptionFormat: config.output.descriptionFormat,
		requestTimeout: 60,
		resultsWanted: request.pagination?.limitPerSite ?? 15,
		hoursOld: request.filters?.postedWithinHours ?? null,
	}
}

export function compileSearchRequest<
	const Sites extends readonly JobSite[],
	const C extends JobScoutConfig | undefined = undefined,
>(
	request: JobSearchRequestForSites<Sites, C>,
	config?: C,
): CompiledSearchRequest<Sites, C> {
	const parsedRequest = requestSchema.safeParse(request)
	if (!parsedRequest.success) {
		throw new JobScoutValidationError(
			`Invalid JobSearchRequest: ${zodErrorToMessage(parsedRequest.error)}`,
		)
	}

	const normalizedRequest = parsedRequest.data
	const selectedSites = normalizedRequest.sites
	enforceSiteFilterRules(normalizedRequest, selectedSites)

	const resolvedConfig = resolveConfig(config ?? {})
	enforceExperimentalSiteRules(
		selectedSites,
		resolvedConfig.experimental.experimentalSites,
	)
	const country = resolveCountry(normalizedRequest.indeed?.country)
	const linkedInEnrichment = resolveLinkedInEnrichmentConfig(normalizedRequest)

	const siteRequests = [...new Set(selectedSites)]
		.map((site) => toScraperSite(site))
		.map((scraperSite) => ({
			site: scraperSite,
			scraperInput: compileScraperInput(
				scraperSite,
				normalizedRequest,
				country,
				resolvedConfig,
				linkedInEnrichment,
			),
			scraperOptions: resolvedConfig.transport.scraperOptions,
		}))

	return {
		request: normalizedRequest as unknown as JobSearchRequestForSites<Sites, C>,
		config: resolvedConfig,
		country,
		siteRequests,
	}
}
