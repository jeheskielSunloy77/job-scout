export interface LiveTestConfig {
	proxies: string[]
	userAgent?: string
	requestTimeoutMs: number
	resultsWantedPerSite: number
	countryIndeed: string
	logLevel: 'error' | 'warn' | 'info' | 'debug'
}

function parseProxies(raw: string | undefined): string[] {
	if (!raw) {
		return []
	}
	return raw
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)
}

export function getLiveTestConfig(): LiveTestConfig {
	const proxies = parseProxies(process.env.JOBSCOUT_TEST_PROXIES)

	const requestTimeoutMs = Number.parseInt(
		process.env.JOBSCOUT_TEST_TIMEOUT_MS ?? '20000',
		10,
	)
	const verbose = Number.parseInt(process.env.JOBSCOUT_TEST_VERBOSE ?? '1', 10)
	const logLevel =
		verbose <= 0
			? 'error'
			: verbose === 1
				? 'warn'
				: verbose === 2
					? 'info'
					: 'debug'

	const config: LiveTestConfig = {
		proxies,
		requestTimeoutMs: Number.isFinite(requestTimeoutMs)
			? requestTimeoutMs
			: 20000,
		resultsWantedPerSite: 1,
		countryIndeed: 'usa',
		logLevel,
	}

	if (process.env.JOBSCOUT_TEST_USER_AGENT) {
		config.userAgent = process.env.JOBSCOUT_TEST_USER_AGENT
	}

	return config
}
