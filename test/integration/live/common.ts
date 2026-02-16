import type { JobSearchRequestForSites, JobSite } from '../../../src/index'

export interface SiteScenario<Site extends JobSite = JobSite> {
	site: Site
	request: Omit<JobSearchRequestForSites<readonly [Site]>, 'sites'>
}

function defineScenario<const Site extends JobSite>(
	scenario: SiteScenario<Site>,
): SiteScenario<Site> {
	return scenario
}

export const siteScenarios = [
	defineScenario({
		site: 'indeed',
		request: {
			query: 'software engineer',
			location: 'San Francisco, CA',
			indeed: { country: 'usa' },
		},
	}),
	defineScenario({
		site: 'linkedin',
		request: {
			query: 'software engineer',
			location: 'Yogyakarta, Indonesia',
			linkedin: { fetchDescription: false },
		},
	}),
	defineScenario({
		site: 'zipRecruiter',
		request: {
			query: 'software engineer',
			location: 'Ambon, Indonesia',
		},
	}),
	defineScenario({
		site: 'glassdoor',
		request: {
			query: 'software engineer',
			location: 'San Francisco, CA',
			indeed: { country: 'usa' },
		},
	}),
	defineScenario({
		site: 'google',
		request: {
			query: 'software engineer jobs',
			google: {
				query: 'software engineer jobs',
			},
		},
	}),
	defineScenario({
		site: 'bayt',
		request: {
			query: 'software',
		},
	}),
	defineScenario({
		site: 'naukri',
		request: {
			query: 'software engineer',
			location: 'Bengaluru',
		},
	}),
	defineScenario({
		site: 'bdjobs',
		request: {
			query: 'software',
		},
	}),
] as const
