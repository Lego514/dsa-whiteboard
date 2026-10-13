// 樣式不經過打包，直接複製到 dist，讓使用的一方自己決定要引入哪些
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
for (const name of ['board.css', 'base.css']) copyFileSync(`src/styles/${name}`, `dist/${name}`);
