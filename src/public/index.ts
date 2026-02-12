export { createClient } from '@/public/client'
export { scoutJobRows } from '@/public/scout-job-rows'
export { scoutJobs } from '@/public/scout-jobs'

export type {
	CompensationInterval,
	EmploymentType,
	Job,
	JobCompensation,
	JobDescriptionFormat,
	JobLocation,
	JobRow,
	JobScoutClient,
	JobScoutConfig,
	JobSearchRequest,
	JobSite,
	SalarySourceType,
} from '@/domain/types'

export {
	JobScoutError,
	JobScoutValidationError,
	SiteExecutionError,
} from '@/core/errors'
export { toJobRow, toJobRows } from '@/domain/row-normalizer'
