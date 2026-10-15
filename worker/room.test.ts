import { describe, expect, it } from 'vitest';
import { applyBatch, cleanName, loadDoc, parseClientMessage } from './room';

const v = (id: string, value = '1') => ({ type: 'var', id, x: 0, y: 0, name: id, value });

describe('room rules', () => {
  it('accepts well-formed messages and rejects anything else', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'ops', batch: 1, ops: [{ k: 'put', el: v('a') }] }))?.t).toBe('ops');
    expect(parseClientMessage(JSON.stringify({ t: 'cursor', at: { x: 3, y: 4 } }))?.t).toBe('cursor');
    expect(parseClientMessage(JSON.stringify({ t: 'cursor', at: null }))?.t).toBe('cursor');
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'ops', batch: 1, ops: [] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'ops', batch: 1, ops: [{ k: 'put', el: { type: 'nope', id: 'x' } }] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'ops', batch: 1, ops: [{ k: 'del', id: 'Bad Id!' }] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'cursor', at: { x: Number.MAX_VALUE, y: 0 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'shout' }))).toBeNull();
  });

  it('cleans up names', () => {
    expect(cleanName('  Ada   Lovelace ', 'Guest')).toBe('Ada Lovelace');
    expect(cleanName('', 'Guest 2')).toBe('Guest 2');
    expect(cleanName(null, 'Guest 2')).toBe('Guest 2');
    expect(cleanName('x'.repeat(50), 'Guest')).toHaveLength(30);
  });

  it('refuses a batch that would make the board too large', () => {
    const points = Array.from({ length: 4000 }, (_, i) => 100000 + i);
    const stroke = (id: string) => ({ type: 'stroke' as const, id, color: 'ink' as const, points });
    const small = applyBatch({ elements: [] }, [{ k: 'put', el: stroke('s1') }]);
    expect(small.ok).toBe(true);
    const big = applyBatch({ elements: [] }, Array.from({ length: 120 }, (_, i) => ({ k: 'put' as const, el: stroke(`s${i}`) })));
    expect(big).toEqual({ ok: false, reason: 'too_large' });
  });

  it('reads back a stored board, and treats a broken one as missing', () => {
    expect(loadDoc(undefined)).toBeNull();
    expect(loadDoc({ elements: [v('a')] })?.elements).toHaveLength(1);
    expect(loadDoc({ elements: 'oops' })).toBeNull();
  });
});
