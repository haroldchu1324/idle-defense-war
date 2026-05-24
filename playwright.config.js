// Load test environment variables from .env.test before anything else
require('dotenv').config({ path: '.env.test' });

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',

  // Per-test timeout (auth tests hit real Supabase so need more time)
  timeout: 60_000,

  // Assertion timeout
  expect: { timeout: 30_000 },

  // No automatic retries — if a test fails we want to know immediately
  retries: 0,

  // Run tests sequentially (avoids Supabase rate-limiting during auth)
  workers: 1,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Start a local static server for every test run
  webServer: {
    command: 'npm run serve:test',
    url: 'http://localhost:5000',
    // Reuse an already-running server in local dev; always start fresh in CI
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
