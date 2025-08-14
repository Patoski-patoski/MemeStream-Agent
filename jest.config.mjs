export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json',
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\.\.?/.+)\.js$': '$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!supertest)/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};