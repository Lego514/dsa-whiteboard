import { createContext, useContext } from 'react';
import type { Messages } from '../i18n';
import type { CollabStatus } from './client';

/** 白板有連到共用房間時的狀態；沒有共用是 null。標題列上的按鈕（ShareControls）用 */
export interface RoomState {
  status: CollabStatus | null;
}

export const RoomContext = createContext<RoomState | null>(null);

export function useRoom(): RoomState | null {
  return useContext(RoomContext);
}

/** 房間裡的人：自己排第一個 */
export function peopleOf(status: CollabStatus | null) {
  if (!status) return [];
  return [...(status.me ? [status.me] : []), ...status.peers];
}

/** 標題列上的連線狀態 */
export function roomLabel(status: CollabStatus | null, t: Messages): string {
  switch (status?.state) {
    case 'open':
      return t.collab.people(peopleOf(status).length);
    case 'offline':
      return t.collab.offline;
    case 'full':
      return t.collab.full;
    default:
      return t.collab.connecting;
  }
}
