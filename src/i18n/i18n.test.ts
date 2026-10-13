import { describe, expect, it } from 'vitest';
import { en } from './en';
import { zhTW } from './zh-TW';

// 中日韓文字與全形標點；用字元碼組出範圍，原始碼裡才不會出現全形字
const range = (from: number, to: number) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`;
const CJK = new RegExp(`[${range(0x3000, 0x303f)}${range(0x4e00, 0x9fff)}${range(0xff00, 0xffef)}]`);

/** 把字典攤平成字串；函式用幾組假參數呼叫，檢查產生的句子 */
function collectStrings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return [1, 2, 0].flatMap((n) => collectStrings(fn(...Array.from({ length: fn.length }, () => n)), `${path}()`));
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => collectStrings(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => collectStrings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** 所有 key 的路徑，用來比對兩個語言有沒有一樣 */
function keyPaths(value: unknown, path = ''): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => keyPaths(v, path ? `${path}.${k}` : k));
  }
  return [path];
}

describe('dictionaries', () => {
  it('have the same keys in both languages', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(zhTW).sort());
  });

  it('have no empty strings', () => {
    for (const dict of [zhTW, en]) {
      expect(collectStrings(dict).filter(([, text]) => text.trim() === '')).toEqual([]);
    }
  });

  it('keep Chinese out of the English dictionary', () => {
    expect(collectStrings(en).filter(([, text]) => CJK.test(text))).toEqual([]);
  });
});
