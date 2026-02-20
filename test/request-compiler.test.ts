import { describe, expect, it } from 'bun:test'

import { Site } from '../src/core/model'
import { compileSearchRequest } from '../src/core/request-compiler'

describe('compileSearchRequest', () => {
	it('compiles TS-native request and config into per-site scraper inputs', () => {
		const compiled = compileSearchRequest(
			{
				sites: ['indeed', 'zipRecruiter'],
				query: 'software engineer',
				location: 'San Francisco, CA',
				pagination: {
					limitPerSite: 20,
					offset: 5,
				},
				filters: {
					distanceMiles: 25,
					remote: true,
					employmentType: 'fullTime',
				},
				indeed: {
					country: 'usa',
				},
			},
			{
				transport: {
					timeoutMs: 15000,
					proxies: ['127.0.0.1:8080'],
					userAgent: 'JobScoutTest/1.0',
				},
				logging: {
					level: 'info',
				},
				output: {
					descriptionFormat: 'plain',
					annualizeSalary: true,
				},
				experimental: {
					experimentalSites: {
						zipRecruiter: true,
					},
				},
			},
		)

		expect(compiled.siteRequests.length).toBe(2)
		expect(compiled.siteRequests[0]?.site).toBe(Site.INDEED)
		expect(compiled.siteRequests[1]?.site).toBe(Site.ZIP_RECRUITER)

		const first = compiled.siteRequests[0]
		expect(first?.scraperInput.searchTerm).toBe('software engineer')
		expect(first?.scraperInput.distance).toBe(25)
		expect(first?.scraperInput.isRemote).toBe(true)
		expect(first?.scraperInput.resultsWanted).toBe(20)
		expect(first?.scraperInput.offset).toBe(5)
		expect(first?.scraperOptions.userAgent).toBe('JobScoutTest/1.0')

		expect(compiled.config.output.descriptionFormat).toBe('plain')
		expect(compiled.config.output.annualizeSalary).toBe(true)
	})

	it('rejects unknown request keys', () => {
		expect(() =>
			compileSearchRequest({
				unknown: true,
			} as any),
		).toThrow('Invalid JobSearchRequest')
	})

	it('requires sites to be provided', () => {
		expect(() =>
			compileSearchRequest({
				query: 'software engineer',
			} as any),
		).toThrow('Invalid JobSearchRequest')
	})

	it('requires google.query when google is selected', () => {
		expect(() =>
			compileSearchRequest({
				sites: ['google'],
				query: 'software engineer',
			} as any),
		).toThrow('google.query is required')
	})

	it('rejects experimental sites unless explicitly enabled', () => {
		expect(() =>
			compileSearchRequest({
				sites: ['zipRecruiter'],
				query: 'software engineer',
			} as any),
		).toThrow('Experimental sites require explicit opt-in')
	})

	it('allows experimental sites when explicitly enabled', () => {
		expect(() =>
			compileSearchRequest(
				{
					sites: ['zipRecruiter'],
					query: 'software engineer',
				} as any,
				{
					experimental: {
						experimentalSites: {
							zipRecruiter: true,
						},
					},
				},
			),
		).not.toThrow()
	})

	it('rejects mixed requests that include blocked experimental sites', () => {
		expect(() =>
			compileSearchRequest({
				sites: ['indeed', 'google'],
				query: 'software engineer',
				google: { query: 'software engineer jobs in Austin, TX' },
			} as any),
		).toThrow('Blocked sites: google')
	})

	it('enforces Indeed mutually-exclusive filters', () => {
		expect(() =>
			compileSearchRequest({
				sites: ['indeed'],
				query: 'software engineer',
				filters: {
					postedWithinHours: 24,
					easyApply: true,
				},
			} as any),
		).toThrow('Indeed only supports one filter group')
	})

	it('defaults enrichment to disabled', () => {
		const compiled = compileSearchRequest({
			sites: ['linkedin'],
			query: 'software engineer',
		})

		expect(compiled.siteRequests[0]?.scraperInput.linkedinEnrichment).toEqual({
			enabled: false,
			mode: 'off',
			budget: {
				maxExtraRequestsPerJob: 0,
				maxPagesPerDomain: 0,
				requestTimeoutMs: 0,
			},
			sources: {
				jobDetailPage: false,
				externalApplyPage: false,
				companyPages: false,
			},
			fields: {
				emails: false,
				skills: false,
				seniority: false,
				companyWebsite: false,
				workMode: false,
				companySize: false,
			},
			exposeMeta: false,
		})
	})

	it('applies enrichment override precedence with nested merges', () => {
		const compiled = compileSearchRequest({
			sites: ['linkedin'],
			query: 'software engineer',
			enrichment: {
				enabled: true,
				mode: 'low',
				budget: {
					maxExtraRequestsPerJob: 3,
				},
				sources: {
					externalApplyPage: false,
				},
				fields: {
					emails: true,
				},
				exposeMeta: true,
			},
			linkedin: {
				enrichment: {
					mode: 'high',
					budget: {
						requestTimeoutMs: 9000,
					},
					fields: {
						skills: true,
					},
				},
			},
		})

		expect(compiled.siteRequests[0]?.scraperInput.linkedinEnrichment).toEqual({
			enabled: true,
			mode: 'high',
			budget: {
				maxExtraRequestsPerJob: 3,
				maxPagesPerDomain: 3,
				requestTimeoutMs: 9000,
			},
			sources: {
				jobDetailPage: true,
				externalApplyPage: false,
				companyPages: true,
			},
			fields: {
				emails: true,
				skills: true,
				seniority: false,
				companyWebsite: false,
				workMode: false,
				companySize: false,
			},
			exposeMeta: true,
		})
	})

	it('enables all enrichment fields when enabled and fields is omitted', () => {
		const compiled = compileSearchRequest({
			sites: ['linkedin'],
			query: 'software engineer',
			enrichment: {
				enabled: true,
			},
		})

		expect(compiled.siteRequests[0]?.scraperInput.linkedinEnrichment.fields).toEqual({
			emails: true,
			skills: true,
			seniority: true,
			companyWebsite: true,
			workMode: true,
			companySize: true,
		})
	})

	it('uses conservative mode budget defaults', () => {
		const low = compileSearchRequest({
			sites: ['linkedin'],
			query: 'software engineer',
			enrichment: {
				mode: 'low',
			},
		})
		const medium = compileSearchRequest({
			sites: ['linkedin'],
			query: 'software engineer',
			enrichment: {
				mode: 'medium',
			},
		})
		const high = compileSearchRequest({
			sites: ['linkedin'],
			query: 'software engineer',
			enrichment: {
				mode: 'high',
			},
		})

		expect(low.siteRequests[0]?.scraperInput.linkedinEnrichment.budget).toEqual({
			maxExtraRequestsPerJob: 1,
			maxPagesPerDomain: 1,
			requestTimeoutMs: 3000,
		})
		expect(medium.siteRequests[0]?.scraperInput.linkedinEnrichment.budget).toEqual({
			maxExtraRequestsPerJob: 2,
			maxPagesPerDomain: 2,
			requestTimeoutMs: 5000,
		})
		expect(high.siteRequests[0]?.scraperInput.linkedinEnrichment.budget).toEqual({
			maxExtraRequestsPerJob: 4,
			maxPagesPerDomain: 3,
			requestTimeoutMs: 7000,
		})
	})
})
