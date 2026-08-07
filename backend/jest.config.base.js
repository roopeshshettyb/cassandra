/** @type {import('jest').Config} Shared base for the api and llm-regression suites. */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  testEnvironment: 'node',
  testTimeout: 120000, // live API/model calls need headroom
  detectOpenHandles: true,
  forceExit: true,
};
