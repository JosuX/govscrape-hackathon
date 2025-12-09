import { z } from 'zod'

/**
 * SOURCE SCHEMAS
 *
 * These schemas represent the EXACT structure scraped from the source website
 * WITHOUT any processing, transformation, or enrichment.
 *
 * The data should be stored exactly as extracted from the HTML/API.
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
 * Represents a single document/attachment from the source.
 *
 * Example fields to include:
 * - id: string (generated)
 * - fileName: string (e.g., "RFP_Document.pdf")
 * - downloadUrl: string (local file path or URL after download)
 * - fileSize: number (in bytes, optional)
 * - contractId: string (link to parent opportunity)
 *
 * Add any source-specific fields you need.
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
 * Represents a single procurement opportunity from the source.
 * This is the main entity being scraped.
 *
 * Example fields to include:
 * - id: string (generated)
 * - eventId: string (unique ID from source)
 * - title: string (opportunity title)
 * - description: string (full description)
 * - startDate: string (posting/start date as string)
 * - endDate: string (closing/end date as string)
 * - agencyName: string (issuing agency)
 * - agencyCode: string (agency identifier)
 * - status: string (e.g., "Open", "Closed")
 * - contactName: string (buyer/contact name)
 * - contactEmail: string (buyer email)
 * - contactPhone: string (buyer phone)
 * - sourceUrl: string (URL to detail page)
 *
 * Add any source-specific fields:
 * - Categories/codes (NIGP, NAICS, etc.)
 * - Event type
 * - Government type
 * - Special requirements
 * - etc.
 */
export const SOURCE_OPPORTUNITY = z.object({
    id: z.string(),
    eventId: z.string(),
    title: z.string(),
    description: z.string(),
    detail: z.string().nullable().optional(),
    openDate: z.string(),
    closeDate: z.string(),
    dueTime: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    lastUpdated: z.string().nullable().optional(),
    status: z.string(),
    entity: z.string(),
    agencyNumber: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    division: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    adType: z.string().nullable().optional(),
    unspscCodes: z.array(z.string()).nullable().optional(),
    naicsCodes: z.array(z.string()).nullable().optional(),
    nigpCodes: z.array(z.string()).nullable().optional(),
    buyerName: z.string(),
    buyerEmail: z.string().nullable().optional(),
    buyerPhone: z.string().nullable().optional(),
    bidSubmissionInstructions: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    awardeeName: z.string().nullable().optional(),
    awardAmount: z.number().nullable().optional(),
    awardDate: z.string().nullable().optional(),
    contractStartDate: z.string().nullable().optional(),
    contractEndDate: z.string().nullable().optional(),
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
 *   - source: Source name (e.g., "yourstate")
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
