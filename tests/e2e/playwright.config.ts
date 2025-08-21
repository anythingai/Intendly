/**
 * @fileoverview Playwright configuration for E2E tests
 * @description Configuration for browser-based end-to-end testing
 */

import { defineConfig, devices } from '@playwright/test';
import { testConfig } from '../setup/test-config.js';

export default defineConfig({
  testDir: './specs',
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },
  fullyParallel: false, // Run tests sequentially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker to avoid resource conflicts
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  outputDir: 'test-results/',
  
  use: {
    baseURL: 'http://localhost:3000', // Frontend app URL
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    }
  ],

  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      cwd: '../web',
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    },
    {
      command: 'npm run dev',
      port: 3001,
      cwd: '../backend',
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    }
  ],

  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts'
});