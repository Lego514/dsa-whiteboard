import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBatch } from '../../worker/room';
import { EMPTY_DOC } from '../lib/model';
import type { BoardDoc, BoardElement } from '../schema';
import { CollabClient, type CollabStatus } from './client';
import type { Peer, ServerMessage } from './messages';
import { applyOps, diffDocs } from './ops';

// 用假的網路模擬伺服器和兩個人：訊息排在佇列裡，測試決定什麼時候送達，才能做出「同時改」的情況。

const v = (id: string, value: string): BoardElement => ({ type: 'var', id, x: 0, y: 0, name: id, value });
const valueOf = (doc: BoardDoc, id: string) => (doc.elements.find((el) => el.id === id) as { value: string } | undefined)?.value;

class Network {
  server = new FakeServer(this);
  queue: (() => void)[] = [];
  /** 依序送達所有排著的訊息（送達時可能又產生新的） */
  deliverAll() {
    for (let i = 0; i < 1000 && this.queue.length > 0; i += 1) this.queue.shift()!();
  }
}

class FakeServer {
  doc: BoardDoc = EMPTY_DOC;
  stored = false;
  sockets = new Map<FakeSocket, Peer>();
  private n = 0;
  constructor(private net: Network) {}

  connect(ws: FakeSocket, name: string) {
    this.n += 1;
    const peer: Peer = { id: `p${this.n}`, name, color: 'blue' };
    const peers = [...this.sockets.values()];
    this.sockets.set(ws, peer);
    this.to(ws, { t: 'init', you: peer, doc: this.doc, empty: !this.stored && this.doc.elements.length === 0, peers });
    for (const socket of this.sockets.keys()) if (socket !== ws) this.to(socket, { t: 'join', peer });
  }

  receive(ws: FakeSocket, raw: string) {
    const message = JSON.parse(raw);
    const from = this.sockets.get(ws);
    if (!from) return;
    // 跟真的伺服器一樣：改名字送給所有人，包含自己
    if (message.t === 'rename') {
      const peer = { ...from, name: message.name };
      this.sockets.set(ws, peer);
      for (const socket of this.sockets.keys()) this.to(socket, { t: 'peer', peer });
      return;
    }
    if (message.t !== 'ops') return;
    const result = applyBatch(this.doc, message.ops);
    if (!result.ok) return;
    this.doc = result.doc;
    this.stored = true;
    for (const socket of this.sockets.keys()) this.to(socket, { t: 'ops', from: from.id, batch: message.batch, ops: message.ops });
  }

  drop(ws: FakeSocket) {
    this.sockets.delete(ws);
  }

  private to(ws: FakeSocket, message: ServerMessage) {
    const data = JSON.stringify(message);
    this.net.queue.push(() => ws.onmessage?.({ data } as MessageEvent));
  }
}

let net: Network;

class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  constructor(url: URL) {
    net.server.connect(this, url.searchParams.get('name') ?? '');
  }
  send(data: string) {
    net.queue.push(() => net.server.receive(this, data));
  }
  close() {
    this.readyState = 3;
    net.server.drop(this);
    net.queue.push(() => this.onclose?.({ code: 1000 } as CloseEvent));
  }
}

/** 一個人的白板：本機的內容加上連線，修改時跟白板元件一樣算出差異再送出 */
function person(name: string, start: BoardDoc = EMPTY_DOC, seed = false) {
  const me = {
    doc: start,
    status: null as CollabStatus | null,
    client: null as unknown as CollabClient,
    edit(next: BoardDoc) {
      const ops = diffDocs(me.doc, next);
      me.doc = next;
      me.client.send(ops);
    },
  };
  me.client = new CollabClient('ws://test/room/abcdefgh', name, seed, {
    getDoc: () => me.doc,
    onInit: (doc) => (me.doc = doc),
    onRemote: (ops) => (me.doc = applyOps(me.doc, ops)),
    onCursor: () => {},
    onStatus: (status) => (me.status = status),
  });
  me.client.connect();
  return me;
}

/** 送出排著的修改，再讓網路把訊息都送完 */
function settle() {
  vi.advanceTimersByTime(60);
  net.deliverAll();
  vi.advanceTimersByTime(60);
  net.deliverAll();
}

beforeEach(() => {
  vi.useFakeTimers();
  net = new Network();
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 這個人畫面上看到的房間裡的人（自己在第一個） */
const namesSeenBy = (who: ReturnType<typeof person>) => [who.status?.me?.name, ...(who.status?.peers ?? []).map((peer) => peer.name)];

describe('collab client', () => {
  it('takes another default name when the same one is already in the room, like a second tab', () => {
    const first = person('勇敢烏龜');
    settle();
    const second = person('勇敢烏龜');
    settle();
    const [mine, other] = namesSeenBy(second);
    expect(other).toBe('勇敢烏龜');
    expect(mine).not.toBe('勇敢烏龜');
    expect(namesSeenBy(first)).toEqual(['勇敢烏龜', mine]);
    // 名字是英文的人也算撞到
    const third = person('Brave Turtle');
    settle();
    expect(new Set(namesSeenBy(third)).size).toBe(3);
  });

  it('keeps a name the person chose, even if someone else has it', () => {
    person('Ray');
    settle();
    const other = person('Ray');
    settle();
    expect(namesSeenBy(other)).toEqual(['Ray', 'Ray']);
  });

  it('lists yourself once after a rename', () => {
    const alice = person('Alice');
    person('Bob');
    settle();
    alice.client.rename('Alicia');
    settle();
    expect(namesSeenBy(alice)).toEqual(['Alicia', 'Bob']);
  });

  it('puts the creator’s board into an empty room, and the next person sees it', () => {
    const alice = person('Alice', { elements: [v('a', '1'), v('b', '2')] }, true);
    settle();
    expect(net.server.doc.elements.map((el) => el.id)).toEqual(['a', 'b']);
    const bob = person('Bob');
    settle();
    expect(bob.doc).toEqual(net.server.doc);
    expect(alice.doc).toEqual(net.server.doc);
  });

  it('ends with the same result for everyone when two people change the same element at once', () => {
    const alice = person('Alice', { elements: [v('x', '0')] }, true);
    settle();
    const bob = person('Bob');
    settle();
    // 兩個人都改了 x，訊息還沒送到伺服器
    alice.edit({ elements: [v('x', 'A')] });
    bob.edit({ elements: [v('x', 'B')] });
    vi.advanceTimersByTime(60);
    net.deliverAll();
    // 伺服器先收到 Alice 的，再收到 Bob 的：Bob 的勝出，兩個人看到的都是 B
    expect(valueOf(net.server.doc, 'x')).toBe('B');
    expect(valueOf(alice.doc, 'x')).toBe('B');
    expect(valueOf(bob.doc, 'x')).toBe('B');
  });

  it('keeps both people’s changes when they edit different elements', () => {
    const alice = person('Alice', { elements: [v('x', '0'), v('y', '0')] }, true);
    settle();
    const bob = person('Bob');
    settle();
    alice.edit({ elements: [v('x', 'A'), v('y', '0')] });
    bob.edit({ elements: [v('x', '0'), v('y', 'B')] });
    settle();
    for (const doc of [net.server.doc, alice.doc, bob.doc]) {
      expect(valueOf(doc, 'x')).toBe('A');
      expect(valueOf(doc, 'y')).toBe('B');
    }
  });

  it('after reconnecting, sends what changed while offline and keeps what others did', () => {
    const alice = person('Alice', { elements: [v('x', '0')] }, true);
    settle();
    const bob = person('Bob');
    settle();
    // Bob 斷線
    const socket = (bob.client as unknown as { ws: FakeSocket }).ws;
    socket.close();
    net.deliverAll();
    alice.edit({ elements: [v('x', '0'), v('y', 'from Alice')] });
    settle();
    bob.edit({ elements: [v('x', 'offline edit')] });
    vi.advanceTimersByTime(60);
    // 自動重新連線
    vi.advanceTimersByTime(1000);
    settle();
    for (const doc of [net.server.doc, alice.doc, bob.doc]) {
      expect(valueOf(doc, 'x')).toBe('offline edit');
      expect(valueOf(doc, 'y')).toBe('from Alice');
    }
  });

  it('batches quick changes, like a drag, into one message', () => {
    const alice = person('Alice', { elements: [v('x', '0')] }, true);
    settle();
    let sent = 0;
    const socket = (alice.client as unknown as { ws: FakeSocket }).ws;
    const send = socket.send.bind(socket);
    socket.send = (data: string) => {
      sent += 1;
      send(data);
    };
    for (let i = 1; i <= 10; i += 1) alice.edit({ elements: [v('x', String(i))] });
    settle();
    expect(sent).toBe(1);
    expect(valueOf(net.server.doc, 'x')).toBe('10');
  });
});
