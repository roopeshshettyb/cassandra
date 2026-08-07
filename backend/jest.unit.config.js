/** @type {import('jest').Config} Pure unit suite — no server, no DB, no network. */
module.exports = {
  ...require('./jest.config.base'),
  testRegex: 'test/unit/.*\\.spec\\.ts$',
  testTimeout: 5000,
  detectOpenHandles: false,
  forceExit: false,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.model.ts', '!src/**/*.module.ts', '!src/main.ts', '!src/seed.ts'],
};
