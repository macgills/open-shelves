import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  outputDir: 'test-results/visual',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run build && npm run dev',
    url: 'http://127.0.0.1:4173/open-shelves/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'] }
    },
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      }
    }
  ]
});
