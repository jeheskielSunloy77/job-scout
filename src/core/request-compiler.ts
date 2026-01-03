import { z } from 'zod'

import { toLegacyJobType } from '../domain/employment-type.js'
import { allJobSites, toLegacySite } from '../domain/site-mapping.js'
import type {
	JobScoutConfig,
	JobSearchRequest,
	JobSite,
} from '../domain/types.js'
import { toLegacySiteConcurrencyMap } from '../internal/http/limiter.js'
import { normalizeRetryPolicy } from '../internal/http/retry.js'
import {
	Country,
	DescriptionFormat,
	type ScraperInput,
	type Site,
} from '../model.js'

import type {
	CompiledSearchRequest,
	ResolvedJobScoutConfig,
} from './contracts.js'
import { JobScoutValidationError } from './errors.js'

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

const employmentTypeSchema = z.enum([
	'fullTime',
	'partTime',
	'contract',
	'internship',
	'temporary',
	'other',
])

const requestSchema = z
	.object({
		sites: z.array(jobSiteSchema).min(1).optional(),
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
		linkedin: z
			.object({
				fetchDescription: z.boolean().optional(),
				companyIds: z.array(z.number().int().positive()).optional(),
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

const legacyKeyMap: Record<string, string> = {
	site_name: 'sites',
	search_term: 'query',
	google_search_term: 'google.query',
	results_wanted: 'pagination.limitPerSite',
	country_indeed: 'indeed.country',
	is_remote: 'filters.remote',
	job_type: 'filters.employmentType',
	easy_apply: 'filters.easyApply',
	hours_old: 'filters.postedWithinHours',
	linkedin_fetch_description: 'linkedin.fetchDescription',
	linkedin_company_ids: 'linkedin.companyIds',
	enforce_annual_salary: 'output.annualizeSalary',
	user_agent: 'transport.userAgent',
	ca_cert: 'transport.caCertPath',
	verbose: 'logging.level',
	proxies: 'transport.proxies',
	offset: 'pagination.offset',
	description_format: 'output.descriptionFormat',
	distance: 'filters.distanceMiles',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectLegacyKeys(value: unknown): string[] {
	if (!isPlainObject(value)) {
		return []
	}

	const hits: string[] = []
	for (const [key] of Object.entries(value)) {
		if (key in legacyKeyMap) {
			hits.push(key)
		}
	}

	return hits
}

function assertNoLegacyKeys(
	payload: unknown,
	label: 'request' | 'config',
): void {
	const keys = collectLegacyKeys(payload)
	if (keys.length === 0) {
		return
	}

	const details = keys
		.map((path) => {
			const key = path.split('.').at(-1) ?? path
			const replacement = legacyKeyMap[key]
			return replacement ? `'${path}' (use '${replacement}')` : `'${path}'`
		})
		.join(', ')

	throw new JobScoutValidationError(
		`Legacy snake_case keys are not supported in ${label}: ${details}. See MIGRATION.md for the full mapping.`,
	)
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
		? toLegacySiteConcurrencyMap(parsed.performance.maxConcurrencyPerSite)
		: undefined
	const retryPolicy = parsed.performance?.retry
		? normalizeRetryPolicy(parsed.performance.retry)
		: undefined

	return {
		raw: parsed,
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
): ScraperInput {
	return {
		site_type: [site],
		country,
		search_term: request.query ?? null,
		google_search_term: request.google?.query ?? null,
		location: request.location ?? null,
		distance: request.filters?.distanceMiles ?? 50,
		is_remote: request.filters?.remote ?? false,
		job_type: toLegacyJobType(request.filters?.employmentType),
		easy_apply: request.filters?.easyApply ?? null,
		offset: request.pagination?.offset ?? 0,
		linkedin_fetch_description: request.linkedin?.fetchDescription ?? false,
		linkedin_company_ids: request.linkedin?.companyIds ?? null,
		description_format: config.output.descriptionFormat,
		request_timeout: 60,
		results_wanted: request.pagination?.limitPerSite ?? 15,
		hours_old: request.filters?.postedWithinHours ?? null,
	}
}

export function compileSearchRequest(
	request: JobSearchRequest,
	config: JobScoutConfig = {},
): CompiledSearchRequest {
	assertNoLegacyKeys(request, 'request')
	assertNoLegacyKeys(config, 'config')

	const parsedRequest = requestSchema.safeParse(request)
	if (!parsedRequest.success) {
		throw new JobScoutValidationError(
			`Invalid JobSearchRequest: ${zodErrorToMessage(parsedRequest.error)}`,
		)
	}

	const normalizedRequest = parsedRequest.data
	const selectedSites = normalizedRequest.sites ?? allJobSites
	enforceSiteFilterRules(normalizedRequest, selectedSites)

	const resolvedConfig = resolveConfig(config)
	const country = resolveCountry(normalizedRequest.indeed?.country)

	const siteRequests = [...new Set(selectedSites)]
		.map((site) => toLegacySite(site))
		.map((legacySite) => ({
			site: legacySite,
			scraperInput: compileScraperInput(
				legacySite,
				normalizedRequest,
				country,
				resolvedConfig,
			),
			scraperOptions: resolvedConfig.transport.scraperOptions,
		}))

	return {
		request: normalizedRequest as JobSearchRequest,
		config: resolvedConfig,
		country,
		siteRequests,
	}
}
