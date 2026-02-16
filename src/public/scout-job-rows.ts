import { toJobRows } from '@/domain/row-normalizer'
import type {
	JobRow,
	JobScoutConfig,
	JobSearchRequestForSites,
	JobSite,
} from '@/domain/types'

import { scoutJobs } from '@/public/scout-jobs'

export async function scoutJobRows<
	const C extends JobScoutConfig | undefined = undefined,
	const Sites extends readonly JobSite[] = readonly JobSite[],
>(
	request: JobSearchRequestForSites<Sites, C>,
	config?: C,
): Promise<JobRow[]> {
	const jobs = await scoutJobs(request, config)
	return toJobRows(jobs)
}
