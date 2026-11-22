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

  it('labels every example with a short topic in both languages, a different one each', () => {
    for (const locale of ['en', 'zh-TW'] as const) {
      const topics = EXAMPLE_IDS.map((id) => exampleOf(id).topic[locale]);
      // 標題列放得下：一個題型最多 12 個字
      for (const topic of topics) {
        expect(topic.length).toBeGreaterThan(0);
        expect(topic.length).toBeLessThanOrEqual(12);
      }
      expect(new Set(topics).size).toBe(EXAMPLE_IDS.length);
    }
  });

  it('opens 206 first and only accepts the listed ids from a link', () => {
    expect(DEFAULT_EXAMPLE).toBe('206');
    expect(isExampleId('1143')).toBe(true);
    expect(isExampleId('15')).toBe(false);
    expect(isExampleId(null)).toBe(false);
  });
});
