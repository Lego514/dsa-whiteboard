import { describe, expect, it } from 'vitest';
import { MAX_STEP_MS, MIN_STEP_MS, stepDwellMs } from './playback';

describe('stepDwellMs', () => {
  it('waits the minimum when a step has no caption or a short one', () => {
    expect(stepDwellMs(undefined)).toBe(MIN_STEP_MS);
    expect(stepDwellMs('   ')).toBe(MIN_STEP_MS);
    expect(stepDwellMs('Start')).toBe(MIN_STEP_MS);
  });

  it('gives longer captions time to be read', () => {
    const short = stepDwellMs('Save next = 3, point 2 back at 1, then move forward again.');
    const long = stepDwellMs(
      'The key insight is that when the last characters match, they extend the common subsequence of the two shorter prefixes by one character.',
    );
    expect(short).toBeGreaterThan(MIN_STEP_MS);
    expect(long).toBeGreaterThan(short);
    // 二十幾個字大約五、六秒
    expect(long).toBeGreaterThanOrEqual(5000);
  });

  it('never waits longer than the cap', () => {
    expect(stepDwellMs('word '.repeat(200))).toBe(MAX_STEP_MS);
  });
});
