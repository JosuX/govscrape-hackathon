import { Page, Locator } from 'playwright'
import { BaseExtractor } from '../base/BaseExtractor'
import type { SOURCE_DOCUMENT } from '../schemas/source.schema'

/**
 * DocumentExtractor
 * 
 * Extracts document/attachment metadata from detail pages.
 * 
 * This extractor handles all fields defined in SOURCE_DOCUMENT schema:
 * - id: Generated document ID
 * - fileName: Document file name
 * - downloadUrl: URL to download the document (will be replaced with local path after download)
 * - fileSize: File size in bytes (if available)
 * - contractId: Link to parent opportunity
 */
export class DocumentExtractor extends BaseExtractor<SOURCE_DOCUMENT[]> {
	private contractId: string

	constructor(contractId: string) {
		super()
		this.contractId = contractId
	}

	/**
	 * Extract document data from the page
	 * 
	 * TODO: Customize selectors based on your target website structure
	 * - Update CSS selectors to match your website's document links
	 * - Adjust extraction logic for different document presentation styles
	 * - Handle cases where documents are in tabs, modals, or separate sections
	 */
	public async extract(page: Page): Promise<SOURCE_DOCUMENT[]> {
		// Wait for page to load
		await page.waitForLoadState('networkidle')

		const documents: SOURCE_DOCUMENT[] = []

		// Try multiple selectors to find document links
		const documentSelectors = [
			'a[href*=".pdf"]',
			'a[href*=".doc"]',
			'a[href*=".docx"]',
			'a[href*=".xls"]',
			'a[href*=".xlsx"]',
			'.document-link',
			'.attachment-link',
			'[data-document]',
			'.file-download',
			'a[download]',
		]

		// Try to find documents container first
		const containerSelectors = [
			'.documents',
			'.attachments',
			'.files',
			'[data-documents]',
			'.document-list',
		]

		let documentLinks: Locator[] = []

		// First, try to find documents in a container
		for (const containerSelector of containerSelectors) {
			try {
				const container = page.locator(containerSelector)
				const count = await container.count()
				if (count > 0) {
					// Find all links within the container
					for (const docSelector of documentSelectors) {
						const links = container.locator(docSelector)
						const linkCount = await links.count()
						if (linkCount > 0) {
							documentLinks = await links.all()
							break
						}
					}
					if (documentLinks.length > 0) break
				}
			} catch {
				continue
			}
		}

		// If no container found, search entire page
		if (documentLinks.length === 0) {
			for (const docSelector of documentSelectors) {
				try {
					const links = page.locator(docSelector)
					const count = await links.count()
					if (count > 0) {
						documentLinks = await links.all()
						break
					}
				} catch {
					continue
				}
			}
		}

		// If still no documents found, try extracting from table format
		if (documentLinks.length === 0) {
			try {
				const documentTables = [
					'table.documents',
					'table.attachments',
					'table[data-documents]',
					'.documents table',
					'.attachments table',
				]

				for (const tableSelector of documentTables) {
					const table = page.locator(tableSelector).first()
					const tableCount = await table.count()
					if (tableCount > 0) {
						const tableData = await this.extractTable(page, tableSelector)
						
						// Convert table rows to document links
						for (const row of tableData) {
							// Look for file name and URL columns
							const fileName = row['file_name'] || row['name'] || row['document'] || row['file'] || ''
							const fileUrl = row['url'] || row['link'] || row['download'] || row['href'] || ''
							
							if (fileName || fileUrl) {
								// Find the actual link element if possible
								const url = fileUrl || fileName
								if (url) {
									const link = page.locator(`a[href*="${url}"], a:has-text("${fileName}")`).first()
									const linkCount = await link.count()
									if (linkCount > 0) {
										documentLinks.push(link)
									}
								}
							}
						}
						
						if (documentLinks.length > 0) break
					}
				}
			} catch (error) {
				// Ignore table extraction errors, continue with other methods
				console.warn('Error extracting documents from table:', error)
			}
		}

		// Extract data from each document link
		for (let i = 0; i < documentLinks.length; i++) {
			try {
				const link = documentLinks[i]
				
				// Get download URL
				const downloadUrl = await this.extractAttribute(link, 'href')
				if (!downloadUrl) continue

				// Resolve relative URLs
				const absoluteUrl = downloadUrl.startsWith('http')
					? downloadUrl
					: new URL(downloadUrl, page.url()).href

				// Get file name
				let fileName = await this.extractText(link)
				
				// If no text, try to extract from href
				if (!fileName || fileName.trim().length === 0) {
					fileName = absoluteUrl.split('/').pop() || `document-${i + 1}`
					// Remove query parameters
					fileName = fileName.split('?')[0]
				}

				// Clean up file name
				fileName = fileName.trim()
				if (!fileName) continue
				
				// Ensure file name has an extension - extract from URL if missing
				if (!fileName.match(/\.\w+$/)) {
					try {
						const urlPath = new URL(absoluteUrl).pathname
						const urlExtension = urlPath.match(/\.(\w+)(?:\?|$)/)
						if (urlExtension && urlExtension[1]) {
							fileName = `${fileName}.${urlExtension[1]}`
						}
					} catch {
						// If URL parsing fails, try simple regex match
						const urlMatch = absoluteUrl.match(/\.(\w+)(?:\?|$)/)
						if (urlMatch && urlMatch[1]) {
							fileName = `${fileName}.${urlMatch[1]}`
						}
					}
				}

				// Try to extract file size (if available in data attributes or nearby text)
				const fileSize = await this.extractFileSize(link)

				// Generate document ID
				const id = this.generateDocumentId(absoluteUrl, fileName)

				documents.push({
					id,
					fileName,
					downloadUrl: absoluteUrl,
					fileSize: fileSize || null,
					contractId: this.contractId,
				})
			} catch (error) {
				// Skip this document if extraction fails
				console.warn(`Failed to extract document ${i}:`, error)
				continue
			}
		}

		return documents
	}

	/**
	 * Extract text from a locator
	 */
	protected async extractText(locator: Locator): Promise<string | null> {
		try {
			const count = await locator.count()
			if (count === 0) return null

			const text = await locator.first().textContent()
			return text ? text.trim() : null
		} catch {
			return null
		}
	}

	/**
	 * Extract attribute from a locator
	 */
	protected async extractAttribute(
		locator: Locator,
		attribute: string
	): Promise<string | null> {
		try {
			const count = await locator.count()
			if (count === 0) return null

			const value = await locator.first().getAttribute(attribute)
			return value ? value.trim() : null
		} catch {
			return null
		}
	}

	/**
	 * Extract file size if available
	 * 
	 * Tries to find file size in:
	 * - data-file-size attribute
	 * - Nearby text (e.g., "Document.pdf (2.5 MB)")
	 * - Sibling elements
	 */
	private async extractFileSize(link: Locator): Promise<number | null> {
		// Try data attribute first
		const dataSize = await this.extractAttribute(link, 'data-file-size')
		if (dataSize) {
			const size = this.parseFileSize(dataSize)
			if (size !== null) return size
		}

		// Try to find size in parent or sibling elements
		try {
			const parent = link.locator('..')
			const parentText = await this.extractText(parent)
			if (parentText) {
				const size = this.extractSizeFromText(parentText)
				if (size !== null) return size
			}

			// Try next sibling
			const nextSibling = link.locator('+ *')
			const siblingText = await this.extractText(nextSibling)
			if (siblingText) {
				const size = this.extractSizeFromText(siblingText)
				if (size !== null) return size
			}
		} catch {
			// Ignore errors
		}

		return null
	}

	/**
	 * Parse file size string to bytes
	 * 
	 * Handles formats like:
	 * - "2.5 MB" -> 2621440
	 * - "1.2GB" -> 1288490188
	 * - "500 KB" -> 512000
	 * - "1024" -> 1024 (assumes bytes)
	 */
	private parseFileSize(sizeStr: string): number | null {
		const cleaned = sizeStr.trim().toUpperCase()
		
		// Match patterns like "2.5 MB", "1.2GB", "500 KB"
		const match = cleaned.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i)
		if (!match) return null

		const value = parseFloat(match[1])
		if (isNaN(value)) return null

		const unit = (match[2] || 'B').toUpperCase()
		const multipliers: Record<string, number> = {
			'B': 1,
			'KB': 1024,
			'MB': 1024 * 1024,
			'GB': 1024 * 1024 * 1024,
			'TB': 1024 * 1024 * 1024 * 1024,
		}

		return Math.round(value * (multipliers[unit] || 1))
	}

	/**
	 * Extract file size from text containing size information
	 */
	private extractSizeFromText(text: string): number | null {
		// Look for patterns like "(2.5 MB)", "Size: 1.2 GB", etc.
		const sizePatterns = [
			/\(([\d.]+\s*(?:B|KB|MB|GB|TB))\)/i,
			/Size:\s*([\d.]+\s*(?:B|KB|MB|GB|TB))/i,
			/([\d.]+\s*(?:B|KB|MB|GB|TB))/i,
		]

		for (const pattern of sizePatterns) {
			const match = text.match(pattern)
			if (match) {
				const size = this.parseFileSize(match[1])
				if (size !== null) return size
			}
		}

		return null
	}

	/**
	 * Extract data from a table
	 * 
	 * Extracts structured data from HTML tables. Useful when documents are listed in table format.
	 * Returns an array of objects where each object represents a row with column names as keys.
	 */
	protected async extractTable(
		page: Page,
		tableSelector: string
	): Promise<Record<string, string>[]> {
		try {
			const table = page.locator(tableSelector).first()
			const count = await table.count()
			if (count === 0) return []

			// Extract headers from <th> elements
			const headers: string[] = []
			const headerCells = table.locator('thead th, th, tr:first-child th, tr:first-child td')
			const headerCount = await headerCells.count()

			if (headerCount > 0) {
				for (let i = 0; i < headerCount; i++) {
					const headerText = await this.extractText(headerCells.nth(i))
					if (headerText) {
						headers.push(headerText.trim().toLowerCase().replace(/\s+/g, '_'))
					} else {
						headers.push(`column_${i + 1}`)
					}
				}
			}

			// If no headers found, try to infer from first row
			if (headers.length === 0) {
				const firstRow = table.locator('tr').first()
				const firstRowCells = firstRow.locator('td, th')
				const firstRowCount = await firstRowCells.count()
				for (let i = 0; i < firstRowCount; i++) {
					const cellText = await this.extractText(firstRowCells.nth(i))
					if (cellText && cellText.trim().length > 0) {
						headers.push(cellText.trim().toLowerCase().replace(/\s+/g, '_'))
					} else {
						headers.push(`column_${i + 1}`)
					}
				}
			}

			// Extract rows
			const rows: Record<string, string>[] = []
			const rowElements = table.locator('tbody tr, tr')
			const rowCount = await rowElements.count()

			// Start from row 1 if we used first row as headers, otherwise start from 0
			const startRow = headers.length > 0 && headerCount > 0 ? 1 : 0

			for (let i = startRow; i < rowCount; i++) {
				const row = rowElements.nth(i)
				const cells = row.locator('td, th')
				const cellCount = await cells.count()

				if (cellCount === 0) continue

				const rowData: Record<string, string> = {}

				for (let j = 0; j < cellCount; j++) {
					const cellText = await this.extractText(cells.nth(j))
					const header = headers[j] || `column_${j + 1}`
					rowData[header] = cellText ? cellText.trim() : ''
				}

				// Only add row if it has at least one non-empty value
				if (Object.values(rowData).some(val => val.length > 0)) {
					rows.push(rowData)
				}
			}

			return rows
		} catch (error) {
			console.warn(`Error extracting table with selector "${tableSelector}":`, error)
			return []
		}
	}

	/**
	 * Generate deterministic document ID
	 */
	private generateDocumentId(downloadUrl: string, fileName: string): string {
		// Use URL and filename to create unique ID
		const urlHash = downloadUrl.split('/').pop()?.split('?')[0] || ''
		const fileHash = fileName.replace(/[^a-zA-Z0-9]/g, '-')
		return `${this.contractId}-doc-${fileHash}-${urlHash.slice(-8)}`
			.replace(/--+/g, '-')
			.toLowerCase()
	}
}

