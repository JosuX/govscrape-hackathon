import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
	generateId,
	delay,
	cleanText,
	sanitizeFileName,
	parseFlexibleDate,
	parseMonetaryValue,
	deduplicateBy,
	retry,
	log,
} from '../helpers'

describe('helpers', () => {
	describe('generateId', () => {
		it('should generate deterministic ID from string', () => {
			const id1 = generateId('test-input')
			const id2 = generateId('test-input')
			expect(id1).toBe(id2)
			expect(id1).toHaveLength(16)
		})

		it('should generate different IDs for different inputs', () => {
			const id1 = generateId('input1')
			const id2 = generateId('input2')
			expect(id1).not.toBe(id2)
		})

		it('should add prefix when provided', () => {
			const id = generateId('test', 'contract')
			expect(id).toMatch(/^contract-[a-f0-9]{16}$/)
		})

		it('should not add prefix when not provided', () => {
			const id = generateId('test')
			expect(id).toMatch(/^[a-f0-9]{16}$/)
		})
	})

	describe('delay', () => {
		it('should delay execution for specified milliseconds', async () => {
			const start = Date.now()
			await delay(100)
			const end = Date.now()
			const elapsed = end - start
			expect(elapsed).toBeGreaterThanOrEqual(90) // Allow some margin
			expect(elapsed).toBeLessThan(200)
		})
	})

	describe('cleanText', () => {
		it('should return null for null input', () => {
			expect(cleanText(null)).toBeNull()
		})

		it('should return null for undefined input', () => {
			expect(cleanText(undefined)).toBeNull()
		})

		it('should return null for empty string', () => {
			expect(cleanText('')).toBeNull()
			expect(cleanText('   ')).toBeNull()
		})

		it('should trim whitespace', () => {
			expect(cleanText('  hello  ')).toBe('hello')
		})

		it('should replace multiple spaces with single space', () => {
			expect(cleanText('hello    world')).toBe('hello world')
		})

		it('should replace newlines with spaces', () => {
			expect(cleanText('hello\nworld')).toBe('hello world')
			expect(cleanText('hello\n\nworld')).toBe('hello world')
		})

		it('should handle mixed whitespace', () => {
			expect(cleanText('  hello   \n\n  world  ')).toBe('hello world')
		})
	})

	describe('sanitizeFileName', () => {
		it('should replace invalid characters with underscore', () => {
			expect(sanitizeFileName('file/name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file\\name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file:name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file*name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file?name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file"name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file<name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file>name.txt')).toBe('file_name.txt')
			expect(sanitizeFileName('file|name.txt')).toBe('file_name.txt')
		})

		it('should preserve file extension', () => {
			expect(sanitizeFileName('file.name.pdf')).toBe('file.name.pdf') // Dots in filename are preserved, only invalid chars replaced
			expect(sanitizeFileName('file/name.pdf')).toBe('file_name.pdf')
			expect(sanitizeFileName('file.name.docx')).toBe('file.name.docx')
		})

		it('should handle files without extension', () => {
			expect(sanitizeFileName('file/name')).toBe('file_name')
		})

		it('should replace spaces with underscores', () => {
			expect(sanitizeFileName('file name.txt')).toBe('file_name.txt')
		})

		it('should limit length', () => {
			const longName = 'a'.repeat(300) + '.txt'
			const sanitized = sanitizeFileName(longName)
			expect(sanitized.length).toBeLessThanOrEqual(204) // 200 + '.txt'
		})

		it('should remove trailing dots and underscores', () => {
			expect(sanitizeFileName('file___.txt')).toBe('file.txt')
			expect(sanitizeFileName('file...txt')).toBe('file.txt')
		})
	})

	describe('parseFlexibleDate', () => {
		it('should return null for null input', () => {
			expect(parseFlexibleDate(null)).toBeNull()
		})

		it('should return null for empty string', () => {
			expect(parseFlexibleDate('')).toBeNull()
			expect(parseFlexibleDate('   ')).toBeNull()
		})

		it('should parse ISO format', () => {
			const date = parseFlexibleDate('2024-01-15')
			expect(date).not.toBeNull()
			expect(date?.getFullYear()).toBe(2024)
			expect(date?.getMonth()).toBe(0) // January is 0
			expect(date?.getDate()).toBe(15)
		})

		it('should parse US format', () => {
			const date = parseFlexibleDate('01/15/2024')
			expect(date).not.toBeNull()
			expect(date?.getFullYear()).toBe(2024)
			expect(date?.getMonth()).toBe(0)
			expect(date?.getDate()).toBe(15)
		})

		it('should parse text format', () => {
			const date = parseFlexibleDate('Jan 15, 2024')
			expect(date).not.toBeNull()
			expect(date?.getFullYear()).toBe(2024)
		})

		it('should handle dates with time', () => {
			const date = parseFlexibleDate('Jan 15, 2024 @ 05:00 PM ET')
			expect(date).not.toBeNull()
		})

		it('should return null for invalid dates', () => {
			expect(parseFlexibleDate('invalid-date')).toBeNull()
			expect(parseFlexibleDate('99/99/9999')).toBeNull()
		})
	})

	describe('parseMonetaryValue', () => {
		it('should return null for null input', () => {
			expect(parseMonetaryValue(null)).toBeNull()
		})

		it('should parse dollar amounts with commas', () => {
			expect(parseMonetaryValue('$1,000.00')).toBe(1000)
			expect(parseMonetaryValue('$10,000')).toBe(10000)
		})

		it('should parse amounts with K suffix', () => {
			expect(parseMonetaryValue('$500K')).toBe(500000)
			expect(parseMonetaryValue('$1.5K')).toBe(1500)
		})

		it('should parse amounts with M suffix', () => {
			expect(parseMonetaryValue('$1M')).toBe(1000000)
			expect(parseMonetaryValue('$2.5M')).toBe(2500000)
		})

		it('should parse amounts with B suffix', () => {
			expect(parseMonetaryValue('$1B')).toBe(1000000000)
		})

		it('should handle ranges by taking first value', () => {
			expect(parseMonetaryValue('$1M - $5M')).toBe(1000000)
		})

		it('should remove currency symbols and commas', () => {
			// parseMonetaryValue rounds to integer, so 1234.56 becomes 1235
			expect(parseMonetaryValue('$1,234.56')).toBe(1235)
			expect(parseMonetaryValue('$1,000')).toBe(1000)
		})

		it('should return null for invalid input', () => {
			expect(parseMonetaryValue('invalid')).toBeNull()
			expect(parseMonetaryValue('abc')).toBeNull()
		})
	})

	describe('deduplicateBy', () => {
		it('should remove duplicates based on key function', () => {
			const items = [
				{ id: '1', name: 'A' },
				{ id: '2', name: 'B' },
				{ id: '1', name: 'A-duplicate' },
				{ id: '3', name: 'C' },
			]
			const result = deduplicateBy(items, item => item.id)
			expect(result).toHaveLength(3)
			expect(result[0].name).toBe('A') // First occurrence kept
		})

		it('should return empty array for empty input', () => {
			expect(deduplicateBy([], item => item)).toEqual([])
		})

		it('should return same array if no duplicates', () => {
			const items = [
				{ id: '1', name: 'A' },
				{ id: '2', name: 'B' },
			]
			const result = deduplicateBy(items, item => item.id)
			expect(result).toHaveLength(2)
		})
	})

	describe('retry', () => {
		it('should succeed on first attempt', async () => {
			const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success')
			const result = await retry(fn, 3, 100)
			expect(result).toBe('success')
			expect(fn).toHaveBeenCalledTimes(1)
		})

		it('should retry on failure and eventually succeed', async () => {
			const fn = jest.fn<() => Promise<string>>()
				.mockRejectedValueOnce(new Error('fail1'))
				.mockRejectedValueOnce(new Error('fail2'))
				.mockResolvedValue('success')
			
			const result = await retry(fn, 3, 10)
			expect(result).toBe('success')
			expect(fn).toHaveBeenCalledTimes(3)
		})

		it('should throw error after max retries', async () => {
			const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('always fails'))
			
			await expect(retry(fn, 2, 10)).rejects.toThrow('always fails')
			expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
		})

		it('should use exponential backoff', async () => {
			const fn = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('fail'))
			const delays: number[] = []
			
			// Mock setTimeout to track delays
			const originalSetTimeout = global.setTimeout
			global.setTimeout = jest.fn((callback: () => void, delay: number) => {
				delays.push(delay)
				return originalSetTimeout(callback, delay)
			}) as any
			
			try {
				await retry(fn, 2, 100)
			} catch {
				// Expected to fail
			}
			
			expect(delays[0]).toBe(100) // First retry
			expect(delays[1]).toBe(200) // Second retry (doubled)
			
			global.setTimeout = originalSetTimeout
		})
	})

	describe('log', () => {
		let consoleLogSpy: ReturnType<typeof jest.spyOn>
		let consoleWarnSpy: ReturnType<typeof jest.spyOn>
		let consoleErrorSpy: ReturnType<typeof jest.spyOn>

		beforeEach(() => {
			consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
			consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
			consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
		})

		afterEach(() => {
			consoleLogSpy.mockRestore()
			consoleWarnSpy.mockRestore()
			consoleErrorSpy.mockRestore()
		})

		it('should log info messages', () => {
			log('test', 'message', 'info')
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('[test]')
			)
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('[INFO]')
			)
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('message')
			)
		})

		it('should log warn messages', () => {
			log('test', 'warning', 'warn')
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('[WARN]')
			)
		})

		it('should log error messages', () => {
			log('test', 'error', 'error')
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			)
		})

		it('should default to info level', () => {
			log('test', 'message')
			expect(consoleLogSpy).toHaveBeenCalled()
		})

		it('should include timestamp', () => {
			log('test', 'message')
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
			)
		})
	})
})

