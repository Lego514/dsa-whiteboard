import type { BoardStep, History } from '../lib/model';
import type { BoardDoc, BoardElement } from '../schema';

// 一起編輯時在網路上傳的修改：以元件為單位，後到伺服器的勝出（last-write-wins）。
// 元件都有自己的 id，兩個人改不同元件互不影響；逐步播放的步驟整串當成一個值。

export type Op = { k: 'put'; el: BoardElement } | { k: 'del'; id: string } | { k: 'steps'; steps: BoardStep[] };

/** 同一個東西的修改用同一把 key：元件用 id，步驟用 #steps（元件 id 不會有 #） */
export const STEPS_KEY = '#steps';

export function opKey(op: Op): string {
  return op.k === 'put' ? op.el.id : op.k === 'del' ? op.id : STEPS_KEY;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** 從 before 變成 after 要送出哪些修改；沒變的元件（同一個物件或內容一樣）不送 */
export function diffDocs(before: BoardDoc, after: BoardDoc): Op[] {
  const ops: Op[] = [];
  const old = new Map(before.elements.map((el) => [el.id, el]));
  const kept = new Set<string>();
  for (const el of after.elements) {
    kept.add(el.id);
    const prev = old.get(el.id);
    if (!prev || !same(prev, el)) ops.push({ k: 'put', el });
  }
  for (const el of before.elements) if (!kept.has(el.id)) ops.push({ k: 'del', id: el.id });
  const steps = after.steps ?? [];
  if (before.steps !== after.steps && !same(before.steps ?? [], steps)) ops.push({ k: 'steps', steps });
  return ops;
}

/** 套用修改：已經有的元件原地換掉，新的放最後；刪掉的元件不存在也沒關係 */
export function applyOps(doc: BoardDoc, ops: readonly Op[]): BoardDoc {
  if (ops.length === 0) return doc;
  let elements = doc.elements;
  let steps = doc.steps;
  for (const op of ops) {
    if (op.k === 'put') {
      const index = elements.findIndex((el) => el.id === op.el.id);
      elements = index === -1 ? [...elements, op.el] : elements.map((el, i) => (i === index ? op.el : el));
    } else if (op.k === 'del') {
      elements = elements.filter((el) => el.id !== op.id);
    } else {
      steps = op.steps;
    }
  }
  const next: BoardDoc = { ...doc, elements };
  if (steps && steps.length > 0) next.steps = steps;
  else delete next.steps;
  return next;
}

/** 別人的修改也要套到復原紀錄的每一個版本上：復原只會退回自己的動作，不會把別人的修改一起退掉 */
export function rebaseHistory(history: History, ops: readonly Op[]): History {
  if (ops.length === 0) return history;
  const move = (doc: BoardDoc) => applyOps(doc, ops);
  return { past: history.past.map(move), present: move(history.present), future: history.future.map(move) };
}

/** 把同一批裡同一個東西的多次修改合成最後一次 */
export function coalesce(ops: readonly Op[]): Op[] {
  const byKey = new Map<string, Op>();
  for (const op of ops) {
    const key = opKey(op);
    byKey.delete(key);
    byKey.set(key, op);
  }
  return [...byKey.values()];
}
