import { useEffect, useRef, useState } from 'react';
import type { BoardDoc } from '../schema';
import { CollabClient, type CollabStatus } from './client';
import type { Op } from './ops';

export interface CollabOptions {
  /** 房間的 WebSocket 網址，例如 wss://…/room/k3f9x2… */
  url: string;
  /** 別人看到的名字 */
  name: string;
  /** 建立房間的人：房間是空的時候，把自己現在的白板放上去 */
  seed?: boolean;
  /** 連線狀態和房間裡有誰 */
  onStatus?: (status: CollabStatus) => void;
}

interface Handlers {
  getDoc: () => BoardDoc;
  onInit: (doc: BoardDoc) => void;
  onRemote: (ops: Op[]) => void;
}

export type Cursors = ReadonlyMap<string, { x: number; y: number }>;

/** 連到共用房間；options 是 undefined 就不連 */
export function useCollab(options: CollabOptions | undefined, handlers: Handlers) {
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [cursors, setCursors] = useState<Cursors>(() => new Map());
  const client = useRef<CollabClient | null>(null);
  // 回呼一直用最新的，連線不用因為重新繪製就重連
  const latest = useRef({ handlers, options });
  useEffect(() => {
    latest.current = { handlers, options };
  });

  const url = options?.url;
  useEffect(() => {
    if (!url) return;
    const { options: initial } = latest.current;
    const c = new CollabClient(url, initial?.name ?? '', !!initial?.seed, {
      getDoc: () => latest.current.handlers.getDoc(),
      onInit: (doc) => latest.current.handlers.onInit(doc),
      onRemote: (ops) => latest.current.handlers.onRemote(ops),
      onCursor: (from, at) =>
        setCursors((prev) => {
          const next = new Map(prev);
          if (at) next.set(from, at);
          else next.delete(from);
          return next;
        }),
      onStatus: (s) => {
        setStatus(s);
        latest.current.options?.onStatus?.(s);
      },
    });
    client.current = c;
    c.connect();
    return () => {
      c.close();
      client.current = null;
    };
  }, [url]);

  const name = options?.name;
  useEffect(() => {
    if (name) client.current?.rename(name);
  }, [name]);

  return {
    status,
    cursors,
    send: (ops: readonly Op[]) => client.current?.send(ops),
    cursor: (at: { x: number; y: number } | null) => client.current?.cursor(at),
  };
}
