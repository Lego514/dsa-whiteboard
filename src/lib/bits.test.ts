import { describe, expect, it } from 'vitest';
import { boardDocSchema } from '../schema';
import { bitPosition, bitsValue, clearLowestOne, flipBit, isBits, lowestOne, onesCount, parseBits, serializeBits, setBitsValue, shiftBits, type BitsList } from './bits';
import { boardToSvg, estimateWidth } from './exportSvg';
import { createElement, findElement, isIndexed, type BoardDoc } from './model';
import { applyStructureText } from './structures';

const texts = { heading: 'Title', text: 'Text', sticky: 'Idea' };

function bitsDoc(items?: string[]): BoardDoc {
  const el = createElement('bits', { x: 0, y: 0 }, 'b', texts) as BitsList;
  return { elements: [items ? { ...el, items } : el] };
}

const bits = (doc: BoardDoc) => findElement(doc, 'b') as BitsList;

describe('bits', () => {
  it('starts as 11 in eight bits, indexed by bit position from the right', () => {
    const el = bits(bitsDoc());
    expect(isBits(el) && isIndexed(el)).toBe(true);
    expect(el.items.join('')).toBe('00001011');
    expect(bitsValue(el)).toBe(11);
    expect(onesCount(el)).toBe(3);
    expect(bitPosition(el, 0)).toBe(7);
    expect(bitPosition(el, 7)).toBe(0);
    expect(boardDocSchema.parse(bitsDoc())).toEqual(bitsDoc());
  });

  it('shifts within the same width, carrying highlights with the bits', () => {
    let doc = bitsDoc(['1', '0', '0', '1']);
    doc = { elements: [{ ...bits(doc), colors: [null, null, null, 'yellow'] }] };
    const left = bits(shiftBits(doc, 'b', 'left'));
    expect(left.items.join('')).toBe('0010');
    expect(left.colors).toEqual([null, null, 'yellow', null]);
    const right = bits(shiftBits(doc, 'b', 'right'));
    expect(right.items.join('')).toBe('0100');
    // 右移時標了底色的那一位被擠掉，底色一起拿掉
    expect(right.colors).toBeUndefined();
  });

  it('clears the lowest 1 with n & (n - 1), one at a time', () => {
    let doc = bitsDoc(['1', '0', '1', '1', '0']);
    expect(lowestOne(bits(doc))).toBe(3);
    const values: number[] = [];
    while (lowestOne(bits(doc)) >= 0) {
      doc = clearLowestOne(doc, 'b');
      values.push(bitsValue(bits(doc)));
    }
    expect(values).toEqual([20, 16, 0]);
    expect(clearLowestOne(doc, 'b')).toBe(doc);
  });

  it('flips one bit and sets a new number, widening only when needed', () => {
    const doc = bitsDoc();
    expect(bitsValue(bits(flipBit(doc, 'b', 0)))).toBe(139);
    expect(bits(setBitsValue(doc, 'b', 5)).items.join('')).toBe('00000101');
    expect(bits(setBitsValue(doc, 'b', 300)).items).toHaveLength(12);
    expect(setBitsValue(doc, 'b', -1)).toBe(doc);
  });

  it('reads decimal numbers, 0b literals, and LeetCode’s 32-bit strings', () => {
    expect(parseBits('n = 11')).toEqual({ items: [...'00001011'], name: 'n' });
    expect(parseBits('0b101')).toEqual({ items: [...'101'] });
    expect(parseBits('"1101"')).toEqual({ items: [...'1101'] });
    expect(parseBits('n = 00000000000000000000000000001011')).toEqual({ items: [...'00000000000000000000000000001011'], name: 'n' });
    expect((parseBits('4294967293') as { items: string[] }).items).toHaveLength(32);
    expect(parseBits('n = 5, k = 2')).toEqual({ items: [...'00000101'], name: 'n' });
    expect(parseBits('')).toEqual({ error: 'empty' });
    expect(parseBits('-3')).toEqual({ error: 'badFormat' });
    expect(parseBits('4294967296')).toEqual({ error: 'tooMany' });
  });

  it('builds from text and writes itself back as binary, keeping the width', () => {
    const doc = bitsDoc();
    const result = applyStructureText(doc, 'b', 'x = 0b0110');
    if ('error' in result) throw new Error(result.error);
    const el = bits(result.doc);
    expect(el).toMatchObject({ label: 'x', items: ['0', '1', '1', '0'] });
    expect(serializeBits(el)).toBe('x = 0b0110');
  });

  it('exports bit positions and the value next to the name', () => {
    const svg = boardToSvg(bitsDoc(), undefined, { measure: estimateWidth, front: 'front', back: 'back' })!.svg;
    expect(svg).toContain('= 11 (3 ones)');
    expect(svg).toContain('>7</text>');
  });
});
