/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/llm-regression/.*\\.test\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }] },
  testEnvironment: 'node',
  testTimeout: 120000, // live model + judge calls per case
  detectOpenHandles: true,
  forceExit: true,
};
