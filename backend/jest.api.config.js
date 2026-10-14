module.exports = {
  ...require('./jest.config.base'),
  // Every suite in test/api, against the backend already running on BACKEND_PORT (see test/README.md).
  testMatch: ['<rootDir>/test/api/*.test.ts'],
  setupFiles: ['<rootDir>/test/api/env.ts'],
};
