import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ContactExtractor } from '../ContactExtractor'
import { Page, Locator } from 'playwright'

describe('ContactExtractor', () => {
	let extractor: ContactExtractor
	let mockPage: jest.Mocked<Page>
	let mockLocator: jest.Mocked<Locator>

	beforeEach(() => {
		extractor = new ContactExtractor()
		mockLocator = {
			first: jest.fn().mockReturnThis(),
			nth: jest.fn().mockReturnThis(),
			count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('test content'),
			getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('test-attr'),
		} as any

		mockPage = {
			locator: jest.fn().mockReturnValue(mockLocator),
			waitForLoadState: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
		} as any
	})

	describe('extract', () => {
		it('should extract contact information', async () => {
			mockLocator.textContent
				.mockResolvedValueOnce('John Doe') // buyerName
				.mockResolvedValueOnce('john@example.com') // email
				.mockResolvedValueOnce('555-1234') // phone

			const result = await extractor.extract(mockPage)

			expect(result).toHaveProperty('buyerName')
			expect(result).toHaveProperty('buyerEmail')
			expect(result).toHaveProperty('buyerPhone')
		})

		it('should extract email from mailto links', async () => {
			// Mock extractFromMultipleSelectors to return email from mailto link
			// Flow: extractEmail -> extractFromMultipleSelectors -> context.locator(selector).first()
			// Then: extractText(locator) -> locator.first().textContent() (returns null)
			// Then: extractAttribute(locator, 'href') -> locator.first().getAttribute('href') (returns 'mailto:john@example.com')
			const mockEmailInnerLocator: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('mailto:john@example.com'),
			}

			const mockEmailLocator: any = {
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				first: jest.fn().mockReturnValue(mockEmailInnerLocator),
			}

			const mockEmailLinkParent: any = {
				first: jest.fn().mockReturnValue(mockEmailLocator),
			}

			// Mock page.locator - extractFromMultipleSelectors tries selectors in order
			const locatorSpy = jest.spyOn(mockPage, 'locator')
			locatorSpy.mockImplementation((selector: any) => {
				if (selector === 'a[href^="mailto:"]') {
					return mockEmailLinkParent
				}
				// For other selectors, return empty locator (count = 0)
				const emptyLocatorParent: any = {
					first: jest.fn().mockReturnValue({
						count: jest.fn<() => Promise<number>>().mockResolvedValue(0),
					}),
				}
				return emptyLocatorParent
			})

			const result = await extractor.extract(mockPage)

			expect(result.buyerEmail).toBeTruthy()
			expect(result.buyerEmail).toBe('john@example.com')
			
			locatorSpy.mockRestore()
		})

		it('should extract phone from tel links', async () => {
			// Mock extractFromMultipleSelectors to return phone from tel link
			// Flow: extractPhone -> extractFromMultipleSelectors -> context.locator(selector).first()
			// Then: extractText(locator) -> locator.first().textContent() (returns null)
			// Then: extractAttribute(locator, 'href') -> locator.first().getAttribute('href') (returns 'tel:+15551234')
			const mockPhoneInnerLocator: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('tel:+15551234'),
			}

			const mockPhoneLocator: any = {
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				first: jest.fn().mockReturnValue(mockPhoneInnerLocator),
			}

			const mockPhoneLinkParent: any = {
				first: jest.fn().mockReturnValue(mockPhoneLocator),
			}

			// Mock page.locator - extractFromMultipleSelectors tries selectors in order
			const locatorSpy = jest.spyOn(mockPage, 'locator')
			locatorSpy.mockImplementation((selector: any) => {
				if (selector === 'a[href^="tel:"]') {
					return mockPhoneLinkParent
				}
				// For other selectors, return empty locator (count = 0)
				const emptyLocatorParent: any = {
					first: jest.fn().mockReturnValue({
						count: jest.fn<() => Promise<number>>().mockResolvedValue(0),
					}),
				}
				return emptyLocatorParent
			})

			const result = await extractor.extract(mockPage)

			expect(result.buyerPhone).toBeTruthy()
			expect(result.buyerPhone).toContain('15551234')
			
			locatorSpy.mockRestore()
		})

		it('should handle missing contact information', async () => {
			mockLocator.count.mockResolvedValue(0)
			mockLocator.textContent.mockResolvedValue(null)

			const result = await extractor.extract(mockPage)

			expect(result.buyerName).toBe('')
			expect(result.buyerEmail).toBeNull()
			expect(result.buyerPhone).toBeNull()
		})

		it('should extract from contact section container', async () => {
			const mockContainer = {
				first: jest.fn().mockReturnThis(),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				locator: jest.fn().mockReturnValue(mockLocator),
			} as any

			mockPage.locator.mockReturnValue(mockContainer)
			mockLocator.textContent.mockResolvedValue('John Doe')

			const result = await extractor.extract(mockPage)

			expect(result.buyerName).toBeTruthy()
		})
	})

	describe('extractTable', () => {
		it('should extract contact info from table', async () => {
			const mockTableLocator = {
				first: jest.fn().mockReturnThis(),
				locator: jest.fn().mockReturnValue(mockLocator),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			} as any

			mockPage.locator.mockReturnValue(mockTableLocator)
			mockLocator.count.mockResolvedValue(2)
			mockLocator.textContent
				.mockResolvedValueOnce('name')
				.mockResolvedValueOnce('email')
				.mockResolvedValueOnce('John Doe')
				.mockResolvedValueOnce('john@example.com')

			const result = await extractor['extractTable'](mockPage, 'table')

			expect(Array.isArray(result)).toBe(true)
		})
	})
})

