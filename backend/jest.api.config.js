module.exports = {
  ...require('./jest.config.base'),
  // Every suite in test/api. Starts the backend itself unless one is already running (see test/README.md).
  testMatch: ['<rootDir>/test/api/*.test.ts'],
  setupFiles: ['<rootDir>/test/api/env.ts'],
  globalSetup: '<rootDir>/test/api/global-setup.ts',
  globalTeardown: '<rootDir>/test/api/global-teardown.ts',
};
