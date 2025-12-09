import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
	parseArgs,
	getDateRange,
	formatDate,
	parseDate,
	getYesterday,
	getToday,
} from '../cli'

describe('cli', () => {
	const originalArgv = process.argv

	beforeEach(() => {
		process.argv = ['node', 'cli.js']
	})

	afterEach(() => {
		process.argv = originalArgv
	})

	describe('parseArgs', () => {
		it('should return default values when no args', () => {
			process.argv = ['node', 'cli.js']
			const result = parseArgs()
			expect(result.isToday).toBe(false)
			expect(result.dateRange).toBeNull()
		})

		it('should detect --today flag', () => {
			process.argv = ['node', 'cli.js', '--today']
			const result = parseArgs()
			expect(result.isToday).toBe(true)
		})

		it('should parse --date-range flag', () => {
			process.argv = ['node', 'cli.js', '--date-range=2024-01-01,2024-01-31']
			const result = parseArgs()
			expect(result.dateRange).toBe('2024-01-01,2024-01-31')
		})

		it('should throw error for invalid date range format', () => {
			process.argv = ['node', 'cli.js', '--date-range=invalid']
			expect(() => parseArgs()).toThrow('Invalid date range format')
		})

		it('should handle both flags', () => {
			process.argv = ['node', 'cli.js', '--today', '--date-range=2024-01-01,2024-01-31']
			const result = parseArgs()
			expect(result.isToday).toBe(true)
			expect(result.dateRange).toBe('2024-01-01,2024-01-31')
		})
	})

	describe('formatDate', () => {
		it('should format date as yyyy-MM-dd', () => {
			const date = new Date('2024-01-15T12:00:00Z')
			expect(formatDate(date)).toBe('2024-01-15')
		})

		it('should pad month and day with zeros', () => {
			const date = new Date('2024-01-05T12:00:00Z')
			expect(formatDate(date)).toBe('2024-01-05')
		})

		it('should use UTC dates', () => {
			const date = new Date('2024-12-31T23:00:00Z')
			expect(formatDate(date)).toBe('2024-12-31')
		})
	})

	describe('parseDate', () => {
		it('should parse valid date string', () => {
			const date = parseDate('2024-01-15')
			expect(date).not.toBeNull()
			expect(date?.getUTCFullYear()).toBe(2024)
			expect(date?.getUTCMonth()).toBe(0) // January is 0
			expect(date?.getUTCDate()).toBe(15)
		})

		it('should return null for invalid format', () => {
			expect(parseDate('invalid')).toBeNull()
			expect(parseDate('01/15/2024')).toBeNull()
		})

		it('should return null for invalid dates', () => {
			expect(parseDate('2024-13-01')).toBeNull() // Invalid month
			expect(parseDate('2024-02-30')).toBeNull() // Invalid day
		})

		it('should use UTC dates', () => {
			const date = parseDate('2024-01-15')
			expect(date?.getUTCHours()).toBe(0)
			expect(date?.getUTCMinutes()).toBe(0)
		})
	})

	describe('getYesterday', () => {
		it('should return yesterday date', () => {
			const yesterday = getYesterday()
			const today = new Date()
			today.setUTCHours(0, 0, 0, 0)
			const expected = new Date(today)
			expected.setUTCDate(expected.getUTCDate() - 1)
			
			expect(yesterday.getTime()).toBe(expected.getTime())
		})

		it('should set time to start of day', () => {
			const yesterday = getYesterday()
			expect(yesterday.getUTCHours()).toBe(0)
			expect(yesterday.getUTCMinutes()).toBe(0)
			expect(yesterday.getUTCSeconds()).toBe(0)
		})
	})

	describe('getToday', () => {
		it('should return today date', () => {
			const today = getToday()
			const expected = new Date()
			expected.setUTCHours(0, 0, 0, 0)
			
			expect(today.getUTCFullYear()).toBe(expected.getUTCFullYear())
			expect(today.getUTCMonth()).toBe(expected.getUTCMonth())
			expect(today.getUTCDate()).toBe(expected.getUTCDate())
		})

		it('should set time to start of day', () => {
			const today = getToday()
			expect(today.getUTCHours()).toBe(0)
			expect(today.getUTCMinutes()).toBe(0)
			expect(today.getUTCSeconds()).toBe(0)
		})
	})

	describe('getDateRange', () => {
		it('should return yesterday range by default', () => {
			process.argv = ['node', 'cli.js']
			const range = getDateRange()
			const yesterday = getYesterday()
			
			expect(range.from.getTime()).toBe(yesterday.getTime())
			expect(range.to.getTime()).toBe(yesterday.getTime())
		})

		it('should return today range when --today flag is set', () => {
			process.argv = ['node', 'cli.js', '--today']
			const range = getDateRange()
			const today = getToday()
			
			expect(range.from.getTime()).toBe(today.getTime())
			expect(range.to.getTime()).toBe(today.getTime())
		})

		it('should parse custom date range', () => {
			process.argv = ['node', 'cli.js', '--date-range=2024-01-01,2024-01-31']
			const range = getDateRange()
			
			expect(range.from.getUTCFullYear()).toBe(2024)
			expect(range.from.getUTCMonth()).toBe(0)
			expect(range.from.getUTCDate()).toBe(1)
			
			expect(range.to.getUTCFullYear()).toBe(2024)
			expect(range.to.getUTCMonth()).toBe(0)
			expect(range.to.getUTCDate()).toBe(31)
		})

		it('should throw error for invalid date range', () => {
			process.argv = ['node', 'cli.js', '--date-range=2024-01-31,2024-01-01']
			expect(() => getDateRange()).toThrow('Start date must be before end date')
		})
	})
})

