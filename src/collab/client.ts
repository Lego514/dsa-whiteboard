import type { BoardDoc } from '../schema';
import type { ClientMessage, Peer, ServerMessage } from './messages';
import { applyOps, opKey, STEPS_KEY, type Op } from './ops';

// 共用房間的連線。伺服器依收到的順序決定誰的修改最後算數，再送給所有人（包含自己）。
//
// 自己改過、伺服器還沒確認的東西（pending），別人對同一個東西的修改先不套用：
// 自己的那筆會排在後面，最後大家都會停在自己的版本。這樣每個人看到的結果都一樣。

export interface CollabStatus {
  state: 'connecting' | 'open' | 'offline' | 'full';
  me?: Peer;
  peers: Peer[];
}

export interface CollabCallbacks {
  /** 白板現在的內容 */
  getDoc: () => BoardDoc;
  /** 連上（或重新連上）時，整份換成這個內容 */
  onInit: (doc: BoardDoc) => void;
  /** 別人的修改 */
  onRemote: (ops: Op[]) => void;
  onCursor: (from: string, at: { x: number; y: number } | null) => void;
  onStatus: (status: CollabStatus) => void;
}

/** 合併一小段時間內的修改再送，拖曳時不用每一格畫面都送 */
const FLUSH_MS = 50;
/** 游標最多每 50 毫秒送一次 */
const CURSOR_MS = 50;
const MAX_BACKOFF_MS = 10_000;
/** 伺服器關掉連線的原因：房間滿了 */
export const CLOSE_FULL = 4001;

export class CollabClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private seed: boolean;
  private backoff = 500;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private batch = 0;
  /** 還沒送出的修改（同一個東西只留最後一次） */
  private queue = new Map<string, Op>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** 送出了但伺服器還沒確認：每個東西還差幾筆確認 */
  private pending = new Map<string, number>();
  private me: Peer | undefined;
  private peers = new Map<string, Peer>();
  private state: CollabStatus['state'] = 'connecting';
  private cursorAt: { x: number; y: number } | null = null;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private cursorSentAt = 0;

  constructor(
    private readonly url: string,
    private name: string,
    seed: boolean,
    private readonly cb: CollabCallbacks,
  ) {
    this.seed = seed;
  }

  connect(): void {
    this.closed = false;
    this.setState('connecting');
    const url = new URL(this.url);
    url.searchParams.set('name', this.name);
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onmessage = (event) => {
      if (this.ws !== ws || typeof event.data !== 'string') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      this.receive(message);
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.peers.clear();
      if (this.closed) return;
      if (event.code === CLOSE_FULL) {
        this.setState('full');
        return;
      }
      this.setState('offline');
      this.retry = setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(MAX_BACKOFF_MS, this.backoff * 2);
    };
  }

  close(): void {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.cursorTimer) clearTimeout(this.cursorTimer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  /** 自己的修改；過一下才一起送出 */
  send(ops: readonly Op[]): void {
    for (const op of ops) {
      const key = opKey(op);
      this.queue.delete(key);
      this.queue.set(key, op);
    }
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
  }

  cursor(at: { x: number; y: number } | null): void {
    this.cursorAt = at && { x: Math.round(at.x), y: Math.round(at.y) };
    if (this.cursorTimer) return;
    const wait = Math.max(0, this.cursorSentAt + CURSOR_MS - Date.now());
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null;
      this.cursorSentAt = Date.now();
      this.post({ t: 'cursor', at: this.cursorAt });
    }, wait);
  }

  rename(name: string): void {
    this.name = name;
    this.post({ t: 'rename', name });
  }

  private flush(): void {
    this.flushTimer = null;
    if (this.queue.size === 0 || this.ws?.readyState !== WebSocket.OPEN || this.state !== 'open') return;
    const ops = [...this.queue.values()];
    this.queue.clear();
    for (const op of ops) {
      const key = opKey(op);
      this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
    }
    this.batch += 1;
    this.post({ t: 'ops', batch: this.batch, ops });
  }

  private post(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  /** 自己改過、還沒被確認的東西 */
  private dirtyKeys(): Set<string> {
    return new Set([...this.queue.keys(), ...[...this.pending].filter(([, n]) => n > 0).map(([key]) => key)]);
  }

  private receive(message: ServerMessage): void {
    switch (message.t) {
      case 'init': {
        this.backoff = 500;
        this.me = message.you;
        this.peers = new Map(message.peers.map((peer) => [peer.id, peer]));
        const local = this.cb.getDoc();
        // 建立房間的人把自己的白板放上去；重新連上時，把斷線期間自己改的東西補上去
        const keys = message.empty && this.seed ? keysOf(local) : this.dirtyKeys();
        this.seed = false;
        const mine = opsFor(local, keys);
        this.pending.clear();
        this.queue.clear();
        this.cb.onInit(applyOps(message.doc, mine));
        this.setState('open');
        if (mine.length > 0) {
          this.send(mine);
          this.flush();
        }
        return;
      }
      case 'ops': {
        if (message.from === this.me?.id) {
          for (const op of message.ops) {
            const key = opKey(op);
            const left = (this.pending.get(key) ?? 0) - 1;
            if (left > 0) this.pending.set(key, left);
            else this.pending.delete(key);
          }
          return;
        }
        const busy = this.dirtyKeys();
        const ops = message.ops.filter((op) => !busy.has(opKey(op)));
        if (ops.length > 0) this.cb.onRemote(ops);
        return;
      }
      case 'cursor':
        this.cb.onCursor(message.from, message.at);
        return;
      case 'join':
      case 'peer':
        this.peers.set(message.peer.id, message.peer);
        this.emit();
        return;
      case 'leave':
        this.peers.delete(message.id);
        this.cb.onCursor(message.id, null);
        this.emit();
        return;
      case 'reject':
        return;
    }
  }

  private setState(state: CollabStatus['state']): void {
    this.state = state;
    this.emit();
  }

  private emit(): void {
    this.cb.onStatus({ state: this.state, me: this.me, peers: [...this.peers.values()] });
  }
}

function keysOf(doc: BoardDoc): Set<string> {
  const keys = new Set(doc.elements.map((el) => el.id));
  if (doc.steps?.length) keys.add(STEPS_KEY);
  return keys;
}

/** 把本機這些東西現在的樣子寫成修改：還在的是 put，不見的是 del */
export function opsFor(doc: BoardDoc, keys: ReadonlySet<string>): Op[] {
  const ops: Op[] = [];
  for (const key of keys) {
    if (key === STEPS_KEY) {
      ops.push({ k: 'steps', steps: doc.steps ?? [] });
      continue;
    }
    const el = doc.elements.find((e) => e.id === key);
    ops.push(el ? { k: 'put', el } : { k: 'del', id: key });
  }
  // 依白板上的順序放，新加的元件在房間裡也排在一樣的前後
  const order = new Map(doc.elements.map((el, i) => [el.id, i]));
  return ops.sort((a, b) => (order.get(opKey(a)) ?? Infinity) - (order.get(opKey(b)) ?? Infinity));
}
