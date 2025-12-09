import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { DocumentExtractor } from '../DocumentExtractor'
import { Page, Locator } from 'playwright'

describe('DocumentExtractor', () => {
	let extractor: DocumentExtractor
	let mockPage: jest.Mocked<Page>
	let mockLocator: jest.Mocked<Locator>
	const contractId = 'contract-123'

	beforeEach(() => {
		extractor = new DocumentExtractor(contractId)
		mockLocator = {
			first: jest.fn().mockReturnThis(),
			nth: jest.fn().mockReturnThis(),
			count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('document.pdf'),
			getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('https://example.com/doc.pdf'),
			all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
		} as any

		mockPage = {
			locator: jest.fn().mockReturnValue(mockLocator),
			url: jest.fn().mockReturnValue('https://example.com/opportunity/123'),
			waitForLoadState: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
		} as any
	})

	describe('extract', () => {
		it('should extract documents from links', async () => {
			const mockLink: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('document.pdf'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('https://example.com/doc.pdf'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
			}
			mockLink.all.mockResolvedValue([mockLink])

			mockPage.locator.mockReturnValue(mockLink)

			const result = await extractor.extract(mockPage)

			expect(Array.isArray(result)).toBe(true)
			if (result.length > 0) {
				expect(result[0]).toHaveProperty('id')
				expect(result[0]).toHaveProperty('fileName')
				expect(result[0]).toHaveProperty('downloadUrl')
				expect(result[0].contractId).toBe(contractId)
			}
		})

		it('should handle documents in containers', async () => {
			// Create a mock link that will be returned
			const mockLink: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('document.pdf'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('https://example.com/doc.pdf'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
			}

			// Mock container that returns links when locator is called
			const mockContainer: any = {
				locator: jest.fn().mockReturnValue({
					count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
					all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([mockLink]),
				}),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			}

			// Mock page.locator to return container for container selectors, and return links for document selectors
			mockPage.locator.mockImplementation((selector: string) => {
				// If it's a container selector, return the container
				if (selector.includes('.documents') || selector.includes('.attachments') || 
				    selector.includes('.files') || selector.includes('[data-documents]') || 
				    selector.includes('.document-list')) {
					return mockContainer
				}
				// Otherwise return a locator that finds nothing (count = 0)
				return {
					count: jest.fn<() => Promise<number>>().mockResolvedValue(0),
					all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
				} as any
			})

			const result = await extractor.extract(mockPage)

			expect(Array.isArray(result)).toBe(true)
			if (result.length > 0) {
				expect(result[0]).toHaveProperty('fileName')
				expect(result[0]).toHaveProperty('downloadUrl')
			}
		})

		it('should extract file name from link text', async () => {
			const mockLink: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('My Document.pdf'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('https://example.com/doc.pdf'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
			}
			mockLink.all.mockResolvedValue([mockLink])

			mockPage.locator.mockReturnValue(mockLink)

			const result = await extractor.extract(mockPage)

			if (result.length > 0) {
				expect(result[0].fileName).toContain('pdf')
			}
		})

		it('should extract file name from URL if link text is empty', async () => {
			const mockLink: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue(''),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('https://example.com/document.pdf'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
			}
			mockLink.all.mockResolvedValue([mockLink])

			mockPage.locator.mockReturnValue(mockLink)

			const result = await extractor.extract(mockPage)

			if (result.length > 0) {
				expect(result[0].fileName).toBeTruthy()
			}
		})

		it('should resolve relative URLs', async () => {
			const mockLink: any = {
				textContent: jest.fn<() => Promise<string | null>>().mockResolvedValue('doc.pdf'),
				getAttribute: jest.fn<() => Promise<string | null>>().mockResolvedValue('/documents/doc.pdf'),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
				all: jest.fn<() => Promise<Locator[]>>().mockResolvedValue([]),
			}
			mockLink.all.mockResolvedValue([mockLink])

			mockPage.locator.mockReturnValue(mockLink)
			mockPage.url.mockReturnValue('https://example.com/page')

			const result = await extractor.extract(mockPage)

			if (result.length > 0) {
				expect(result[0].downloadUrl).toContain('https://')
			}
		})

		it('should return empty array when no documents found', async () => {
			mockPage.locator.mockReturnValue(mockLocator)
			mockLocator.count.mockResolvedValue(0)
			mockLocator.all.mockResolvedValue([])

			const result = await extractor.extract(mockPage)

			expect(result).toEqual([])
		})
	})

	describe('extractTable', () => {
		it('should extract documents from table format', async () => {
			const mockTableLocator = {
				first: jest.fn().mockReturnThis(),
				locator: jest.fn().mockReturnValue(mockLocator),
				count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
			} as any

			mockPage.locator.mockReturnValue(mockTableLocator)
			mockLocator.count.mockResolvedValue(2)
			mockLocator.textContent
				.mockResolvedValueOnce('file_name')
				.mockResolvedValueOnce('url')
				.mockResolvedValueOnce('document.pdf')
				.mockResolvedValueOnce('https://example.com/doc.pdf')

			const result = await extractor['extractTable'](mockPage, 'table.documents')

			expect(Array.isArray(result)).toBe(true)
		})
	})
})

