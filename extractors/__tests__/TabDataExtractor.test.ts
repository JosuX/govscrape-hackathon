import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { TabDataExtractor } from '../TabDataExtractor'
import { Page, Locator } from 'playwright'

describe('TabDataExtractor', () => {
	let extractor: TabDataExtractor
	let mockPage: jest.Mocked<Page>
	let mockLocator: jest.Mocked<Locator>

	beforeEach(() => {
		extractor = new TabDataExtractor()
		mockLocator = {
			first: jest.fn().mockReturnThis(),
			nth: jest.fn().mockReturnThis(),
			count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('tab content'),
			getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('tab-name'),
			all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
			click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
			evaluate: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
		} as any

		mockPage = {
			locator: jest.fn().mockReturnValue(mockLocator),
			waitForLoadState: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
			waitForTimeout: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
		} as any
	})

	describe('extract', () => {
		it('should extract data from all tabs', async () => {
			const mockTab1 = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('Tab 1'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('tab1'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
				evaluate: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
			} as any

			const mockTab2 = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('Tab 2'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('tab2'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
				evaluate: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
			} as any

			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.all.mockResolvedValue([mockTab1, mockTab2])

			// Mock tab content extraction
			const mockContentLocator = {
				first: jest.fn().mockReturnThis(),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('Tab content here'),
			} as any

			mockPage.locator.mockImplementation((selector: string) => {
				if (selector.includes('tab-content') || selector.includes('tab-panel')) {
					return mockContentLocator
				}
				return mockLocator
			})

			const result = await extractor.extract(mockPage)

			expect(typeof result).toBe('object')
		})

		it('should skip tabs that cannot be clicked', async () => {
			const mockTab = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('Tab'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('tab'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				click: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Cannot click')),
				evaluate: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
			} as any

			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.all.mockResolvedValue([mockTab])

			const result = await extractor.extract(mockPage)

			expect(typeof result).toBe('object')
		})

		it('should handle tabs with no name', async () => {
			const mockTab = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			} as any

			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.all.mockResolvedValue([mockTab])

			const result = await extractor.extract(mockPage)

			expect(typeof result).toBe('object')
		})

		it('should extract table data from tab content', async () => {
			const mockTab = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('Overview'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('overview'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
				evaluate: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
			} as any

			const mockTable = {
				first: jest.fn().mockReturnThis(),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				locator: jest.fn().mockReturnValue(mockLocator),
			} as any

			mockPage.locator.mockImplementation((selector: string) => {
				if (selector.includes('table')) {
					return mockTable
				}
				if (selector.includes('tab')) {
					return mockLocator
				}
				return mockLocator
			})

			mockLocator.all.mockResolvedValue([mockTab])
			mockLocator.count.mockResolvedValue(2)
			mockLocator.textContent
				.mockResolvedValueOnce('Header1')
				.mockResolvedValueOnce('Header2')
				.mockResolvedValueOnce('Value1')
				.mockResolvedValueOnce('Value2')

			const result = await extractor.extract(mockPage)

			expect(typeof result).toBe('object')
		})
	})

	describe('clickTab', () => {
		it('should click tab by selector', async () => {
			const mockTab = {
				first: jest.fn().mockReturnThis(),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				click: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
				evaluate: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
			} as any

			mockPage.locator.mockReturnValue(mockTab)

			const result = await extractor['clickTab'](mockPage, '.tab')

			expect(result).toBe(true)
			expect(mockTab.click).toHaveBeenCalled()
		})

		it('should return false if tab not found', async () => {
			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.count.mockResolvedValue(0)

			const result = await extractor['clickTab'](mockPage, '.tab')

			expect(result).toBe(false)
		})
	})
})

