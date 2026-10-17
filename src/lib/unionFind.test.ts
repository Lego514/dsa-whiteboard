import { describe, expect, it } from 'vitest';
import { boardDocSchema } from '../schema';
import { boardToSvg, estimateWidth } from './exportSvg';
import { createElement, findElement, recordHeapSteps, sizeOf, type BoardDoc } from './model';
import { applyStructureText, structureText } from './structures';
import {
  addUfNode,
  canRemoveUfNode,
  parseUnionFind,
  removeUfNode,
  resetUnionFind,
  setUnionByRank,
  ufColors,
  ufCount,
  ufFind,
  ufLayout,
  ufPath,
  ufRoot,
  ufUnion,
  UF_NODE,
  type UnionFind,
} from './unionFind';

const texts = { heading: 'Title', text: 'Text', sticky: 'Idea' };

function ufDoc(parent?: number[], rank?: number[]): BoardDoc {
  const el = createElement('unionFind', { x: 0, y: 0 }, 'u', texts) as UnionFind;
  return { elements: [{ ...el, ...(parent ? { parent } : {}), ...(rank ? { rank } : {}) }] };
}

const uf = (doc: BoardDoc) => findElement(doc, 'u') as UnionFind;
const last = (steps: { doc: BoardDoc }[]) => steps[steps.length - 1].doc;

describe('Union-Find', () => {
  it('starts half done: 0-1-2 joined, 3 and 4 on their own', () => {
    const el = uf(ufDoc());
    expect(boardDocSchema.parse(ufDoc())).toEqual(ufDoc());
    expect(ufCount(el)).toBe(3);
    expect(ufPath(el.parent, 2)).toEqual([2, 1, 0]);
    // 合併過的組上色，自己一組的不上色
    expect(ufColors(el)).toEqual(['blue', 'blue', 'blue', null, null]);
  });

  it('finds the root and compresses the path in a second step', () => {
    const found = ufFind(ufDoc(), 'u', 2)!;
    expect(found.root).toBe(0);
    expect(found.steps.map((s) => s.caption)).toEqual(['find(2) = 0', 'find(2): 2 → 0']);
    expect(uf(found.steps[0].doc)).toMatchObject({ parent: [0, 0, 1, 3, 4], path: [2, 1, 0] });
    expect(uf(last(found.steps)).parent).toEqual([0, 0, 0, 3, 4]);
    // 已經接在根底下時不用壓縮
    expect(ufFind(ufDoc(), 'u', 1)!.steps).toHaveLength(1);
  });

  it('unions the root of b under the root of a, or reports the same set', () => {
    const steps = ufUnion(ufDoc(), 'u', 3, 4);
    expect(steps[steps.length - 1].caption).toBe('union(3, 4): parent[4] = 3');
    expect(ufCount(uf(last(steps)))).toBe(2);
    const same = ufUnion(ufDoc(), 'u', 2, 1);
    expect(same[same.length - 1].caption).toBe('union(2, 1): same set');
    expect(uf(last(same)).parent).toEqual([0, 0, 0, 3, 4]);
  });

  it('unions by rank: the shorter tree goes under the taller one', () => {
    const doc = setUnionByRank(ufDoc(), 'u', true);
    expect(uf(doc).rank).toEqual([2, 1, 0, 0, 0]);
    // 4 一個人（rank 0）跟 0 那組（rank 2）合併：不管誰先寫，都是 4 接到 0 底下
    const steps = ufUnion(doc, 'u', 4, 2);
    expect(uf(last(steps)).parent[4]).toBe(0);
    // 一樣高時 b 接到 a，a 的 rank 加一
    const tie = uf(last(ufUnion(doc, 'u', 3, 4)));
    expect(tie.parent[4]).toBe(3);
    expect(tie.rank).toEqual([2, 1, 0, 1, 0]);
    expect(uf(setUnionByRank(doc, 'u', false)).rank).toBeUndefined();
  });

  it('records each find and the merge as playback steps', () => {
    const doc = ufDoc();
    const recorded = recordHeapSteps(doc, ufUnion(doc, 'u', 2, 4));
    expect(recorded.steps?.map((s) => s.caption)).toEqual(['find(2) = 0', 'find(2): 2 → 0', 'find(4) = 4', 'union(2, 4): parent[4] = 0']);
  });

  it('adds, removes, and resets nodes', () => {
    let doc = addUfNode(ufDoc(), 'u');
    expect(uf(doc).parent).toEqual([0, 0, 1, 3, 4, 5]);
    expect(canRemoveUfNode(uf(doc))).toBe(true);
    doc = removeUfNode(doc, 'u');
    expect(uf(doc).parent).toHaveLength(5);
    // 有別的節點接在最後一個底下就不能拿掉
    expect(canRemoveUfNode(uf(ufDoc([0, 2, 2])))).toBe(false);
    expect(uf(resetUnionFind(doc, 'u')).parent).toEqual([0, 1, 2, 3, 4]);
  });

  it('reads edges (merged in order), a parent array, or just n', () => {
    expect(parseUnionFind('n = 5, edges = [[0,1],[1,2],[3,4]]', false)).toEqual({ parent: [0, 0, 0, 3, 3] });
    expect(parseUnionFind('parent = [0,0,1,3,3]', true)).toEqual({ parent: [0, 0, 1, 3, 3], rank: [2, 1, 0, 1, 0] });
    expect(parseUnionFind('4', false)).toEqual({ parent: [0, 1, 2, 3] });
    expect(parseUnionFind('parent = [1,0]', false)).toEqual({ error: 'badFormat' });
    expect(parseUnionFind('parent = [0,5]', false)).toEqual({ error: 'badFormat' });
    expect(parseUnionFind('n = 21', false)).toEqual({ error: 'tooMany' });
    expect(parseUnionFind('edges = [["a","b"]]', false)).toEqual({ error: 'badFormat' });
  });

  it('builds from text and writes the parent array back', () => {
    const result = applyStructureText(ufDoc(), 'u', 'n = 4, edges = [[0,1],[2,3],[1,3]]');
    if ('error' in result) throw new Error(result.error);
    const el = uf(result.doc);
    expect(el.parent).toEqual([0, 0, 0, 2]);
    expect(structureText(el)).toBe('parent = [0,0,0,2]');
  });

  it('lays out one tree per set above the parent array, and treats a cycle as rooted', () => {
    const el = uf(ufDoc());
    const layout = ufLayout(el);
    expect(layout.roots).toEqual([0, 3, 4]);
    const [a, b, c] = [layout.centers.get(0)!, layout.centers.get(1)!, layout.centers.get(2)!];
    expect(b.y).toBeGreaterThan(a.y);
    expect(c.y).toBeGreaterThan(b.y);
    // 每一組由左到右排開，不會疊在一起
    expect(layout.centers.get(3)!.x - a.x).toBeGreaterThanOrEqual(UF_NODE);
    expect(layout.arrayTop).toBeGreaterThan(c.y + UF_NODE / 2);
    expect(sizeOf(el)).toEqual({ w: layout.w, h: layout.h });
    expect(ufRoot([1, 0], 1)).toBe(0);
    expect(ufLayout({ ...el, parent: [1, 0] }).centers.size).toBe(2);
  });

  it('exports the forest, the parent row, and the set count', () => {
    const svg = boardToSvg(setUnionByRank(ufDoc(), 'u', true), undefined, { measure: estimateWidth, front: 'front', back: 'back' })!.svg;
    expect(svg).toContain('3 sets');
    expect(svg).toContain('>parent</text>');
    expect(svg).toContain('>rank</text>');
  });
});
