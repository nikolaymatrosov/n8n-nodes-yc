module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>'],
	testMatch: [
		'**/__tests__/**/*.ts',
		'**/?(*.)+(spec|test).ts',
	],
	testPathIgnorePatterns: [
		'/node_modules/',
		'/dist/',
		'/docs/',
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: {
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
			},
		}],
	},
	collectCoverageFrom: [
		'nodes/**/*.ts',
		'utils/**/*.ts',
		'credentials/**/*.ts',
		'!**/*.test.ts',
		'!**/*.spec.ts',
		'!**/node_modules/**',
		'!**/dist/**',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1',
		'^@utils/(.*)$': '<rootDir>/utils/$1',
		// Map logging-v1 imports without /index to the /index path
		'^@yandex-cloud/nodejs-sdk/dist/clients/logging-v1$': '@yandex-cloud/nodejs-sdk/dist/clients/logging-v1/index',
	},
	testTimeout: 10000,
	verbose: true,
};

