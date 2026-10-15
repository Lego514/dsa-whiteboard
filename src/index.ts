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
export type { Locale, Messages } from './i18n';
export type { CollabStatus } from './collab/client';
export { newRoomId, PEER_COLORS, ROOM_ID, type Peer, type PeerColor } from './collab/messages';
export type { CollabOptions } from './collab/useCollab';
export { EMPTY_DOC, MAX_STEPS, type BoardStep } from './lib/model';
export { boardToSvg } from './lib/exportSvg';
export * from './constants';
// 資料格式要用 zod，放在 dsa-whiteboard/schema；這裡只匯出型別，元件才不會把 zod 打包進去
export type { BoardDoc, BoardElement } from './schema';
