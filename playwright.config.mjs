// Playwright runs the pointer, keyboard and touch tests in e2e/ in Chromium, Firefox and WebKit (Safari's engine).
// `npm run test:e2e` starts the dev server itself; set ROMLY_URL to test a running site instead, e.g. staging.
import { defineConfig, devices } from '@playwright/test';

const port = 5176;
const baseURL = process.env.ROMLY_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /touch/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /touch/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /touch/ },
    { name: 'phone-chromium', use: { ...devices['Pixel 7'] }, testMatch: /touch/ },
    { name: 'phone-webkit', use: { ...devices['iPhone 14'] }, testMatch: /touch/ },
  ],
  webServer: process.env.ROMLY_URL ? undefined : {
    command: `node scripts/run-framework.mjs dev --port ${port} --strictPort`,
    url: `${baseURL}/studio/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
