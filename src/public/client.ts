import type {
	JobScoutClient,
	JobScoutConfig,
	JobSearchRequestForSites,
	JobSite,
} from '@/domain/types'

import { scoutJobRows } from '@/public/scout-job-rows'
import { scoutJobs } from '@/public/scout-jobs'

export function createClient<const C extends JobScoutConfig | undefined = undefined>(
	config?: C,
): JobScoutClient<C> {
	return {
		async scoutJobs<const Sites extends readonly JobSite[]>(
			request: JobSearchRequestForSites<Sites, C>,
		) {
			return scoutJobs(request, config)
		},
		async scoutJobRows<const Sites extends readonly JobSite[]>(
			request: JobSearchRequestForSites<Sites, C>,
		) {
			return scoutJobRows(request, config)
		},
	}
}
