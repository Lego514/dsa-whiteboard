import { CELL, MAX_CELLS, sizeOf, type BoardDoc, type BoardElement, type Placed, type Point, type Sizes } from './model';
import { parseGraph, parseIntervals, parseTree, readValue, type ParseError } from './structures';
import { idMaker, placeGroup } from './templates';

// 貼上整段範例：把 LeetCode 的 Input（例如 nums = [2,7,11,15], target = 9）一次畫成好幾個元件。
// 每個參數依名稱和值判斷畫成什麼：陣列、字串拆成字元、樹、鏈結串列、圖、區間、二維陣列、字典，數字和布林是變數。

export interface ExampleArg {
  name: string;
  /** 原本的文字，例如 [2,7,11,15] */
  raw: string;
}

/** 名稱和值之間、參數之間的分隔：最外層的逗號或換行，後面接著「名稱 =」 */
export function splitExample(text: string): ExampleArg[] {
  // 去掉 Input:，以及 Output:、Explanation: 之後的東西（整段從題目複製時會帶到）
  const body = text
    .replace(/^\s*(Input|輸入)\s*[:：]/i, '')
    .split(/\n\s*(Output|Explanation|輸出|解釋)\s*[:：]/i)[0]
    .trim();
  const pieces: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if ('[{('.includes(ch)) depth += 1;
    else if (']})'.includes(ch)) depth -= 1;
    else if ((ch === ',' || ch === '\n') && depth === 0 && /^\s*[A-Za-z_]\w*\s*=/.test(body.slice(i + 1))) {
      pieces.push(body.slice(start, i));
      start = i + 1;
    }
  }
  pieces.push(body.slice(start));
  return pieces
    .map((piece) => {
      const match = /^\s*([A-Za-z_]\w*)\s*=\s*([\s\S]*?)\s*$/.exec(piece);
      return match ? { name: match[1].slice(0, 40), raw: match[2] } : { name: '', raw: piece.trim() };
    })
    .filter((arg) => arg.raw !== '');
}

const isPrimitive = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const text = (v: unknown) => (v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 40);

const TREE_NAMES = /^(root\d*|subRoot|tree\d*|original|cloned)$/i;
const LIST_NAMES = /^(head\d*|headA|headB|l\d+|list\d*)$/i;
const EDGE_NAMES = /edges|prerequisites|connections|roads|flights|tickets|times|pairs|equations/i;
const DIRECTED_NAMES = /prerequisites|flights|tickets|times/i;
const ADJ_NAMES = /^(adj\w*|graph|adjList)$/i;
const INTERVAL_NAMES = /interval|meeting|schedule/i;
const COUNT_NAMES = /^(n|numCourses|numNodes|V)$/;

type Built = { el: BoardElement } | { error: ParseError };

function asVar(id: string, name: string, raw: string): Built {
  return { el: { type: 'var', id, x: 0, y: 0, name: name || 'x', value: raw.slice(0, 80) } };
}

/** 一個參數畫成一個元件；n 這種給圖用的數字由呼叫的地方處理 */
function buildArg(arg: ExampleArg, id: string, all: ExampleArg[]): Built {
  const { name, raw } = arg;
  const value = readValue(raw);
  const label = name;
  if (value === undefined) {
    // 讀不懂的就當成變數，至少畫得出來
    return /^[\w.\-+]+$/.test(raw) ? asVar(id, name, raw) : { error: 'badFormat' };
  }
  if (typeof value === 'string') {
    // 字串題常要一個字元一個字元看（滑動視窗），太長的就當成變數
    if (value.length === 0 || value.length > MAX_CELLS) return asVar(id, name, raw);
    return { el: { type: 'list', id, x: 0, y: 0, variant: 'array', label, items: [...value] } };
  }
  if (isPrimitive(value)) return asVar(id, name, raw);
  if (!Array.isArray(value)) {
    const rows = Object.entries(value as Record<string, unknown>).map(([k, v]) => [k.slice(0, 40), text(v)]);
    if (rows.length === 0) return asVar(id, name, raw);
    if (rows.length > 26) return { error: 'tooMany' };
    return { el: { type: 'table', id, x: 0, y: 0, variant: 'dict', label, rows } };
  }
  if (value.length === 0) return asVar(id, name, raw);
  if (value.every(isPrimitive)) {
    if (TREE_NAMES.test(name) || (/^[pq]$/.test(name) && value.includes(null))) {
      const tree = parseTree(raw);
      if ('error' in tree) return tree;
      return { el: { type: 'tree', id, x: 0, y: 0, label, nodes: tree.nodes } };
    }
    if (value.length > MAX_CELLS) return { error: 'tooMany' };
    const items = value.map(text);
    if (LIST_NAMES.test(name)) return { el: { type: 'list', id, x: 0, y: 0, variant: 'linked', label, items } };
    return { el: { type: 'list', id, x: 0, y: 0, variant: 'array', label, items } };
  }
  if (!value.every((row) => Array.isArray(row))) return asVar(id, name, raw);
  const rows = value as unknown[][];
  if (INTERVAL_NAMES.test(name)) {
    const extra = all.find((a) => /^(newInterval|toBeRemoved)$/.test(a.name));
    const parsed = parseIntervals(extra ? `${raw}, ${extra.raw}` : raw);
    if ('error' in parsed) return parsed;
    return { el: { type: 'intervals', id, x: 0, y: 0, label, items: parsed.items } };
  }
  if (EDGE_NAMES.test(name) || ADJ_NAMES.test(name)) {
    const count = all.find((a) => COUNT_NAMES.test(a.name));
    const parsed = parseGraph(`${count ? `n = ${count.raw}, ` : ''}${ADJ_NAMES.test(name) ? 'adj' : 'edges'} = ${raw}`);
    if ('error' in parsed) return parsed;
    const directed = parsed.directed ?? DIRECTED_NAMES.test(name);
    return { el: { type: 'graph', id, x: 0, y: 0, label, nodes: parsed.nodes, edges: parsed.edges, ...(directed ? { directed: true } : {}) } };
  }
  if (!rows.every((row) => row.every(isPrimitive))) return asVar(id, name, raw);
  if (rows.length > 26 || rows.some((row) => row.length > 26)) return { error: 'tooMany' };
  return { el: { type: 'table', id, x: 0, y: 0, variant: 'grid', label, rows: rows.map((row) => row.map(text)) } };
}

/** 兩個元件之間留的空間 */
const GAP = 40;

/**
 * 把一段範例畫成一組元件：資料結構由上往下排，變數排在右邊一欄；整組放在 center 附近的空位。
 * 圖用到的節點數（n、numCourses）和區間的 newInterval 併進那個元件，不另外畫變數
 */
export function insertExample(doc: BoardDoc, input: string, center: Point, sizes?: Sizes): { doc: BoardDoc; ids: string[] } | { error: ParseError } {
  const args = splitExample(input);
  if (args.length === 0) return { error: 'empty' };
  const nextId = idMaker(doc);
  const structures: Placed[] = [];
  const vars: Placed[] = [];
  const consumed = new Set<ExampleArg>();
  const built: [ExampleArg, Built][] = args.map((arg) => [arg, buildArg(arg, nextId(), args)]);
  for (const [, result] of built) {
    if ('error' in result) return result;
    if (result.el.type === 'graph') args.filter((a) => COUNT_NAMES.test(a.name)).forEach((a) => consumed.add(a));
    if (result.el.type === 'intervals') args.filter((a) => /^(newInterval|toBeRemoved)$/.test(a.name)).forEach((a) => consumed.add(a));
  }
  for (const [arg, result] of built) {
    if (consumed.has(arg) || 'error' in result) continue;
    const el = result.el as Placed;
    (el.type === 'var' ? vars : structures).push(el);
  }
  // 由上往下排資料結構，變數放在右邊一欄
  let y = 0;
  let width = 0;
  for (const el of structures) {
    const size = sizeOf(el);
    el.x = 0;
    el.y = y;
    y += size.h + GAP;
    width = Math.max(width, size.w);
  }
  let vy = structures.length > 0 ? CELL / 2 : 0;
  for (const el of vars) {
    el.x = structures.length > 0 ? width + GAP : 0;
    el.y = vy;
    vy += sizeOf(el).h + 12;
  }
  return placeGroup(doc, [...structures, ...vars], center, sizes);
}
