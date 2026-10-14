import { DurableObject } from 'cloudflare:workers';
import { MAX_PEERS, PEER_COLORS, ROOM_ID, type Peer, type ServerMessage } from '../src/collab/messages';
import { EMPTY_DOC } from '../src/lib/model';
import type { BoardDoc } from '../src/schema';
import { applyBatch, cleanName, loadDoc, parseClientMessage } from './room';

// 白板共用房間的伺服器（Cloudflare Workers）：每個房間是一個 Durable Object，
// 所有人的 WebSocket 都連到同一個物件，由它決定修改的先後、轉發給大家、把內容存起來。

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** 允許連線的網站，用逗號分開 */
  ALLOWED_ORIGINS: string;
}

/** 沒人改之後隔多久寫進儲存空間 */
const SAVE_DELAY_MS = 2000;
/** 最後一個人離開後，房間保留多久 */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const CLOSE_FULL = 4001;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    const match = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!match || !ROOM_ID.test(match[1])) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    // 只讓白板的網站連進來，別的網站不能拿這台伺服器來用
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (!allowed.includes(origin)) return new Response('Origin not allowed', { status: 403 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    return room.fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class Room extends DurableObject<Env> {
  /** 房間的內容；物件休眠後會從儲存空間讀回來 */
  private doc: BoardDoc | null = null;
  private dirty = false;

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const peers = this.peers();
    if (peers.length >= MAX_PEERS) {
      server.close(CLOSE_FULL, 'Room is full');
      return new Response(null, { status: 101, webSocket: client });
    }
    const taken = new Set(peers.map((p) => p.color));
    const color = PEER_COLORS.find((c) => !taken.has(c)) ?? PEER_COLORS[0];
    const me: Peer = {
      id: crypto.randomUUID().slice(0, 8),
      name: cleanName(new URL(request.url).searchParams.get('name'), `Guest ${peers.length + 1}`),
      color,
    };
    server.serializeAttachment(me);
    await this.ctx.storage.delete('expiresAt');
    const doc = await this.load();
    const stored = await this.ctx.storage.get('doc');
    this.send(server, { t: 'init', you: me, doc, empty: stored === undefined && doc.elements.length === 0, peers });
    this.broadcast({ t: 'join', peer: me }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const me = ws.deserializeAttachment() as Peer | null;
    if (!me || typeof raw !== 'string') return;
    const message = parseClientMessage(raw);
    if (!message) {
      this.send(ws, { t: 'reject', reason: 'invalid' });
      await this.resync(ws, me);
      return;
    }
    switch (message.t) {
      case 'ops': {
        const result = applyBatch(await this.load(), message.ops);
        if (!result.ok) {
          this.send(ws, { t: 'reject', reason: result.reason });
          await this.resync(ws, me);
          return;
        }
        this.doc = result.doc;
        this.dirty = true;
        // 依收到的順序送給所有人，自己也收到一份當作確認
        this.broadcast({ t: 'ops', from: me.id, batch: message.batch, ops: message.ops });
        // 已經排了更早的鬧鐘就不用再排；房間保留期限的鬧鐘（七天後）換成存檔的
        const alarm = await this.ctx.storage.getAlarm();
        if (alarm === null || alarm > Date.now() + SAVE_DELAY_MS) await this.ctx.storage.setAlarm(Date.now() + SAVE_DELAY_MS);
        return;
      }
      case 'cursor':
        this.broadcast({ t: 'cursor', from: me.id, at: message.at }, ws);
        return;
      case 'rename': {
        const peer = { ...me, name: cleanName(message.name, me.name) };
        ws.serializeAttachment(peer);
        this.broadcast({ t: 'peer', peer });
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.left(ws);
  }

  /** 存檔，或是最後一個人離開很久之後把房間清掉 */
  async alarm(): Promise<void> {
    if (this.dirty) await this.save();
    if (this.peers().length > 0) return;
    const expiresAt = await this.ctx.storage.get<number>('expiresAt');
    if (expiresAt === undefined) return;
    if (Date.now() >= expiresAt) {
      await this.ctx.storage.deleteAll();
      this.doc = null;
    } else {
      await this.ctx.storage.setAlarm(expiresAt);
    }
  }

  private async left(ws: WebSocket): Promise<void> {
    const me = ws.deserializeAttachment() as Peer | null;
    try {
      ws.close();
    } catch {
      // 已經關掉了
    }
    if (!me) return;
    this.broadcast({ t: 'leave', id: me.id }, ws);
    if (this.peers(ws).length > 0) return;
    if (this.dirty) await this.save();
    const expiresAt = Date.now() + KEEP_MS;
    await this.ctx.storage.put('expiresAt', expiresAt);
    await this.ctx.storage.setAlarm(expiresAt);
  }

  private async resync(ws: WebSocket, me: Peer): Promise<void> {
    this.send(ws, { t: 'init', you: me, doc: await this.load(), empty: false, peers: this.peers(ws) });
  }

  private async load(): Promise<BoardDoc> {
    if (!this.doc) this.doc = loadDoc(await this.ctx.storage.get('doc')) ?? EMPTY_DOC;
    return this.doc;
  }

  private async save(): Promise<void> {
    if (!this.doc) return;
    await this.ctx.storage.put('doc', this.doc);
    this.dirty = false;
  }

  /** 房間裡的人；except 是正在離開或剛連進來的那條連線 */
  private peers(except?: WebSocket): Peer[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN)
      .map((ws) => ws.deserializeAttachment() as Peer | null)
      .filter((p): p is Peer => p !== null);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // 連線已經斷了，close 事件會處理
    }
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        // 同上
      }
    }
  }
}
