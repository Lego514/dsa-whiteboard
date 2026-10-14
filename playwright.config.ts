import { defineConfig, devices } from '@playwright/test';

// 端對端測試跑建置好的獨立網站（vite build --mode e2e），用 vite preview 提供；
// 共用房間的伺服器用 wrangler dev 在本機跑，不用 Cloudflare 帳號
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
  webServer: [
    {
      command: 'npm run preview',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx wrangler dev --port 8787 --ip 127.0.0.1',
      url: 'http://127.0.0.1:8787/health',
      env: { WRANGLER_SEND_METRICS: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
