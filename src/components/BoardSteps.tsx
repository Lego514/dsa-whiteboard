import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { BoardStep } from '../lib/model';

// 逐步播放：編輯時左上角記步驟的小面板，播放時下方的播放列。

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const ICON_PREV = (
  <Icon>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);
const ICON_NEXT = (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
const ICON_PLAY = (
  <Icon>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </Icon>
);
const ICON_MIC = (
  <Icon>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Icon>
);
const ICON_PAUSE = (
  <Icon>
    <path d="M8 5.5v13M16 5.5v13" strokeWidth="3" />
  </Icon>
);

/** 記下一步之後提示停多久（毫秒）；滑鼠移上去或在寫說明時不收起來 */
const RECORDED_NOTE_MS = 6000;

export interface RecordedStep {
  /** 第幾步（從 0 算） */
  index: number;
  /** 每記一次就換，提示重新計時、點點閃一下 */
  serial: number;
  caption: string;
  onCaptionStart: () => void;
  onCaption: (caption: string) => void;
  onCaptionEnd: () => void;
  onDismiss: () => void;
}

/**
 * 記下一步之後在面板下面停幾秒：說記到第幾步，可以順手寫這一步的說明。
 * 不會自己跳進輸入框，連按 S 照樣能一直記下去。
 */
function RecordedNote({ index, caption, onCaptionStart, onCaption, onCaptionEnd, onDismiss }: RecordedStep) {
  const { t } = useI18n();
  const s = t.board.steps;
  const [hovered, setHovered] = useState(false);
  const [typing, setTyping] = useState(false);
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (hovered || typing) return;
    const timer = window.setTimeout(() => dismiss(), RECORDED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [hovered, typing]);
  return (
    <div className="board-recorded" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <div className="board-recorded-head">
        <p className="board-recorded-title" role="status">
          {s.recorded(index + 1)}
        </p>
        <button type="button" className="btn btn-quiet btn-small board-recorded-close" aria-label={t.board.close} title={t.board.close} onClick={onDismiss}>
          ×
        </button>
      </div>
      <input
        className="input board-recorded-caption"
        value={caption}
        placeholder={s.recordedPlaceholder}
        aria-label={s.captionLabel(index + 1)}
        maxLength={200}
        onFocus={() => {
          setTyping(true);
          onCaptionStart();
        }}
        onBlur={() => {
          setTyping(false);
          onCaptionEnd();
        }}
        onChange={(e) => onCaption(e.target.value)}
        onKeyDown={(e) => {
          // 打字時不要觸發白板的快捷鍵；Enter 寫好了就收起來，Esc 只離開輸入框
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.currentTarget.blur();
            onDismiss();
          } else if (e.key === 'Escape') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

interface StepsWidgetProps {
  count: number;
  full: boolean;
  /** 沒給就不顯示「記下這一步」（只能看的共用連結） */
  onCapture?: () => void;
  onPlay: () => void;
  /** 沒給就不顯示「講解」按鈕 */
  onExplain?: () => void;
  /** 剛記下的那一步：面板下面說一聲，可以寫說明 */
  recorded?: RecordedStep | null;
}

/** 編輯時左上角：把目前的畫面記成一步、從頭播放、照著步驟講解 */
export function StepsWidget({ count, full, onCapture, onPlay, onExplain, recorded }: StepsWidgetProps) {
  const { t } = useI18n();
  const s = t.board.steps;
  return (
    <div className="board-steps-widget" role="group" aria-label={s.label} data-ui>
      {onCapture && (
        <button
          type="button"
          className="btn btn-small board-record"
          disabled={full}
          aria-label={full ? s.full : s.captureHint}
          title={full ? s.full : s.captureHint}
          onClick={onCapture}
        >
          {/* 記下一步時點點閃一下（換 key 讓動畫重播） */}
          <span key={recorded?.serial ?? 0} className={recorded ? 'board-record-dot board-record-dot-flash' : 'board-record-dot'} aria-hidden />
          <span className="board-steps-text">{s.capture}</span>
        </button>
      )}
      <button type="button" className="btn btn-small" disabled={count === 0} aria-label={s.playAll(count)} title={s.playAll(count)} onClick={onPlay}>
        <span className="board-steps-play" aria-hidden>
          {ICON_PLAY}
        </span>
        <span aria-live="polite">
          <span className="board-steps-text">{s.count(count)}</span>
          {/* 手機上位置不夠，只顯示步數 */}
          <span className="board-steps-num">{count}</span>
        </span>
      </button>
      {onExplain && (
        <button
          type="button"
          className="btn btn-small"
          disabled={count === 0}
          aria-label={count === 0 ? t.board.explain.needSteps : t.board.explain.startHint}
          title={count === 0 ? t.board.explain.needSteps : t.board.explain.startHint}
          onClick={onExplain}
        >
          <span className="board-steps-play" aria-hidden>
            {ICON_MIC}
          </span>
          <span className="board-steps-text">{t.board.explain.start}</span>
        </button>
      )}
      {recorded && <RecordedNote key={recorded.serial} {...recorded} />}
    </div>
  );
}

interface PlaybackBarProps {
  steps: BoardStep[];
  index: number;
  autoPlay: boolean;
  onGo: (index: number) => void;
  onToggleAuto: () => void;
  onExit: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onCaptionStart: () => void;
  onCaption: (caption: string) => void;
  onCaptionEnd: () => void;
  /** 講解中：說明只能看（當作提詞），下方換成講解的計時和「講完了」 */
  explain?: ReactNode;
  /** 做好的步驟（例如參考板書）：說明只能看、會換行，沒有「從這步繼續編輯」和「刪除這一步」 */
  readOnly?: boolean;
}

/** 播放時下方的播放列：換步、自動播放、這一步的說明、從這步繼續編輯 */
export function PlaybackBar({
  steps,
  index,
  autoPlay,
  onGo,
  onToggleAuto,
  onExit,
  onRestore,
  onDelete,
  onCaptionStart,
  onCaption,
  onCaptionEnd,
  explain,
  readOnly = false,
}: PlaybackBarProps) {
  const { t } = useI18n();
  const s = t.board.steps;
  const last = index === steps.length - 1;
  return (
    <div className="board-playback" role="toolbar" aria-label={explain ? t.board.explain.label : s.playbackLabel} data-ui>
      <div className="board-playback-row">
        <button type="button" className="board-tool" aria-label={s.prev} title={s.prev} disabled={index === 0} onClick={() => onGo(index - 1)}>
          {ICON_PREV}
        </button>
        <span className="board-playback-count" aria-live="polite">
          {s.position(index + 1, steps.length)}
        </span>
        <button type="button" className="board-tool" aria-label={s.next} title={s.next} disabled={last} onClick={() => onGo(index + 1)}>
          {ICON_NEXT}
        </button>
        {!explain && (
          <button
            type="button"
            className="board-tool"
            aria-label={autoPlay ? s.pause : s.play}
            title={autoPlay ? s.pause : s.play}
            aria-pressed={autoPlay}
            onClick={onToggleAuto}
          >
            {autoPlay ? ICON_PAUSE : ICON_PLAY}
          </button>
        )}
        <ol className="board-step-dots">
          {steps.map((step, i) => (
            <li key={step.id}>
              <button type="button" aria-label={s.goTo(i + 1)} aria-current={i === index ? 'step' : undefined} onClick={() => onGo(i)}>
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>
      {explain || readOnly ? (
        <>
          {steps[index].caption && (
            <p className="board-playback-notes" lang="en">
              {steps[index].caption}
            </p>
          )}
          {readOnly && !explain && (
            <div className="board-playback-row board-playback-actions">
              <button type="button" className="btn btn-small btn-primary" onClick={onExit}>
                {s.exit}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <input
            className="input board-playback-caption"
            value={steps[index].caption}
            placeholder={s.captionPlaceholder}
            aria-label={s.captionLabel(index + 1)}
            maxLength={200}
            onFocus={onCaptionStart}
            onBlur={onCaptionEnd}
            onChange={(e) => onCaption(e.target.value)}
            onKeyDown={(e) => {
              // 打字時不要觸發白板的快捷鍵；Enter 或 Esc 結束輸入
              e.stopPropagation();
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
          />
          <div className="board-playback-row board-playback-actions">
            <button type="button" className="btn btn-small" onClick={onRestore}>
              {s.restore}
            </button>
            <button type="button" className="btn btn-small btn-danger" onClick={onDelete}>
              {s.delete}
            </button>
            <button type="button" className="btn btn-small btn-primary" onClick={onExit}>
              {s.exit}
            </button>
          </div>
        </>
      )}
      {explain}
    </div>
  );
}
