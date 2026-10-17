import { findElement, updateElement, type BoardDoc, type CellColor, type ElementOf } from './model';
import type { ParseError } from './structures';

// 位元列：把一個數字畫成一排 0/1（第一格是最高位），位移、清掉最低位的 1 時看得到每一位怎麼動。
// Number of 1 Bits、Counting Bits、Reverse Bits 這類題目用。

/** 最多 32 位（LeetCode 的位元題大多是 32 位元整數） */
export const BITS_MAX = 32;

/** variant 是 bits 的 list；型別寫窄一點，判斷「不是位元列」時其他 list 才不會被一起排除 */
export type BitsList = ElementOf<'list'> & { variant: 'bits' };

export function isBits(el: { type: string; variant?: string } | undefined): el is BitsList {
  return el?.type === 'list' && el.variant === 'bits';
}

/** 這一格是第幾位（最右邊是第 0 位） */
export function bitPosition(el: BitsList, index: number): number {
  return el.items.length - 1 - index;
}

/** 這排位元代表的數字；不是 1 的格子都當 0 */
export function bitsValue(el: BitsList): number {
  return el.items.reduce((sum, v) => sum * 2 + (v.trim() === '1' ? 1 : 0), 0);
}

/** 幾個 1（popcount） */
export function onesCount(el: BitsList): number {
  return el.items.filter((v) => v.trim() === '1').length;
}

/** 放得下這個數字的寬度：至少 8 位，以 4 位為單位，最多 32 位 */
export function bitsWidth(value: number): number {
  const needed = value > 0 ? Math.floor(Math.log2(value)) + 1 : 1;
  return Math.min(BITS_MAX, Math.max(8, Math.ceil(needed / 4) * 4));
}

export function toBits(value: number, width: number): string[] {
  return Array.from({ length: width }, (_, i) => (Math.floor(value / 2 ** (width - 1 - i)) % 2 === 1 ? '1' : '0'));
}

/**
 * 讀數字：13 或 n = 13 是十進位；0b1101、"1101" 和 LeetCode 191 那種 32 個 0/1 的寫法
 * （n = 00000000000000000000000000001011）是二進位，寬度照寫的位數
 */
export function parseBits(text: string): { items: string[]; name?: string } | { error: ParseError } {
  const match = /^\s*(?:([A-Za-z_]\w*)\s*=\s*)?([\s\S]*?)\s*$/.exec(text)!;
  const name = match[1]?.slice(0, 40);
  const body = match[2].replace(/,\s*[A-Za-z_]\w*\s*=[\s\S]*$/, '').trim();
  if (!body) return { error: 'empty' };
  const named = name ? { name } : {};
  const binary = /^0b([01]+)$/i.exec(body) ?? /^["']([01]+)["']$/.exec(body) ?? (/^0[01]+$/.test(body) ? [body, body] : null);
  if (binary) {
    const digits = binary[1].replace(/^0+(?=[01]{32})/, '');
    if (digits.length > BITS_MAX) return { error: 'tooMany' };
    return { items: [...digits], ...named };
  }
  if (!/^\d+$/.test(body)) return { error: 'badFormat' };
  const value = Number(body);
  if (value >= 2 ** BITS_MAX) return { error: 'tooMany' };
  return { items: toBits(value, bitsWidth(value)), ...named };
}

/** 寫回二進位，寬度留著 */
export function serializeBits(el: BitsList): string {
  const body = `0b${el.items.map((v) => (v.trim() === '1' ? '1' : '0')).join('')}`;
  return el.label ? `${el.label} = ${body}` : body;
}

function setBits(doc: BoardDoc, el: BitsList, items: string[], colors: (CellColor | null)[] | undefined): BoardDoc {
  const kept = colors?.some((c) => c !== null) ? colors : undefined;
  return updateElement<BitsList>(doc, el.id, { items, colors: kept });
}

/** 左移或右移一位，寬度不變（超出的位丟掉，空出來的補 0）；底色跟著那一位走 */
export function shiftBits(doc: BoardDoc, id: string, dir: 'left' | 'right'): BoardDoc {
  const el = findElement(doc, id);
  if (!isBits(el)) return doc;
  const colors = el.colors && el.items.map((_, i) => el.colors?.[i] ?? null);
  if (dir === 'left') return setBits(doc, el, [...el.items.slice(1), '0'], colors && [...colors.slice(1), null]);
  return setBits(doc, el, ['0', ...el.items.slice(0, -1)], colors && [null, ...colors.slice(0, -1)]);
}

/** 最低位的 1 在第幾格；沒有 1 時是 -1 */
export function lowestOne(el: BitsList): number {
  for (let i = el.items.length - 1; i >= 0; i -= 1) if (el.items[i].trim() === '1') return i;
  return -1;
}

/** n & (n - 1)：清掉最低位的 1 */
export function clearLowestOne(doc: BoardDoc, id: string): BoardDoc {
  const el = findElement(doc, id);
  if (!isBits(el)) return doc;
  const at = lowestOne(el);
  if (at < 0) return doc;
  return updateElement<BitsList>(doc, id, { items: el.items.map((v, i) => (i === at ? '0' : v)) });
}

export function flipBit(doc: BoardDoc, id: string, index: number): BoardDoc {
  const el = findElement(doc, id);
  if (!isBits(el) || index < 0 || index >= el.items.length) return doc;
  return updateElement<BitsList>(doc, id, { items: el.items.map((v, i) => (i === index ? (v.trim() === '1' ? '0' : '1') : v)) });
}

/** 改成另一個數字：寬度放得下就不變，放不下就加寬；底色清掉 */
export function setBitsValue(doc: BoardDoc, id: string, value: number): BoardDoc {
  const el = findElement(doc, id);
  if (!isBits(el) || !Number.isInteger(value) || value < 0 || value >= 2 ** BITS_MAX) return doc;
  const width = Math.max(el.items.length, bitsWidth(value));
  return updateElement<BitsList>(doc, id, { items: toBits(value, width), colors: undefined });
}
