import * as fs from 'fs/promises'
import * as path from 'path'
import { sanitizeFileName } from './helpers'

/**
 * Storage Utilities
 * 
 * Handle local file system operations for saving scraped data.
 * 
 * File structure:
 * ./output/
 *   source/
 *     session_SOURCE_YYYY-MM-DD_TIMESTAMP/
 *       batch_1.json
 *       batch_2.json
 *       ...
 *   intake/
 *     intake_SOURCE_YYYY-MM-DD_TIMESTAMP.json
 *   documents/
 *     CONTRACT_ID/
 *       document1.pdf
 *       document2.xlsx
 *       ...
 */

/**
 * Create session directory for this scraping run
 * 
 * @param sessionName - Unique session directory name
 * @param stage - Either 'source' or 'intake'
 * @returns Full path to created directory
 * 
 * TODO: Implement directory creation
 * - Build path: ./output/{stage}/{sessionName}/
 * - Create directory recursively (mkdir -p)
 * - Return full path
 * - Handle errors gracefully
 */
export async function createSessionDirectory(
	sessionName: string,
	stage: 'source' | 'intake'
): Promise<string> {
	// TODO: Implement directory creation
	// - Build path: ./output/{stage}/{sessionName}/
	// - Create directory recursively (mkdir -p)
	// - Return full path
	// - Handle errors gracefully
	
	const dirPath = path.join(process.cwd(), 'output', stage, sessionName)
	
	try {
		await fs.mkdir(dirPath, { recursive: true })
		return dirPath
	} catch (error) {
		throw new Error(`Failed to create session directory: ${dirPath}. Error: ${error}`)
	}
}

/**
 * Save batch data to JSON file
 * 
 * @param data - Data object to save (must match SOURCE_TO_INTAKE schema)
 * @param sessionDir - Session directory path
 * @param batchNum - Batch number (for filename)
 * 
 * TODO: Implement batch saving
 * - Build filename: batch_{batchNum}.json
 * - Convert data to JSON string (pretty-printed with 2 spaces)
 * - Write to file
 * - Log success message
 * - Handle write errors
 */
export async function saveBatchToFile(
	data: any,
	sessionDir: string,
	batchNum: number
): Promise<void> {
	// TODO: Implement batch saving
	// - Build filename: batch_{batchNum}.json
	// - Convert data to JSON string (pretty-printed with 2 spaces)
	// - Write to file
	// - Log success message
	// - Handle write errors
	
	const fileName = `batch_${batchNum}.json`
	const filePath = path.join(sessionDir, fileName)
	const jsonContent = JSON.stringify(data, null, 2)
	
	try {
		await fs.writeFile(filePath, jsonContent, 'utf-8')
		console.log(`Batch ${batchNum} saved to ${filePath}`)
	} catch (error) {
		throw new Error(`Failed to save batch file: ${filePath}. Error: ${error}`)
	}
}

/**
 * Save intake output to JSON file
 * 
 * @param data - Intake data object (must match INTAKE_OUTPUT schema)
 * @param fileName - Output file name
 * 
 * TODO: Implement intake saving
 * - Create intake directory if not exists
 * - Build path: ./output/intake/{fileName}.json
 * - Convert data to JSON string (pretty-printed)
 * - Write to file
 * - Log success message
 */
export async function saveIntakeToFile(data: any, fileName: string): Promise<void> {
	// TODO: Implement intake saving
	// - Create intake directory if not exists
	// - Build path: ./output/intake/{fileName}.json
	// - Convert data to JSON string (pretty-printed)
	// - Write to file
	// - Log success message
	
	const intakeDir = path.join(process.cwd(), 'output', 'intake')
	const filePath = path.join(intakeDir, `${fileName}.json`)
	const jsonContent = JSON.stringify(data, null, 2)
	
	try {
		// Create intake directory if it doesn't exist
		await fs.mkdir(intakeDir, { recursive: true })
		
		// Write file
		await fs.writeFile(filePath, jsonContent, 'utf-8')
		console.log(`Intake file saved to ${filePath}`)
	} catch (error) {
		throw new Error(`Failed to save intake file: ${filePath}. Error: ${error}`)
	}
}

/**
 * Download file from URL and save locally
 * 
 * @param url - URL to download from
 * @param contractId - Contract ID (for organizing files)
 * @param fileName - File name to save as
 * @returns Local file path where file was saved
 * 
 * TODO: Implement file download
 * - Create documents directory structure: ./output/documents/{contractId}/
 * - Download file from URL (use fetch or Playwright)
 * - Save to local path
 * - Return local file path
 * - Handle download errors gracefully
 */
export async function downloadFileLocally(
	url: string,
	contractId: string,
	fileName: string
): Promise<string> {
	// Create documents directory structure: ./output/documents/{contractId}/
	// Download file from URL and save with correct extension
	
	// Extract file extension from URL if fileName doesn't have one
	let finalFileName = fileName.trim()
	
	// Check if fileName has an extension
	const hasExtension = /\.\w+$/.test(finalFileName)
	
	// If no extension, try to extract from URL
	if (!hasExtension) {
		try {
			const urlPath = new URL(url).pathname
			const urlExtension = path.extname(urlPath)
			if (urlExtension && urlExtension.length > 1) {
				finalFileName = `${finalFileName}${urlExtension}`
			}
		} catch {
			// If URL parsing fails, try to extract extension from URL string directly
			const urlMatch = url.match(/\.(\w+)(?:\?|$)/)
			if (urlMatch && urlMatch[1]) {
				finalFileName = `${finalFileName}.${urlMatch[1]}`
			}
		}
	}
	
	// Sanitize the file name (preserves extension)
	finalFileName = sanitizeFileName(finalFileName)
	
	// Ensure we have at least some extension or default to .bin
	if (!path.extname(finalFileName)) {
		// Try to get content type from response headers to determine extension
		// For now, default to .bin if we can't determine
		finalFileName = `${finalFileName}.bin`
	}
	
	const documentsDir = path.join(process.cwd(), 'output', 'documents', contractId)
	const filePath = path.join(documentsDir, finalFileName)
	
	try {
		// Create directory if it doesn't exist
		await fs.mkdir(documentsDir, { recursive: true })
		
		// Download file using fetch
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
		}
		
		// Try to determine file extension from Content-Type header if still missing
		let actualFileName = finalFileName
		const contentType = response.headers.get('content-type')
		if (contentType && !path.extname(actualFileName) && actualFileName.endsWith('.bin')) {
			// Map common content types to extensions
			const contentTypeMap: Record<string, string> = {
				'application/pdf': '.pdf',
				'application/msword': '.doc',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
				'application/vnd.ms-excel': '.xls',
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
				'application/vnd.ms-powerpoint': '.ppt',
				'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
				'text/plain': '.txt',
				'text/html': '.html',
				'text/csv': '.csv',
				'image/png': '.png',
				'image/jpeg': '.jpg',
				'image/gif': '.gif',
			}
			
			const extension = contentTypeMap[contentType.split(';')[0].trim()]
			if (extension) {
				actualFileName = actualFileName.replace(/\.bin$/, extension)
				// Update filePath
				const newFilePath = path.join(documentsDir, actualFileName)
				// If file already exists with .bin, we'll overwrite with correct extension
				const arrayBuffer = await response.arrayBuffer()
				const buffer = Buffer.from(arrayBuffer)
				await fs.writeFile(newFilePath, buffer)
				return newFilePath
			}
		}
		
		// Get file buffer
		const arrayBuffer = await response.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)
		
		// Write to file
		await fs.writeFile(filePath, buffer)
		
		return filePath
	} catch (error) {
		throw new Error(`Failed to download file from ${url} to ${filePath}. Error: ${error}`)
	}
}

/**
 * Read all batch files from a session directory
 * 
 * @param sessionDir - Session directory path
 * @returns Array of parsed batch data objects
 * 
 * TODO: Implement batch reading
 * - List all files in session directory
 * - Filter for batch_*.json files
 * - Read and parse each file
 * - Return array of parsed objects
 * - Handle read/parse errors
 */
export async function readBatchFiles(sessionDir: string): Promise<any[]> {
	// TODO: Implement batch reading
	// - List all files in session directory
	// - Filter for batch_*.json files
	// - Read and parse each file
	// - Return array of parsed objects
	// - Handle read/parse errors
	
	try {
		const files = await fs.readdir(sessionDir)
		const batchFiles = files
			.filter(file => file.startsWith('batch_') && file.endsWith('.json'))
			.sort() // Sort to ensure consistent order
		
		const batches: any[] = []
		
		for (const file of batchFiles) {
			try {
				const filePath = path.join(sessionDir, file)
				const content = await fs.readFile(filePath, 'utf-8')
				const parsed = JSON.parse(content)
				batches.push(parsed)
			} catch (error) {
				console.warn(`Failed to read or parse batch file ${file}: ${error}`)
				// Continue with other files
			}
		}
		
		return batches
	} catch (error) {
		throw new Error(`Failed to read batch files from ${sessionDir}. Error: ${error}`)
	}
}

/**
 * Generate unique session name
 * 
 * @param source - Source name (e.g., 'yourstate')
 * @param dateRange - Date range being scraped
 * @returns Unique session name
 * 
 * Format: session_SOURCE_YYYY-MM-DD_TIMESTAMP
 * Example: session_georgia_2024-01-15_1705334400000
 * 
 * TODO: Implement session name generation
 * - Format date as YYYY-MM-DD
 * - Get current timestamp
 * - Combine into session name
 */
export function generateSessionName(
	source: string,
	dateRange: { from: Date; to: Date }
): string {
	// TODO: Implement session name generation
	// - Format date as YYYY-MM-DD
	// - Get current timestamp
	// - Combine into session name
	// Format: session_SOURCE_YYYY-MM-DD_TIMESTAMP
	// Example: session_georgia_2024-01-15_1705334400000
	
	const dateStr = dateRange.from.toISOString().split('T')[0] // YYYY-MM-DD
	const timestamp = Date.now()
	
	return `session_${source}_${dateStr}_${timestamp}`
}

/**
 * Check if directory exists
 * 
 * @param dirPath - Directory path to check
 * @returns True if directory exists
 * 
 * TODO: Implement directory existence check
 * - Use fs.access or fs.stat
 * - Return true if exists, false otherwise
 * - Handle errors gracefully
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
	// TODO: Implement directory existence check
	// - Use fs.access or fs.stat
	// - Return true if exists, false otherwise
	// - Handle errors gracefully
	
	try {
		const stats = await fs.stat(dirPath)
		return stats.isDirectory()
	} catch {
		return false
	}
}

