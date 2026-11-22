import { useId, useRef, useSyncExternalStore } from 'react';
import type { Locale } from '../src';
import { EXAMPLE_IDS, exampleOf, type ExampleId } from './examples';

// 網站標題列上換範例的按鈕，和範例播放時想畫東西的提示。
// 按鈕寫題型（串列、動態規劃、圖），不寫題號：看不懂題號的人也知道有哪些。換範例就改網址，連結可以直接傳給別人。

/** 比這個窄，標題列放不下整組範例按鈕，改成一個下拉選單（ExamplePicker）；再窄（白板的標題列收起來時）收進「⋯」 */
const COMPACT_EXAMPLES = '(max-width: 960px)';

function subscribeCompact(listener: () => void): () => void {
  const media = window.matchMedia(COMPACT_EXAMPLES);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export function useCompactExamples(): boolean {
  return useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_EXAMPLES).matches,
    () => false,
  );
}

export function openExample(id: ExampleId): void {
  window.location.hash = `example=${id}`;
}

interface ExampleChoiceProps {
  locale: Locale;
  /** 「範例」這兩個字 */
  label: string;
}

/** 寬的畫面看範例時：三個相連的按鈕，現在看的那個亮起來；滑鼠停上去看完整題名 */
export function ExampleSwitcher({ current, locale, label }: ExampleChoiceProps & { current: ExampleId }) {
  return (
    <span className="app-examples" role="group" aria-label={label}>
      <span className="app-examples-label" aria-hidden>
        {label}
      </span>
      {EXAMPLE_IDS.map((id) => {
        const { title, topic } = exampleOf(id);
        return (
          <button
            key={id}
            type="button"
            className="app-example"
            aria-pressed={id === current}
            aria-label={`${topic[locale]}: ${title}`}
            title={title}
            onClick={() => id !== current && openExample(id)}
          >
            {topic[locale]}
          </button>
        );
      })}
    </span>
  );
}

/**
 * 一個按鈕，打開列出三個範例的完整題名和題型。看範例時（中等寬度）按鈕寫現在的題型、黃色；
 * 在自己的白板上（沒有 current）寫「範例」，畫到一半也能回去看範例（自己的白板留著，按「我的白板」回來）。
 */
export function ExamplePicker({ current, locale, label }: ExampleChoiceProps & { current?: ExampleId }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  return (
    <>
      <button
        type="button"
        className={current ? 'btn btn-small app-example-pick app-example-pick-current' : 'btn btn-small app-example-pick'}
        popoverTarget={id}
        aria-label={current ? `${label}: ${exampleOf(current).title}` : label}
        title={label}
      >
        {current ? exampleOf(current).topic[locale] : label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={id} ref={menu} className="board-room-menu board-more-menu app-example-menu" popover="auto" aria-label={label}>
        {EXAMPLE_IDS.map((example) => {
          const { title, topic } = exampleOf(example);
          return (
            <button
              key={example}
              type="button"
              className="board-more-item"
              aria-current={example === current || undefined}
              onClick={() => {
                menu.current?.hidePopover();
                openExample(example);
              }}
            >
              <span className="app-example-title">{title}</span>
              <span className="app-example-topic">{topic[locale]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

interface DrawPromptProps {
  message: string;
  closeLabel: string;
  /** 跟標題列一樣的兩個按鈕：拿這張來改、開空白白板（或我的白板） */
  actions: { label: string; primary?: boolean; onClick: () => void }[];
  onClose: () => void;
}

/** 範例播放時按了左邊的元件（播放時不能畫）：說為什麼沒反應，給兩條路 */
export function ExampleDrawPrompt({ message, closeLabel, actions, onClose }: DrawPromptProps) {
  return (
    <div className="app-draw-prompt" role="status">
      <p>{message}</p>
      <span className="app-draw-prompt-actions">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.primary ? 'btn btn-small btn-primary' : 'btn btn-small'}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
        <button type="button" className="btn btn-quiet btn-small app-draw-prompt-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </span>
    </div>
  );
}

/**
 * 點到的是不是「範例播放中」左邊的元件區。白板播放時元件區不能用（pointer-events: none，點擊落在後面那層），
 * 但看起來還是能按，第一次來的人會以為壞了（使用者測試找到的），所以看點的位置在不在元件區裡。
 * 看的是白板的 class 和 data-playing，白板改了這裡要跟著改。
 */
export function isPaletteClickDuringPlayback(event: { target: EventTarget | null; clientX: number; clientY: number }): boolean {
  if (!(event.target instanceof Element)) return false;
  const palette = event.target.closest('.board[data-playing]')?.querySelector('.board-palette');
  if (!palette) return false;
  const box = palette.getBoundingClientRect();
  return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
}
