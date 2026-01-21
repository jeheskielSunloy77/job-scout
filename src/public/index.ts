export { createClient } from './client.js'
export { scoutJobRows } from './scout-job-rows.js'
export { scoutJobs } from './scout-jobs.js'

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
} from '../domain/types.js'

export {
	JobScoutError,
	JobScoutValidationError,
	SiteExecutionError,
} from '../core/errors.js'
export { toJobRow, toJobRows } from '../domain/row-normalizer.js'
