// dsa-whiteboard：畫資料結構和演算法的白板元件。
// 樣式另外引入：import 'dsa-whiteboard/board.css'（使用的一方沒有自己的基本樣式時，再加 base.css）

export {
  Whiteboard,
  type ExplainHooks,
  type ExplainReviewProps,
  type ExplainSessionProps,
  type WhiteboardProps,
} from './components/Whiteboard';
export type { Locale, Messages } from './i18n';
export { EMPTY_DOC, MAX_STEPS, type BoardStep } from './lib/model';
export { boardToSvg } from './lib/exportSvg';
export * from './schema';
