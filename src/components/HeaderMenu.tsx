import { useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useI18n } from '../i18n';

// 標題列上「可以收起來」的按鈕：語言、深淺色、原始碼連結、匯出圖片。
// 寬的畫面排成一排小圖示；手機上（NARROW）標題列放不下，收進右上角的「⋯」選單，每一項寫上文字，
// 題目名稱和存檔狀態才放得下。共用不收：那是邀請別人進來的主要按鈕。

/** 標題列選單的一項；由使用白板的一方決定放什麼（例如語言和深淺色是 App 自己的設定） */
export interface HeaderMenuItem {
  /** 選單裡寫的字，也是按鈕的名稱（螢幕閱讀器念的、滑鼠停上去的提示） */
  label: string;
  /** 寬的畫面時按鈕上的圖示或短字，例如「中」 */
  icon: ReactNode;
  onSelect?: () => void;
  /** 連結（例如 GitHub），在新分頁打開 */
  href?: string;
  /** 名稱是另一種語言時標上，例如切換語言的那一項 */
  lang?: string;
  disabled?: boolean;
}

/** 比這個窄就收進選單 */
const NARROW = '(max-width: 560px)';

function subscribeNarrow(listener: () => void): () => void {
  const media = window.matchMedia(NARROW);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export function useNarrowHeader(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/** 寬的畫面：一排小圖示按鈕 */
export function InlineMenuItems({ items }: { items: readonly HeaderMenuItem[] }) {
  return (
    <>
      {items.map((item) =>
        item.href ? (
          <a
            key={item.label}
            className="btn btn-quiet btn-small board-menu-inline"
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            lang={item.lang}
          >
            {item.icon}
          </a>
        ) : (
          <button
            key={item.label}
            type="button"
            className="btn btn-quiet btn-small board-menu-inline"
            aria-label={item.label}
            title={item.label}
            lang={item.lang}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            {item.icon}
          </button>
        ),
      )}
    </>
  );
}

/** 手機：右上角「⋯」打開的選單 */
export function MoreMenu({ items }: { items: readonly HeaderMenuItem[] }) {
  const { t } = useI18n();
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const close = () => menu.current?.hidePopover();
  return (
    <>
      <button type="button" className="btn btn-quiet btn-small board-more" popoverTarget={id} aria-label={t.board.more} title={t.board.more}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5.5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="18.5" cy="12" r="1.8" />
        </svg>
      </button>
      <div id={id} ref={menu} className="board-room-menu board-more-menu" popover="auto" aria-label={t.board.more}>
        {items.map((item) =>
          item.href ? (
            <a key={item.label} className="board-more-item" href={item.href} target="_blank" rel="noopener noreferrer" lang={item.lang} onClick={close}>
              <span className="board-more-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </a>
          ) : (
            <button
              key={item.label}
              type="button"
              className="board-more-item"
              lang={item.lang}
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect?.();
              }}
            >
              <span className="board-more-icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}
