import { describe, expect, it } from 'vitest';
import { boardDocSchema } from '../schema';
import { insertExample, splitExample } from './example';
import { EMPTY_DOC, rectOf, type BoardDoc, type ElementOf, type Placed } from './model';

const center = { x: 0, y: 0 };

function draw(text: string): BoardDoc {
  const result = insertExample(EMPTY_DOC, text, center);
  if ('error' in result) throw new Error(result.error);
  expect(boardDocSchema.parse(result.doc)).toEqual(result.doc);
  return result.doc;
}

const kinds = (doc: BoardDoc) =>
  doc.elements.map((el) => {
    if (el.type === 'list' || el.type === 'table') return `${el.type}:${el.variant}:${el.label}`;
    if (el.type === 'var') return `var:${el.name}=${el.value}`;
    return `${el.type}:${'label' in el ? el.label : ''}`;
  });

describe('pasting a whole example', () => {
  it('splits arguments at top-level commas and new lines, skipping Input and Output', () => {
    expect(splitExample('Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]')).toEqual([
      { name: 'nums', raw: '[2,7,11,15]' },
      { name: 'target', raw: '9' },
    ]);
    expect(splitExample('s = "a, b = c", k = 2')).toEqual([
      { name: 's', raw: '"a, b = c"' },
      { name: 'k', raw: '2' },
    ]);
    expect(splitExample('grid = [\n  [1,0],\n  [0,1]\n]\nk = 1').map((a) => a.name)).toEqual(['grid', 'k']);
  });

  it('draws an array and a variable for Two Sum, side by side', () => {
    const doc = draw('nums = [2,7,11,15], target = 9');
    expect(kinds(doc)).toEqual(['list:array:nums', 'var:target=9']);
    const [nums, target] = doc.elements as Placed[];
    // 變數在陣列右邊
    expect(target.x).toBeGreaterThan(rectOf(doc, nums).x + rectOf(doc, nums).w);
  });

  it('splits a string into characters, and stacks structures top to bottom', () => {
    const doc = draw('s = "abcabcbb", t = "abc"');
    expect(kinds(doc)).toEqual(['list:array:s', 'list:array:t']);
    expect((doc.elements[0] as ElementOf<'list'>).items).toHaveLength(8);
    expect((doc.elements[1] as Placed).y).toBeGreaterThan((doc.elements[0] as Placed).y);
  });

  it('knows trees and linked lists by name', () => {
    expect(kinds(draw('root = [3,9,20,null,null,15,7], targetSum = 22'))).toEqual(['tree:root', 'var:targetSum=22']);
    expect(kinds(draw('l1 = [2,4,3], l2 = [5,6,4]'))).toEqual(['list:linked:l1', 'list:linked:l2']);
    expect(kinds(draw('head = [1,2,3,4,5], n = 2'))).toEqual(['list:linked:head', 'var:n=2']);
  });

  it('turns edges into a graph and folds n into it', () => {
    const doc = draw('n = 5, edges = [[0,1],[1,2],[3,4]]');
    expect(kinds(doc)).toEqual(['graph:edges']);
    expect((doc.elements[0] as ElementOf<'graph'>).nodes).toHaveLength(5);
    const courses = draw('numCourses = 2, prerequisites = [[1,0]]');
    expect(courses.elements[0]).toMatchObject({ type: 'graph', directed: true });
  });

  it('draws intervals, grids, and dicts', () => {
    const merged = draw('intervals = [[1,3],[6,9]], newInterval = [2,5]');
    expect(kinds(merged)).toEqual(['intervals:intervals']);
    expect((merged.elements[0] as ElementOf<'intervals'>).items).toHaveLength(3);
    expect(kinds(draw('grid = [["1","1","0"],["0","1","0"]]'))).toEqual(['table:grid:grid']);
    expect(kinds(draw("counts = {'a': 1, 'b': 2}"))).toEqual(['table:dict:counts']);
    expect(kinds(draw('n = 3'))).toEqual(['var:n=3']);
  });

  it('reports what it cannot read', () => {
    expect(insertExample(EMPTY_DOC, '   ', center)).toEqual({ error: 'empty' });
    expect(insertExample(EMPTY_DOC, 'nums = [1, 2', center)).toEqual({ error: 'badFormat' });
    expect(insertExample(EMPTY_DOC, `nums = [${Array.from({ length: 70 }, (_, i) => i).join(',')}]`, center)).toEqual({ error: 'tooMany' });
  });
});
