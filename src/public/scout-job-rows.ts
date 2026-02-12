import { toJobRows } from '@/domain/row-normalizer'
import type {
	JobRow,
	JobScoutConfig,
	JobSearchRequest,
} from '@/domain/types'

import { scoutJobs } from '@/public/scout-jobs'

export async function scoutJobRows(
	request: JobSearchRequest,
	config: JobScoutConfig = {},
): Promise<JobRow[]> {
	const jobs = await scoutJobs(request, config)
	return toJobRows(jobs)
}
