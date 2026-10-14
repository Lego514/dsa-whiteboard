import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { EMPTY_DOC, newRoomId, ROOM_ID, Whiteboard, type BoardDoc, type CollabStatus, type Locale } from '../src';
import { boardDocSchema } from '../src/schema';

// 獨立的白板網站：一張白板存在這個瀏覽器裡，不用登入。
// 按「共用」會建立一個共用房間，網址後面加上 #room=…，把網址傳給別人就能一起編輯。

const DOC_KEY = 'dsa-whiteboard:doc';
const LOCALE_KEY = 'dsa-whiteboard:locale';
const NAME_KEY = 'dsa-whiteboard:name';
const REPO_URL = 'https://github.com/Lego514/dsa-whiteboard';
/** 共用房間的伺服器；建置時沒設定就不顯示「共用」 */
const COLLAB_URL = import.meta.env.VITE_COLLAB_URL;

const TEXT = {
  'zh-TW': {
    caption: '資料結構與演算法白板',
    switchTo: 'EN',
    switchLabel: 'Switch to English',
    source: 'GitHub 上的原始碼',
    storageFull: '瀏覽器的儲存空間滿了，這次的修改沒有存起來。',
    share: '共用',
    shareHint: '建立共用連結，拿到連結的人可以一起編輯',
    copyLink: '複製連結',
    copied: '已複製',
    leave: '離開共用',
    saveCopy: '存一份到我的白板',
    saveCopyConfirm: '要用這張共用白板取代你自己的白板嗎？你原本的白板會被蓋掉。',
    savedCopy: '已存到你的白板',
    guest: '訪客',
    room: '共用房間',
    you: '（你）',
    rename: '改名字',
    renamePrompt: '別人看到的名字',
    people: (n: number) => `${n} 人在線上`,
    connecting: '連線中…',
    offline: '離線，正在重新連線…',
    full: '這個房間已經滿了（最多 8 人）',
    roomCaption: '共用白板',
  },
  en: {
    caption: 'Data structures & algorithms',
    switchTo: '中',
    switchLabel: '切換成中文',
    source: 'Source code on GitHub',
    storageFull: 'Browser storage is full, so the latest change wasn’t saved.',
    share: 'Share',
    shareHint: 'Create a link; anyone with it can edit this board with you',
    copyLink: 'Copy link',
    copied: 'Copied',
    leave: 'Leave',
    saveCopy: 'Save a copy to my board',
    saveCopyConfirm: 'Replace your own board with this shared one? Your current board will be overwritten.',
    savedCopy: 'Saved to your board',
    guest: 'Guest',
    room: 'Shared room',
    you: ' (you)',
    rename: 'Change name',
    renamePrompt: 'Name others see',
    people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'} here`,
    connecting: 'Connecting…',
    offline: 'Offline, reconnecting…',
    full: 'This room is full (8 people max)',
    roomCaption: 'Shared whiteboard',
  },
} satisfies Record<Locale, unknown>;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadDoc(): BoardDoc {
  const raw = storage()?.getItem(DOC_KEY);
  if (!raw) return EMPTY_DOC;
  try {
    const parsed = boardDocSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_DOC;
  } catch {
    return EMPTY_DOC;
  }
}

function initialLocale(): Locale {
  const saved = storage()?.getItem(LOCALE_KEY);
  if (saved === 'zh-TW' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

/** 網址裡的房間代碼：#room=…（網站沒設定共用伺服器時當作沒有） */
function roomFromHash(): string | null {
  if (!COLLAB_URL) return null;
  const id = new URLSearchParams(window.location.hash.slice(1)).get('room');
  return id && ROOM_ID.test(id) ? id : null;
}

/** 頭像上的字：名字的第一個字 */
function initialOf(name: string): string {
  return [...name][0]?.toUpperCase() ?? '?';
}

function initialName(locale: Locale): string {
  const saved = storage()?.getItem(NAME_KEY)?.trim();
  if (saved) return saved;
  const name = `${TEXT[locale].guest} ${Math.floor(Math.random() * 90) + 10}`;
  storage()?.setItem(NAME_KEY, name);
  return name;
}

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);

const SHARE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M17 8v6M14 11h6" />
  </svg>
);

const LINK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

const SAVE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 4h9l3 3v13H6z" />
    <path d="M9 4v5h6V4M9 20v-6h6v6" />
  </svg>
);

const LEAVE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </svg>
);

export function App() {
  const [locale, setLocale] = useState(initialLocale);
  const [localDoc, setLocalDoc] = useState(loadDoc);
  const [room, setRoom] = useState(roomFromHash);
  /** 這個分頁建立的房間：房間是空的時候，把自己的白板放上去 */
  const [created, setCreated] = useState<string | null>(null);
  const [name, setName] = useState(() => initialName(locale));
  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [copied, setCopied] = useState(false);
  /** 白板現在的內容（共用時是房間的內容）：共用時放進房間、「存一份」時用 */
  const current = useRef<BoardDoc>(localDoc);
  const menu = useRef<HTMLDivElement>(null);
  const text = TEXT[locale];

  // 上一頁、下一頁或手動改網址時，跟著換房間
  const onHashChange = useEffectEvent(() => {
    const next = roomFromHash();
    if (next === room) return;
    setRoom(next);
    setStatus(null);
    setLocalDoc(loadDoc());
  });
  useEffect(() => {
    const onHash = () => onHashChange();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const switchLocale = () => {
    const next: Locale = locale === 'en' ? 'zh-TW' : 'en';
    setLocale(next);
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-Hant';
    storage()?.setItem(LOCALE_KEY, next);
  };

  const save = (doc: BoardDoc) => {
    // 共用時內容存在房間裡
    if (room) return;
    try {
      storage()?.setItem(DOC_KEY, JSON.stringify(doc));
      setLocalDoc(doc);
    } catch {
      window.alert(text.storageFull);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(text.copyLink, window.location.href);
    }
  };

  const share = () => {
    // 最後一次修改可能還沒存：先存起來，房間也從現在看到的內容開始
    const doc = current.current;
    try {
      storage()?.setItem(DOC_KEY, JSON.stringify(doc));
    } catch {
      // 存不下也照樣共用，內容會在房間裡
    }
    setLocalDoc(doc);
    const id = newRoomId();
    setCreated(id);
    setStatus(null);
    window.location.hash = `room=${id}`;
    setRoom(id);
    void copyLink();
  };

  const leave = () => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setRoom(null);
    setStatus(null);
    setLocalDoc(loadDoc());
  };

  const saveCopy = () => {
    if (!window.confirm(text.saveCopyConfirm)) return;
    try {
      storage()?.setItem(DOC_KEY, JSON.stringify(current.current));
      setLocalDoc(current.current);
      window.alert(text.savedCopy);
    } catch {
      window.alert(text.storageFull);
    }
  };

  const rename = () => {
    const next = window.prompt(text.renamePrompt, name)?.trim();
    if (!next) return;
    setName(next);
    storage()?.setItem(NAME_KEY, next);
  };

  const peers = status ? [...(status.me ? [status.me] : []), ...status.peers] : [];
  const roomLabel =
    status?.state === 'open'
      ? text.people(peers.length)
      : status?.state === 'offline'
        ? text.offline
        : status?.state === 'full'
          ? text.full
          : text.connecting;

  const closeMenu = () => menu.current?.hidePopover();

  const actions = (
    <span className="app-actions" data-room={room ? '' : undefined}>
      {room ? (
        <>
          {/* 頭像疊在一起；點下去看房間裡有誰、改名字、存一份、離開 */}
          <button
            type="button"
            className="app-peers"
            popoverTarget="app-room-menu"
            data-state={status?.state ?? 'connecting'}
            aria-label={`${text.room} · ${roomLabel}`}
            title={roomLabel}
          >
            {peers.length === 0 && <span className="app-peer" aria-hidden />}
            {peers.slice(0, 3).map((peer) => (
              <span key={peer.id} className="app-peer" data-peer={peer.color} aria-hidden>
                {initialOf(peer.name)}
              </span>
            ))}
            {peers.length > 3 && (
              <span className="app-peer app-peer-more" aria-hidden>
                +{peers.length - 3}
              </span>
            )}
          </button>
          <div id="app-room-menu" className="app-menu" popover="auto" ref={menu}>
            <p className="app-menu-status">{roomLabel}</p>
            <ul className="app-menu-people" aria-label={text.room}>
              {peers.map((peer) => {
                const isMe = peer.id === status?.me?.id;
                return (
                  <li key={peer.id}>
                    <span className="app-peer" data-peer={peer.color} aria-hidden>
                      {initialOf(peer.name)}
                    </span>
                    <span className="app-menu-name">
                      {peer.name}
                      {isMe && text.you}
                    </span>
                    {isMe && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-small"
                        onClick={() => {
                          closeMenu();
                          rename();
                        }}
                      >
                        {text.rename}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="app-menu-actions">
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => {
                  closeMenu();
                  saveCopy();
                }}
              >
                {SAVE_ICON}
                {text.saveCopy}
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => {
                  closeMenu();
                  leave();
                }}
              >
                {LEAVE_ICON}
                {text.leave}
              </button>
            </div>
          </div>
          <button type="button" className="btn btn-quiet btn-small app-icon-link" aria-label={copied ? text.copied : text.copyLink} title={text.copyLink} onClick={() => void copyLink()}>
            {LINK_ICON}
            <span className="app-action-text">{copied ? text.copied : text.copyLink}</span>
          </button>
        </>
      ) : (
        COLLAB_URL && (
          <button type="button" className="btn btn-small app-share" aria-label={text.share} title={text.shareHint} onClick={share}>
            {SHARE_ICON}
            <span className="app-action-text">{text.share}</span>
          </button>
        )
      )}
      <button type="button" className="btn btn-quiet btn-small" aria-label={text.switchLabel} title={text.switchLabel} onClick={switchLocale}>
        {text.switchTo}
      </button>
      <a className="btn btn-quiet btn-small app-icon-link app-github" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={text.source} title={text.source}>
        {GITHUB_ICON}
      </a>
    </span>
  );

  const collab =
    room && COLLAB_URL
      ? { url: `${COLLAB_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/room/${room}`, name, seed: created === room, onStatus: setStatus }
      : undefined;

  return (
    <Whiteboard
      key={room ? `room:${room}` : 'local'}
      locale={locale}
      initial={room ? (created === room ? localDoc : EMPTY_DOC) : localDoc}
      onSave={save}
      onChange={(doc) => (current.current = doc)}
      title="DSA Whiteboard"
      caption={room ? text.roomCaption : text.caption}
      savedLabel={room ? roomLabel : undefined}
      exportName="dsa-whiteboard"
      actions={actions}
      collab={collab}
    />
  );
}
