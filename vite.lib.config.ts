import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 建置成給其他專案用的套件：React、zod 由使用的一方提供，不打包進來
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: { index: 'src/index.ts', schema: 'src/schema.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, 'zod'],
    },
  },
});
