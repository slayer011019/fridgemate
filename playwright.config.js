import { defineConfig, devices } from '@playwright/test';

const sharedUse = {
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    ...sharedUse,
    ...devices['Desktop Chrome']
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: '',
        VITE_ENABLE_OCR: 'true'
      }
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: '/api',
        VITE_ENABLE_OCR: 'true'
      }
    }
  ],
  projects: [
    {
      name: 'local-only',
      testMatch: ['local-only.spec.js', 'ocr-import.spec.js'],
      use: {
        ...sharedUse,
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173'
      }
    },
    {
      name: 'api-mode',
      testMatch: ['api-mode.spec.js'],
      use: {
        ...sharedUse,
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4174'
      }
    }
  ]
});
