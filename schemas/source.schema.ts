import { z } from 'zod'

/**
 * SOURCE SCHEMAS
 *
 * These schemas represent the EXACT structure scraped from Cherokee Bids
 * WITHOUT any processing, transformation, or enrichment.
 *
 * The data should be stored exactly as extracted from the HTML.
 *
 * Guidelines:
 * - Use the exact field names from the source (or descriptive names)
 * - Store dates as strings in their original format
 * - Don't normalize or clean data at this stage
 * - Include all available fields, even if optional
 * - Use .nullable().optional() for fields that might not exist
 */

/**
 * SOURCE_DOCUMENT
 *
 * Represents a single document/attachment from Cherokee Bids.
 */
export const SOURCE_DOCUMENT = z.object({
    id: z.string(),
    fileName: z.string(),
    downloadUrl: z.string(),
    fileSize: z.number().nullable().optional(),
    contractId: z.string(),
})

/**
 * SOURCE_OPPORTUNITY
 *
 * Represents a single procurement opportunity from Cherokee Bids.
 * This is the main entity being scraped.
 */
export const SOURCE_OPPORTUNITY = z.object({
    id: z.string(),
    eventId: z.string(),
    title: z.string(),
    description: z.string(),
    openDate: z.string(),
    closeDate: z.string(),
    status: z.string(),
    entity: z.string(),
    buyerName: z.string(),
    buyerEmail: z.string().nullable().optional(),
    buyerPhone: z.string().nullable().optional(),
    sourceUrl: z.string(),
})

/**
 * SOURCE_TO_INTAKE
 *
 * Container for a complete scraping session's data.
 * This is what gets saved to batch JSON files.
 *
 * Structure:
 * - metadata: Information about the scraping session
 *   - scrapedAt: ISO timestamp
 *   - source: Source name (e.g., "cherokee")
 *   - sourceUrl: Base URL of the source
 *   - dateRange: Date range that was scraped
 *   - totalItems: Number of items in this batch
 *
 * - items: Array of opportunities with their documents
 *   - opportunity: SOURCE_OPPORTUNITY data
 *   - documents: Array of SOURCE_DOCUMENT data
 */
export const SOURCE_TO_INTAKE = z.object({
    metadata: z.object({
        scrapedAt: z.string(),
        source: z.string(),
        sourceUrl: z.string(),
        dateRange: z.object({
            from: z.string(),
            to: z.string(),
        }).nullable().optional(),
        totalItems: z.number(),
    }),
    items: z.array(
        z.object({
            opportunity: SOURCE_OPPORTUNITY,
            documents: z.array(SOURCE_DOCUMENT),
        }),
    ),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SOURCE_DOCUMENT = z.infer<typeof SOURCE_DOCUMENT>
export type SOURCE_OPPORTUNITY = z.infer<typeof SOURCE_OPPORTUNITY>
export type SOURCE_TO_INTAKE = z.infer<typeof SOURCE_TO_INTAKE>
