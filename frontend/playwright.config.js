// UI tests (e2e/): Playwright starts a seeded backend and the built frontend, signs each role in
// once (auth.setup.js), then runs the specs. Run with `npm run test:e2e`.
const { defineConfig, devices } = require('@playwright/test');
const { BACKEND_URL, FRONTEND_URL } = require('./e2e/settings');

const isCI = !!process.env.CI;
const STACK_TIMEOUT_MS = 10 * 60 * 1000;

module.exports = defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  timeout: 60000,
  // Under two parallel browsers the backend has answered list calls in 6–10s, so checks wait up to 20s.
  expect: { timeout: 20000 },
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [[isCI ? 'github' : 'list'], ['html', { outputFolder: 'e2e/.report', open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // The app's service worker would carry its requests in Firefox and WebKit, where page.route
    // cannot see them, so stubs would never answer. Nothing tested needs it.
    serviceWorkers: 'block',
  },
  // Every desktop spec runs in each engine: Chrome's, Firefox's, Safari's (WebKit) and Edge.
  // Edge is the installed browser (`npx playwright install msedge`); the rest ship with Playwright.
  projects: [
    // Signs in once in Chromium; the saved sessions are browser-agnostic, so every project uses them.
    { name: 'setup', testMatch: /auth\.setup\.js/, use: devices['Desktop Chrome'] },
    ...[
      ['chromium', devices['Desktop Chrome']],
      ['firefox', devices['Desktop Firefox']],
      ['webkit', devices['Desktop Safari']],
      ['msedge', { ...devices['Desktop Edge'], channel: 'msedge' }],
    ].map(([name, use]) => ({ name, testMatch: /\.spec\.js/, testIgnore: /\.mobile\.spec\.js/, use, dependencies: ['setup'] })),
    { name: 'mobile', testMatch: /\.mobile\.spec\.js/, use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
  ],
  // Started in order: the frontend build reads its constants from the running backend.
  // Locally a stack already running on these ports is reused, so reruns skip the build.
  webServer: [
    { command: 'node e2e/start-backend.js', url: `${BACKEND_URL}/health`, timeout: STACK_TIMEOUT_MS, reuseExistingServer: !isCI, stdout: 'pipe' },
    { command: 'node e2e/start-frontend.js', url: FRONTEND_URL, timeout: STACK_TIMEOUT_MS, reuseExistingServer: !isCI, stdout: 'pipe' },
  ],
});
