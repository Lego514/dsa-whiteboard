import { useEffect, useId, useRef, useState } from 'react';
import { peopleOf, roomLabel, useRoom } from '../collab/context';
import { useI18n } from '../i18n';
import { PeerAvatar } from './PeerAvatar';

// 標題列上的共用按鈕：放在 Whiteboard 的 actions 裡。
// 沒在房間裡時是「共用」：先說明會發生什麼（誰能改、存在哪裡、自己的白板怎麼辦），按「建立連結」才開房間。
// 在房間裡時是疊在一起的頭像（點開看連結、有誰、改名字、存一份、離開）和「複製連結」。
// 不能用剪貼簿時把連結放在選單的輸入框裡、選好，讓人自己複製，不會什麼都沒發生。
// 房間代碼放在哪裡（網址的 # 或 ?）、怎麼存一份，由使用的一方決定。

export interface ShareControlsProps {
  /** 按「建立連結」：建立房間並回傳房間的連結，會自動複製。沒給就不顯示「共用」 */
  onShare?: () => string | undefined;
  /** 房間的連結，「複製連結」用 */
  link?: string;
  /** 改名字；沒給就不能改 */
  onRename?: (name: string) => void;
  /** 把房間的白板存成自己的；沒給就不顯示 */
  onSaveCopy?: () => void;
  onLeave: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** 「已複製」顯示多久 */
const COPIED_MS = 2000;

/**
 * 剛按了「建立連結」：複製的結果。進房間時使用的一方通常會換掉整塊白板（這個元件也重新掛上），
 * 所以放在元件外面；進了房間的那一個打開選單、顯示複製成功或失敗
 */
let justShared: Promise<boolean> | null = null;

async function writeClipboard(text: string | undefined): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 沒有權限、不是 https：讓使用者自己複製
    return false;
  }
}

export function ShareControls({ onShare, link, onRename, onSaveCopy, onLeave }: ShareControlsProps) {
  const { t } = useI18n();
  const c = t.collab;
  const room = useRoom();
  const menuId = useId();
  const introId = useId();
  const introTitle = useId();
  const menu = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const showCopied = (ok: boolean) => {
    window.clearTimeout(copiedTimer.current);
    setCopy(ok ? 'copied' : 'failed');
    if (ok) copiedTimer.current = window.setTimeout(() => setCopy('idle'), COPIED_MS);
  };

  /** 打開房間選單、把連結選好，可以直接按 Ctrl+C */
  const showLink = () => {
    menu.current?.showPopover();
    requestAnimationFrame(() => linkInput.current?.select());
  };

  // 剛建立的房間：打開選單，連結選好，等複製的結果
  const inRoom = room !== null;
  useEffect(() => {
    const pending = justShared;
    if (!inRoom || !pending) return;
    const node = menu.current;
    if (node && !node.matches(':popover-open')) node.showPopover();
    requestAnimationFrame(() => linkInput.current?.select());
    let live = true;
    void pending.then((ok) => {
      if (!live) return;
      justShared = null;
      showCopied(ok);
    });
    return () => {
      live = false;
    };
  }, [inRoom]);

  const copyLink = async (text: string | undefined): Promise<boolean> => {
    const ok = await writeClipboard(text);
    showCopied(ok);
    return ok;
  };

  if (!room) {
    if (!onShare) return null;
    const create = () => {
      intro.current?.hidePopover();
      justShared = writeClipboard(onShare());
    };
    return (
      <>
        <button type="button" className="btn btn-small board-share" popoverTarget={introId} aria-label={c.share} title={c.shareHint}>
          {ICON_SHARE}
          <span className="board-action-text">{c.share}</span>
        </button>
        {/* 先說清楚再開房間：會傳到伺服器、拿到連結的人都能改、自己的白板留在這台裝置 */}
        <div id={introId} className="board-room-menu board-share-intro" popover="auto" ref={intro} role="dialog" aria-labelledby={introTitle}>
          <h2 id={introTitle} className="board-share-title">
            {c.introTitle}
          </h2>
          <ul className="board-share-points">
            {c.introPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="board-share-buttons">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => intro.current?.hidePopover()}>
              {c.cancel}
            </button>
            <button type="button" className="btn btn-primary btn-small" onClick={create}>
              {c.createLink}
            </button>
          </div>
        </div>
      </>
    );
  }

  const { status } = room;
  const people = peopleOf(status);
  const label = roomLabel(status, t);
  const close = () => menu.current?.hidePopover();
  const rename = () => {
    close();
    const next = window.prompt(c.renamePrompt, status?.me?.name ?? '')?.trim();
    if (next) onRename?.(next);
  };
  const note = copy === 'failed' ? c.copyFailed : copy === 'copied' ? c.linkCopied : c.roomNote;

  return (
    <>
      {/* 頭像疊在一起；點下去看連結和房間裡有誰 */}
      <button
        type="button"
        className="board-peers"
        popoverTarget={menuId}
        data-state={status?.state ?? 'connecting'}
        aria-label={`${c.room} · ${label}`}
        title={label}
      >
        {people.length === 0 && <span className="board-peer" aria-hidden />}
        {people.slice(0, 3).map((peer) => (
          <PeerAvatar key={peer.id} name={peer.name} color={peer.color} />
        ))}
        {people.length > 3 && (
          <span className="board-peer board-peer-more" aria-hidden>
            +{people.length - 3}
          </span>
        )}
      </button>
      <div id={menuId} className="board-room-menu" popover="auto" ref={menu}>
        <p className="board-room-status">{label}</p>
        {link && (
          <div className="board-room-link">
            <div className="board-room-link-row">
              <input
                ref={linkInput}
                className="board-room-link-input"
                readOnly
                value={link}
                aria-label={c.linkLabel}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn btn-small" onClick={() => void copyLink(link)}>
                {copy === 'copied' ? c.copied : c.copy}
              </button>
            </div>
            <p className="board-room-note" role="status" data-failed={copy === 'failed' || undefined}>
              {note}
            </p>
          </div>
        )}
        <ul className="board-room-people" aria-label={c.room}>
          {people.map((peer) => {
            const isMe = peer.id === status?.me?.id;
            return (
              <li key={peer.id}>
                <PeerAvatar name={peer.name} color={peer.color} />
                <span className="board-room-name">
                  {peer.name}
                  {isMe && c.you}
                </span>
                {isMe && onRename && (
                  <button type="button" className="btn btn-quiet btn-small" onClick={rename}>
                    {c.rename}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="board-room-actions">
          {onSaveCopy && (
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => {
                close();
                onSaveCopy();
              }}
            >
              {ICON_SAVE}
              {c.saveCopy}
            </button>
          )}
          <button
            type="button"
            className="btn btn-quiet btn-small"
            onClick={() => {
              close();
              onLeave();
            }}
          >
            {ICON_LEAVE}
            {c.leave}
          </button>
        </div>
      </div>
      {link && (
        <button
          type="button"
          className="btn btn-quiet btn-small board-copy-link"
          aria-label={copy === 'copied' ? c.copied : c.copyLink}
          title={c.copyLink}
          // 複製不了就打開選單，連結選好讓人自己複製
          onClick={() => void copyLink(link).then((ok) => ok || showLink())}
        >
          {ICON_LINK}
          <span className="board-action-text">{copy === 'copied' ? c.copied : c.copyLink}</span>
        </button>
      )}
    </>
  );
}

const ICON_SHARE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M17 8v6M14 11h6" />
  </svg>
);

const ICON_LINK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

const ICON_SAVE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 4h9l3 3v13H6z" />
    <path d="M9 4v5h6V4M9 20v-6h6v6" />
  </svg>
);

const ICON_LEAVE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </svg>
);
