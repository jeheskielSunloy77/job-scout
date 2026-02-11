import { describe, expect, it } from "bun:test"

import { scoutJobs } from '../../../src/index.js'
import { assertBasicJobSchema } from './assertions.js'
import { siteScenarios } from './common.js'
import { getLiveTestConfig } from './env.js'
import {
	createTransientExternalError,
	isTransientExternalFailure,
	runWithRetries,
} from './retry.js'

const cfg = getLiveTestConfig()

describe('Live Integration - Per Scraper', () => {
	for (const scenario of siteScenarios) {
		it(`${scenario.site} returns >= 1 valid job`, async () => {
			const started = Date.now()

			let jobs: Awaited<ReturnType<typeof scoutJobs>>
			try {
				jobs = await runWithRetries(`${scenario.site} scrape`, async () => {
					const request = {
						sites: [scenario.site],
						pagination: { limitPerSite: cfg.resultsWantedPerSite },
						filters: { postedWithinHours: 72 },
						indeed: { country: cfg.countryIndeed },
						...scenario.request,
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
							`site=${scenario.site} returned zero jobs for live query`,
						)
					}
					return result
				})
			} catch (error) {
				if (isTransientExternalFailure(error)) {
					console.warn(
						`[quarantined] site=${scenario.site} transient external failure: ${String(error)}`,
					)
					return
				}
				throw error
			}

			const elapsedMs = Date.now() - started
			console.info(
				`[live] site=${scenario.site} count=${jobs.length} elapsedMs=${elapsedMs}`,
			)

			expect(jobs.length).toBeGreaterThanOrEqual(1)

			for (const job of jobs) {
				assertBasicJobSchema(job, scenario.site)
			}
		}, 120000)
	}
})
