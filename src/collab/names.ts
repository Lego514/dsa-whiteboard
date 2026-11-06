import { MESSAGES, type Locale } from '../i18n';

// 共用房間裡的預設名字：形容詞加動物，像 Curious Capybara、好奇水豚，好念又好記。
// 預設名字的頭像是那種動物的小插圖（PeerAvatar.tsx）；自己取的名字頭像放第一個字，
// 所以每個形容詞的第一個字也都不一樣。名單在 i18n 的 collab.guest，兩種語言各一份。

export const GUEST_ANIMALS = [
  'capybara',
  'otter',
  'panda',
  'fox',
  'koala',
  'penguin',
  'owl',
  'rabbit',
  'dolphin',
  'turtle',
  'squirrel',
  'hedgehog',
] as const;
export type GuestAnimal = (typeof GUEST_ANIMALS)[number];

const LOCALES = Object.keys(MESSAGES) as Locale[];

/** 隨機取一個預設名字 */
export function guestName(locale: Locale, random: () => number = Math.random): string {
  const guest = MESSAGES[locale].collab.guest;
  const pick = <T,>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  return guest.name(pick(guest.adjectives), guest.animals[pick(GUEST_ANIMALS)]);
}

/** 名字是預設的「形容詞加動物」（任一種語言）時，是哪一種動物；自己取的名字是 undefined */
export function animalOf(name: string): GuestAnimal | undefined {
  const trimmed = name.trim();
  for (const locale of LOCALES) {
    const guest = MESSAGES[locale].collab.guest;
    for (const animal of GUEST_ANIMALS) {
      if (guest.adjectives.some((adjective) => guest.name(adjective, guest.animals[animal]) === trimmed)) return animal;
    }
  }
  return undefined;
}

/** 舊版自動取的「Guest 17」「訪客 17」：不是自己取的，可以換成新的預設名字 */
export function isOldGuestName(name: string): boolean {
  return /^(Guest|訪客) \d{1,2}$/.test(name.trim());
}
