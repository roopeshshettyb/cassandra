// UI tests: the real frontend against the real backend and a seeded local Postgres.
// Everything for them lives in this folder. Run: npm run test:e2e   (see README.md here)
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { env, BACKEND_URL, FRONTEND_URL, FRONTEND_PORT } = require('./support/env');

module.exports = defineConfig({
  testDir: __dirname,
  outputDir: path.join(__dirname, 'test-results'),
  workers: 1, // one seeded database shared by every test
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(__dirname, 'playwright-report') }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
  ],
  // In order: the frontend fetches its constants from the backend, as `npm start` does, then is
  // built into e2e/build (not build/) and served as a static SPA, which is what ships.
  webServer: [
    {
      command: 'npm run seed && npx nest build && node dist/main.js',
      cwd: path.join(__dirname, '../../backend'),
      url: `${BACKEND_URL}/health`,
      env,
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
    {
      command: `npm run fetch-constants && npx react-scripts build && node e2e/support/serve.js ${FRONTEND_PORT}`,
      cwd: path.join(__dirname, '..'),
      url: FRONTEND_URL,
      env: { ...env, REACT_APP_BACKEND_URL: BACKEND_URL, BUILD_PATH: path.join(__dirname, 'build'), GENERATE_SOURCEMAP: 'false', CI: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
  ],
});
