import { describe, expect, it } from 'vitest';
import { DEFAULT_EXAMPLE, EXAMPLE_IDS, exampleOf, isExampleId } from './examples';

describe('site examples', () => {
  it('has a step-by-step walkthrough for every example, with a caption on each step', () => {
    for (const id of EXAMPLE_IDS) {
      const { doc, title } = exampleOf(id);
      expect(title.startsWith(`${id}. `)).toBe(true);
      expect(doc.elements.length).toBeGreaterThan(0);
      expect(doc.steps?.length ?? 0).toBeGreaterThanOrEqual(5);
      for (const step of doc.steps ?? []) expect(step.caption.trim()).not.toBe('');
    }
  });

  it('opens 206 first and only accepts the listed ids from a link', () => {
    expect(DEFAULT_EXAMPLE).toBe('206');
    expect(isExampleId('1143')).toBe(true);
    expect(isExampleId('15')).toBe(false);
    expect(isExampleId(null)).toBe(false);
  });
});
