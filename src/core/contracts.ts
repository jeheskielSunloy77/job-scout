import type {
	Country,
	DescriptionFormat,
	JobPost,
	ScraperInput,
	ScraperOptions,
	Site,
} from '@/core/model'
import type { HttpClient, HttpClientConfig } from '@/util/http'

import type { JobSearchRequest } from '@/domain/types'

export interface ResolvedJobScoutConfig {
	raw: unknown
	logging: {
		level: 'error' | 'warn' | 'info' | 'debug'
	}
	transport: {
		http: HttpClientConfig
		scraperOptions: ScraperOptions
	}
	output: {
		descriptionFormat: DescriptionFormat
		annualizeSalary: boolean
		salaryFallback: 'usOnly'
	}
}

export interface CompiledSiteRequest {
	site: Site
	scraperInput: ScraperInput
	scraperOptions: ScraperOptions
}

export interface CompiledSearchRequest {
	request: JobSearchRequest
	config: ResolvedJobScoutConfig
	country: Country
	siteRequests: CompiledSiteRequest[]
}

export interface SearchContext {
	transport: HttpClient
	config: ResolvedJobScoutConfig
}

export interface SiteProvider {
	readonly site: Site
	search(
		request: CompiledSiteRequest,
		context: SearchContext,
	): Promise<JobPost[]>
}

export interface SiteSearchResult {
	site: Site
	jobs: JobPost[]
}
