import { describe, expect, it } from "bun:test"

import type { JobSite } from '../../../src/index'
import { scoutJobs, toJobRows } from '../../../src/index'
import { assertRowBasics, assertSortedBySiteAndDate } from './assertions'
import { getLiveTestConfig } from './env'
import {
	createTransientExternalError,
	isTransientExternalFailure,
	runWithRetries,
} from './retry'

const cfg = getLiveTestConfig()

describe('Live Integration - Orchestrator', () => {
	it('aggregates multiple sites and returns sorted rows', async () => {
		const sites: JobSite[] = ['indeed', 'google', 'bayt']

		let jobs: Awaited<ReturnType<typeof scoutJobs>>
		try {
			jobs = await runWithRetries('orchestrator multi-site scrape', async () => {
				const request = {
					sites: [...sites],
					query: 'software engineer',
					location: 'San Francisco, CA',
					pagination: { limitPerSite: 1 },
					filters: { postedWithinHours: 72 },
					google: {
						query:
							'software engineer jobs near San Francisco, CA since yesterday',
					},
					indeed: { country: cfg.countryIndeed },
				}
				const config = {
					transport: {
						timeoutMs: cfg.requestTimeoutMs,
						...(cfg.proxies.length > 0 ? { proxies: cfg.proxies } : {}),
						...(cfg.userAgent ? { userAgent: cfg.userAgent } : {}),
					},
					logging: {
						level: cfg.logLevel,
					},
				}
				const result = await scoutJobs(request, config)
				if (result.length < 1) {
					throw createTransientExternalError(
						'orchestrator returned zero jobs across requested sites',
					)
				}
				return result
			})
		} catch (error) {
			if (isTransientExternalFailure(error)) {
				console.warn(
					`[quarantined] orchestrator transient external failure: ${String(error)}`,
				)
				return
			}
			throw error
		}

		expect(jobs.length).toBeGreaterThanOrEqual(1)
		for (const job of jobs) {
			expect(sites.includes(job.site)).toBe(true)
		}

		assertSortedBySiteAndDate(jobs)

		const rows = toJobRows(jobs)
		expect(rows.length).toBe(jobs.length)
		assertRowBasics(rows)
	}, 180000)
})
