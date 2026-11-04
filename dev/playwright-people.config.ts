import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/playwright',
  testMatch: 'people.spec.ts',
  timeout: 60000,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  outputDir: '../test-results/people',
  reporter: [['list']],
  webServer: {
    command: 'npm run dev:mocked -- --host 127.0.0.1',
    url: 'http://127.0.0.1:1235/',
    timeout: 120000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://127.0.0.1:1235/',
    channel: process.env.PLAYWRIGHT_CHROME_CHANNEL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    {
      name: 'narrow-touch',
      use: { ...devices['Pixel 5'], defaultBrowserType: 'chromium', colorScheme: 'light' },
    },
  ],
});
