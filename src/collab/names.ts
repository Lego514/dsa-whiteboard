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

/** 預設名字是第幾個形容詞、哪一種動物；跟語言無關，兩種語言的同一個名字是同一組 */
interface GuestKey {
  locale: Locale;
  adjective: number;
  animal: GuestAnimal;
}

function guestKeyOf(name: string): GuestKey | undefined {
  const trimmed = name.trim();
  for (const locale of LOCALES) {
    const guest = MESSAGES[locale].collab.guest;
    for (const animal of GUEST_ANIMALS) {
      const adjective = guest.adjectives.findIndex((a) => guest.name(a, guest.animals[animal]) === trimmed);
      if (adjective >= 0) return { locale, adjective, animal };
    }
  }
  return undefined;
}

function nameOf(key: Omit<GuestKey, 'locale'>, locale: Locale): string {
  const guest = MESSAGES[locale].collab.guest;
  return guest.name(guest.adjectives[key.adjective], guest.animals[key.animal]);
}

/** 名字是預設的「形容詞加動物」（任一種語言）時，是哪一種動物；自己取的名字是 undefined */
export function animalOf(name: string): GuestAnimal | undefined {
  return guestKeyOf(name)?.animal;
}

/**
 * 畫面上顯示的名字：預設名字換成看的人的語言（中文介面看到「勇敢烏龜」，英文介面看到 Brave Turtle）；
 * 自己取的名字照原樣
 */
export function localGuestName(name: string, locale: Locale): string {
  const key = guestKeyOf(name);
  return key ? nameOf(key, locale) : name;
}

/**
 * 進房間時，房間裡已經有人用同一個預設名字（不管哪種語言），就換一個沒人用的；自己取的名字不換。
 * 同一個瀏覽器開兩個分頁時名字存在同一個地方，一定會撞到。盡量換成沒人用的動物，頭像也分得出來
 */
export function distinctGuestName(name: string, taken: readonly string[], random: () => number = Math.random): string {
  const mine = guestKeyOf(name);
  if (!mine) return name;
  const others = taken.map(guestKeyOf).filter((key): key is GuestKey => key !== undefined);
  const same = (a: Omit<GuestKey, 'locale'>, b: Omit<GuestKey, 'locale'>) => a.adjective === b.adjective && a.animal === b.animal;
  if (!others.some((key) => same(key, mine))) return name;
  const adjectives = MESSAGES[mine.locale].collab.guest.adjectives.length;
  const free = GUEST_ANIMALS.flatMap((animal) =>
    Array.from({ length: adjectives }, (_, adjective) => ({ adjective, animal })),
  ).filter((key) => !others.some((other) => same(other, key)));
  const usedAnimals = new Set(others.map((key) => key.animal));
  const freshAnimal = free.filter((key) => !usedAnimals.has(key.animal));
  const pool = freshAnimal.length > 0 ? freshAnimal : free;
  // 名單只有 144 組，房間最多 8 個人，一定有沒人用的
  const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return nameOf(pick, mine.locale);
}

/** 舊版自動取的「Guest 17」「訪客 17」：不是自己取的，可以換成新的預設名字 */
export function isOldGuestName(name: string): boolean {
  return /^(Guest|訪客) \d{1,2}$/.test(name.trim());
}
