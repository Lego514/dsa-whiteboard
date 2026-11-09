// dsa-whiteboard：畫資料結構和演算法的白板元件。
// 樣式另外引入：import 'dsa-whiteboard/board.css'（使用的一方沒有自己的基本樣式時，再加 base.css）

export {
  Whiteboard,
  type ExplainHooks,
  type ExplainReviewProps,
  type ExplainSessionProps,
  type WhiteboardProps,
} from './components/Whiteboard';
export { ShareControls, type ShareControlsProps } from './components/ShareControls';
export type { HeaderMenuItem } from './components/HeaderMenu';
export type { Locale, Messages } from './i18n';
export type { CollabStatus } from './collab/client';
export { newRoomId, PEER_COLORS, ROOM_ID, VIEW_ID, type Peer, type PeerColor } from './collab/messages';
export { guestName, isOldGuestName } from './collab/names';
export type { CollabOptions } from './collab/useCollab';
export { EMPTY_DOC, MAX_STEPS, type BoardStep } from './lib/model';
export { boardToSvg } from './lib/exportSvg';
// 畫範例的解析，使用的一方可以先檢查自己的範例畫不畫得出來（例如題庫的測試）
export { insertExample, splitExample } from './lib/example';
export * from './constants';
// 資料格式要用 zod，放在 dsa-whiteboard/schema；這裡只匯出型別，元件才不會把 zod 打包進去
export type { BoardDoc, BoardElement } from './schema';
