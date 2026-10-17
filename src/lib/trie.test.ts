import { describe, expect, it } from 'vitest';
import { boardDocSchema } from '../schema';
import { boardToSvg, estimateWidth } from './exportSvg';
import { createElement, findElement, recordHeapSteps, sizeOf, type BoardDoc } from './model';
import { applyStructureText, structureText } from './structures';
import { canInsert, parseTrie, setTrieAt, trieInsert, trieLayout, trieNodes, triePath, trieRemove, trieSearch, trieSearchSteps, type Trie } from './trie';

const texts = { heading: 'Title', text: 'Text', sticky: 'Idea' };

function trieDoc(words?: string[]): BoardDoc {
  const el = createElement('trie', { x: 0, y: 0 }, 't', texts) as Trie;
  return { elements: [words ? { ...el, words } : el] };
}

const trie = (doc: BoardDoc) => findElement(doc, 't') as Trie;
const last = (steps: { doc: BoardDoc }[]) => steps[steps.length - 1].doc;

describe('trie', () => {
  it('grows nodes from the words, shared prefixes once, letters in order', () => {
    const { nodes } = trieNodes(['app', 'apple', 'apt', 'bat']);
    expect(boardDocSchema.parse(trieDoc())).toEqual(trieDoc());
    expect(nodes.map((n) => n.prefix)).toEqual(['', 'a', 'ap', 'app', 'appl', 'apple', 'apt', 'b', 'ba', 'bat']);
    expect(nodes.filter((n) => n.end).map((n) => n.prefix)).toEqual(['app', 'apple', 'apt', 'bat']);
    expect(nodes[3].parent).toBe(2);
  });

  it('tells a word from a prefix from a miss', () => {
    const words = ['app', 'apple'];
    expect(trieSearch(words, 'app')).toBe('word');
    expect(trieSearch(words, 'appl')).toBe('prefix');
    expect(trieSearch(words, 'apx')).toBe('none');
    const el = trie(setTrieAt(trieDoc(), 't', 'apx'));
    // 走得到的是根、a、ap
    expect(triePath(el, trieNodes(el.words).nodes)).toEqual([0, 1, 2]);
  });

  it('inserts a word, walking the shared prefix first', () => {
    const steps = trieInsert(trieDoc(), 't', 'apply');
    expect(steps.map((s) => s.caption)).toEqual(['insert("apply"): a', 'insert("apply"): ap', 'insert("apply"): app', 'insert("apply"): appl', 'insert("apply")']);
    expect(trie(last(steps))).toMatchObject({ words: ['app', 'apple', 'apt', 'bat', 'apply'], at: 'apply' });
    // 已經有的字不重複放
    expect(trie(last(trieInsert(trieDoc(), 't', 'app'))).words).toHaveLength(4);
  });

  it('searches letter by letter and stops where the path ends', () => {
    const steps = trieSearchSteps(trieDoc(), 't', 'apx');
    expect(steps.map((s) => s.caption)).toEqual(['search("apx"): a', 'search("apx"): ap', 'search("apx"): apx: none']);
    expect(trie(last(steps)).at).toBe('apx');
    expect(trieSearchSteps(trieDoc(), 't', 'bat').at(-1)!.caption).toBe('search("bat"): bat: word');
    const recorded = recordHeapSteps(trieDoc(), steps);
    expect(recorded.steps).toHaveLength(3);
  });

  it('removes a word and refuses words that do not fit', () => {
    const doc = trieRemove(setTrieAt(trieDoc(), 't', 'apt'), 't', 'apt');
    expect(trie(doc)).toMatchObject({ words: ['app', 'apple', 'bat'] });
    expect(trie(doc).at).toBeUndefined();
    const full = trie(trieDoc(Array.from({ length: 30 }, (_, i) => `w${i}`)));
    expect(canInsert(full, 'new')).toBe(false);
    expect(canInsert(full, 'w3')).toBe(true);
  });

  it('reads a JSON list or words separated by spaces, and writes it back', () => {
    expect(parseTrie('["apple","app"]')).toEqual({ words: ['apple', 'app'] });
    expect(parseTrie("words = ['dog', 'do']")).toEqual({ words: ['dog', 'do'] });
    expect(parseTrie('cat car  cat')).toEqual({ words: ['cat', 'car'] });
    expect(parseTrie('')).toEqual({ error: 'empty' });
    expect(parseTrie('[1,2]')).toEqual({ error: 'badFormat' });
    expect(parseTrie('abcdefghijklmnopq')).toEqual({ error: 'tooMany' });
    const result = applyStructureText(trieDoc(), 't', 'words = ["sea","see"]');
    if ('error' in result) throw new Error(result.error);
    expect(structureText(trie(result.doc))).toBe('words = ["sea","see"]');
  });

  it('lays the root on top and children below it, with no overlaps', () => {
    const el = trie(trieDoc());
    const layout = trieLayout(el);
    const xs = layout.nodes.map((_, i) => layout.centers.get(i)!);
    expect(xs[1].y).toBeGreaterThan(xs[0].y);
    const byRow = new Map<number, number[]>();
    for (const c of xs) byRow.set(c.y, [...(byRow.get(c.y) ?? []), c.x]);
    for (const row of byRow.values()) {
      const sorted = [...row].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(32);
    }
    expect(sizeOf(el)).toEqual({ w: layout.w, h: layout.h });
  });

  it('exports letters, word ends, and the search result', () => {
    const svg = boardToSvg(setTrieAt(trieDoc(), 't', 'ap'), undefined, { measure: estimateWidth, front: 'front', back: 'back' })!.svg;
    expect(svg).toContain('search(&quot;ap&quot;): prefix');
    expect(svg).toContain('>e</text>');
  });
});
