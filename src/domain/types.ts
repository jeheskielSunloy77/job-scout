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

export interface JobSearchRequest {
	sites?: JobSite[]
	query?: string
	location?: string
	pagination?: {
		limitPerSite?: number
		offset?: number
	}
	filters?: {
		distanceMiles?: number
		remote?: boolean
		easyApply?: boolean
		employmentType?: EmploymentType
		postedWithinHours?: number
	}
	linkedin?: {
		fetchDescription?: boolean
		companyIds?: number[]
	}
	indeed?: {
		country?: string
	}
	google?: {
		query?: string
	}
}

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
	scoutJobs(request: JobSearchRequest): Promise<Job[]>
	scoutJobRows(request: JobSearchRequest): Promise<JobRow[]>
}
