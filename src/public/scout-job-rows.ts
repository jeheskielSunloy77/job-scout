import { toJobRows } from '@/domain/row-normalizer'
import type {
	JobRow,
	JobScoutConfig,
	JobSearchRequestForSites,
	JobSite,
} from '@/domain/types'

import { scoutJobs } from '@/public/scout-jobs'

export async function scoutJobRows<const Sites extends readonly JobSite[]>(
	request: JobSearchRequestForSites<Sites>,
	config: JobScoutConfig = {},
): Promise<JobRow[]> {
	const jobs = await scoutJobs(request, config)
	return toJobRows(jobs)
}
