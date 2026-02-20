import { describe, expect, it } from 'bun:test'

import { scoutJobs } from '../../../src/index'
import { assertBasicJobSchema } from './assertions'
import { siteScenarios } from './common'
import { getLiveTestConfig } from './env'
import { createTransientExternalError, runWithRetries } from './retry'

const cfg = getLiveTestConfig()

describe('Live Integration - Per Scraper', () => {
	for (const scenario of siteScenarios) {
		it(`${scenario.site} returns >= 1 valid job`, async () => {
			const started = Date.now()

			const jobs = await runWithRetries(`${scenario.site} scrape`, async () => {
				const request = {
					sites: [scenario.site],
					pagination: { limitPerSite: cfg.resultsWantedPerSite },
					filters: { postedWithinHours: 72 },
					indeed: { country: cfg.countryIndeed },
					linkedin: { fetchDescription: true },
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

				const result = await scoutJobs(request as any, config)
				if (result.length < 1) {
					throw createTransientExternalError(
						`site=${scenario.site} returned zero jobs for live query`,
					)
				}
				return result
			})

			const elapsedMs = Date.now() - started
			console.info(
				`[live] site=${scenario.site} count=${jobs.length} elapsedMs=${elapsedMs}`,
				JSON.stringify(jobs, null, 2),
			)

			expect(jobs.length).toBeGreaterThanOrEqual(1)

			for (const job of jobs) {
				assertBasicJobSchema(job, scenario.site)
			}
		}, 120000)
	}
})
