// 自動播放每一步停多久：照那一步說明的長短，讀得完才換下一步。
// 一分鐘大約讀 250 個英文字（一秒 4 個字），再多留一點時間看白板上變了什麼。

/** 沒有說明或說明很短時至少停這麼久（毫秒） */
export const MIN_STEP_MS = 1400;
/** 說明再長也不會停超過這麼久，免得看起來像卡住 */
export const MAX_STEP_MS = 9000;
/** 看白板上變了什麼的時間 */
const LOOK_MS = 1000;
/** 讀一個字的時間 */
const PER_WORD_MS = 240;

/** 自動播放時這一步停多久（毫秒） */
export function stepDwellMs(caption: string | undefined): number {
  const words = caption?.trim() ? caption.trim().split(/\s+/).length : 0;
  return Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, LOOK_MS + words * PER_WORD_MS));
}
