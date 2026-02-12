import type {
	JobScoutClient,
	JobScoutConfig,
	JobSearchRequestForSites,
	JobSite,
} from '@/domain/types'

import { scoutJobRows } from '@/public/scout-job-rows'
import { scoutJobs } from '@/public/scout-jobs'

export function createClient(config: JobScoutConfig = {}): JobScoutClient {
	return {
		async scoutJobs<const Sites extends readonly JobSite[]>(
			request: JobSearchRequestForSites<Sites>,
		) {
			return scoutJobs(request, config)
		},
		async scoutJobRows<const Sites extends readonly JobSite[]>(
			request: JobSearchRequestForSites<Sites>,
		) {
			return scoutJobRows(request, config)
		},
	}
}
