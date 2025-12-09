module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>'],
	testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	collectCoverageFrom: [
		'**/*.ts',
		'!**/*.d.ts',
		'!**/node_modules/**',
		'!**/dist/**',
		'!**/output/**',
		'!**/*.config.ts',
		'!**/scripts/**', // Scripts are integration tests, not unit tests
		'!**/base/**', // Base classes are framework code
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: {
				noUnusedLocals: false, // Allow unused parameters in abstract methods
				noUnusedParameters: false,
			},
		}],
	},
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	verbose: true,
	setupFilesAfterEnv: [],
	testTimeout: 10000,
}

