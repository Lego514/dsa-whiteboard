import { describe, expect, it } from 'vitest';
import { checkpoint, commit, EMPTY_DOC, initHistory, undo } from '../lib/model';
import type { BoardDoc, BoardElement } from '../schema';
import { applyOps, coalesce, diffDocs, rebaseHistory, STEPS_KEY, opKey, type Op } from './ops';

const v = (id: string, value: string): BoardElement => ({ type: 'var', id, x: 0, y: 0, name: id, value });
const doc = (...elements: BoardElement[]): BoardDoc => ({ elements });

describe('collab ops', () => {
  it('sends only what changed: new, edited, and deleted elements, and the steps', () => {
    const a = v('a', '1');
    const b = v('b', '2');
    const before = doc(a, b);
    expect(diffDocs(before, before)).toEqual([]);
    // 內容一樣但物件不同也不送
    expect(diffDocs(before, doc({ ...a }, b))).toEqual([]);
    const c = v('c', '3');
    const after: BoardDoc = { elements: [v('a', '9'), c], steps: [{ id: 's1', caption: '', elements: [] }] };
    expect(diffDocs(before, after)).toEqual([
      { k: 'put', el: v('a', '9') },
      { k: 'put', el: c },
      { k: 'del', id: 'b' },
      { k: 'steps', steps: after.steps },
    ]);
  });

  it('applies changes in place, appends new elements, and drops empty steps', () => {
    const start = doc(v('a', '1'), v('b', '2'));
    const next = applyOps(start, [
      { k: 'put', el: v('b', '5') },
      { k: 'put', el: v('c', '3') },
      { k: 'del', id: 'a' },
      { k: 'del', id: 'missing' },
    ]);
    expect(next.elements.map((el) => (el as { value: string }).value)).toEqual(['5', '3']);
    const withSteps = applyOps(next, [{ k: 'steps', steps: [{ id: 's', caption: 'x', elements: [] }] }]);
    expect(withSteps.steps).toHaveLength(1);
    expect(applyOps(withSteps, [{ k: 'steps', steps: [] }])).not.toHaveProperty('steps');
    // 送來又套回去，結果一樣
    expect(applyOps(start, diffDocs(start, next))).toEqual(next);
  });

  it('keeps the last change to each thing in a batch', () => {
    const ops: Op[] = [
      { k: 'put', el: v('a', '1') },
      { k: 'put', el: v('b', '1') },
      { k: 'put', el: v('a', '2') },
      { k: 'del', id: 'b' },
    ];
    expect(coalesce(ops)).toEqual([
      { k: 'put', el: v('a', '2') },
      { k: 'del', id: 'b' },
    ]);
    expect(opKey({ k: 'steps', steps: [] })).toBe(STEPS_KEY);
  });

  it('undo only takes back my own change, not what someone else did meanwhile', () => {
    let h = initHistory(EMPTY_DOC);
    h = commit(h, doc(v('mine', '1')));
    // 別人加了一個元件
    h = rebaseHistory(h, [{ k: 'put', el: v('theirs', '7') }]);
    expect(h.present.elements.map((el) => el.id)).toEqual(['mine', 'theirs']);
    h = undo(h);
    expect(h.present.elements.map((el) => el.id)).toEqual(['theirs']);
    // 拖曳的 checkpoint 也一樣
    h = checkpoint(h);
    h = rebaseHistory(h, [{ k: 'del', id: 'theirs' }]);
    expect(undo(h).present.elements).toEqual([]);
  });
});
