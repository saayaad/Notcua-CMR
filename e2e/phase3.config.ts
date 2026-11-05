import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'campaign-alternatives.spec.ts',
  workers: 1,
  outputDir: '../.audit/phase3-results',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5188', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-1366', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'desktop-1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'mobile-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer:
    process.env.PHASE3_USE_RUNNING_SERVER === '1'
      ? undefined
      : {
          command: 'node e2e/scripts/phase3-editor-server.mjs',
          cwd: '..',
          url: 'http://127.0.0.1:5188/phase3-editor.html',
          reuseExistingServer: false,
          timeout: 60000,
        },
});
