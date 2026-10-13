import type { BoardDoc } from './schema';

// 白板的常數；跟資料格式（schema.ts，要用到 zod）分開，元件本身才不用把 zod 打包進去。

/** 一張白板最多約 400 KB，一次同步的請求才不會太大 */
export const BOARD_MAX_BYTES = 400_000;

/** 白板的筆跡與箭頭顏色；畫面上對應到各自的 CSS 變數 */
export const BOARD_COLORS = ['ink', 'red', 'blue', 'green', 'orange'] as const;
export type BoardColor = (typeof BOARD_COLORS)[number];

/** 白板陣列格子可以上的底色，追蹤時標出看過的、視窗裡的格子 */
export const CELL_COLORS = ['yellow', 'green', 'blue', 'red', 'purple', 'gray'] as const;
export type CellColor = (typeof CELL_COLORS)[number];

/** 內容有沒有超過大小上限（JSON 字串長度） */
export function fitsSizeLimit(doc: BoardDoc): boolean {
  return JSON.stringify(doc).length <= BOARD_MAX_BYTES;
}
