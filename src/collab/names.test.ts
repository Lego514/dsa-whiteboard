import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../i18n';
import { animalOf, GUEST_ANIMALS, guestName, isOldGuestName } from './names';

describe('default names in a shared room', () => {
  it('pairs an adjective with an animal in each language', () => {
    expect(guestName('en', () => 0)).toBe('Brave Capybara');
    expect(guestName('zh-TW', () => 0)).toBe('勇敢水豚');
    // random() 最大接近 1 時取最後一個，不會超出名單
    expect(guestName('en', () => 0.9999)).toBe('Witty Hedgehog');
  });

  it('starts every adjective with a different letter, so avatars tell people apart', () => {
    for (const messages of Object.values(MESSAGES)) {
      const { adjectives, animals } = messages.collab.guest;
      expect(new Set(adjectives.map((a) => [...a][0])).size).toBe(adjectives.length);
      expect(Object.keys(animals).sort()).toEqual([...GUEST_ANIMALS].sort());
    }
    // 兩種語言的形容詞一樣多
    expect(MESSAGES.en.collab.guest.adjectives).toHaveLength(MESSAGES['zh-TW'].collab.guest.adjectives.length);
  });

  it('knows which animal a default name is, in either language, but not for names people chose', () => {
    expect(animalOf('Brave Capybara')).toBe('capybara');
    expect(animalOf('機智刺蝟')).toBe('hedgehog');
    expect(animalOf(' Happy Owl ')).toBe('owl');
    for (let i = 0; i < 20; i += 1) expect(animalOf(guestName(i % 2 ? 'en' : 'zh-TW'))).toBeDefined();
    expect(animalOf('Ray')).toBeUndefined();
    expect(animalOf('Capybara')).toBeUndefined();
    expect(animalOf('Grumpy Cat')).toBeUndefined();
  });

  it('recognizes the old automatic names, but not names people chose', () => {
    expect(isOldGuestName('Guest 17')).toBe(true);
    expect(isOldGuestName('訪客 42')).toBe(true);
    expect(isOldGuestName('Ray')).toBe(false);
    expect(isOldGuestName('Guest Star')).toBe(false);
    expect(isOldGuestName('Brave Capybara')).toBe(false);
  });
});
