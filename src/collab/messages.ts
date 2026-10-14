import type { BoardDoc } from '../schema';
import type { Op } from './ops';

// 白板和共用房間伺服器之間的訊息（JSON）。只有型別，白板元件不用把檢查用的 zod 打包進去。

export interface Peer {
  id: string;
  name: string;
  color: PeerColor;
}

/** 每個人一個顏色，游標和頭像都用這個顏色 */
export const PEER_COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'teal', 'pink', 'brown'] as const;
export type PeerColor = (typeof PEER_COLORS)[number];

/** 一個房間最多幾個人 */
export const MAX_PEERS = PEER_COLORS.length;

export type ClientMessage =
  /** 一批修改；batch 是這個連線自己的流水號 */
  | { t: 'ops'; batch: number; ops: Op[] }
  /** 游標在白板上的位置（白板座標）；離開畫布時是 null */
  | { t: 'cursor'; at: { x: number; y: number } | null }
  /** 改名字 */
  | { t: 'rename'; name: string };

export type ServerMessage =
  /** 一連上（或修改被退回要重新同步）時：房間現在的內容、自己是誰、房間裡還有誰 */
  | { t: 'init'; you: Peer; doc: BoardDoc; empty: boolean; peers: Peer[] }
  /** 有人的修改被伺服器接受了，依伺服器收到的順序送給所有人（包含自己，當作確認） */
  | { t: 'ops'; from: string; batch: number; ops: Op[] }
  | { t: 'cursor'; from: string; at: { x: number; y: number } | null }
  | { t: 'join'; peer: Peer }
  | { t: 'leave'; id: string }
  | { t: 'peer'; peer: Peer }
  /** 修改沒被接受（格式不對或白板太大），接著會送一次 init */
  | { t: 'reject'; reason: 'invalid' | 'too_large' };

/** 房間代碼：小寫英數，產生時用 16 個字元，猜不到 */
export const ROOM_ID = /^[a-z0-9]{8,32}$/;

export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('');
}
