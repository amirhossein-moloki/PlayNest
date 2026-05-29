/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/?(*.)+(spec|test|e2e.test).[jt]s?(x)'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  clearMocks: true,
  transformIgnorePatterns: ['/node_modules/(?!uuid|@faker-js/faker)'],
  moduleNameMapper: {
    '^cuid$': '<rootDir>/test-utils/cuid.ts',
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.test.ts',
    '!src/**/*.e2e.test.ts',
    '!src/docs/**',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
