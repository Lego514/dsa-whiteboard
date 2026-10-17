import { forestLayout, type ForestPoint } from './forest';
import { CELL, findElement, INDEX_H, LABEL_H, updateElement, type BoardDoc, type CellColor, type ElementOf, type HeapStep } from './model';
import { parseGraph, type ParseError } from './structures';

// 並查集（Union-Find）：parent 陣列和它畫成的一片樹是同一份資料。
// find 會順便做路徑壓縮，union 可以照 rank 合併；每一次 find、union 都可以記成逐步播放。
// 這裡的常數不在頂層用 model 的值（model 也引用這個檔案），用到時才讀。

export type UnionFind = ElementOf<'unionFind'>;

/** 最多 20 個節點：樹和陣列都還放得下 */
export const UF_MAX = 20;
/** 節點是圓形，比二元樹的小一點 */
export const UF_NODE = 36;
const UF_GAP = 14;
const UF_LEVEL = 64;
/** 根節點上方畫指回自己的小圈 */
const UF_LOOP_H = 20;
/** 陣列左邊寫「parent」「rank」 */
export const UF_HEAD_W = 56;

/** i 的根節點；parent 裡有環（不該有，但手動貼的資料可能有）時，取環上最小的節點當根 */
export function ufRoot(parent: readonly number[], i: number): number {
  const seen: number[] = [];
  let x = i;
  while (parent[x] !== x) {
    if (seen.includes(x)) return Math.min(...seen.slice(seen.indexOf(x)));
    seen.push(x);
    x = parent[x];
  }
  return x;
}

/** 從 i 走到根經過的節點（含 i 和根） */
export function ufPath(parent: readonly number[], i: number): number[] {
  const root = ufRoot(parent, i);
  const path = [i];
  let x = i;
  while (x !== root && path.length <= parent.length) {
    x = parent[x];
    path.push(x);
  }
  return path;
}

/** 每一組的根，由小到大 */
export function ufRoots(el: UnionFind): number[] {
  return [...new Set(el.parent.map((_, i) => ufRoot(el.parent, i)))].sort((a, b) => a - b);
}

/** 每個節點在樹上的子節點（指向它的節點，由小到大） */
export function ufChildren(el: UnionFind): number[][] {
  const roots = new Set(ufRoots(el));
  const children = el.parent.map((): number[] => []);
  el.parent.forEach((p, i) => {
    if (p !== i && !roots.has(i)) children[p].push(i);
  });
  return children;
}

/** 幾組 */
export function ufCount(el: UnionFind): number {
  return ufRoots(el).length;
}

/** 合併過的組（兩個以上的節點）依根節點的順序輪流上色；自己一組的不上色，合併之後一眼看得出來 */
const GROUP_COLORS: CellColor[] = ['blue', 'yellow', 'green', 'purple', 'red'];

export function ufColors(el: UnionFind): (CellColor | null)[] {
  const rootOf = el.parent.map((_, i) => ufRoot(el.parent, i));
  const size = new Map<number, number>();
  rootOf.forEach((r) => size.set(r, (size.get(r) ?? 0) + 1));
  const colorOf = new Map<number, CellColor>();
  for (const r of ufRoots(el)) {
    if ((size.get(r) ?? 0) >= 2) colorOf.set(r, GROUP_COLORS[colorOf.size % GROUP_COLORS.length]);
  }
  return rootOf.map((r) => colorOf.get(r) ?? null);
}

export interface UfLayout {
  /** 樹上每個節點的中心，相對於元件左上角 */
  centers: Map<number, ForestPoint>;
  roots: number[];
  /** parent 那一列的上緣；rank 那一列在索引下面 */
  arrayTop: number;
  rankTop?: number;
  w: number;
  h: number;
}

/** 上面是一片樹（每一組一棵，由左到右），下面是 parent 陣列（帶索引），開了 union by rank 再加一列 rank */
export function ufLayout(el: UnionFind): UfLayout {
  const roots = ufRoots(el);
  const forest = forestLayout(roots, ufChildren(el), { node: UF_NODE, gap: UF_GAP, level: UF_LEVEL, top: LABEL_H + UF_LOOP_H + UF_NODE / 2 });
  const arrayTop = forest.h + 18;
  const rankTop = el.rank ? arrayTop + CELL + INDEX_H : undefined;
  const arrayW = UF_HEAD_W + el.parent.length * CELL;
  return {
    centers: forest.centers,
    roots,
    arrayTop,
    rankTop,
    w: Math.max(forest.w, arrayW),
    h: (rankTop ?? arrayTop) + CELL + (rankTop === undefined ? INDEX_H : 0),
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

/** 箭頭的頭：尖端在 tip，朝 (ux, uy) 的方向 */
function arrowHead(tip: ForestPoint, ux: number, uy: number): string {
  const size = 7;
  const side = (sign: number) => {
    const cos = Math.cos(sign * 0.5);
    const sin = Math.sin(sign * 0.5);
    return { x: tip.x - size * (ux * cos - uy * sin), y: tip.y - size * (ux * sin + uy * cos) };
  };
  const [a, b] = [side(1), side(-1)];
  return `M${round(a.x)} ${round(a.y)}L${round(tip.x)} ${round(tip.y)}L${round(b.x)} ${round(b.y)}`;
}

/** 子節點指向父節點的箭頭：從子節點的圓邊畫到父節點的圓邊，頭在父節點那端 */
export function ufArrowPath(from: ForestPoint, to: ForestPoint): string {
  const r = UF_NODE / 2;
  const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / d;
  const uy = (to.y - from.y) / d;
  const tip = { x: to.x - ux * (r + 1), y: to.y - uy * (r + 1) };
  return `M${round(from.x + ux * r)} ${round(from.y + uy * r)}L${round(tip.x)} ${round(tip.y)}${arrowHead(tip, ux, uy)}`;
}

/** 根節點上方指回自己的小圈（parent[root] = root） */
export function ufLoopPath(c: ForestPoint): string {
  const top = c.y - UF_NODE / 2;
  const tip = { x: c.x + 7, y: top + 1 };
  // 最後一段曲線從控制點 (x+18, top-20) 往尖端走
  const d = Math.hypot(tip.x - (c.x + 18), tip.y - (top - 20));
  const head = arrowHead(tip, (tip.x - (c.x + 18)) / d, (tip.y - (top - 20)) / d);
  return `M${c.x - 7} ${top + 1}C${c.x - 18} ${top - 20} ${c.x + 18} ${top - 20} ${tip.x} ${tip.y}${head}`;
}

/** 每個節點底下樹的高度：開 union by rank 時拿來當 rank 的起始值 */
function heights(parent: readonly number[]): number[] {
  const out = parent.map(() => 0);
  parent.forEach((_, i) => {
    const path = ufPath(parent, i);
    path.forEach((node, depth) => {
      out[node] = Math.max(out[node], depth);
    });
  });
  return out;
}

function patch(doc: BoardDoc, id: string, next: Partial<UnionFind>): BoardDoc {
  return updateElement<UnionFind>(doc, id, next);
}

/**
 * find(x)：先標出從 x 走到根的路，再把路上每個節點直接接到根（路徑壓縮）。
 * 回傳根和每一步；路上只有 x 和它的父節點時不用壓縮，只有一步
 */
export function ufFind(doc: BoardDoc, id: string, x: number): { root: number; steps: HeapStep[] } | null {
  const el = findElement(doc, id);
  if (el?.type !== 'unionFind' || x < 0 || x >= el.parent.length) return null;
  const path = ufPath(el.parent, x);
  const root = path[path.length - 1];
  const walked = patch(doc, id, { path });
  const steps: HeapStep[] = [{ doc: walked, caption: `find(${x}) = ${root}` }];
  if (path.length > 2) {
    const parent = el.parent.map((p, i) => (path.includes(i) ? root : p));
    steps.push({ doc: patch(walked, id, { parent }), caption: `find(${x}): ${path.slice(0, -2).join(', ')} → ${root}` });
  }
  return { root, steps };
}

/**
 * union(a, b)：find(a)、find(b)，根不一樣就接起來。有 rank 時矮的接到高的底下（一樣高時 b 的根接到 a 的根，a 的根 rank 加一），
 * 沒有 rank 時 b 的根接到 a 的根。回傳每一步，最後一步標出接起來的兩個根
 */
export function ufUnion(doc: BoardDoc, id: string, a: number, b: number): HeapStep[] {
  const first = ufFind(doc, id, a);
  if (!first) return [];
  const afterA = first.steps[first.steps.length - 1].doc;
  const second = ufFind(afterA, id, b);
  if (!second) return [];
  const steps = [...first.steps, ...second.steps];
  const current = second.steps[second.steps.length - 1].doc;
  const el = findElement(current, id) as UnionFind;
  const ra = first.root;
  const rb = second.root;
  if (ra === rb) {
    steps.push({ doc: patch(current, id, { path: [a, b] }), caption: `union(${a}, ${b}): same set` });
    return steps;
  }
  let child = rb;
  let root = ra;
  let rank = el.rank;
  if (rank) {
    const [rA, rB] = [rank[ra] ?? 0, rank[rb] ?? 0];
    if (rA < rB) [child, root] = [ra, rb];
    if (rA === rB) rank = rank.map((r, i) => (i === ra ? Math.min(19, r + 1) : r));
  }
  const parent = el.parent.map((p, i) => (i === child ? root : p));
  steps.push({ doc: patch(current, id, { parent, rank, path: [child, root] }), caption: `union(${a}, ${b}): parent[${child}] = ${root}` });
  return steps;
}

/** 開關 union by rank：打開時 rank 從每棵樹的高度算起 */
export function setUnionByRank(doc: BoardDoc, id: string, on: boolean): BoardDoc {
  const el = findElement(doc, id);
  if (el?.type !== 'unionFind') return doc;
  return patch(doc, id, { rank: on ? heights(el.parent) : undefined });
}

/** 加一個自己一組的節點 */
export function addUfNode(doc: BoardDoc, id: string): BoardDoc {
  const el = findElement(doc, id);
  if (el?.type !== 'unionFind' || el.parent.length >= UF_MAX) return doc;
  const n = el.parent.length;
  return patch(doc, id, { parent: [...el.parent, n], rank: el.rank && [...el.rank, 0] });
}

/** 拿掉最後一個節點；有別的節點接在它底下就不能拿 */
export function canRemoveUfNode(el: UnionFind): boolean {
  const last = el.parent.length - 1;
  return last > 0 && el.parent[last] === last && !el.parent.some((p, i) => i !== last && p === last);
}

export function removeUfNode(doc: BoardDoc, id: string): BoardDoc {
  const el = findElement(doc, id);
  if (el?.type !== 'unionFind' || !canRemoveUfNode(el)) return doc;
  const n = el.parent.length - 1;
  return patch(doc, id, { parent: el.parent.slice(0, n), rank: el.rank?.slice(0, n), path: el.path?.filter((i) => i < n) });
}

/** 全部變回自己一組 */
export function resetUnionFind(doc: BoardDoc, id: string): BoardDoc {
  const el = findElement(doc, id);
  if (el?.type !== 'unionFind') return doc;
  return patch(doc, id, { parent: el.parent.map((_, i) => i), rank: el.rank?.map(() => 0), path: undefined });
}

const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);

/**
 * 用文字建立：
 * - parent = [0,0,1,3,3]：直接給 parent 陣列
 * - n = 5, edges = [[0,1],[1,2],[3,4]]：n 個節點，照順序 union 每一條邊（題目常給的寫法）
 * - 5 或 n = 5：5 個節點，各自一組
 */
export function parseUnionFind(text: string, byRank: boolean): { parent: number[]; rank?: number[] } | { error: ParseError } {
  const plain = /^\s*(?:n\s*=\s*)?(\d+)\s*$/.exec(text);
  if (plain) {
    const n = Number(plain[1]);
    if (n < 1) return { error: 'empty' };
    if (n > UF_MAX) return { error: 'tooMany' };
    const parent = Array.from({ length: n }, (_, i) => i);
    return { parent, ...(byRank ? { rank: parent.map(() => 0) } : {}) };
  }
  if (/\bparent\s*=/.test(text)) {
    const body = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      return { error: 'badFormat' };
    }
    if (!Array.isArray(value) || value.length === 0) return { error: Array.isArray(value) ? 'empty' : 'badFormat' };
    if (value.length > UF_MAX) return { error: 'tooMany' };
    if (!value.every((v) => isInt(v) && v >= 0 && v < value.length)) return { error: 'badFormat' };
    const parent = value as number[];
    // 每個節點都要走得到指向自己的根，不能繞圈
    if (parent.some((_, i) => parent[ufRoot(parent, i)] !== ufRoot(parent, i))) return { error: 'badFormat' };
    return { parent, ...(byRank ? { rank: heights(parent) } : {}) };
  }
  const graph = parseGraph(text);
  if ('error' in graph) return graph;
  if (!graph.nodes.every((v, i) => v === String(i))) return { error: 'badFormat' };
  if (graph.nodes.length > UF_MAX) return { error: 'tooMany' };
  // 照順序 union 每一條邊，用跟畫面上一樣的規則
  const id = 'uf';
  let doc: BoardDoc = {
    elements: [
      {
        type: 'unionFind',
        id,
        x: 0,
        y: 0,
        label: '',
        parent: graph.nodes.map((_, i) => i),
        ...(byRank ? { rank: graph.nodes.map(() => 0) } : {}),
      },
    ],
  };
  for (const edge of graph.edges) {
    const steps = ufUnion(doc, id, edge.a, edge.b);
    if (steps.length > 0) doc = steps[steps.length - 1].doc;
  }
  const done = doc.elements[0] as UnionFind;
  return { parent: done.parent, ...(done.rank ? { rank: done.rank } : {}) };
}

export function serializeUnionFind(el: UnionFind): string {
  return `parent = [${el.parent.join(',')}]`;
}
