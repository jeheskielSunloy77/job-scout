import type {
	JobScoutClient,
	JobScoutConfig,
	JobSearchRequest,
} from '@/domain/types'

import { scoutJobRows } from '@/public/scout-job-rows'
import { scoutJobs } from '@/public/scout-jobs'

export function createClient(config: JobScoutConfig = {}): JobScoutClient {
	return {
		async scoutJobs(request: JobSearchRequest) {
			return scoutJobs(request, config)
		},
		async scoutJobRows(request: JobSearchRequest) {
			return scoutJobRows(request, config)
		},
	}
}
