/** @type {import('jest').Config} Unit tests: no server, no database, every dependency mocked. */
module.exports = {
  ...require('../../jest.config.base'),
  rootDir: '../..',
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  // Type-checking every spec makes the run ten times slower.
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', isolatedModules: true }] },
  setupFiles: ['<rootDir>/test/unit/setup.ts'],
  testTimeout: 10000,
  detectOpenHandles: false,
};
