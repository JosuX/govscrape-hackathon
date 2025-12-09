/**
 * INTAKE ENTRY POINT
 * 
 * This script processes the raw scraped data (SOURCE schemas)
 * and transforms it into normalized intake data (INTAKE schemas).
 * 
 * Usage:
 * - npm run intake <session_directory>
 * 
 * Example:
 * - npm run intake ./output/source/session_yourstate_2024-01-15_1705334400000
 * 
 * The intake will:
 * 1. Read all batch files from the session directory
 * 2. Transform each opportunity using transformers
 * 3. Deduplicate agencies and people
 * 4. Generate intake output file
 * 5. Output intake file location
 */

import { readBatchFiles, saveIntakeToFile } from '../utils/storage'
import { 
	ContractTransformer,
	AgencyTransformer,
	DocumentTransformer,
	PeopleTransformer 
} from '../base/BaseTransformer'
import { deduplicateBy, log, generateId, parseFlexibleDate } from '../utils/helpers'
import { SOURCE_TO_INTAKE, type SOURCE_OPPORTUNITY, type SOURCE_DOCUMENT } from '../schemas/source.schema'
import { INTAKE_OUTPUT, type INTAKE_CONTRACT, type INTAKE_AGENCY, type INTAKE_DOCUMENT, type INTAKE_PEOPLE } from '../schemas/intake.schema'
import * as crypto from 'crypto'

/**
 * YourStateContractTransformer
 */
class YourStateContractTransformer extends ContractTransformer {
	public transform(opportunity: SOURCE_OPPORTUNITY, source: string): INTAKE_CONTRACT {
		// Map fields from SOURCE_OPPORTUNITY to INTAKE_CONTRACT
		// Example:
		// return {
		//   id: this.generateContractId(opportunity.eventId, source),
		//   externalId: opportunity.eventId,
		//   source: source,
		//   title: opportunity.title,
		//   description: opportunity.description,
		//   publishedAt: this.parseDate(opportunity.startDate),
		//   closingAt: this.parseDate(opportunity.endDate),
		//   status: this.normalizeStatus(opportunity.status),
		//   agencyId: this.generateAgencyId(opportunity.agencyCode, source),
		//   sourceUrl: opportunity.sourceUrl,
		//   scrapedAt: new Date().toISOString(),
		// }
		
		// Generate contract ID
		const contractId = this.generateContractId(opportunity.eventId, source)

		// Parse dates
		const publishedAt = this.parseDate(opportunity.openDate) || new Date().toISOString()
		const closingAt = this.parseDate(opportunity.closeDate) || new Date().toISOString()

		// Get scrapedAt from opportunity if available, otherwise use current time
		const scrapedAt = new Date().toISOString()

		return {
			id: contractId,
			externalId: opportunity.eventId,
			source: source,
			title: opportunity.title || '',
			description: opportunity.description || '',
			publishedAt: publishedAt,
			closingAt: closingAt,
			status: this.normalizeStatus(opportunity.status),
			agencyId: null,
			contactIds: [], // Will be populated after people transformation
			amount: null,
			sourceUrl: opportunity.sourceUrl || '',
			scrapedAt: scrapedAt,
		}
	}

	protected parseDate(dateStr: string | null): string | null {
		if (!dateStr) return null

		try {
			// Try parsing with parseFlexibleDate if available
			const date = parseFlexibleDate(dateStr)
			if (date) {
				return date.toISOString()
			}

			// Fallback: Try common date formats
			const parsed = new Date(dateStr)
			if (!isNaN(parsed.getTime())) {
				return parsed.toISOString()
			}
		} catch {
			// Ignore parsing errors
		}

		return null
	}

	protected generateContractId(eventId: string, source: string): string {
		// Use generateId helper if available, otherwise create simple hash
		try {
			return generateId(`${source}-${eventId}`, 'contract')
		} catch {
			// Fallback: Simple hash-based ID
			const hash = crypto.createHash('sha256')
				.update(`${source}-${eventId}`)
				.digest('hex')
				.substring(0, 16)
			return `contract-${hash}`
		}
	}

	private normalizeStatus(status: string | null): string {
		// Map source-specific statuses to standard values
		// Example: "Open" => "open", "Closed" => "closed"
		if (!status) return 'unknown'

		const normalized = status.toLowerCase().trim()
		
		// Map common status variations
		const statusMap: Record<string, string> = {
			'open': 'open',
			'active': 'open',
			'posted': 'open',
			'available': 'open',
			'closed': 'closed',
			'expired': 'closed',
			'ended': 'closed',
			'awarded': 'awarded',
			'completed': 'awarded',
			'cancelled': 'cancelled',
			'canceled': 'cancelled',
		}

		return statusMap[normalized] || normalized
	}
}

/**
 * YourStateAgencyTransformer
 */
class YourStateAgencyTransformer extends AgencyTransformer {
	public transform(opportunity: SOURCE_OPPORTUNITY, source: string): INTAKE_AGENCY | null {
		// Extract and transform agency data
		// Example:
		// return {
		//   id: this.generateAgencyId(opportunity.agencyCode, source),
		//   externalId: opportunity.agencyCode,
		//   source: source,
		//   name: opportunity.agencyName,
		//   type: this.normalizeAgencyType(opportunity.governmentType),
		// }
		
		// Return null if no agency information
		if (!opportunity.entity) {
			return null
		}

		const agencyCode = opportunity.entity || ''
		const agencyId = this.generateAgencyId(agencyCode, source)

		return {
			id: agencyId,
			externalId: agencyCode,
			source: source,
			name: opportunity.entity || 'Unknown Agency',
			type: this.normalizeAgencyType(opportunity.entity),
			website: null,
			location: null,
		}
	}

	protected generateAgencyId(agencyCode: string, source: string): string {
		if (!agencyCode) {
			// Generate ID from entity name if no code
			const entityName = source
			const hash = crypto.createHash('sha256')
				.update(`${source}-${entityName}`)
				.digest('hex')
				.substring(0, 16)
			return `agency-${hash}`
		}

		try {
			return generateId(`${source}-${agencyCode}`, 'agency')
		} catch {
			// Fallback: Simple hash-based ID
			const hash = crypto.createHash('sha256')
				.update(`${source}-${agencyCode}`)
				.digest('hex')
				.substring(0, 16)
			return `agency-${hash}`
		}
	}

	private normalizeAgencyType(govType: string | null): string | null {
		if (!govType) return null

		const normalized = govType.toLowerCase().trim()
		
		// Map common government type variations
		const typeMap: Record<string, string> = {
			'state': 'state',
			'county': 'county',
			'city': 'city',
			'municipal': 'city',
			'federal': 'federal',
			'tribal': 'tribal',
			'school': 'school',
			'university': 'university',
			'district': 'district',
		}

		// Check if any keyword matches
		for (const [key, value] of Object.entries(typeMap)) {
			if (normalized.includes(key)) {
				return value
			}
		}

		return normalized
	}
}

/**
 * YourStateDocumentTransformer
 */
class YourStateDocumentTransformer extends DocumentTransformer {
	public transform(document: SOURCE_DOCUMENT, contractId: string, source: string): INTAKE_DOCUMENT {
		// Example:
		// return {
		//   id: this.generateDocumentId(document.downloadUrl, source),
		//   contractId: contractId,
		//   source: source,
		//   fileName: document.fileName,
		//   fileType: this.extractFileExtension(document.fileName),
		//   fileSize: document.fileSize,
		//   fileUrl: document.downloadUrl,
		//   uploadedAt: document.createdAt,
		// }
		
		const fileType = this.extractFileExtension(document.fileName)
		const documentId = this.generateDocumentId(document.downloadUrl || document.id, source)

		// Use current time as uploadedAt if createdAt is not available
		const uploadedAt = new Date().toISOString()

		return {
			id: documentId,
			contractId: contractId,
			source: source,
			fileName: document.fileName || 'unknown',
			fileType: fileType,
			fileSize: document.fileSize || null,
			fileUrl: document.downloadUrl || '',
			uploadedAt: uploadedAt,
		}
	}

	protected extractFileExtension(fileName: string): string {
		if (!fileName) return 'unknown'

		// Remove query parameters if present
		const cleanName = fileName.split('?')[0]
		
		// Extract extension
		const lastDot = cleanName.lastIndexOf('.')
		if (lastDot === -1 || lastDot === cleanName.length - 1) {
			return 'unknown'
		}

		const extension = cleanName.substring(lastDot + 1).toLowerCase()
		
		// Return 'unknown' if extension is too long (likely not a real extension)
		return extension.length > 10 ? 'unknown' : extension
	}

	protected generateDocumentId(documentUrl: string, source: string): string {
		try {
			return generateId(`${source}-${documentUrl}`, 'doc')
		} catch {
			// Fallback: Simple hash-based ID
			const hash = crypto.createHash('sha256')
				.update(`${source}-${documentUrl}`)
				.digest('hex')
				.substring(0, 16)
			return `doc-${hash}`
		}
	}
}

/**
 * YourStatePeopleTransformer
 */
class YourStatePeopleTransformer extends PeopleTransformer {
	public transform(opportunity: SOURCE_OPPORTUNITY, contractId: string, source: string): INTAKE_PEOPLE | null {
		// Return null if no contact info
		// Example:
		// if (!opportunity.contactEmail && !opportunity.contactName) {
		//   return null
		// }
		// return {
		//   id: this.generatePersonId(opportunity.contactEmail, source),
		//   contractId: contractId,
		//   source: source,
		//   name: opportunity.contactName,
		//   email: this.normalizeEmail(opportunity.contactEmail),
		//   phone: this.normalizePhone(opportunity.contactPhone),
		//   role: 'buyer',
		// }
		
		// Return null if no contact info
		if (!opportunity.buyerEmail && !opportunity.buyerName) {
			return null
		}

		// Use email for ID generation, fallback to name if no email
		const email = opportunity.buyerEmail || ''
		const personId = email 
			? this.generatePersonId(email, source)
			: this.generatePersonIdFromName(opportunity.buyerName, source)

		return {
			id: personId,
			contractId: contractId,
			source: source,
			name: opportunity.buyerName || 'Unknown',
			email: this.normalizeEmail(opportunity.buyerEmail ?? null),
			phone: this.normalizePhone(opportunity.buyerPhone ?? null),
			role: 'buyer',
		}
	}

	protected normalizePhone(phone: string | null): string | null {
		if (!phone) return null

		// Remove common formatting characters
		let normalized = phone.replace(/[\s\-\(\)\.]/g, '')
		
		// Remove leading +1 for US numbers
		if (normalized.startsWith('+1')) {
			normalized = normalized.substring(2)
		}
		if (normalized.startsWith('1') && normalized.length === 11) {
			normalized = normalized.substring(1)
		}

		// Validate: should be 10 digits for US numbers
		if (!/^\d{10}$/.test(normalized)) {
			return null
		}

		// Format as (XXX) XXX-XXXX
		return `(${normalized.substring(0, 3)}) ${normalized.substring(3, 6)}-${normalized.substring(6)}`
	}

	protected normalizeEmail(email: string | null): string | null {
		if (!email) return null

		// Convert to lowercase and trim
		const normalized = email.toLowerCase().trim()

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailRegex.test(normalized)) {
			return null
		}

		return normalized
	}

	protected generatePersonId(email: string, source: string): string {
		if (!email) {
			throw new Error('Email required for person ID generation')
		}

		try {
			return generateId(`${source}-${email}`, 'person')
		} catch {
			// Fallback: Simple hash-based ID
			const hash = crypto.createHash('sha256')
				.update(`${source}-${email}`)
				.digest('hex')
				.substring(0, 16)
			return `person-${hash}`
		}
	}

	private generatePersonIdFromName(name: string, source: string): string {
		// Generate ID from name when email is not available
		try {
			return generateId(`${source}-${name}`, 'person')
		} catch {
			const hash = crypto.createHash('sha256')
				.update(`${source}-${name}`)
				.digest('hex')
				.substring(0, 16)
			return `person-${hash}`
		}
	}
}

/**
 * Process intake
 * 
 * Main function that orchestrates the intake process.
 */
async function processIntake(sessionDir: string): Promise<void> {
	try {
		log('intake', 'Starting intake process...', 'info')
		log('intake', `Reading from: ${sessionDir}`, 'info')

		// Read all batch files
		const batches = await readBatchFiles(sessionDir)
		log('intake', `Found ${batches.length} batch files`, 'info')

		// Validate batch data against SOURCE_TO_INTAKE schema
		for (const batch of batches) {
			try {
				SOURCE_TO_INTAKE.parse(batch)
			} catch (error) {
				log('intake', `Schema validation error in batch: ${error}`, 'warn')
				// Continue processing even if validation fails
			}
		}

		// Initialize transformers
		const contractTransformer = new YourStateContractTransformer()
		const agencyTransformer = new YourStateAgencyTransformer()
		const documentTransformer = new YourStateDocumentTransformer()
		const peopleTransformer = new YourStatePeopleTransformer()

		// Initialize output collections
		const contracts: INTAKE_CONTRACT[] = []
		const agencies: INTAKE_AGENCY[] = []
		const documents: INTAKE_DOCUMENT[] = []
		const people: INTAKE_PEOPLE[] = []

		const source = batches[0]?.metadata?.source || 'unknown'

		// Process each batch
		for (const batch of batches) {
			for (const item of batch.items) {
				try {
					// Transform contract
					const contract = contractTransformer.transform(item.opportunity, source)
					contracts.push(contract)

					// Transform agency
					const agency = agencyTransformer.transform(item.opportunity, source)
					if (agency) {
						agencies.push(agency)
						// Link agency to contract if not already set
						if (!contract.agencyId && agency.id) {
							contract.agencyId = agency.id
						}
					}

					// Transform documents
					for (const doc of item.documents) {
						try {
							const document = documentTransformer.transform(doc, contract.id, source)
							documents.push(document)
						} catch (error) {
							log('intake', `Error transforming document: ${error}`, 'warn')
							continue
						}
					}

					// Transform people
					const person = peopleTransformer.transform(item.opportunity, contract.id, source)
					if (person) {
						people.push(person)
						// Link person to contract
						if (!contract.contactIds.includes(person.id)) {
							contract.contactIds.push(person.id)
						}
					}
				} catch (error) {
					log('intake', `Error processing item: ${error}`, 'warn')
					continue
				}
			}
		}

		log('intake', `Processed ${contracts.length} contracts`, 'info')

		// Deduplicate agencies and people
		let uniqueAgencies: INTAKE_AGENCY[]
		let uniquePeople: INTAKE_PEOPLE[]
		
		try {
			uniqueAgencies = deduplicateBy(agencies, (a) => a.id)
			uniquePeople = deduplicateBy(people, (p) => p.id)
		} catch (error) {
			// Fallback: Manual deduplication
			log('intake', 'Using fallback deduplication', 'warn')
			const agencyMap = new Map<string, INTAKE_AGENCY>()
			const peopleMap = new Map<string, INTAKE_PEOPLE>()
			
			for (const agency of agencies) {
				if (!agencyMap.has(agency.id)) {
					agencyMap.set(agency.id, agency)
				}
			}
			uniqueAgencies = Array.from(agencyMap.values())
			
			for (const person of people) {
				if (!peopleMap.has(person.id)) {
					peopleMap.set(person.id, person)
				}
			}
			uniquePeople = Array.from(peopleMap.values())
		}

		// Create intake output
		const output = {
			contracts: contracts,
			agencies: uniqueAgencies,
			documents: documents,
			people: uniquePeople,
			metadata: {
				processedAt: new Date().toISOString(),
				source: source,
				totalContracts: contracts.length,
				totalAgencies: uniqueAgencies.length,
				totalDocuments: documents.length,
				totalPeople: uniquePeople.length,
			},
		}

		// Validate output against INTAKE_OUTPUT schema
		try {
			INTAKE_OUTPUT.parse(output)
			log('intake', 'Output validated against INTAKE_OUTPUT schema', 'info')
		} catch (error) {
			log('intake', `Schema validation error: ${error}`, 'error')
			throw error
		}

		// Save intake output
		const fileName = `intake_${source}_${Date.now()}`
		await saveIntakeToFile(output, fileName)

		log('intake', 'Intake process complete!', 'info')
		log('intake', `Output file: ./output/intake/${fileName}.json`, 'info')

	} catch (error) {
		log('intake', `Fatal error: ${error}`, 'error')
		throw error
	}
}

/**
 * Main execution
 */
async function main() {
	try {
		// Get session directory from command line arguments
		const sessionDir = process.argv[2]

		if (!sessionDir) {
			console.error('Usage: npm run intake <session_directory>')
			console.error('Example: npm run intake ./output/source/session_yourstate_2024-01-15_1705334400000')
			process.exit(1)
		}

		await processIntake(sessionDir)
		process.exit(0)
	} catch (error) {
		console.error('Fatal error:', error)
		process.exit(1)
	}
}

// Run if this is the main module
if (require.main === module) {
	main()
}


