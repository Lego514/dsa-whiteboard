import { forestLayout, type ForestPoint } from './forest';
import { findElement, LABEL_H, updateElement, type BoardDoc, type ElementOf, type HeapStep } from './model';
import type { ParseError } from './structures';

// 字典樹（Trie）：存的是放進去的字，樹由這些字長出來，同一層依字母排；字的最後一個字母畫成結尾。
// insert、search 可以一個字母一個字母記成逐步播放，看出共用的前綴。
// 這裡的常數不在頂層用 model 的值（model 也引用這個檔案），用到時才讀。

export type Trie = ElementOf<'trie'>;

export const TRIE_MAX_WORDS = 30;
export const TRIE_MAX_LEN = 16;
/** 根節點以外最多 62 個字母，樹還放得下 */
export const TRIE_MAX_NODES = 63;
export const TRIE_NODE = 32;
const TRIE_GAP = 8;
const TRIE_LEVEL = 54;

export interface TrieNode {
  /** 這個節點的字母；根節點是空字串 */
  char: string;
  /** 從根走到這裡的字 */
  prefix: string;
  /** 有字在這裡結束 */
  end: boolean;
  parent: number;
}

/** 字典樹的節點，依前序排（同一層依字母），第 0 個是根 */
export function trieNodes(words: readonly string[]): { nodes: TrieNode[]; children: number[][] } {
  const ends = new Set(words.filter(Boolean));
  const prefixes = new Set<string>();
  for (const word of ends) for (let k = 1; k <= word.length; k += 1) prefixes.add(word.slice(0, k));
  const kidsOf = new Map<string, string[]>();
  for (const p of prefixes) {
    const up = p.slice(0, -1);
    kidsOf.set(up, [...(kidsOf.get(up) ?? []), p]);
  }
  const nodes: TrieNode[] = [];
  const children: number[][] = [];
  const visit = (prefix: string, parent: number) => {
    const index = nodes.length;
    nodes.push({ char: prefix.slice(-1), prefix, end: ends.has(prefix), parent });
    children.push([]);
    if (parent >= 0) children[parent].push(index);
    for (const kid of (kidsOf.get(prefix) ?? []).sort()) visit(kid, index);
  };
  visit('', -1);
  return { nodes, children };
}

export interface TrieLayout {
  nodes: TrieNode[];
  centers: Map<number, ForestPoint>;
  w: number;
  h: number;
}

export function trieLayout(el: Trie): TrieLayout {
  const { nodes, children } = trieNodes(el.words);
  // 名稱下面一行寫「search("app")：找到」，再下面才是根
  const forest = forestLayout([0], children, { node: TRIE_NODE, gap: TRIE_GAP, level: TRIE_LEVEL, top: LABEL_H + 22 + TRIE_NODE / 2 });
  return { nodes, centers: forest.centers, w: Math.max(forest.w, 160), h: forest.h };
}

export type TrieResult = 'word' | 'prefix' | 'none';

/** 找一個字：整個字都存在（word）、只是某些字的前綴（prefix）、走到一半就斷了（none） */
export function trieSearch(words: readonly string[], query: string): TrieResult {
  if (words.includes(query)) return 'word';
  return words.some((w) => w.startsWith(query)) ? 'prefix' : 'none';
}

/** 正在找的字從根走得到的節點（依序） */
export function triePath(el: Trie, nodes: readonly TrieNode[]): number[] {
  if (el.at === undefined) return [];
  const out: number[] = [];
  for (let k = 0; k <= el.at.length; k += 1) {
    const index = nodes.findIndex((n) => n.prefix === el.at!.slice(0, k));
    if (index < 0) break;
    out.push(index);
  }
  return out;
}

/** 字只留英文字母和數字以外也收，但去掉空白、引號，最長 16 個字 */
export function cleanWord(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').trim().slice(0, TRIE_MAX_LEN);
}

function nodeCount(words: readonly string[]): number {
  return trieNodes(words).nodes.length;
}

/** 放得下這個字嗎（字數、節點數） */
export function canInsert(el: Trie, word: string): boolean {
  if (!word) return false;
  if (el.words.includes(word)) return true;
  return el.words.length < TRIE_MAX_WORDS && nodeCount([...el.words, word]) <= TRIE_MAX_NODES;
}

function patch(doc: BoardDoc, id: string, next: Partial<Trie>): BoardDoc {
  return updateElement<Trie>(doc, id, next);
}

/**
 * insert：先沿著已經有的前綴往下走（每走一個字母一步），再把字放進去。
 * 回傳每一步；放不下時是空的
 */
export function trieInsert(doc: BoardDoc, id: string, raw: string): HeapStep[] {
  const el = findElement(doc, id);
  const word = cleanWord(raw);
  if (el?.type !== 'trie' || !canInsert(el, word)) return [];
  const steps: HeapStep[] = [];
  const nodes = trieNodes(el.words).nodes;
  for (let k = 1; k < word.length && nodes.some((n) => n.prefix === word.slice(0, k)); k += 1) {
    steps.push({ doc: patch(doc, id, { at: word.slice(0, k) }), caption: `insert("${word}"): ${word.slice(0, k)}` });
  }
  const words = el.words.includes(word) ? el.words : [...el.words, word];
  steps.push({ doc: patch(doc, id, { words, at: word }), caption: `insert("${word}")` });
  return steps;
}

/** search：一個字母一個字母往下走，走不下去就停；最後一步寫結果 */
export function trieSearchSteps(doc: BoardDoc, id: string, raw: string): HeapStep[] {
  const el = findElement(doc, id);
  const word = cleanWord(raw);
  if (el?.type !== 'trie' || !word) return [];
  const steps: HeapStep[] = [];
  for (let k = 1; k <= word.length; k += 1) {
    const prefix = word.slice(0, k);
    const missing = trieSearch(el.words, prefix) === 'none';
    const result = k === word.length || missing ? `: ${trieSearch(el.words, word)}` : '';
    // 最後一步（找到底或走不下去）放整個字，畫面寫出找的是什麼、結果如何
    steps.push({ doc: patch(doc, id, { at: result ? word : prefix }), caption: `search("${word}"): ${prefix}${result}` });
    if (missing) break;
  }
  return steps;
}

export function trieRemove(doc: BoardDoc, id: string, word: string): BoardDoc {
  const el = findElement(doc, id);
  if (el?.type !== 'trie') return doc;
  return patch(doc, id, { words: el.words.filter((w) => w !== word), at: el.at === word ? undefined : el.at });
}

export function setTrieAt(doc: BoardDoc, id: string, at: string | undefined): BoardDoc {
  return patch(doc, id, { at: at ? cleanWord(at) : undefined });
}

/** 用文字建立：["apple","app","apt"]、words = [...]，或用逗號、空白隔開的字 */
export function parseTrie(text: string): { words: string[] } | { error: ParseError } {
  const body = text.replace(/^\s*[A-Za-z_]\w*\s*=\s*/, '').trim();
  let raw: string[];
  if (body.startsWith('[')) {
    try {
      const value: unknown = JSON.parse(body.replace(/'/g, '"'));
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return { error: 'badFormat' };
      raw = value as string[];
    } catch {
      return { error: 'badFormat' };
    }
  } else {
    raw = body.split(/[,\s]+/);
  }
  const words = [...new Set(raw.map((w) => w.trim()).filter(Boolean))];
  if (words.length === 0) return { error: 'empty' };
  if (words.length > TRIE_MAX_WORDS || words.some((w) => w.length > TRIE_MAX_LEN) || nodeCount(words) > TRIE_MAX_NODES) return { error: 'tooMany' };
  return { words };
}

export function serializeTrie(el: Trie): string {
  return `words = [${el.words.map((w) => JSON.stringify(w)).join(',')}]`;
}
