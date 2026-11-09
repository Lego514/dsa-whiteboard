import { DurableObject } from 'cloudflare:workers';
import { MAX_PEERS, PEER_COLORS, ROOM_ID, VIEW_ID, type Peer, type ServerMessage } from '../src/collab/messages';
import { EMPTY_DOC } from '../src/lib/model';
import type { BoardDoc } from '../src/schema';
import { applyBatch, cleanName, loadDoc, parseClientMessage, viewIdOf } from './room';

// 白板共用房間的伺服器（Cloudflare Workers）：每個房間是一個 Durable Object，
// 所有人的 WebSocket 都連到同一個物件，由它決定修改的先後、轉發給大家、把內容存起來。
//
// 兩種連結：/room/<房間代碼> 能改，/view/<只能看的代碼> 只能看。只能看的代碼從房間代碼算出來（viewIdOf），
// 房間用它當名字，所以兩種連結都找得到同一個房間，只能看的人卻推不出房間代碼。

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

/** 每條連線記著的東西；viewId 只有能改的人有，送 init 時才給得出只能看的連結 */
interface Seat {
  peer: Peer;
  viewId?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    const match = url.pathname.match(/^\/(room|view)\/([^/]+)$/);
    const edit = match?.[1] === 'room';
    const id = match?.[2] ?? '';
    if (!match || !(edit ? ROOM_ID : VIEW_ID).test(id)) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    // 只讓白板的網站連進來，別的網站不能拿這台伺服器來用
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (!allowed.includes(origin)) return new Response('Origin not allowed', { status: 403 });
    const viewId = edit ? await viewIdOf(id) : id;
    // 「room:」開頭：舊的房間直接用房間代碼當名字（代碼裡不會有冒號），兩種名字不會撞在一起
    const room = env.ROOMS.get(env.ROOMS.idFromName(`room:${viewId}`));
    // 能不能改由這裡決定，用戶端自己帶的 role 不算數
    const inner = new URL(request.url);
    for (const key of ['role', 'view', 'legacy']) inner.searchParams.delete(key);
    inner.searchParams.set('role', edit ? 'edit' : 'view');
    inner.searchParams.set('view', viewId);
    if (edit) inner.searchParams.set('legacy', id);
    return room.fetch(new Request(inner, request));
  },
} satisfies ExportedHandler<Env>;

export class Room extends DurableObject<Env> {
  /** 房間的內容；物件休眠後會從儲存空間讀回來 */
  private doc: BoardDoc | null = null;
  private dirty = false;
  private legacyChecked = false;

  async fetch(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams;
    const viewer = params.get('role') !== 'edit';
    const viewId = params.get('view') ?? undefined;
    const legacy = params.get('legacy');
    if (!viewer && legacy) await this.adoptLegacy(legacy);
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
      name: cleanName(params.get('name'), `Guest ${peers.length + 1}`),
      color,
      ...(viewer && { viewer: true }),
    };
    const seat: Seat = { peer: me, ...(!viewer && { viewId }) };
    server.serializeAttachment(seat);
    await this.ctx.storage.delete('expiresAt');
    const doc = await this.load();
    const stored = await this.ctx.storage.get('doc');
    this.send(server, { t: 'init', you: me, doc, empty: stored === undefined && doc.elements.length === 0, peers, viewId: seat.viewId });
    this.broadcast({ t: 'join', peer: me }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const seat = seatOf(ws);
    if (!seat || typeof raw !== 'string') return;
    const me = seat.peer;
    const message = parseClientMessage(raw);
    if (!message) {
      this.send(ws, { t: 'reject', reason: 'invalid' });
      await this.resync(ws, seat);
      return;
    }
    switch (message.t) {
      case 'ops': {
        if (me.viewer) {
          this.send(ws, { t: 'reject', reason: 'read_only' });
          await this.resync(ws, seat);
          return;
        }
        const result = applyBatch(await this.load(), message.ops);
        if (!result.ok) {
          this.send(ws, { t: 'reject', reason: result.reason });
          await this.resync(ws, seat);
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
        ws.serializeAttachment({ ...seat, peer } satisfies Seat);
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

  /**
   * 舊的房間（還沒有只能看的連結以前開的）用房間代碼當名字：能改的人第一次從新的名字進來時，把內容搬過來。
   * 房間最後一個人離開一週後就刪掉，所以 2026-11-20 以後可以拿掉
   */
  private async adoptLegacy(roomId: string): Promise<void> {
    if (this.legacyChecked) return;
    this.legacyChecked = true;
    if (this.doc || (await this.ctx.storage.get('doc')) !== undefined) return;
    const old = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomId));
    const doc = loadDoc(await old.takeDoc());
    if (!doc) return;
    this.doc = doc;
    await this.save();
  }

  /** 舊的房間交出內容，然後清空自己（給 adoptLegacy 用） */
  async takeDoc(): Promise<unknown> {
    const doc = await this.ctx.storage.get('doc');
    if (doc === undefined) return null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.doc = null;
    return doc;
  }

  private async left(ws: WebSocket): Promise<void> {
    const me = seatOf(ws)?.peer;
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

  private async resync(ws: WebSocket, seat: Seat): Promise<void> {
    this.send(ws, { t: 'init', you: seat.peer, doc: await this.load(), empty: false, peers: this.peers(ws), viewId: seat.viewId });
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
      .map((ws) => seatOf(ws)?.peer)
      .filter((p): p is Peer => p !== undefined);
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

function seatOf(ws: WebSocket): Seat | null {
  return ws.deserializeAttachment() as Seat | null;
}
