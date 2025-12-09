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

import { chromium, Browser, Page } from 'playwright'
import { BaseScraper, ScraperConfig } from '../base/BaseScraper'
import { getDateRange } from '../utils/cli'
import { 
	createSessionDirectory, 
	saveBatchToFile, 
	generateSessionName,
	downloadFileLocally 
} from '../utils/storage'
import { log } from '../utils/helpers'
import { SOURCE_TO_INTAKE, type SOURCE_OPPORTUNITY, type SOURCE_DOCUMENT } from '../schemas/source.schema'
import { OpportunityExtractor, DocumentExtractor, ContactExtractor, TabDataExtractor } from '../extractors'

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
	CALEPROCURE = 'caleprocure',
	TEXAS = 'texas',
	NYSCR = 'nyscr',
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
	dateFilterSelector?: string
	paginationType: 'url' | 'button' | 'api'
	requiresAuth: boolean
}

/**
 * YourStateScraper
 * 
 * Concrete implementation of BaseScraper for your target website.
 * 
 * Supports multiple websites:
 * - Cherokee Bids (primary target)
 * - Cal eProcure
 * - Texas Comptroller
 * - NYSCR
 */
class YourStateScraper extends BaseScraper {
	private oppExtractor: OpportunityExtractor
	private contactExtractor: ContactExtractor
	private tabExtractor: TabDataExtractor
	private websiteConfig: WebsiteConfig

	constructor(config: ScraperConfig) {
		super(config)
		this.oppExtractor = new OpportunityExtractor()
		this.contactExtractor = new ContactExtractor()
		this.tabExtractor = new TabDataExtractor()
		
		// Configure website-specific settings
		this.websiteConfig = this.getWebsiteConfig(config.source)
	}

	/**
	 * Get website configuration based on source name
	 */
	private getWebsiteConfig(source: string): WebsiteConfig {
		const configs: Record<Source, WebsiteConfig> = {
			[Source.CHEROKEE]: {
				baseUrl: 'https://www.cherokeebids.org',
				searchUrl: 'https://www.cherokeebids.org/WebsiteAdmin/Procurement',
				listingSelector: '.procurement-item, .opportunity-item, tr[data-opportunity], .listing-row',
				titleSelector: '.title, h3, h4, .opportunity-title, td:nth-child(2)',
				linkSelector: 'a[href*="procurement"], a[href*="opportunity"], a[href*="bid"]',
				idSelector: '[data-id], .id, .opportunity-id, td:first-child',
				paginationType: 'url',
				requiresAuth: true,
			},
			[Source.CALEPROCURE]: {
				baseUrl: 'https://caleprocure.ca.gov',
				searchUrl: 'https://caleprocure.ca.gov/pages/index.aspx',
				listingSelector: '.opportunity-list-item, .bid-item, table tbody tr',
				titleSelector: '.title, h3, .bid-title, td:nth-child(2)',
				linkSelector: 'a[href*="opportunity"], a[href*="bid"], a[href*="contract"]',
				idSelector: '[data-id], .id, .opportunity-id, td:first-child',
				paginationType: 'button',
				requiresAuth: false,
			},
			[Source.TEXAS]: {
				baseUrl: 'https://comptroller.texas.gov',
				searchUrl: 'https://comptroller.texas.gov/purchasing/',
				listingSelector: '.procurement-item, .opportunity-card, table tbody tr',
				titleSelector: '.title, h3, .procurement-title, td:nth-child(2)',
				linkSelector: 'a[href*="purchasing"], a[href*="opportunity"], a[href*="bid"]',
				idSelector: '[data-id], .id, .opportunity-id, td:first-child',
				paginationType: 'url',
				requiresAuth: false,
			},
			[Source.NYSCR]: {
				baseUrl: 'https://www.nyscr.ny.gov',
				searchUrl: 'https://www.nyscr.ny.gov/adsOpen.cfm',
				listingSelector: '.contract-item, .opportunity-row, table tbody tr',
				titleSelector: '.title, h3, .contract-title, td:nth-child(2)',
				linkSelector: 'a[href*="contract"], a[href*="opportunity"], a[href*="bid"]',
				idSelector: '[data-id], .id, .contract-id, td:first-child',
				paginationType: 'url',
				requiresAuth: false,
			},
		}

		const sourceKey = source.toLowerCase() as Source
		return configs[sourceKey] || configs[Source.CHEROKEE]
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
	): Promise<Listing[]> {
		try {
			// Build URL based on pagination type
			let url = this.websiteConfig.searchUrl
			
			if (this.websiteConfig.paginationType === 'url') {
				// Add pagination parameters to URL
				const separator = url.includes('?') ? '&' : '?'
				url = `${url}${separator}page=${pageNumber}&pageSize=${pageSize}`
			}

			log('scraper', `Fetching page ${pageNumber} from ${url}`, 'info')
			
			// Navigate to search/listing page
			await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
			await this.delay(1000) // Be polite

			// Wait for listings to load
			await page.waitForSelector(this.websiteConfig.listingSelector, { timeout: 10000 }).catch(() => {
				log('scraper', 'Listing selector not found, trying alternative selectors', 'warn')
			})

			// Extract listing elements
			const listingElements = await page.locator(this.websiteConfig.listingSelector).all()
			
			if (listingElements.length === 0) {
				log('scraper', 'No listings found on page', 'warn')
				return []
			}

			log('scraper', `Found ${listingElements.length} listings on page ${pageNumber}`, 'info')

			// Extract data from each listing
			const listings: Listing[] = []
			for (let i = 0; i < listingElements.length; i++) {
				try {
					const element = listingElements[i]
					
					// Extract ID
					const id = await element.locator(this.websiteConfig.idSelector).first().textContent().catch(() => null)
						|| await element.getAttribute('data-id')
						|| `listing-${pageNumber}-${i + 1}`

					// Extract title
					const title = await element.locator(this.websiteConfig.titleSelector).first().textContent().catch(() => null)
						|| 'Untitled Opportunity'

					// Extract link
					const linkElement = await element.locator(this.websiteConfig.linkSelector).first()
					const link = await linkElement.getAttribute('href').catch(() => null)
					
					// Build full URL if relative
					const fullUrl = link 
						? (link.startsWith('http') ? link : new URL(link, this.websiteConfig.baseUrl).href)
						: null

					if (fullUrl) {
						listings.push({
							id: id.trim(),
							title: title.trim(),
							link: fullUrl,
							pageNumber,
							index: i + 1,
						})
					}
				} catch (error) {
					log('scraper', `Error extracting listing ${i + 1}: ${error}`, 'warn')
					continue
				}
			}

			return listings
		} catch (error) {
			log('scraper', `Error fetching listings: ${error}`, 'error')
			return []
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

			// Check if page uses tabs - extract tab data if available
			let tabData: Record<string, string | null> | null = null
			try {
				// Try to detect if page has tabs
				const hasTabs = await detailPage.locator('.tab, .nav-tab, [role="tab"], .tab-button').count() > 0
				if (hasTabs) {
					log('scraper', 'Detected tabbed interface, extracting tab data...', 'info')
					tabData = await this.tabExtractor.extract(detailPage)
					log('scraper', `Extracted data from ${Object.keys(tabData).length} tabs`, 'info')
				}
			} catch (error) {
				log('scraper', `Error extracting tab data: ${error}`, 'warn')
				// Continue without tab data
			}

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
			// If tabs were found, documents might be in a "Documents" tab
			// DocumentExtractor will search the entire page, including tab content
			const docExtractor = new DocumentExtractor(opportunity.id)
			let documents = await docExtractor.extract(detailPage)

			// If no documents found and we have tab data, try extracting from "Documents" tab
			if (documents.length === 0 && tabData) {
				const documentsTabContent = tabData['documents'] || tabData['attachments'] || tabData['files']
				if (documentsTabContent) {
					log('scraper', 'No documents found on main page, checking Documents tab...', 'info')
					// Documents might be in tab content - DocumentExtractor should handle this
					// But we can try extracting again after ensuring Documents tab is active
					try {
						// Try clicking Documents tab if it exists
						const documentsTab = detailPage.locator('.tab, [role="tab"]').filter({ hasText: /document|attachment|file/i })
						const tabCount = await documentsTab.count()
						if (tabCount > 0) {
							await documentsTab.first().click()
							await this.delay(500) // Wait for tab content to load
							documents = await docExtractor.extract(detailPage)
						}
					} catch (error) {
						log('scraper', `Error extracting documents from tab: ${error}`, 'warn')
					}
				}
			}

			// Download documents
			for (const doc of documents) {
				try {
					log('scraper', `Downloading document: ${doc.fileName}`, 'info')
					const localPath = await downloadFileLocally(
						doc.downloadUrl,
						opportunity.id,
						doc.fileName
					)
					doc.downloadUrl = localPath // Update to local path
				} catch (error) {
					log('scraper', `Error downloading document ${doc.fileName}: ${error}`, 'warn')
					// Continue even if download fails
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
		this.sessionDirName = generateSessionName(
			this.config.source,
			this.config.dateRange
		)
		
		await createSessionDirectory(this.sessionDirName, 'source')
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
					const listings = await this.fetchListings(
						mainPage,
						this.currentPage,
						this.config.batchSize || 50
					)

					if (listings.length === 0) {
						log('scraper', 'No more listings found', 'info')
						hasMorePages = false
						break
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

					// Check if there are more pages
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

		// Create scraper config
		const config: ScraperConfig = {
			source: Source.CHEROKEE, // Change to your source name (options: Source.CHEROKEE, Source.CALEPROCURE, Source.TEXAS, Source.NYSCR)
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


