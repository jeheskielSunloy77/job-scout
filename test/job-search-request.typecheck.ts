import { createClient, scoutJobs } from '../src/index'

async function typecheckJobSearchRequest() {
	await scoutJobs({
		sites: ['indeed'],
		query: 'backend engineer',
		indeed: { country: 'usa' },
	})

	await scoutJobs({
		sites: ['google'],
		query: 'software engineer',
		google: { query: 'software engineer jobs near Yogyakarta, Indonesia' },
	}, {
		experimental: {
			experimentalSites: {
				google: true,
			},
		},
	})

	await scoutJobs({
		sites: ['indeed'],
		query: 'software engineer',
		filters: { postedWithinHours: 24 },
	})

	await scoutJobs({
		sites: ['linkedin'],
		query: 'software engineer',
		filters: { easyApply: true },
	})

	const dynamicSites = ['indeed', 'linkedin'] as const

	await scoutJobs({
		sites: dynamicSites,
		query: 'software engineer',
	})

	// @ts-expect-error sites is required.
	await scoutJobs({})

	await scoutJobs({
		// @ts-expect-error google is experimental and not enabled by default.
		sites: ['google'],
		query: 'software engineer',
	})

	await scoutJobs({
		// @ts-expect-error google is experimental and must be enabled via config.
		sites: ['google'],
		query: 'software engineer',
		google: { query: 'software engineer jobs near Austin, TX' },
	})

	await scoutJobs({
		sites: ['indeed'],
		query: 'software engineer',
		// @ts-expect-error Indeed supports only one filter group at a time.
		filters: { postedWithinHours: 24, easyApply: true },
	})

	await scoutJobs({
		sites: ['linkedin'],
		query: 'software engineer',
		// @ts-expect-error LinkedIn cannot combine postedWithinHours + easyApply=true.
		filters: { postedWithinHours: 24, easyApply: true },
	})

	// @ts-expect-error google.query is required when google is enabled and selected.
	await scoutJobs({
		sites: ['google'],
		query: 'software engineer',
	}, {
		experimental: {
			experimentalSites: {
				google: true,
			},
		},
	})

	const stableClient = createClient()
	await stableClient.scoutJobs({
		// @ts-expect-error google is experimental and not enabled for this client config.
		sites: ['google'],
		query: 'software engineer',
		google: { query: 'software engineer jobs near Austin, TX' },
	})

	const experimentalClient = createClient({
		experimental: {
			experimentalSites: {
				google: true,
			},
		},
	})
	await experimentalClient.scoutJobs({
		sites: ['google'],
		query: 'software engineer',
		google: { query: 'software engineer jobs near Austin, TX' },
	})
}

void typecheckJobSearchRequest
