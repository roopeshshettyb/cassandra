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
  // The REST API layer. Chat, voice, speech and the model/SDK wrappers sit behind sockets
  // and third-party calls; test/api/sockets.api.test.ts and npm run test:llm cover those.
  collectCoverageFrom: [
    'src/{accounts,auth,bookings,costs,dashboard,hotels,integrations,organisations,requests,restaurant,rooms}/**/*.{service,controller,guard,adapter,registry,middleware,strategy}.ts',
    'src/notifications/notifications.{service,controller}.ts',
    'src/oauth/oauth.{service,controller}.ts',
    'src/oauth/email/email.service.ts',
    'src/common/constants/constants.{service,controller}.ts',
    'src/app.controller.ts',
  ],
  // Just under today's numbers, so new API code without tests fails `npm run test:unit:cov`.
  coverageThreshold: { global: { statements: 95, lines: 95, functions: 90, branches: 80 } },
};
