import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../.audit/playwright-results',
  reporter: [['line'], ['html', { outputFolder: '../.audit/playwright-report', open: 'never' }]],
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-1366', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'desktop-1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'mobile-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: process.env.AUDIT_USE_RUNNING_SERVER === '1' ? undefined : {
    command: 'npm run audit:dev',
    cwd: '..',
    url: 'http://127.0.0.1:3340/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
