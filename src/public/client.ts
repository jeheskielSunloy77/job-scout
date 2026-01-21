import type {
	JobScoutClient,
	JobScoutConfig,
	JobSearchRequest,
} from '../domain/types.js'

import { scoutJobRows } from './scout-job-rows.js'
import { scoutJobs } from './scout-jobs.js'

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
