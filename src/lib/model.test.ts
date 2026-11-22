import { describe, expect, it } from 'vitest';
import { fitsSizeLimit } from '../constants';
import { boardDocSchema } from '../schema';
import { boardToSvg, estimateWidth } from './exportSvg';
import {
  addElement,
  addPointerAt,
  appendPoint,
  arrowPoints,
  arrowEndAt,
  setDashed,
  cellRect,
  bendArrow,
  arrowShape,
  autoBend,
  CELL,
  COMPLEXITY_H,
  COMPLEXITY_W,
  findElement,
  graphLayout,
  hasColor,
  WIDE_CELL,
  checkpoint,
  commit,
  contentBounds,
  freeSpot,
  createElement,
  distanceToShapeEdge,
  deleteCell,
  dropEmptyCheckpoint,
  dropPointer,
  duplicateElements,
  EMPTY_DOC,
  hitInk,
  INDEX_H,
  initHistory,
  insertCell,
  keepRatio,
  LABEL_H,
  moveElements,
  nextPointerName,
  PALETTE,
  placeAtCenter,
  recolorElements,
  elementsInRect,
  rectFromCorners,
  captureStep,
  deleteStep,
  setStepCaption,
  restoreStep,
  stepDoc,
  clearElements,
  MAX_STEPS,
  hitConnector,
  setArrowHead,
  pointerPosition,
  pointerTone,
  POINTER_TONES,
  POINTER_H,
  POINTER_W,
  redo,
  removeElements,
  replace,
  resizeList,
  resizeShape,
  resizeTable,
  setCellColor,
  setCellValue,
  shapeFromDrag,
  shiftPointer,
  sizeOf,
  undo,
  type BoardDoc,
  type ElementOf,
} from './model';

const texts = { heading: 'Title', text: 'Text', sticky: 'Idea', complexity: 'Complexity' };

function boardWithArray(): BoardDoc {
  const array = createElement('array', { x: 100, y: 100 }, 'arr', texts);
  const i = createElement('pointer', { x: 0, y: 0 }, 'pi', texts);
  const j = { ...createElement('pointer', { x: 0, y: 0 }, 'pj', texts), name: 'j' } as ElementOf<'pointer'>;
  return { elements: [array, i, j] };
}

const pointer = (doc: BoardDoc, id: string) => doc.elements.find((el) => el.id === id) as ElementOf<'pointer'>;

describe('creating elements', () => {
  it('makes every palette item with content the server accepts', () => {
    let doc = EMPTY_DOC;
    for (const { kinds } of PALETTE) {
      for (const kind of kinds) doc = addElement(doc, createElement(kind, { x: 10.6, y: -3.2 }, `k${doc.elements.length}`, texts));
    }
    expect(doc.elements).toHaveLength(23);
    expect(boardDocSchema.parse(doc)).toEqual(doc);
    expect(doc.elements[0]).toMatchObject({ x: 11, y: -3 });
  });

  it('sizes structured elements from their content', () => {
    const array = createElement('array', { x: 0, y: 0 }, 'a', texts) as ElementOf<'list'>;
    expect(sizeOf(array)).toEqual({ w: 4 * CELL, h: LABEL_H + CELL + INDEX_H });
    const stack = createElement('stack', { x: 0, y: 0 }, 's', texts);
    expect(sizeOf(stack)).toEqual({ w: CELL, h: LABEL_H + 2 * CELL });
    const set = createElement('set', { x: 0, y: 0 }, 'z', texts);
    expect(sizeOf(set).h).toBe(LABEL_H + CELL);
  });

  it('centers new elements and finds a free spot instead of covering others', () => {
    const first = placeAtCenter(EMPTY_DOC, createElement('treeNode', { x: 0, y: 0 }, 'a', texts), { x: 100, y: 100 });
    expect(first).toMatchObject({ x: 76, y: 76 });
    let doc: BoardDoc = { elements: [first] };
    for (const id of ['b', 'c', 'd']) {
      const next = placeAtCenter(doc, createElement('array', { x: 0, y: 0 }, id, texts), { x: 100, y: 100 });
      doc = addElement(doc, next);
    }
    const rects = doc.elements.map((el) => ({ ...(el as ElementOf<'list'>), ...sizeOf(el as ElementOf<'list'>) }));
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    }
  });

  it('keeps a new element on screen when the middle is taken, instead of pushing it off the top', () => {
    // 畫面中間被一個大陣列占住，畫面上方（y < 0）還有地方，但那裡看不到
    const big: ElementOf<'list'> = { ...(createElement('array', { x: -150, y: -60 }, 'big', texts) as ElementOf<'list'>), items: Array.from({ length: 7 }, (_, i) => String(i)) };
    const doc: BoardDoc = { elements: [big] };
    const visible = { x: -300, y: -100, w: 600, h: 500 };
    const spot = freeSpot(doc, 200, 80, { x: 0, y: 0 }, undefined, visible);
    expect(spot.x).toBeGreaterThanOrEqual(visible.x);
    expect(spot.y).toBeGreaterThanOrEqual(visible.y);
    expect(spot.x + 200).toBeLessThanOrEqual(visible.x + visible.w);
    expect(spot.y + 80).toBeLessThanOrEqual(visible.y + visible.h);
    // 一樣近的位置先放旁邊、再放下面，最後才放上面
    const small = freeSpot({ elements: [createElement('treeNode', { x: -24, y: -24 }, 'n', texts)] }, 40, 40, { x: 0, y: 0 });
    expect(small.y).toBe(-20);
    // 畫面裡全滿才放到畫面外，不會找不到位置
    const tiny = { x: 0, y: 0, w: 10, h: 10 };
    expect(freeSpot(doc, 200, 80, { x: 0, y: 0 }, undefined, tiny)).toEqual(freeSpot(doc, 200, 80, { x: 0, y: 0 }));
  });

  it('names pointers i, j on arrays but node, cur on trees and graphs', () => {
    const tree = createElement('binaryTree', { x: 0, y: 0 }, 't', texts);
    const array = createElement('array', { x: 0, y: 300 }, 'a', texts);
    let doc: BoardDoc = { elements: [tree, array] };
    expect(nextPointerName(doc, array)).toBe('i');
    expect(nextPointerName(doc, tree)).toBe('node');
    doc = addElement(doc, { type: 'pointer', id: 'p', x: 0, y: 0, name: 'node', attach: { id: 't', index: 0 } });
    expect(nextPointerName(doc, tree)).toBe('cur');
    expect(nextPointerName(doc)).toBe('i');
  });

  it('gives each common pointer name its own color, and any name a stable one', () => {
    expect(['i', 'j', 'k', 'l'].map(pointerTone)).toEqual(['blue', 'orange', 'green', 'purple']);
    expect(pointerTone('left')).toBe(pointerTone('left'));
    expect(POINTER_TONES).toContain(pointerTone('whatever'));
  });

  it('names new pointers i, j, k and so on', () => {
    let doc = EMPTY_DOC;
    const names: string[] = [];
    for (let n = 0; n < 3; n += 1) {
      const name = nextPointerName(doc);
      names.push(name);
      doc = addElement(doc, { ...createElement('pointer', { x: 0, y: 0 }, `p${n}`, texts), name } as ElementOf<'pointer'>);
    }
    expect(names).toEqual(['i', 'j', 'k']);
  });
});

describe('pointers', () => {
  it('snaps to the nearest array cell when dropped close to it', () => {
    let doc = boardWithArray();
    // 放在第 3 格（index 2）下方附近
    doc = moveElements(doc, new Set(['pi']), 100 + 2 * CELL + 3, 100 + LABEL_H + CELL + INDEX_H + 10);
    doc = dropPointer(doc, 'pi');
    expect(pointer(doc, 'pi').attach).toEqual({ id: 'arr', index: 2 });
    expect(pointerPosition(doc, pointer(doc, 'pi'))).toEqual({
      x: 100 + 2 * CELL + CELL / 2 - POINTER_W / 2,
      y: 100 + LABEL_H + CELL + INDEX_H + 2,
    });

    // 太遠的不吸附
    doc = moveElements(doc, new Set(['pj']), 900, 900);
    expect(pointer(dropPointer(doc, 'pj'), 'pj').attach).toBeUndefined();
  });

  it('stacks pointers on the same cell and follows the array when it moves', () => {
    let doc = boardWithArray();
    doc = { elements: doc.elements.map((el) => (el.type === 'pointer' ? { ...el, attach: { id: 'arr', index: 0 } } : el)) };
    const i = pointerPosition(doc, pointer(doc, 'pi'));
    const j = pointerPosition(doc, pointer(doc, 'pj'));
    expect(j).toEqual({ x: i.x, y: i.y + POINTER_H });

    doc = moveElements(doc, new Set(['arr']), 50, 10);
    expect(pointerPosition(doc, pointer(doc, 'pi'))).toEqual({ x: i.x + 50, y: i.y + 10 });
  });

  it('moves one cell at a time and stays inside the array', () => {
    let doc = boardWithArray();
    doc = { elements: doc.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index: 3 } } : el)) };
    doc = shiftPointer(doc, 'pi', 1);
    expect(pointer(doc, 'pi').attach?.index).toBe(3);
    doc = shiftPointer(shiftPointer(doc, 'pi', -1), 'pi', -1);
    expect(pointer(doc, 'pi').attach?.index).toBe(1);
  });

  it('comes off the array where it was when dragged or when the array is deleted', () => {
    let doc = boardWithArray();
    doc = { elements: doc.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index: 1 } } : el)) };
    const before = pointerPosition(doc, pointer(doc, 'pi'));
    const dragged = moveElements(doc, new Set(['pi']), 5, 5);
    expect(pointer(dragged, 'pi')).toMatchObject({ x: before.x + 5, y: before.y + 5, attach: undefined });

    const removed = removeElements(doc, new Set(['arr']));
    expect(pointer(removed, 'pi')).toMatchObject({ x: before.x, y: before.y, attach: undefined });
  });

  it('moves to the last cell when the array shrinks', () => {
    let doc = boardWithArray();
    doc = { elements: doc.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index: 3 } } : el)) };
    doc = resizeList(doc, 'arr', -1);
    expect(pointer(doc, 'pi').attach?.index).toBe(2);
    expect((doc.elements[0] as ElementOf<'list'>).items).toEqual(['1', '2', '3']);
  });
});

describe('single cells', () => {
  const at = (doc: BoardDoc, index: number) => ({ elements: doc.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index } } : el)) });
  const list = (doc: BoardDoc) => doc.elements[0] as ElementOf<'list'>;

  it('inserts a cell and moves pointers with their values', () => {
    let doc = at(boardWithArray(), 2);
    doc = insertCell(doc, 'arr', 1);
    expect(list(doc).items).toEqual(['1', '', '2', '3', '4']);
    // 指標原本指著 '3'，插入後還是指著 '3'
    expect(pointer(doc, 'pi').attach?.index).toBe(3);
    doc = insertCell(doc, 'arr', 99);
    expect(list(doc).items).toHaveLength(6);
  });

  it('deletes a cell, keeps at least one, and keeps pointers inside the array', () => {
    let doc = at(boardWithArray(), 3);
    doc = deleteCell(doc, 'arr', 0);
    expect(list(doc).items).toEqual(['2', '3', '4']);
    expect(pointer(doc, 'pi').attach?.index).toBe(2);
    doc = deleteCell(doc, 'arr', 2);
    expect(pointer(doc, 'pi').attach?.index).toBe(1);
    doc = deleteCell(deleteCell(doc, 'arr', 0), 'arr', 0);
    expect(list(doc).items).toEqual(['3']);
  });

  it('colors cells and keeps colors with their cells', () => {
    let doc = setCellColor(boardWithArray(), 'arr', 1, 'yellow');
    expect(list(doc).colors).toEqual([null, 'yellow', null, null]);
    doc = insertCell(doc, 'arr', 0);
    expect(list(doc).colors).toEqual([null, null, 'yellow', null, null]);
    doc = deleteCell(doc, 'arr', 2);
    expect(list(doc).colors).toBeUndefined();
    expect(boardDocSchema.safeParse(setCellColor(doc, 'arr', 0, 'green')).success).toBe(true);
  });

  it('adds a pointer on a cell with the next free name', () => {
    const doc = addPointerAt(boardWithArray(), 'arr', 2, 'pk');
    expect(pointer(doc, 'pk')).toMatchObject({ name: 'k', attach: { id: 'arr', index: 2 } });
  });
});

describe('typing into a selected cell', () => {
  const make = (kind: Parameters<typeof createElement>[0]) => ({ elements: [createElement(kind, { x: 0, y: 0 }, 'e', texts)] }) as BoardDoc;
  const el = <T extends BoardDoc['elements'][number]['type']>(doc: BoardDoc) => doc.elements[0] as ElementOf<T>;

  it('replaces one array cell, or one tree, graph or recursion node', () => {
    expect(el<'list'>(setCellValue(make('array'), 'e', 1, '9')).items).toEqual(['1', '9', '3', '4']);
    const tree = make('binaryTree');
    expect(el<'tree'>(setCellValue(tree, 'e', 0, '7')).nodes[0]).toBe('7');
    expect(el<'graph'>(setCellValue(make('graph'), 'e', 2, 'X')).nodes[2]).toBe('X');
    const rec = setCellValue(make('recursionTree'), 'e', 0, 'f(5)');
    expect(el<'recursion'>(rec).nodes[0].text).toBe('f(5)');
  });

  it('leaves the board alone for a missing cell, an empty tree slot, a DP table, or another element', () => {
    const array = make('array');
    expect(setCellValue(array, 'e', 9, '1')).toBe(array);
    expect(setCellValue(array, 'nope', 0, '1')).toBe(array);
    const tree = make('binaryTree');
    const hole = el<'tree'>(tree).nodes.findIndex((v) => v === null);
    if (hole >= 0) expect(setCellValue(tree, 'e', hole, '1')).toBe(tree);
    // DP 表有自己填值的輸入框，便利貼沒有格子
    for (const kind of ['dpTable', 'sticky'] as const) {
      const other = make(kind);
      expect(setCellValue(other, 'e', 0, '1')).toBe(other);
    }
  });
});

describe('editing', () => {
  it('adds and removes table rows and columns but keeps at least one', () => {
    let doc: BoardDoc = { elements: [createElement('dict', { x: 0, y: 0 }, 'd', texts)] };
    doc = resizeTable(doc, 'd', 'row', 1);
    doc = resizeTable(doc, 'd', 'col', 1);
    expect((doc.elements[0] as ElementOf<'table'>).rows).toEqual([
      ['a', '1', ''],
      ['b', '2', ''],
      ['', '', ''],
    ]);
    for (let n = 0; n < 5; n += 1) doc = resizeTable(resizeTable(doc, 'd', 'row', -1), 'd', 'col', -1);
    expect((doc.elements[0] as ElementOf<'table'>).rows).toEqual([['a']]);
  });

  it('deletes arrows attached to a deleted element', () => {
    const a = createElement('treeNode', { x: 0, y: 0 }, 'a', texts);
    const b = createElement('treeNode', { x: 100, y: 0 }, 'b', texts);
    const doc: BoardDoc = {
      elements: [a, b, { type: 'arrow', id: 'e', from: { id: 'a' }, to: { id: 'b' }, color: 'ink' }],
    };
    expect(removeElements(doc, new Set(['b'])).elements.map((el) => el.id)).toEqual(['a']);
  });

  it('duplicates with new ids and offset, freeing a pointer copied without its array', () => {
    let doc = boardWithArray();
    doc = { elements: doc.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index: 0 } } : el)) };
    const { doc: next, ids } = duplicateElements(doc, new Set(['pi']));
    expect(ids).toHaveLength(1);
    const copy = next.elements.find((el) => el.id === ids[0]) as ElementOf<'pointer'>;
    expect(copy.attach).toBeUndefined();
    expect(copy.x).toBe(pointerPosition(doc, pointer(doc, 'pi')).x + 24);
  });
});

describe('arrows and ink', () => {
  const a = createElement('treeNode', { x: 0, y: 0 }, 'a', texts);
  const b = createElement('listNode', { x: 200, y: 0 }, 'b', texts);
  const arrow = { type: 'arrow' as const, id: 'e', from: { id: 'a' }, to: { id: 'b' }, color: 'ink' as const };
  const doc: BoardDoc = { elements: [a, b, arrow] };

  it('stops at the edge of circles and boxes', () => {
    const [start, end] = arrowPoints(doc, arrow)!;
    // 圓心 (24, 24)、半徑 24；串列節點從 x = 200 開始，中心高度 22
    expect(Math.hypot(start.x - 24, start.y - 24)).toBeCloseTo(24);
    expect(start.x).toBeCloseTo(48, 1);
    expect(end.x).toBeCloseTo(200);
    expect(end.y).toBeGreaterThan(22);
    expect(end.y).toBeLessThan(23);
    expect(arrowPoints({ elements: [a, arrow] }, arrow)).toBeNull();
  });

  it('erases strokes and arrows near the eraser', () => {
    const stroke = { type: 'stroke' as const, id: 's', color: 'red' as const, points: [0, 300, 100, 300] };
    const inked = addElement(doc, stroke);
    expect(hitInk(inked, { x: 50, y: 304 }, 6)).toEqual(['s']);
    expect(hitInk(inked, { x: 120, y: 23 }, 6)).toEqual(['e']);
    expect(hitInk(inked, { x: 50, y: 200 }, 6)).toEqual([]);
  });

  it('skips stroke points that are too close and rounds them', () => {
    let pts = appendPoint([], { x: 0.4, y: 0.6 });
    pts = appendPoint(pts, { x: 1, y: 1 });
    pts = appendPoint(pts, { x: 5.2, y: 1 });
    expect(pts).toEqual([0, 1, 5, 1]);
  });

  it('measures everything on the board', () => {
    const inked = addElement(doc, { type: 'stroke', id: 's', color: 'red', points: [-50, 300, 10, 310] });
    expect(contentBounds(inked)).toEqual({ x: -50, y: 0, w: 326, h: 310 });
    expect(contentBounds(EMPTY_DOC)).toBeNull();
  });
});

describe('arrows on cells, curved, and dashed', () => {
  // 陣列 nums 在 (100, 100)，四格：1 2 3 4
  const base = boardWithArray();
  const list = (doc: BoardDoc) => findElement(doc, 'arr') as ElementOf<'list'>;
  const cellArrow = (from: number, to: number, extra: Partial<ElementOf<'arrow'>> = {}): ElementOf<'arrow'> => ({
    type: 'arrow',
    id: 'e',
    from: { id: 'arr', cell: from },
    to: { id: 'arr', cell: to },
    color: 'ink',
    ...extra,
  });

  it('starts and ends on the cells it is attached to', () => {
    const arrow = cellArrow(0, 3);
    const doc = addElement(base, arrow);
    const [start, end] = arrowPoints(doc, arrow)!;
    const first = cellRect(list(doc), 0);
    const last = cellRect(list(doc), 3);
    // 從第 0 格的右邊出去，進到第 3 格的左邊
    expect(start).toEqual({ x: first.x + first.w, y: first.y + first.h / 2 });
    expect(end).toEqual({ x: last.x, y: last.y + last.h / 2 });
    expect(boardDocSchema.safeParse(doc).success).toBe(true);
  });

  it('moves with its cells when cells are inserted or deleted, and falls back to the whole array when its cell is gone', () => {
    let doc = addElement(base, cellArrow(1, 3));
    doc = insertCell(doc, 'arr', 0);
    expect(findElement(doc, 'e')).toMatchObject({ from: { cell: 2 }, to: { cell: 4 } });
    doc = deleteCell(doc, 'arr', 0);
    expect(findElement(doc, 'e')).toMatchObject({ from: { cell: 1 }, to: { cell: 3 } });
    // 舊資料或別人的修改讓那一格不在了：接到整個陣列，不會不見
    const stale = addElement(base, cellArrow(1, 40));
    expect(arrowPoints(stale, findElement(stale, 'e') as ElementOf<'arrow'>)).not.toBeNull();
  });

  it('attaches to a cell only on elements that have cells or nodes', () => {
    const note = createElement('sticky', { x: 0, y: 400 }, 'n', texts);
    const doc = addElement(base, note);
    expect(arrowEndAt(doc, 'arr', 2)).toEqual({ id: 'arr', cell: 2 });
    expect(arrowEndAt(doc, 'arr', 9)).toEqual({ id: 'arr' });
    expect(arrowEndAt(doc, 'n', 0)).toEqual({ id: 'n' });
    const tree = { elements: [createElement('binaryTree', { x: 0, y: 0 }, 't', texts)] } as BoardDoc;
    expect(arrowEndAt(tree, 't', 1)).toEqual({ id: 't', cell: 1 });
  });

  it('curves through a point bend away from the middle, and the handle drags it', () => {
    const straight: ElementOf<'arrow'> = { type: 'arrow', id: 'e', from: { x: 0, y: 0 }, to: { x: 200, y: 0 }, color: 'ink' };
    let doc: BoardDoc = { elements: [straight] };
    expect(arrowShape(doc, straight)).toMatchObject({ control: null, apex: { x: 100, y: 0 } });
    // 往下拖 40：bend 是往左邊（從 from 看 to）為正，所以往下是負的
    doc = bendArrow(doc, 'e', 0, { x: 100, y: 0 }, { x: 100, y: 40 });
    const bent = findElement(doc, 'e') as ElementOf<'arrow'>;
    expect(bent.bend).toBe(-40);
    const shape = arrowShape(doc, bent)!;
    expect(shape.apex.x).toBeCloseTo(100);
    expect(shape.apex.y).toBeCloseTo(40);
    // 彎的線點得到彎的地方，直線的位置點不到
    expect(hitConnector(doc, { x: 100, y: 38 }, 6)).toBe('e');
    expect(hitConnector(doc, { x: 100, y: 0 }, 6)).toBeUndefined();
    // 拖回接近直線就變回直的
    doc = bendArrow(doc, 'e', -40, { x: 100, y: 40 }, { x: 100, y: 3 });
    expect((findElement(doc, 'e') as ElementOf<'arrow'>).bend).toBeUndefined();
  });

  it('makes arrows and frames dashed or solid, and exports them that way', () => {
    const frame = createElement('treeNode', { x: 0, y: 0 }, 'a', texts);
    const box = { type: 'shape' as const, id: 'r', variant: 'rect' as const, x: 0, y: 100, w: 80, h: 40, color: 'red' as const };
    let doc: BoardDoc = { elements: [frame, box, cellArrow(0, 1, { id: 'e' })] };
    doc = setDashed(doc, new Set(['r', 'e', 'a']), true);
    expect(findElement(doc, 'r')).toMatchObject({ dash: true });
    expect(findElement(doc, 'a')).not.toHaveProperty('dash');
    expect(boardDocSchema.safeParse(doc).success).toBe(true);
    doc = setDashed(doc, new Set(['r']), false);
    expect((findElement(doc, 'r') as ElementOf<'shape'>).dash).toBeUndefined();
    const bent = { elements: [{ ...cellArrow(0, 1), from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, dash: true as const, bend: 30 }] } as BoardDoc;
    const svg = boardToSvg(bent, undefined, { measure: estimateWidth, front: 'front', back: 'back' })!.svg;
    expect(svg).toContain('stroke-dasharray="9 7"');
    expect(svg).toMatch(/d="M0 0Q50 -?\d+ 100 0"/);
  });

  it('arcs a new arrow between two cells of one array over the top, either way', () => {
    for (const [from, to] of [
      [0, 3],
      [3, 0],
      [1, 2],
    ]) {
      const bend = autoBend(base, { id: 'arr', cell: from }, { id: 'arr', cell: to });
      const shape = arrowShape(addElement(base, cellArrow(from, to, { bend })), cellArrow(from, to, { bend }))!;
      // 拱到名稱那一列上面（陣列的 y 是 100），點得到
      expect(shape.apex.y).toBeLessThan(100);
    }
    // 不同元件、整個元件、樹的節點之間是直的
    expect(autoBend(base, { id: 'arr', cell: 0 }, { x: 0, y: 0 })).toBeUndefined();
    expect(autoBend(base, { id: 'arr' }, { id: 'arr', cell: 1 })).toBeUndefined();
    const tree = { elements: [createElement('binaryTree', { x: 0, y: 0 }, 't', texts)] } as BoardDoc;
    expect(autoBend(tree, { id: 't', cell: 1 }, { id: 't', cell: 2 })).toBeUndefined();
  });

  it('keeps the cell when an arrow is copied with its array', () => {
    const doc = addElement(base, cellArrow(0, 2));
    const { doc: next, ids } = duplicateElements(doc, new Set(['arr', 'e']));
    const copy = next.elements.find((el) => el.type === 'arrow' && ids.includes(el.id)) as ElementOf<'arrow'>;
    expect(copy.from).toMatchObject({ cell: 0 });
    expect(copy.to).toMatchObject({ cell: 2 });
  });
});

describe('small fixes from the first-time user test', () => {
  const svgOptions = { measure: estimateWidth, front: 'front', back: 'back' };

  it('colors text, sticky notes, and headings, but not code, and drops the color when set back to ink', () => {
    const note = createElement('text', { x: 0, y: 0 }, 'n', texts);
    const code = createElement('code', { x: 0, y: 200 }, 'c', texts);
    let doc: BoardDoc = { elements: [note, code] };
    expect(hasColor(note)).toBe(true);
    expect(hasColor(code)).toBe(false);
    doc = recolorElements(doc, new Set(['n', 'c']), 'red');
    expect(findElement(doc, 'n')).toMatchObject({ color: 'red' });
    expect(findElement(doc, 'c')).not.toHaveProperty('color');
    expect(boardDocSchema.safeParse(doc).success).toBe(true);
    expect(boardToSvg(doc, undefined, svgOptions)!.svg).toContain('fill="#c62828"');
    doc = recolorElements(doc, new Set(['n']), 'ink');
    expect((findElement(doc, 'n') as ElementOf<'text'>).color).toBeUndefined();
  });

  it('picks a pencil stroke by clicking on it, the topmost one first', () => {
    const doc: BoardDoc = {
      elements: [
        { type: 'stroke', id: 's1', color: 'ink', points: [0, 0, 100, 0] },
        { type: 'stroke', id: 's2', color: 'red', points: [50, -50, 50, 50] },
      ],
    };
    expect(hitConnector(doc, { x: 20, y: 3 }, 8)).toBe('s1');
    expect(hitConnector(doc, { x: 50, y: 0 }, 8)).toBe('s2');
    expect(hitConnector(doc, { x: 20, y: 30 }, 8)).toBeUndefined();
  });

  it('clears recorded steps with the canvas only when asked', () => {
    const doc: BoardDoc = { elements: [createElement('array', { x: 0, y: 0 }, 'a', texts)], steps: [{ id: 's1', caption: '', elements: [] }] };
    expect(clearElements(doc)).toEqual({ elements: [], steps: doc.steps });
    expect(clearElements(doc, true).steps).toBeUndefined();
    expect(clearElements(doc, true).elements).toEqual([]);
  });

  it('draws the default graph with no edges crossing in the middle', () => {
    const graph = createElement('graph', { x: 0, y: 0 }, 'g', texts) as ElementOf<'graph'>;
    const { centers } = graphLayout(graph);
    const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }, s: { x: number; y: number }) => {
      const side = (a: typeof p, b: typeof p, c: typeof p) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
      return side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0;
    };
    for (const [i, e] of graph.edges.entries()) {
      for (const f of graph.edges.slice(i + 1)) {
        expect(cross(centers[e.a], centers[e.b], centers[f.a], centers[f.b]), `${e.a}-${e.b} × ${f.a}-${f.b}`).toBe(false);
      }
    }
  });

  it('labels a dict’s two columns key and value', () => {
    const dict = createElement('dict', { x: 0, y: 0 }, 'd', texts) as ElementOf<'table'>;
    expect(sizeOf(dict)).toEqual({ w: 2 * WIDE_CELL, h: LABEL_H + INDEX_H + 2 * CELL });
    const svg = boardToSvg({ elements: [dict] }, undefined, { ...svgOptions, dictHead: ['key', 'value'] })!.svg;
    expect(svg).toContain('>key</text>');
    expect(svg).toContain('>value</text>');
  });
});

describe('complexity block', () => {
  it('starts with a title and empty answers, so you think of them yourself, and fits the save format', () => {
    const block = createElement('complexity', { x: 10, y: 20 }, 'c', texts);
    expect(block).toEqual({ type: 'complexity', id: 'c', x: 10, y: 20, title: 'Complexity', time: '', timeWhy: '', space: '', spaceWhy: '' });
    expect(sizeOf(block)).toEqual({ w: COMPLEXITY_W, h: COMPLEXITY_H });
    // 理由換行時畫面量到比較高，寬度不變；量到的比預設矮也不會縮
    expect(sizeOf(block, { w: 999, h: 140 })).toEqual({ w: COMPLEXITY_W, h: 140 });
    expect(sizeOf(block, { w: 999, h: 60 })).toEqual({ w: COMPLEXITY_W, h: COMPLEXITY_H });
    expect(boardDocSchema.safeParse({ elements: [block] }).success).toBe(true);
    expect(PALETTE.find((g) => g.group === 'notes')?.kinds).toContain('complexity');
  });

  it('exports the answers written out, an empty one as O(?), and wraps a long reason instead of cutting it', () => {
    const why = 'two nested loops over every pair of numbers in the input array, which is slow';
    const block = { ...(createElement('complexity', { x: 0, y: 0 }, 'c', texts) as ElementOf<'complexity'>), time: 'n^2', timeWhy: why };
    const svg = boardToSvg({ elements: [block] }, undefined, { measure: estimateWidth, front: 'f', back: 'b' })!.svg;
    expect(svg).toContain('>O(n²)</text>');
    expect(svg).toContain('>O(?)</text>');
    expect(svg).not.toContain('…</text>');
    // 理由分成好幾行，每個字都在；整塊比只有一行時高
    const lines = [...svg.matchAll(/font-size="13" fill="[^"]+" dominant-baseline="middle">([^<]+)<\/text>/g)].map((m) => m[1]).filter((line) => why.includes(line));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(why);
    const height = Number(/<rect x="0" y="0" width="360" height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1]);
    expect(height).toBeGreaterThan(COMPLEXITY_H);
  });

  it('gives the reasons the room the answers leave, so a short answer means a wider reason', () => {
    const base = createElement('complexity', { x: 0, y: 0 }, 'c', texts) as ElementOf<'complexity'>;
    const reasonX = (time: string) => {
      const svg = boardToSvg({ elements: [{ ...base, time, timeWhy: 'why' }] }, undefined, { measure: estimateWidth, front: 'f', back: 'b' })!.svg;
      return Number(/<text x="(\d+(?:\.\d+)?)"[^>]*>why<\/text>/.exec(svg)?.[1]);
    };
    expect(reasonX('n')).toBeLessThan(reasonX('n log n'));
  });
});

describe('rectangles and ellipses', () => {
  it('draws from any corner and squares up with Shift', () => {
    expect(shapeFromDrag('r', 'rect', { x: 100, y: 100 }, { x: 40, y: 60 }, 'red')).toMatchObject({ x: 40, y: 60, w: 60, h: 40 });
    expect(shapeFromDrag('e', 'ellipse', { x: 0, y: 0 }, { x: 30, y: 80 }, 'blue', true)).toMatchObject({ w: 80, h: 80 });
    expect(shapeFromDrag('t', 'rect', { x: 0, y: 0 }, { x: 1, y: 1 }, 'ink')).toMatchObject({ w: 8, h: 8 });
  });

  it('only counts the outline, so whatever is framed stays clickable', () => {
    const rect = shapeFromDrag('r', 'rect', { x: 0, y: 0 }, { x: 100, y: 60 }, 'ink');
    expect(distanceToShapeEdge(rect, { x: 50, y: 2 })).toBe(2);
    expect(distanceToShapeEdge(rect, { x: 50, y: 30 })).toBe(30);
    expect(distanceToShapeEdge(rect, { x: 110, y: 30 })).toBe(10);
    const circle = shapeFromDrag('c', 'ellipse', { x: 0, y: 0 }, { x: 100, y: 100 }, 'ink');
    expect(distanceToShapeEdge(circle, { x: 50, y: 0 })).toBeCloseTo(0);
    expect(distanceToShapeEdge(circle, { x: 50, y: 50 })).toBeCloseTo(50);

    const doc: BoardDoc = { elements: [rect] };
    expect(hitInk(doc, { x: 50, y: 4 }, 6)).toEqual(['r']);
    expect(hitInk(doc, { x: 50, y: 30 }, 6)).toEqual([]);
  });

  it('resizes, recolors, and stops arrows on an ellipse', () => {
    const circle = shapeFromDrag('c', 'ellipse', { x: 0, y: 0 }, { x: 100, y: 50 }, 'ink');
    const node = createElement('treeNode', { x: 300, y: 1 }, 'n', texts);
    let doc: BoardDoc = { elements: [circle, node, { type: 'arrow', id: 'a', from: { id: 'c' }, to: { id: 'n' }, color: 'ink' }] };
    const [start] = arrowPoints(doc, doc.elements[2] as ElementOf<'arrow'>)!;
    // 橢圓中心 (50, 25)、半軸 50 和 25：起點要落在橢圓上
    expect(((start.x - 50) / 50) ** 2 + ((start.y - 25) / 25) ** 2).toBeCloseTo(1);

    doc = resizeShape(doc, 'c', 3, 400);
    expect(doc.elements[0]).toMatchObject({ w: 8, h: 400 });
    doc = recolorElements(doc, new Set(['c', 'n']), 'green');
    expect(doc.elements[0]).toMatchObject({ color: 'green' });
    expect(doc.elements[1]).not.toHaveProperty('color');
    expect(boardDocSchema.safeParse(doc).success).toBe(true);
  });

  it('keeps the shape while resizing with Shift or Ctrl, so a circle stays a circle', () => {
    // 正圓：往右下、只往右、往左上拖都還是正圓
    expect(keepRatio({ w: 100, h: 100 }, { w: 140, h: 140 })).toEqual({ w: 140, h: 140 });
    expect(keepRatio({ w: 100, h: 100 }, { w: 140, h: 100 })).toEqual({ w: 120, h: 120 });
    expect(keepRatio({ w: 100, h: 100 }, { w: 60, h: 100 })).toEqual({ w: 80, h: 80 });
    expect(keepRatio({ w: 100, h: 100 }, { w: 50, h: 70 })).toEqual({ w: 60, h: 60 });
    // 橢圓維持 2:1
    const wide = keepRatio({ w: 100, h: 50 }, { w: 200, h: 100 });
    expect(wide).toEqual({ w: 200, h: 100 });
    const shrunk = keepRatio({ w: 100, h: 50 }, { w: 80, h: 30 });
    expect(shrunk.w / shrunk.h).toBeCloseTo(2);
    // 縮到最小：短的那邊至少 8，形狀不變
    expect(keepRatio({ w: 100, h: 50 }, { w: -500, h: -500 })).toEqual({ w: 16, h: 8 });
    // 套用後寬高一樣，存起來的正圓不會差一個像素
    const circle = shapeFromDrag('c', 'ellipse', { x: 0, y: 0 }, { x: 90, y: 90 }, 'ink');
    const size = keepRatio(circle, { w: 133, h: 101 });
    const [resized] = resizeShape({ elements: [circle] }, 'c', size.w, size.h).elements as ElementOf<'shape'>[];
    expect(resized.w).toBe(resized.h);
  });
});

describe('lines', () => {
  const a = createElement('graphNode', { x: 0, y: 0 }, 'a', texts);
  const b = createElement('graphNode', { x: 200, y: 0 }, 'b', texts);
  const edge = { type: 'arrow' as const, id: 'e', from: { id: 'a' }, to: { id: 'b' }, color: 'ink' as const };

  it('turns an arrow into a plain line and back', () => {
    let doc: BoardDoc = { elements: [a, b, edge] };
    doc = setArrowHead(doc, 'e', 'none');
    expect(doc.elements[2]).toMatchObject({ head: 'none' });
    expect(boardDocSchema.safeParse(doc).success).toBe(true);
    doc = setArrowHead(doc, 'e', 'end');
    expect(doc.elements[2]).not.toHaveProperty('head', 'none');
  });

  it('can be clicked and recolored', () => {
    let doc: BoardDoc = { elements: [a, b, edge] };
    expect(hitConnector(doc, { x: 120, y: 27 }, 8)).toBe('e');
    expect(hitConnector(doc, { x: 120, y: 80 }, 8)).toBeUndefined();
    doc = recolorElements(doc, new Set(['e', 'a']), 'red');
    expect(doc.elements[2]).toMatchObject({ color: 'red' });
    expect(doc.elements[0]).not.toHaveProperty('color');
  });
});

describe('steps', () => {
  it('records snapshots that later edits do not change', () => {
    let doc = boardWithArray();
    doc = captureStep(doc, 's1', 'start');
    doc = shiftPointer({ elements: doc.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index: 0 } } : el)), steps: doc.steps }, 'pi', 1);
    doc = captureStep(doc, 's2');
    doc = moveElements(doc, new Set(['arr']), 100, 0);
    expect(doc.steps?.map((s) => s.caption)).toEqual(['start', '']);
    // 第一步記的時候指標還沒吸附，第二步在第 1 格
    expect(pointer(stepDoc(doc, 0), 'pi').attach).toBeUndefined();
    expect(pointer(stepDoc(doc, 1), 'pi').attach?.index).toBe(1);
    expect((stepDoc(doc, 1).elements[0] as ElementOf<'list'>).x).toBe(100);
    expect(boardDocSchema.safeParse(doc).success).toBe(true);
  });

  it('keeps steps through edits, captions, restores, and clearing the canvas', () => {
    let doc = captureStep(boardWithArray(), 's1');
    doc = setStepCaption(doc, 0, 'j moves right');
    doc = removeElements(doc, new Set(['arr']));
    doc = addElement(doc, createElement('var', { x: 0, y: 0 }, 'v', texts));
    expect(doc.steps).toHaveLength(1);
    doc = restoreStep(doc, 0);
    expect(doc.elements.map((el) => el.id)).toEqual(['arr', 'pi', 'pj']);
    doc = clearElements(doc);
    expect(doc.elements).toEqual([]);
    expect(doc.steps?.[0].caption).toBe('j moves right');
    doc = deleteStep(doc, 0);
    expect(doc).not.toHaveProperty('steps');
  });

  it('stops at the step limit', () => {
    let doc: BoardDoc = EMPTY_DOC;
    for (let i = 0; i < MAX_STEPS + 3; i += 1) doc = captureStep(doc, `s${i}`);
    expect(doc.steps).toHaveLength(MAX_STEPS);
  });
});

describe('marquee selection', () => {
  function group(): BoardDoc {
    const base = boardWithArray();
    const elements = base.elements.map((el) => (el.id === 'pi' ? { ...el, attach: { id: 'arr', index: 1 } } : el));
    const a = createElement('treeNode', { x: 100, y: 300 }, 'a', texts);
    const b = createElement('treeNode', { x: 200, y: 300 }, 'b', texts);
    return {
      elements: [
        ...elements,
        a,
        b,
        { type: 'arrow', id: 'e', from: { id: 'a' }, to: { id: 'b' }, color: 'ink' },
        { type: 'stroke', id: 's', color: 'red', points: [100, 400, 150, 420] },
      ],
    };
  }

  it('selects only what lies entirely inside the box', () => {
    const doc = group();
    expect(elementsInRect(doc, rectFromCorners({ x: 90, y: 290 }, { x: 260, y: 430 })).sort()).toEqual(['a', 'b', 'e', 's']);
    // 只框到一半的陣列不算
    expect(elementsInRect(doc, rectFromCorners({ x: 90, y: 90 }, { x: 180, y: 200 }))).not.toContain('arr');
    expect(elementsInRect(doc, rectFromCorners({ x: 90, y: 90 }, { x: 300, y: 240 }))).toEqual(['arr', 'pi']);
  });

  it('moves a group together, keeping pointers on their array and ink in place relative to it', () => {
    const doc = moveElements(group(), new Set(['arr', 'pi', 's', 'e', 'a', 'b']), 50, 10);
    expect(pointer(doc, 'pi').attach).toEqual({ id: 'arr', index: 1 });
    expect((doc.elements.find((el) => el.id === 's') as ElementOf<'stroke'>).points).toEqual([150, 410, 200, 430]);
    expect(doc.elements.find((el) => el.id === 'a')).toMatchObject({ x: 150, y: 310 });
  });

  it('duplicates a group with pointers and arrows wired to the copies', () => {
    const source = group();
    const { doc, ids } = duplicateElements(source, new Set(['arr', 'pi', 'a', 'b', 'e', 's']));
    expect(ids).toHaveLength(6);
    const copies = doc.elements.filter((el) => ids.includes(el.id));
    const arrCopy = copies.find((el) => el.type === 'list')!;
    const ptrCopy = copies.find((el) => el.type === 'pointer') as ElementOf<'pointer'>;
    expect(ptrCopy.attach).toEqual({ id: arrCopy.id, index: 1 });
    const edgeCopy = copies.find((el) => el.type === 'arrow') as ElementOf<'arrow'>;
    const nodeIds = copies.filter((el) => el.type === 'node').map((el) => el.id);
    expect(nodeIds).toContain((edgeCopy.from as { id: string }).id);
    expect(nodeIds).toContain((edgeCopy.to as { id: string }).id);
    expect(boardDocSchema.safeParse(doc).success).toBe(true);

    // 箭頭的另一端沒有一起複製時，不複製箭頭
    const partial = duplicateElements(source, new Set(['a', 'e']));
    expect(partial.ids).toHaveLength(1);
  });
});

describe('history', () => {
  it('undoes and redoes commits, and treats a drag as one step', () => {
    const one: BoardDoc = { elements: [createElement('var', { x: 0, y: 0 }, 'v', texts)] };
    let h = commit(initHistory(EMPTY_DOC), one);
    // 拖曳：開始時 checkpoint，過程中只 replace
    h = checkpoint(h);
    h = replace(h, moveElements(h.present, new Set(['v']), 5, 0));
    h = replace(h, moveElements(h.present, new Set(['v']), 5, 0));
    expect(h.present.elements[0]).toMatchObject({ x: 10 });

    h = undo(h);
    expect(h.present).toBe(one);
    h = undo(h);
    expect(h.present).toBe(EMPTY_DOC);
    h = redo(redo(h));
    expect(h.present.elements[0]).toMatchObject({ x: 10 });
  });

  it('drops the checkpoint of a click that changed nothing', () => {
    const h = dropEmptyCheckpoint(checkpoint(initHistory(EMPTY_DOC)));
    expect(h.past).toEqual([]);
  });
});

describe('sync schema', () => {
  it('rejects boards that are too large', () => {
    const points = Array.from({ length: 4000 }, (_, i) => 100000 + i);
    const elements = Array.from({ length: 120 }, (_, i) => ({ type: 'stroke' as const, id: `s${i}`, color: 'ink' as const, points }));
    expect(fitsSizeLimit({ elements } as never)).toBe(false);
    expect(fitsSizeLimit({ elements: elements.slice(0, 2) } as never)).toBe(true);
  });
});
