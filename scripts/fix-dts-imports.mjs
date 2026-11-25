// tsc 產生的 .d.ts 照抄 src 裡的 import（'./lib/model'，沒有副檔名）。套件是 "type": "module"，
// 用 moduleResolution node16 / nodenext 的專案會找不到這些檔案，型別全部變成 any（issue #34）。
// 這裡把 dist/types 裡相對路徑的 import 補成 Node 找得到的樣子：'./lib/model.js'、資料夾補 '/index.js'。
// 只看檔案系統上真的有的 .d.ts，找不到就讓建置失敗，不要默默發出壞掉的型別。
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TYPES_DIR = path.resolve(process.argv[2] ?? 'dist/types');

// from '…'、import('…')、import '…'（只有副作用的 import）
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(['"])(\.\.?(?:\/[^'"]*)?)\2/gm;

function listDts(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listDts(full);
    return name.endsWith('.d.ts') ? [full] : [];
  });
}

/** './lib/model' → './lib/model.js'；'./i18n' → './i18n/index.js'；已經有 .js 的不動 */
function withExtension(file, specifier) {
  if (specifier.endsWith('.js')) return specifier;
  const target = path.resolve(path.dirname(file), specifier);
  if (existsSync(`${target}.d.ts`)) return `${specifier}.js`;
  if (existsSync(path.join(target, 'index.d.ts'))) return `${specifier.replace(/\/$/, '')}/index.js`;
  throw new Error(`${path.relative(TYPES_DIR, file)}: cannot find the declaration file for '${specifier}'`);
}

let changed = 0;
for (const file of listDts(TYPES_DIR)) {
  const source = readFileSync(file, 'utf8');
  const fixed = source.replace(SPECIFIER, (_match, prefix, quote, specifier) => `${prefix}${quote}${withExtension(file, specifier)}${quote}`);
  if (fixed !== source) {
    writeFileSync(file, fixed);
    changed += 1;
  }
}
console.log(`Added .js extensions to relative imports in ${changed} declaration files`);
