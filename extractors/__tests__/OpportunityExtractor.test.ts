import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { OpportunityExtractor } from '../OpportunityExtractor'
import { Page, Locator } from 'playwright'

describe('OpportunityExtractor', () => {
	let extractor: OpportunityExtractor
	let mockPage: jest.Mocked<Page>
	let mockLocator: jest.Mocked<Locator>

	beforeEach(() => {
		extractor = new OpportunityExtractor()
		mockLocator = {
			first: jest.fn().mockReturnThis(),
			nth: jest.fn().mockReturnThis(),
			count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('test content'),
			getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('test-attr'),
			all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
		} as any

		mockPage = {
			locator: jest.fn().mockReturnValue(mockLocator),
			url: jest.fn().mockReturnValue('https://example.com/opportunity/123'),
			waitForLoadState: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
		} as any
	})

	describe('extract', () => {
		it('should extract basic opportunity data', async () => {
			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.textContent.mockResolvedValue('Test Title')
			mockLocator.count.mockResolvedValue(1)

			const result = await extractor.extract(mockPage)

			expect(result).toHaveProperty('id')
			expect(result).toHaveProperty('eventId')
			expect(result).toHaveProperty('title')
			expect(result).toHaveProperty('sourceUrl')
			expect(mockPage.waitForLoadState).toHaveBeenCalled()
		})

		it('should handle missing fields gracefully', async () => {
			mockLocator.count.mockResolvedValue(0)
			mockLocator.textContent.mockResolvedValue(null)

			const result = await extractor.extract(mockPage)

			expect(result.title).toBe('')
			expect(result.description).toBe('')
		})

		it('should extract dates', async () => {
			mockLocator.textContent
				.mockResolvedValueOnce('2024-01-15') // openDate
				.mockResolvedValueOnce('2024-02-15') // closeDate

			const result = await extractor.extract(mockPage)

			expect(result.openDate).toBeTruthy()
			expect(result.closeDate).toBeTruthy()
		})

		it('should extract agency information', async () => {
			mockLocator.textContent
				.mockResolvedValueOnce('Department of Transportation') // entity
				.mockResolvedValueOnce('DOT-001') // agencyNumber

			const result = await extractor.extract(mockPage)

			expect(result.entity).toBeTruthy()
			expect(result.agencyNumber).toBeTruthy()
		})

		it('should extract contact information', async () => {
			mockLocator.textContent
				.mockResolvedValueOnce('John Doe') // buyerName
				.mockResolvedValueOnce('john@example.com') // buyerEmail
				.mockResolvedValueOnce('555-1234') // buyerPhone

			const result = await extractor.extract(mockPage)

			expect(result.buyerName).toBeTruthy()
			expect(result.buyerEmail).toBeTruthy()
			expect(result.buyerPhone).toBeTruthy()
		})

		it('should generate ID from eventId and source URL', async () => {
			mockLocator.textContent.mockResolvedValue('EVENT-123')
			mockPage.url.mockReturnValue('https://example.com/opp/123')

			const result = await extractor.extract(mockPage)

			expect(result.id).toBeTruthy()
			expect(result.id).toContain('EVENT-123')
		})
	})

	describe('extractTable', () => {
		it('should extract table data', async () => {
			const mockTableLocator = {
				first: jest.fn().mockReturnThis(),
				locator: jest.fn().mockReturnValue(mockLocator),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			} as any

			mockPage.locator.mockReturnValue(mockTableLocator)
			mockLocator.count.mockResolvedValue(2) // 2 headers
			mockLocator.textContent
				.mockResolvedValueOnce('Header1')
				.mockResolvedValueOnce('Header2')
				.mockResolvedValueOnce('Value1')
				.mockResolvedValueOnce('Value2')

			const result = await extractor['extractTable'](mockPage, 'table')

			expect(Array.isArray(result)).toBe(true)
		})

		it('should return empty array if table not found', async () => {
			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.count.mockResolvedValue(0)

			const result = await extractor['extractTable'](mockPage, 'table')

			expect(result).toEqual([])
		})
	})
})

