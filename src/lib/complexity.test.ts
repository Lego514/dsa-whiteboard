import { describe, expect, it } from 'vitest';
import { COMMON_BIG_O, formatBigO } from './complexity';

describe('formatting a complexity', () => {
  it('wraps a bare answer in O( ), and leaves a full one alone', () => {
    expect(formatBigO('n')).toBe('O(n)');
    expect(formatBigO('O(n)')).toBe('O(n)');
    expect(formatBigO('  O(1) ')).toBe('O(1)');
    expect(formatBigO('o(n)')).toBe('O(n)');
    expect(formatBigO('Θ(n log n)')).toBe('Θ(n log n)');
    expect(formatBigO('')).toBe('');
    expect(formatBigO('   ')).toBe('');
  });

  it('turns what is easy to type into how it is written', () => {
    expect(formatBigO('n^2')).toBe('O(n²)');
    expect(formatBigO('O(2^n)')).toBe('O(2ⁿ)');
    expect(formatBigO('n^3')).toBe('O(n³)');
    expect(formatBigO('m * n')).toBe('O(m·n)');
    expect(formatBigO('n*k')).toBe('O(n·k)');
    expect(formatBigO('nlogn')).toBe('O(n log n)');
    expect(formatBigO('O(log n)')).toBe('O(log n)');
    expect(formatBigO('n^(2)')).toBe('O(n²)');
    expect(formatBigO('n logn')).toBe('O(n log n)');
  });

  it('suggests answers that are already written the way they display', () => {
    for (const answer of COMMON_BIG_O) expect(formatBigO(answer)).toBe(answer);
  });
});
