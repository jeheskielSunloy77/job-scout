import { describe, expect, it } from 'bun:test'

import { Country, Location } from '../src/core/model'

describe('Country', () => {
	it('parses aliases with fromString', () => {
		expect(Country.fromString('usa')).toBe(Country.USA)
		expect(Country.fromString('united kingdom')).toBe(Country.UK)
		expect(Country.fromString('indonesia')).toBe(Country.INDONESIA)
	})

	it('returns indeed domain value with api code', () => {
		expect(Country.USA.indeedDomainValue).toEqual(['www', 'US'])
		expect(Country.UK.indeedDomainValue).toEqual(['uk', 'GB'])
	})

	it('returns glassdoor domain value', () => {
		expect(Country.USA.glassdoorDomainValue).toBe('www.glassdoor.com')
		expect(Country.SWITZERLAND.glassdoorDomainValue).toBe('de.glassdoor.ch')
	})
})

describe('Location', () => {
	it('formats display location with enum country', () => {
		const location = new Location({
			city: 'Ambon',
			state: 'Maluku',
			country: Country.INDONESIA,
		})
		expect(location.displayLocation()).toBe('Ambon, Maluku, Indonesia')
	})

	it('formats display location with string country', () => {
		const location = new Location({ city: 'Dhaka', country: 'Bangladesh' })
		expect(location.displayLocation()).toBe('Dhaka, Bangladesh')
	})
})
