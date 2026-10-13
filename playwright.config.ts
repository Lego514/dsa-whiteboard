import { defineConfig, devices } from '@playwright/test';

// 端對端測試跑建置好的獨立網站（npm run build:app），用 vite preview 提供
const PORT = 4180;
const baseURL = `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // iPhone 上所有瀏覽器都用 WebKit
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
