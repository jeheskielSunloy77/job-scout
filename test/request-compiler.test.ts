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
})
