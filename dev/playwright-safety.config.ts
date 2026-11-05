import { defineConfig } from '@playwright/test';

import base from './playwright-people.config';

export default defineConfig({
  ...base,
  testMatch: 'localSafety.spec.ts',
  outputDir: '../test-results/local-safety',
  webServer: {
    command: 'npm run dev:mocked -- --host 127.0.0.1',
    url: 'http://127.0.0.1:1235/',
    timeout: 120000,
    reuseExistingServer: true,
  },
});
