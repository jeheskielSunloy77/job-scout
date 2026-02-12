export type JobSite =
	| 'linkedin'
	| 'indeed'
	| 'zipRecruiter'
	| 'glassdoor'
	| 'google'
	| 'bayt'
	| 'naukri'
	| 'bdjobs'

export type EmploymentType =
	| 'fullTime'
	| 'partTime'
	| 'contract'
	| 'internship'
	| 'temporary'
	| 'other'

export type JobDescriptionFormat = 'markdown' | 'html' | 'plain'

export type SalarySourceType = 'directData' | 'description'

export type CompensationInterval =
	| 'yearly'
	| 'monthly'
	| 'weekly'
	| 'daily'
	| 'hourly'

export interface JobLocation {
	country: string | null
	city: string | null
	state: string | null
	display: string | null
}

export interface JobCompensation {
	interval: CompensationInterval | null
	minAmount: number | null
	maxAmount: number | null
	currency: string | null
}

export interface Job {
	id: string | null
	site: JobSite
	title: string
	companyName: string | null
	jobUrl: string
	jobUrlDirect: string | null
	location: JobLocation | null
	description: string | null
	companyUrl: string | null
	companyUrlDirect: string | null
	employmentTypes: EmploymentType[] | null
	compensation: JobCompensation | null
	salarySource: SalarySourceType | null
	datePosted: Date | null
	emails: string[] | null
	isRemote: boolean | null
	listingType: string | null
	jobLevel: string | null
	companyIndustry: string | null
	companyAddresses: string | null
	companyNumEmployees: string | null
	companyRevenue: string | null
	companyDescription: string | null
	companyLogo: string | null
	bannerPhotoUrl: string | null
	jobFunction: string | null
	skills: string[] | null
	experienceRange: string | null
	companyRating: number | null
	companyReviewsCount: number | null
	vacancyCount: number | null
	workFromHomeType: string | null
}

export interface JobRow {
	id: string | null
	site: JobSite | null
	jobUrl: string | null
	jobUrlDirect: string | null
	title: string | null
	company: string | null
	location: string | null
	datePosted: string | null
	employmentTypes: string | null
	salarySource: SalarySourceType | null
	interval: CompensationInterval | null
	minAmount: number | null
	maxAmount: number | null
	currency: string | null
	isRemote: boolean | null
	jobLevel: string | null
	jobFunction: string | null
	listingType: string | null
	emails: string | null
	description: string | null
	companyIndustry: string | null
	companyUrl: string | null
	companyLogo: string | null
	companyUrlDirect: string | null
	companyAddresses: string | null
	companyNumEmployees: string | null
	companyRevenue: string | null
	companyDescription: string | null
	skills: string | null
	experienceRange: string | null
	companyRating: number | null
	companyReviewsCount: number | null
	vacancyCount: number | null
	workFromHomeType: string | null
}

export type NonEmptyArray<T> = readonly [T, ...T[]]

export type HasSite<
	Sites extends readonly JobSite[],
	SiteName extends JobSite,
> = number extends Sites['length'] ? true : SiteName extends Sites[number]
	? true
	: false

type EnsureSites<Sites extends readonly JobSite[]> =
	number extends Sites['length']
		? Sites
		: Sites extends NonEmptyArray<JobSite>
			? Sites
			: never

type JobSearchPagination = {
	limitPerSite?: number
	offset?: number
}

type JobSearchLinkedInOptions = {
	fetchDescription?: boolean
	companyIds?: number[]
}

type JobSearchIndeedOptions = {
	country?: string
}

type JobSearchGoogleOptions = {
	query?: string
}

type JobSearchRequiredGoogleOptions = {
	query: string
}

type JobSearchFiltersGeneral = {
	distanceMiles?: number
	remote?: boolean
	easyApply?: boolean
	employmentType?: EmploymentType
	postedWithinHours?: number
}

type JobSearchFiltersLinkedIn =
	| {
			distanceMiles?: number
			remote?: boolean
			employmentType?: EmploymentType
			postedWithinHours: number
			easyApply?: false | undefined
	  }
	| {
			distanceMiles?: number
			remote?: boolean
			employmentType?: EmploymentType
			postedWithinHours?: undefined
			easyApply?: boolean
	  }

type JobSearchFiltersIndeed =
	{
		distanceMiles?: number
	} & (
		| {
				postedWithinHours?: undefined
				easyApply?: false | undefined
				employmentType?: undefined
				remote?: false | undefined
		  }
		| {
				postedWithinHours: number
				easyApply?: false | undefined
				employmentType?: undefined
				remote?: false | undefined
		  }
		| {
				postedWithinHours?: undefined
				easyApply: true
				employmentType?: undefined
				remote?: false | undefined
		  }
		| ({
				postedWithinHours?: undefined
				easyApply?: false | undefined
		  } & (
				| {
						employmentType: EmploymentType
						remote?: boolean
				  }
				| {
						remote: true
						employmentType?: EmploymentType
				  }
		  ))
	)

type JobSearchFiltersForSites<Sites extends readonly JobSite[]> =
	HasSite<Sites, 'indeed'> extends true
		? HasSite<Sites, 'linkedin'> extends true
			? JobSearchFiltersIndeed & JobSearchFiltersLinkedIn
			: JobSearchFiltersIndeed
		: HasSite<Sites, 'linkedin'> extends true
			? JobSearchFiltersLinkedIn
			: JobSearchFiltersGeneral

type JobSearchGoogleForSites<Sites extends readonly JobSite[]> =
	HasSite<Sites, 'google'> extends true
		? {
				google: JobSearchRequiredGoogleOptions
		  }
		: {
				google?: JobSearchGoogleOptions
		  }

export type JobSearchRequestForSites<Sites extends readonly JobSite[]> = {
	sites: EnsureSites<Sites>
	query?: string
	location?: string
	pagination?: JobSearchPagination
	filters?: JobSearchFiltersForSites<Sites>
	linkedin?: JobSearchLinkedInOptions
	indeed?: JobSearchIndeedOptions
} & JobSearchGoogleForSites<Sites>

export type JobSearchRequest<
	Sites extends readonly JobSite[] = readonly JobSite[],
> = JobSearchRequestForSites<Sites>

export interface JobScoutConfig {
	transport?: {
		proxies?: string[]
		userAgent?: string
		caCertPath?: string | null
		timeoutMs?: number
	}
	performance?: {
		maxGlobalConcurrency?: number
		maxConcurrencyPerSite?: Partial<Record<JobSite, number>>
		retry?: {
			listPages?: number
			detailPages?: number
			baseDelayMs?: number
			maxDelayMs?: number
		}
		adaptiveConcurrency?: boolean
	}
	output?: {
		descriptionFormat?: JobDescriptionFormat
		annualizeSalary?: boolean
		salaryFallback?: 'usOnly'
	}
	logging?: {
		level?: 'error' | 'warn' | 'info' | 'debug'
	}
}

export interface JobScoutClient {
	scoutJobs<const Sites extends readonly JobSite[]>(
		request: JobSearchRequestForSites<Sites>,
	): Promise<Job[]>
	scoutJobRows<const Sites extends readonly JobSite[]>(
		request: JobSearchRequestForSites<Sites>,
	): Promise<JobRow[]>
}
