import { toJobRows } from '../domain/row-normalizer.js'
import type {
	JobRow,
	JobScoutConfig,
	JobSearchRequest,
} from '../domain/types.js'

import { scoutJobs } from './scout-jobs.js'

export async function scoutJobRows(
	request: JobSearchRequest,
	config: JobScoutConfig = {},
): Promise<JobRow[]> {
	const jobs = await scoutJobs(request, config)
	return toJobRows(jobs)
}
