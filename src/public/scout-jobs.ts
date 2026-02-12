import { executeSearch } from '@/core/engine'
import { compileSearchRequest } from '@/core/request-compiler'
import { toDomainJob } from '@/domain/mapper'
import type {
	Job,
	JobScoutConfig,
	JobSearchRequestForSites,
	JobSite,
} from '@/domain/types'
import { siteProviders } from '@/sites/index'

export async function scoutJobs<const Sites extends readonly JobSite[]>(
	request: JobSearchRequestForSites<Sites>,
	config: JobScoutConfig = {},
): Promise<Job[]> {
	const compiled = compileSearchRequest(request, config)
	const jobs = await executeSearch(compiled, siteProviders)
	return jobs.map((job) => toDomainJob(job))
}
