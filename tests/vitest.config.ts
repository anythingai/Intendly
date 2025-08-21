/**
 * @fileoverview Vitest configuration for comprehensive testing
 * @description Configuration for unit, integration, and e2e tests
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup/vitest-setup.ts'],
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    globalSetup: './setup/global-setup.ts',
    maxConcurrency: 5, // Limit concurrent tests to avoid resource conflicts
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/setup/**',
        '**/mocks/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    include: [
      '**/*.test.ts',
      '**/*.spec.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'e2e/**' // E2E tests run separately with Playwright
    ]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../'),
      '@/backend': resolve(__dirname, '../backend/src'),
      '@/contracts': resolve(__dirname, '../contracts/src'),
      '@/solver-sdk': resolve(__dirname, '../solver-sdk/src'),
      '@/web': resolve(__dirname, '../web'),
      '@/shared': resolve(__dirname, '../shared'),
      '@/tests': resolve(__dirname, './')
    }
  },
  define: {
    global: 'globalThis'
  }
});