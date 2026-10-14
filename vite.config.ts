/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 獨立的白板網站（GitHub Pages）；元件本身用 vite.lib.config.ts 建置成套件
export default defineConfig({
  // 相對路徑，部署在 GitHub Pages 的 /dsa-whiteboard/ 底下也找得到檔案
  base: './',
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
  build: { outDir: 'dist-app' },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
  },
});
