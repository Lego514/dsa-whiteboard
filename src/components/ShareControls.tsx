import { useEffect, useId, useRef, useState } from 'react';
import { peopleOf, roomLabel, useRoom } from '../collab/context';
import { useI18n } from '../i18n';

// 標題列上的共用按鈕：放在 Whiteboard 的 actions 裡。
// 沒在房間裡時是「共用」；在房間裡時是疊在一起的頭像（點開看有誰、改名字、存一份、離開）和「複製連結」。
// 房間代碼放在哪裡（網址的 # 或 ?）、怎麼存一份，由使用的一方決定。

export interface ShareControlsProps {
  /** 按「共用」：建立房間並回傳房間的連結，會自動複製。沒給就不顯示「共用」 */
  onShare?: () => string | undefined;
  /** 房間的連結，「複製連結」用 */
  link?: string;
  /** 改名字；沒給就不能改 */
  onRename?: (name: string) => void;
  /** 把房間的白板存成自己的；沒給就不顯示 */
  onSaveCopy?: () => void;
  onLeave: () => void;
}

export function ShareControls({ onShare, link, onRename, onSaveCopy, onLeave }: ShareControlsProps) {
  const { t } = useI18n();
  const room = useRoom();
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copy = async (text: string | undefined) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 不能用剪貼簿（例如沒有權限）就讓使用者自己複製
      window.prompt(t.collab.copyLink, text);
    }
  };

  if (!room) {
    if (!onShare) return null;
    return (
      <button
        type="button"
        className="btn btn-small board-share"
        aria-label={t.collab.share}
        title={t.collab.shareHint}
        onClick={() => void copy(onShare())}
      >
        {ICON_SHARE}
        <span className="board-action-text">{t.collab.share}</span>
      </button>
    );
  }

  const { status } = room;
  const people = peopleOf(status);
  const label = roomLabel(status, t);
  const close = () => menu.current?.hidePopover();
  const rename = () => {
    close();
    const next = window.prompt(t.collab.renamePrompt, status?.me?.name ?? '')?.trim();
    if (next) onRename?.(next);
  };

  return (
    <>
      {/* 頭像疊在一起；點下去看房間裡有誰 */}
      <button
        type="button"
        className="board-peers"
        popoverTarget={menuId}
        data-state={status?.state ?? 'connecting'}
        aria-label={`${t.collab.room} · ${label}`}
        title={label}
      >
        {people.length === 0 && <span className="board-peer" aria-hidden />}
        {people.slice(0, 3).map((peer) => (
          <span key={peer.id} className="board-peer" data-peer={peer.color} aria-hidden>
            {initialOf(peer.name)}
          </span>
        ))}
        {people.length > 3 && (
          <span className="board-peer board-peer-more" aria-hidden>
            +{people.length - 3}
          </span>
        )}
      </button>
      <div id={menuId} className="board-room-menu" popover="auto" ref={menu}>
        <p className="board-room-status">{label}</p>
        <ul className="board-room-people" aria-label={t.collab.room}>
          {people.map((peer) => {
            const isMe = peer.id === status?.me?.id;
            return (
              <li key={peer.id}>
                <span className="board-peer" data-peer={peer.color} aria-hidden>
                  {initialOf(peer.name)}
                </span>
                <span className="board-room-name">
                  {peer.name}
                  {isMe && t.collab.you}
                </span>
                {isMe && onRename && (
                  <button type="button" className="btn btn-quiet btn-small" onClick={rename}>
                    {t.collab.rename}
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
              {t.collab.saveCopy}
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
            {t.collab.leave}
          </button>
        </div>
      </div>
      {link && (
        <button
          type="button"
          className="btn btn-quiet btn-small board-copy-link"
          aria-label={copied ? t.collab.copied : t.collab.copyLink}
          title={t.collab.copyLink}
          onClick={() => void copy(link)}
        >
          {ICON_LINK}
          <span className="board-action-text">{copied ? t.collab.copied : t.collab.copyLink}</span>
        </button>
      )}
    </>
  );
}

/** 頭像上的字：名字的第一個字 */
function initialOf(name: string): string {
  return [...name][0]?.toUpperCase() ?? '?';
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
