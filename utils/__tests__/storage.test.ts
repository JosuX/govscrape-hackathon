import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'fs/promises'
import {
	createSessionDirectory,
	saveBatchToFile,
	saveIntakeToFile,
	downloadFileLocally,
	readBatchFiles,
	generateSessionName,
	directoryExists,
} from '../storage'

// Mock fs module
jest.mock('fs/promises')

describe('storage', () => {
	const mockFs = fs as jest.Mocked<typeof fs>

	beforeEach(() => {
		jest.clearAllMocks()
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('createSessionDirectory', () => {
		it('should create session directory for source stage', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			
			const sessionName = 'test_session'
			const result = await createSessionDirectory(sessionName, 'source')
			
			expect(result).toContain('output')
			expect(result).toContain('source')
			expect(result).toContain(sessionName)
			expect(mockFs.mkdir).toHaveBeenCalledWith(
				expect.stringContaining(sessionName),
				{ recursive: true }
			)
		})

		it('should create session directory for intake stage', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			
			const sessionName = 'test_session'
			const result = await createSessionDirectory(sessionName, 'intake')
			
			expect(result).toContain('intake')
			expect(mockFs.mkdir).toHaveBeenCalled()
		})

		it('should throw error on failure', async () => {
			mockFs.mkdir.mockRejectedValue(new Error('Permission denied'))
			
			await expect(
				createSessionDirectory('test', 'source')
			).rejects.toThrow('Failed to create session directory')
		})
	})

	describe('saveBatchToFile', () => {
		it('should save batch data to JSON file', async () => {
			mockFs.writeFile.mockResolvedValue(undefined)
			const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
			
			const data = { metadata: {}, items: [] }
			const sessionDir = '/test/session'
			const batchNum = 1
			
			await saveBatchToFile(data, sessionDir, batchNum)
			
			expect(mockFs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('batch_1.json'),
				expect.stringContaining('"metadata"'),
				'utf-8'
			)
			expect(consoleSpy).toHaveBeenCalled()
			
			consoleSpy.mockRestore()
		})

		it('should pretty print JSON', async () => {
			mockFs.writeFile.mockResolvedValue(undefined)
			
			const data = { test: 'value' }
			await saveBatchToFile(data, '/test', 1)
			
			const writeCall = mockFs.writeFile.mock.calls[0]
			const jsonContent = writeCall[1] as string
			const parsed = JSON.parse(jsonContent)
			
			expect(parsed).toEqual(data)
			expect(jsonContent).toContain('\n') // Pretty printed
		})

		it('should throw error on write failure', async () => {
			mockFs.writeFile.mockRejectedValue(new Error('Disk full'))
			
			await expect(
				saveBatchToFile({}, '/test', 1)
			).rejects.toThrow('Failed to save batch file')
		})
	})

	describe('saveIntakeToFile', () => {
		it('should create intake directory if not exists', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			mockFs.writeFile.mockResolvedValue(undefined)
			const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
			
			const data = { contracts: [], agencies: [] }
			await saveIntakeToFile(data, 'test_intake')
			
			expect(mockFs.mkdir).toHaveBeenCalledWith(
				expect.stringContaining('intake'),
				{ recursive: true }
			)
			expect(mockFs.writeFile).toHaveBeenCalled()
			
			consoleSpy.mockRestore()
		})

		it('should save intake data to JSON file', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			mockFs.writeFile.mockResolvedValue(undefined)
			
			const data = { contracts: [] }
			await saveIntakeToFile(data, 'test_intake')
			
			expect(mockFs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('test_intake.json'),
				expect.any(String),
				'utf-8'
			)
		})
	})

	describe('downloadFileLocally', () => {
		beforeEach(() => {
			global.fetch = jest.fn() as jest.Mock
		})

		it('should download file and save locally', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			mockFs.writeFile.mockResolvedValue(undefined)
			
			const mockHeaders = new Map<string, string>()
			mockHeaders.set('content-type', 'application/pdf')
			
			const mockResponse = {
				ok: true,
				headers: {
					get: jest.fn((key: string) => mockHeaders.get(key)),
				},
				arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
			}
			;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
			
			const result = await downloadFileLocally(
				'https://example.com/file.pdf',
				'contract-123',
				'file.pdf'
			)
			
			expect(result).toContain('contract-123')
			expect(result).toContain('file.pdf')
			expect(mockFs.mkdir).toHaveBeenCalled()
			expect(mockFs.writeFile).toHaveBeenCalled()
		})

		it('should throw error on download failure', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: 'Not Found',
			}
			;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
			
			await expect(
				downloadFileLocally('https://example.com/missing.pdf', 'contract-123', 'missing.pdf')
			).rejects.toThrow('Failed to download file')
		})

		it('should create contract directory', async () => {
			mockFs.mkdir.mockResolvedValue(undefined)
			mockFs.writeFile.mockResolvedValue(undefined)
			
			const mockHeaders = new Map<string, string>()
			mockHeaders.set('content-type', 'application/pdf')
			
			const mockResponse = {
				ok: true,
				headers: {
					get: jest.fn((key: string) => mockHeaders.get(key)),
				},
				arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
			}
			;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
			
			await downloadFileLocally('https://example.com/file.pdf', 'contract-123', 'file.pdf')
			
			expect(mockFs.mkdir).toHaveBeenCalledWith(
				expect.stringContaining('contract-123'),
				{ recursive: true }
			)
		})
	})

	describe('readBatchFiles', () => {
		it('should read and parse all batch files', async () => {
			const mockFiles = ['batch_1.json', 'batch_2.json', 'other.txt']
			mockFs.readdir.mockResolvedValue(mockFiles as any)
			
			const batch1 = { metadata: {}, items: [] }
			const batch2 = { metadata: {}, items: [] }
			
			mockFs.readFile
				.mockResolvedValueOnce(JSON.stringify(batch1))
				.mockResolvedValueOnce(JSON.stringify(batch2))
			
			const result = await readBatchFiles('/test/session')
			
			expect(result).toHaveLength(2)
			expect(result[0]).toEqual(batch1)
			expect(result[1]).toEqual(batch2)
		})

		it('should filter only batch_*.json files', async () => {
			const mockFiles = ['batch_1.json', 'other.txt', 'batch_2.json', 'not_batch.json']
			mockFs.readdir.mockResolvedValue(mockFiles as any)
			mockFs.readFile.mockResolvedValue('{}')
			
			await readBatchFiles('/test/session')
			
			expect(mockFs.readFile).toHaveBeenCalledTimes(2) // Only batch files
		})

		it('should handle read errors gracefully', async () => {
			const mockFiles = ['batch_1.json', 'batch_2.json']
			mockFs.readdir.mockResolvedValue(mockFiles as any)
			mockFs.readFile
				.mockResolvedValueOnce('{}')
				.mockRejectedValueOnce(new Error('Read error'))
			
			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
			
			const result = await readBatchFiles('/test/session')
			
			expect(result).toHaveLength(1) // One successful read
			expect(consoleSpy).toHaveBeenCalled()
			
			consoleSpy.mockRestore()
		})

		it('should sort batch files', async () => {
			const mockFiles = ['batch_2.json', 'batch_1.json', 'batch_10.json']
			mockFs.readdir.mockResolvedValue(mockFiles as any)
			mockFs.readFile.mockResolvedValue('{}')
			
			await readBatchFiles('/test/session')
			
			// Check that files are read in sorted order
			const calls = mockFs.readFile.mock.calls
			expect(calls.length).toBe(3)
		})
	})

	describe('generateSessionName', () => {
		it('should generate session name with source and date', () => {
			const dateRange = {
				from: new Date('2024-01-15'),
				to: new Date('2024-01-15'),
			}
			
			const name = generateSessionName('test-source', dateRange)
			
			expect(name).toContain('session')
			expect(name).toContain('test-source')
			expect(name).toContain('2024-01-15')
			expect(name).toMatch(/session_test-source_2024-01-15_\d+$/)
		})

		it('should include timestamp', () => {
			const dateRange = {
				from: new Date('2024-01-15'),
				to: new Date('2024-01-15'),
			}
			
			const name1 = generateSessionName('test', dateRange)
			const name2 = generateSessionName('test', dateRange)
			
			// Both should contain the date
			expect(name1).toContain('2024-01-15')
			expect(name2).toContain('2024-01-15')
			
			// Both should contain timestamp (numeric value)
			const timestamp1 = name1.split('_').pop()
			const timestamp2 = name2.split('_').pop()
			expect(timestamp1).toMatch(/^\d+$/)
			expect(timestamp2).toMatch(/^\d+$/)
			
			// Names should have the correct format
			expect(name1).toMatch(/^session_test_2024-01-15_\d+$/)
			expect(name2).toMatch(/^session_test_2024-01-15_\d+$/)
		})
	})

	describe('directoryExists', () => {
		it('should return true if directory exists', async () => {
			const mockStats = { isDirectory: () => true } as any
			mockFs.stat.mockResolvedValue(mockStats)
			
			const result = await directoryExists('/test/dir')
			expect(result).toBe(true)
		})

		it('should return false if directory does not exist', async () => {
			mockFs.stat.mockRejectedValue(new Error('ENOENT'))
			
			const result = await directoryExists('/test/dir')
			expect(result).toBe(false)
		})

		it('should return false if path is a file', async () => {
			const mockStats = { isDirectory: () => false } as any
			mockFs.stat.mockResolvedValue(mockStats)
			
			const result = await directoryExists('/test/file.txt')
			expect(result).toBe(false)
		})
	})
})

