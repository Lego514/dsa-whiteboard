import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// README 的截圖和動畫：npm run media（會先建置），存到 docs/images/。
// 跟端對端測試用一樣的伺服器：建好的網站加上本機的 wrangler dev（共用房間）。
export default defineConfig({
  ...base,
  testDir: './scripts/media',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  projects: [{ name: 'media', use: { ...devices['Desktop Chrome'] } }],
});
