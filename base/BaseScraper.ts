import { Page, Browser } from 'playwright'

/**
 * ScraperConfig
 * 
 * Configuration object for the scraper
 */
export interface ScraperConfig {
	source: string
	dateRange: { from: Date; to: Date }
	batchSize?: number
	maxPages?: number
}

/**
 * BaseScraper
 * 
 * Abstract base class for all scrapers in the hackathon.
 * Implements the core scraping workflow with pagination and batch saving.
 * 
 * Participants should extend this class and implement the abstract methods.
 * 
 * Architecture:
 * - run() orchestrates the entire scraping process
 * - fetchListings() retrieves a page of opportunities
 * - processOpportunity() extracts details from a single opportunity
 * - saveBatch() persists data to local storage
 * 
 * Key Features:
 * - Pagination support
 * - Incremental batch saving
 * - Memory management (clears data after each batch)
 * - Progress tracking
 */
export abstract class BaseScraper {
	protected config: ScraperConfig
	protected browser: Browser | null = null
	protected currentPage: number = 1
	protected batchNum: number = 1
	protected totalProcessed: number = 0
	protected sessionDirName: string = ''

	constructor(config: ScraperConfig) {
		this.config = config
	}

	/**
	 * Main execution method
	 * 
	 * This method orchestrates the entire scraping process:
	 * 1. Initialize browser and session
	 * 2. Loop through pages of listings
	 * 3. Process each opportunity
	 * 4. Save batches incrementally
	 * 5. Clean up resources
	 * 
	 * @returns Object containing session directory and total items scraped
	 * 
	 * TODO: Implement the main scraping workflow
	 * - Launch browser using launchBrowser()
	 * - Create session directory using createSessionDirectory()
	 * - Implement pagination loop
	 * - Call fetchListings() for each page
	 * - Call processOpportunity() for each listing
	 * - Call saveBatch() after each page
	 * - Handle cleanup in finally block
	 */
	public async run(): Promise<{ sessionDir: string; itemsCount: number }> {
		// TODO: Implement main scraping workflow
		throw new Error('Method not implemented')
	}

	/**
	 * Fetch a page of opportunity listings
	 * 
	 * This method should retrieve a paginated list of opportunities from the source.
	 * It might use API calls, web scraping, or a combination of both.
	 * 
	 * @param page - Playwright page instance
	 * @param pageNumber - Current page number (1-indexed)
	 * @param pageSize - Number of items per page
	 * @returns Array of listing objects (raw data from the source)
	 * 
	 * TODO: Implement listing fetch logic
	 * - Navigate to the search/listing page
	 * - Apply date filters from config.dateRange
	 * - Handle pagination (offset/limit or page numbers)
	 * - Extract listing data (basic info like ID, title, agency)
	 * - Return array of listing objects
	 */
	protected abstract fetchListings(
		page: Page,
		pageNumber: number,
		pageSize: number
	): Promise<any[]>

	/**
	 * Process a single opportunity
	 * 
	 * This method should navigate to the detail page of an opportunity
	 * and extract all relevant data using extractors.
	 * 
	 * @param browser - Playwright browser instance
	 * @param listing - Basic listing info from fetchListings()
	 * @returns Structured opportunity data with documents
	 * 
	 * TODO: Implement opportunity processing
	 * - Build detail page URL from listing data
	 * - Create new page for isolation (browser.newPage())
	 * - Navigate to detail page
	 * - Extract opportunity data (use extractors)
	 * - Extract document metadata
	 * - Download documents to local storage
	 * - Close the page
	 * - Return structured data matching your source schema
	 */
	protected abstract processOpportunity(
		browser: Browser,
		listing: any
	): Promise<any>

	/**
	 * Save batch data to local storage
	 * 
	 * This method saves the accumulated data to a JSON file.
	 * Follow the incremental saving pattern to prevent data loss.
	 * 
	 * @param items - Array of processed opportunities
	 * 
	 * TODO: Implement batch saving
	 * - Create output object matching SOURCE_TO_INTAKE schema
	 * - Include metadata (scrapedAt, source, etc.)
	 * - Call saveBatchToFile() utility
	 * - Increment batchNum counter
	 * - Log progress
	 */
	protected abstract saveBatch(items: any[]): Promise<void>

	/**
	 * Launch Playwright browser
	 * 
	 * Override this method if you need custom browser configuration.
	 * 
	 * @returns Playwright Browser instance
	 * 
	 * TODO: Implement browser launch
	 * - Import chromium from playwright
	 * - Launch with appropriate options (headless, args)
	 * - Return browser instance
	 */
	protected abstract launchBrowser(): Promise<Browser>

	/**
	 * Create session directory
	 * 
	 * Generates a unique directory name for this scraping session
	 * and creates it in the file system.
	 * 
	 * Format: session_SOURCE_YYYY-MM-DD_TIMESTAMP
	 * 
	 * TODO: Implement directory creation
	 * - Generate unique directory name
	 * - Store in this.sessionDirName
	 * - Call createSessionDirectory() utility
	 */
	protected abstract createSessionDirectory(): Promise<void>

	/**
	 * Helper method to add delays between requests
	 * 
	 * Use this to be polite to the target server.
	 * 
	 * @param ms - Milliseconds to delay
	 */
	protected async delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}

