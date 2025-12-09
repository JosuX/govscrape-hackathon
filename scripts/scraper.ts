/**
 * SCRAPER ENTRY POINT
 * 
 * This is the main entry point for your scraper.
 * Run this script to scrape data from your target website.
 * 
 * Usage:
 * - npm run scraper (scrapes yesterday)
 * - npm run scraper --today (scrapes today)
 * - npm run scraper --date-range=2024-01-01,2024-01-31
 * 
 * The scraper will:
 * 1. Parse CLI arguments for date range
 * 2. Initialize browser and session
 * 3. Fetch paginated listings
 * 4. Process each opportunity (extract details, download documents)
 * 5. Save data incrementally in batches
 * 6. Output session directory location
 */

import { chromium, Browser, Page, Locator } from 'playwright'
import { BaseScraper, ScraperConfig } from '../base/BaseScraper'
import { getDateRange } from '../utils/cli'
import { 
	createSessionDirectory, 
	saveBatchToFile, 
	generateSessionName,
	downloadFileLocally 
} from '../utils/storage'
import { log, parseFlexibleDate } from '../utils/helpers'
import { SOURCE_TO_INTAKE, type SOURCE_OPPORTUNITY, type SOURCE_DOCUMENT } from '../schemas/source.schema'
import { OpportunityExtractor, DocumentExtractor, ContactExtractor } from '../extractors'

/**
 * Listing interface for paginated opportunity listings
 */
interface Listing {
	id: string
	title: string
	link: string
	pageNumber: number
	index: number
}

/**
 * BatchItem interface matching SOURCE_TO_INTAKE items structure
 */
interface BatchItem {
	opportunity: SOURCE_OPPORTUNITY
	documents: SOURCE_DOCUMENT[]
}

/**
 * Source enum for supported websites
 */
export enum Source {
	CHEROKEE = 'cherokee',
}

/**
 * Website configuration interface
 */
interface WebsiteConfig {
	baseUrl: string
	searchUrl: string
	listingSelector: string
	titleSelector: string
	linkSelector: string
	idSelector: string
	requiresAuth: boolean
}

/**
 * YourStateScraper
 * 
 * Concrete implementation of BaseScraper for Cherokee Bids website.
 */
class YourStateScraper extends BaseScraper {
	private oppExtractor: OpportunityExtractor
	private contactExtractor: ContactExtractor
	private websiteConfig: WebsiteConfig

	constructor(config: ScraperConfig) {
		super(config)
		this.oppExtractor = new OpportunityExtractor()
		this.contactExtractor = new ContactExtractor()
		
		// Configure website-specific settings
		this.websiteConfig = this.getWebsiteConfig()
	}

	/**
	 * Get website configuration for Cherokee Bids
	 */
	private getWebsiteConfig(): WebsiteConfig {
		return {
			baseUrl: 'https://www.cherokeebids.org',
			searchUrl: 'https://www.cherokeebids.org/WebsiteAdmin/Procurement',
			listingSelector: 'table tbody tr, .table tbody tr, #procurementTable tbody tr, table.procurement-table tbody tr',
			titleSelector: 'td:nth-child(2), .title, a',
			linkSelector: 'td:nth-child(2) a, td a[href*="Procurement"], td a[href*="procurement"]',
			idSelector: 'td:first-child, td:nth-child(1)',
			requiresAuth: false,
		}
	}

	/**
	 * Fetch paginated listings from the source
	 * 
	 * Navigates to search/listing page, handles pagination, and extracts basic listing data.
	 */
	protected async fetchListings(
		page: Page,
		pageNumber: number,
		pageSize: number
	): Promise<{ listings: Listing[]; shouldStopPagination: boolean }> {
		try {
			// Build URL for Cherokee Bids pagination
			// Cherokee Bids uses /Index/Size/{pageSize}/Page/{pageNumber} format
			let url = this.websiteConfig.searchUrl
			
			// Check if URL already has /Index/ pattern
			if (url.includes('/Index/')) {
				// Replace existing pagination in URL
				url = url.replace(/\/Index\/Size\/\d+\/Page\/\d+/, `/Index/Size/${pageSize}/Page/${pageNumber}`)
				if (!url.includes('/Index/')) {
					// If replacement didn't work, append
					url = `${url}/Index/Size/${pageSize}/Page/${pageNumber}`
				}
			} else {
				// Add pagination path
				url = `${url}/Index/Size/${pageSize}/Page/${pageNumber}`
			}
			
			// Add sorting/filtering query parameters (sorted by opendate descending)
			const queryParams = new URLSearchParams()
			queryParams.set('field', 'opendate')
			queryParams.set('isDesc', 'desc')
			queryParams.set('switchSort', 'True')
			
			// Append query parameters
			const separator = url.includes('?') ? '&' : '?'
			url = `${url}${separator}${queryParams.toString()}`
			
			log('scraper', `Fetching page ${pageNumber} from ${url}`, 'info')
			
			// Navigate to search/listing page
			await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
			await this.delay(1000) // Be polite
			
			// Wait for table to load - try multiple selectors for Cherokee Bids
			const tableSelectors = [
				'table tbody tr',
				'.table tbody tr',
				'#procurementTable tbody tr',
				'table.procurement-table tbody tr',
				'table tr',
			]
			
			let listingElements: Locator[] = []
			for (const selector of tableSelectors) {
				try {
					await page.waitForSelector(selector, { timeout: 5000 })
					listingElements = await page.locator(selector).all()
					if (listingElements.length > 0) {
						log('scraper', `Found table with selector: ${selector}`, 'info')
						break
					}
				} catch {
					continue
				}
			}
			
			// If no table rows found, try the configured selector
			if (listingElements.length === 0) {
			try {
					await page.waitForSelector(this.websiteConfig.listingSelector, { timeout: 5000 })
					listingElements = await page.locator(this.websiteConfig.listingSelector).all()
			} catch {
					log('scraper', 'Listing selector not found, trying alternative selectors', 'warn')
				}
			}
			
			// Filter out header row if present (check if first row looks like header)
			if (listingElements.length > 0) {
				const firstRow = listingElements[0]
				const firstRowText = await firstRow.textContent().catch(() => '')
				// If first row looks like a header (contains "Id", "Title", etc.), skip it
				if (firstRowText && (firstRowText.includes('Id') || firstRowText.includes('Title') || firstRowText.includes('Description') || firstRowText.includes('OpenDate'))) {
					listingElements = listingElements.slice(1)
					log('scraper', 'Skipped header row', 'info')
				}
			}
			
			if (listingElements.length === 0) {
				log('scraper', 'No listings found on page', 'warn')
				return { listings: [], shouldStopPagination: false }
			}
			
			log('scraper', `Found ${listingElements.length} listings on page ${pageNumber}`, 'info')
			
			// Extract data from each listing
			const listings: Listing[] = []
			let shouldStopPagination = false // Flag to stop if we've passed the date range
			
			for (let i = 0; i < listingElements.length; i++) {
				try {
					const element = listingElements[i]
					
					// For table rows, extract from cells
					// Try multiple approaches to get ID
					let id: string | null = null
					const idCell = element.locator('td:first-child, td:nth-child(1)').first()
					const idText = await idCell.textContent().catch(() => null)
					if (idText && idText.trim()) {
						id = idText.trim()
					} else {
						id = await element.getAttribute('data-id').catch(() => null)
						if (!id) {
							id = `listing-${pageNumber}-${i + 1}`
						}
					}

					// Extract title from second column or link text
					let title: string | null = null
					const titleCell = element.locator('td:nth-child(2)').first()
					title = await titleCell.textContent().catch(() => null)
					
					// If no title in cell, try link text
					if (!title || !title.trim()) {
						const titleLink = element.locator('td:nth-child(2) a, td a').first()
						title = await titleLink.textContent().catch(() => null)
					}
					
					if (!title || !title.trim()) {
						title = 'Untitled Opportunity'
					}

					// Extract link - try multiple selectors
					let link: string | null = null
					const linkSelectors = [
						'td:nth-child(2) a',
						'td a[href*="Procurement"]',
						'td a[href*="procurement"]',
						'td a',
						'a[href]',
					]
					
					for (const linkSelector of linkSelectors) {
						try {
							const linkElement = element.locator(linkSelector).first()
							const linkCount = await linkElement.count()
							if (linkCount > 0) {
								link = await linkElement.getAttribute('href').catch(() => null)
								if (link) break
							}
						} catch {
						continue
					}
					}
					
					// Extract date from table (OpenDate column)
					// Cherokee Bids table structure: Id | Title | Description | OpenDate | CloseDate | Status
					// Note: There might be a checkbox column, so we check multiple columns
					// OpenDate format: MM/DD/YYYY (e.g., "12/08/2025")
					let openDateStr: string | null = null
					
					// Try all columns to find the date (table might have checkbox column)
					// Check columns 3-6 (Description, OpenDate, CloseDate, Status)
					const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{1,2}-\d{1,2}$|^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/
					
					for (let colNum = 3; colNum <= 6; colNum++) {
						try {
							const cell = element.locator(`td:nth-child(${colNum})`).first()
							const cellText = await cell.textContent().catch(() => null)
							if (cellText && cellText.trim()) {
								const trimmed = cellText.trim()
								// Check if it looks like a date
								if (datePattern.test(trimmed)) {
									openDateStr = trimmed
									break // Found date, stop searching
								}
							}
						} catch {
							continue
						}
					}
					
					// If still not found, try alternative selectors
					if (!openDateStr) {
						const fallbackSelectors = [
							'[data-opendate]',
							'.open-date',
							'[data-date]',
						]
						
						for (const dateSelector of fallbackSelectors) {
							try {
								const dateCell = element.locator(dateSelector).first()
								const dateText = await dateCell.textContent().catch(() => null)
								if (dateText && dateText.trim()) {
									const trimmed = dateText.trim()
									if (datePattern.test(trimmed)) {
										openDateStr = trimmed
										break
									}
								}
							} catch {
								continue
							}
						}
					}
					
					// Filter by date range if date is available
					let withinDateRange = true
					if (this.config.dateRange) {
						if (openDateStr) {
							const listingDate = parseFlexibleDate(openDateStr)
							if (listingDate) {
								const fromDate = new Date(this.config.dateRange.from)
								const toDate = new Date(this.config.dateRange.to)
								// Set time to start/end of day for comparison
								fromDate.setHours(0, 0, 0, 0)
								toDate.setHours(23, 59, 59, 999)
								
								withinDateRange = listingDate >= fromDate && listingDate <= toDate
								
								// Since results are sorted descending by opendate, if we encounter
								// a listing that's before our date range, we can stop pagination
								// All subsequent listings will also be before the date range
								if (listingDate < fromDate) {
									shouldStopPagination = true
									log('scraper', `Stopping pagination: found listing ${id} with date ${openDateStr} (${listingDate.toISOString().split('T')[0]}) before date range ${fromDate.toISOString().split('T')[0]}`, 'info')
									break // Stop processing this page, we've gone past the date range
								}
							} else {
								// Date string found but couldn't parse - skip this listing, continue to next
								continue
							}
						} else {
							// No date found - skip this listing but continue to next page (might find dates on next page)
							continue
						}
					}
					
					// Build full URL if relative
					const fullUrl = link 
						? (link.startsWith('http') ? link : new URL(link, this.websiteConfig.baseUrl).href)
						: null
					
					// Only add if we have at least an ID and title, and it's within date range
					if (id && title && (fullUrl || id !== `listing-${pageNumber}-${i + 1}`) && withinDateRange) {
						listings.push({
							id: id.trim(),
							title: title.trim(),
							link: fullUrl || `${this.websiteConfig.searchUrl}?id=${id}`,
							pageNumber,
							index: i + 1,
						})
					}
					
					// If we should stop pagination, break out of the loop
					if (shouldStopPagination) {
						break
					}
				} catch (error) {
					log('scraper', `Error extracting listing ${i + 1}: ${error}`, 'warn')
					continue
				}
			}
			
			return { listings, shouldStopPagination }
		} catch (error) {
			log('scraper', `Error fetching listings: ${error}`, 'error')
			return { listings: [], shouldStopPagination: false }
		}
	}

	/**
	 * Process a single opportunity
	 * 
	 * Navigates to detail page, extracts data using extractors, downloads documents,
	 * and returns structured data matching SOURCE_OPPORTUNITY schema.
	 */
	protected async processOpportunity(
		browser: Browser,
		listing: Listing
	): Promise<BatchItem> {
		const detailPage = await browser.newPage()
		
		try {
			log('scraper', `Processing opportunity: ${listing.id} - ${listing.title}`, 'info')
			
			// Navigate to detail page
			await detailPage.goto(listing.link, { waitUntil: 'networkidle', timeout: 30000 })
			await this.delay(1000) // Be polite

			// Extract opportunity data using OpportunityExtractor
			const opportunity = await this.oppExtractor.extract(detailPage)
			
			// Try to extract contact info if not already in opportunity
			if (!opportunity.buyerName || !opportunity.buyerEmail) {
				try {
					const contactData = await this.contactExtractor.extract(detailPage)
					if (contactData.buyerName && !opportunity.buyerName) {
						opportunity.buyerName = contactData.buyerName
					}
					if (contactData.buyerEmail && !opportunity.buyerEmail) {
						opportunity.buyerEmail = contactData.buyerEmail
					}
					if (contactData.buyerPhone && !opportunity.buyerPhone) {
						opportunity.buyerPhone = contactData.buyerPhone
					}
				} catch (error) {
					log('scraper', `Error extracting contact info: ${error}`, 'warn')
				}
			}
			
			// Extract documents using DocumentExtractor
			// DocumentExtractor will search the entire page, including tab content
			const docExtractor = new DocumentExtractor(opportunity.id)
			let documents = await docExtractor.extract(detailPage)
			
			// If no documents found, try clicking Documents tab if it exists
			if (documents.length === 0) {
				try {
					const documentsTab = detailPage.locator('.tab, .nav-tab, [role="tab"], .tab-button').filter({ hasText: /document|attachment|file/i })
					const tabCount = await documentsTab.count()
					if (tabCount > 0) {
						log('scraper', 'No documents found on main page, checking Documents tab...', 'info')
						await documentsTab.first().click()
						await this.delay(500) // Wait for tab content to load
						documents = await docExtractor.extract(detailPage)
					}
				} catch (error) {
					log('scraper', `Error extracting documents from tab: ${error}`, 'warn')
				}
			}
			
			// Download documents (preserve original URL, download is for local backup)
			for (const doc of documents) {
				try {
					log('scraper', `Downloading document: ${doc.fileName}`, 'info')
					// Download file locally for backup, but keep original URL in downloadUrl
					await downloadFileLocally(
						doc.downloadUrl,
						opportunity.id,
						doc.fileName
					)
					// Note: downloadUrl remains the original website URL, not the local path
				} catch (error) {
					log('scraper', `Error downloading document ${doc.fileName}: ${error}`, 'warn')
					// Continue even if download fails - original URL is still preserved
				}
			}
			
			// Return structured data matching SOURCE_TO_INTAKE schema
			return {
				opportunity,
				documents,
			}
		} catch (error) {
			log('scraper', `Error processing opportunity ${listing.id}: ${error}`, 'error')
			throw error
		} finally {
			await detailPage.close()
		}
	}

	/**
	 * Save batch data to file
	 * 
	 * Creates output object matching SOURCE_TO_INTAKE schema, validates it,
	 * and saves to batch file using saveBatchToFile utility.
	 */
	protected async saveBatch(items: BatchItem[]): Promise<void> {
		if (items.length === 0) {
			log('scraper', 'No items to save in batch', 'warn')
			return
		}
		
		const output = {
			metadata: {
				scrapedAt: new Date().toISOString(),
				source: this.config.source,
				sourceUrl: this.websiteConfig.baseUrl,
				dateRange: {
					from: this.config.dateRange.from.toISOString(),
					to: this.config.dateRange.to.toISOString(),
				},
				totalItems: items.length,
			},
			items: items,
		}
		
		// Validate against schema
		try {
			SOURCE_TO_INTAKE.parse(output)
		} catch (error) {
			log('scraper', `Schema validation error: ${error}`, 'error')
			throw error
		}
		
		await saveBatchToFile(output, this.sessionDirName, this.batchNum)
		log('scraper', `Saved batch ${this.batchNum} with ${items.length} items`, 'info')
		this.batchNum++
	}

	/**
	 * Launch browser
	 * 
	 * Launches Playwright Chromium browser with appropriate settings for scraping.
	 */
	protected async launchBrowser(): Promise<Browser> {
		log('scraper', 'Launching browser...', 'info')
		
		const browser = await chromium.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-accelerated-2d-canvas',
				'--disable-gpu',
			],
		})
		
		log('scraper', 'Browser launched successfully', 'info')
		return browser
	}

	/**
	 * Create session directory
	 * 
	 * Generates unique session directory name and creates it in the file system.
	 */
	protected async createSessionDirectory(): Promise<void> {
		const sessionName = generateSessionName(
			this.config.source,
			this.config.dateRange
		)
		
		this.sessionDirName = await createSessionDirectory(sessionName, 'source')
		log('scraper', `Session directory created: ${this.sessionDirName}`, 'info')
	}

	/**
	 * Main execution method - orchestrates the entire scraping process
	 */
	public async run(): Promise<{ sessionDir: string; itemsCount: number }> {
		try {
			// Launch browser
			this.browser = await this.launchBrowser()
			
			// Create session directory
			await this.createSessionDirectory()

			// Create main page for listings
			const mainPage = await this.browser.newPage()
			
			try {
				const allItems: BatchItem[] = []
				let hasMorePages = true
				this.currentPage = 1

				// Pagination loop
				while (hasMorePages && this.currentPage <= (this.config.maxPages || 10)) {
					log('scraper', `Processing page ${this.currentPage}...`, 'info')

					// Fetch listings for current page
					const result = await this.fetchListings(
						mainPage,
						this.currentPage,
						this.config.batchSize || 50
					)
					
					const listings = result.listings || []
					const shouldStopPagination = result.shouldStopPagination || false

					if (listings.length === 0) {
						log('scraper', 'No more listings found on this page', 'info')
						// If we should stop pagination (past date range) or no listings, stop
						if (shouldStopPagination) {
							log('scraper', 'Stopping pagination: reached listings past date range', 'info')
							hasMorePages = false
							break
						}
						// If no listings but not past date range, continue to next page
						// (might be listings without dates that we skipped)
					}

					// Process each opportunity
					const batchItems: BatchItem[] = []
					for (const listing of listings) {
						try {
							const item = await this.processOpportunity(this.browser!, listing)
							batchItems.push(item)
							this.totalProcessed++
							
							// Be polite - delay between opportunities
							await this.delay(1500)
						} catch (error) {
							log('scraper', `Failed to process opportunity ${listing.id}: ${error}`, 'error')
							continue
						}
					}

					// Save batch
					if (batchItems.length > 0) {
						await this.saveBatch(batchItems)
						allItems.push(...batchItems)
					}

					// Check if we should stop pagination (found listings before date range)
					if (shouldStopPagination) {
						log('scraper', 'Stopping pagination: reached listings before date range', 'info')
						hasMorePages = false
						break
					}

					// Check if there are more pages (if we got fewer listings than page size)
					if (listings.length < (this.config.batchSize || 50)) {
						hasMorePages = false
					}

					this.currentPage++
					
					// Be polite - delay between pages
					await this.delay(2000)
				}

				log('scraper', `Scraping complete! Processed ${this.totalProcessed} items`, 'info')

				return {
					sessionDir: this.sessionDirName,
					itemsCount: this.totalProcessed,
				}
			} finally {
				await mainPage.close()
			}
		} catch (error) {
			log('scraper', `Fatal error in run(): ${error}`, 'error')
			throw error
		} finally {
			// Clean up browser
			if (this.browser) {
				await this.browser.close()
				log('scraper', 'Browser closed', 'info')
			}
		}
	}
}

/**
 * Main execution
 */
async function main() {
	try {
		// Parse CLI arguments to get date range
		const dateRange = getDateRange()
		log('scraper', `Date range: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()}`, 'info')

		// Create scraper config
		const config: ScraperConfig = {
			source: Source.CHEROKEE,
			dateRange: dateRange,
			batchSize: 50, // Number of items per page
			maxPages: 10, // Maximum pages to scrape (for testing)
		}

		log('scraper', 'Starting scraper...', 'info')
		log('scraper', `Date range: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()}`, 'info')

		// Create and run scraper
		const scraper = new YourStateScraper(config)
		const result = await scraper.run()

		log('scraper', `Scraping complete!`, 'info')
		log('scraper', `Session directory: ${result.sessionDir}`, 'info')
		log('scraper', `Total items scraped: ${result.itemsCount}`, 'info')

		process.exit(0)
	} catch (error) {
		log('scraper', `Fatal error: ${error}`, 'error')
		console.error(error)
		process.exit(1)
	}
}

// Run if this is the main module
if (require.main === module) {
	main()
}


