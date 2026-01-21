import { executeSearch } from '../core/engine.js'
import { compileSearchRequest } from '../core/request-compiler.js'
import { toDomainJob } from '../domain/mapper.js'
import type { Job, JobScoutConfig, JobSearchRequest } from '../domain/types.js'
import { siteProviders } from '../sites/index.js'

export async function scoutJobs(
	request: JobSearchRequest,
	config: JobScoutConfig = {},
): Promise<Job[]> {
	const compiled = compileSearchRequest(request, config)
	const jobs = await executeSearch(compiled, siteProviders)
	return jobs.map((job) => toDomainJob(job))
}
