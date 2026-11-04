import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: 'tests/playwright',
  outputDir: 'test-results/standard',
  timeout: process.env.CI ? 60 * 5 * 1000 : 30 * 1000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  webServer: {
    command: 'npm run dev:mocked -- --host 127.0.0.1',
    port: 1235,
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://127.0.0.1:1235/',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHROME_CHANNEL },
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
      name: 'ios',
      use: { ...devices['iPhone X'] },
    },
  ],
};
export default config;
