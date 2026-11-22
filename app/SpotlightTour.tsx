import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeCard, type Box } from './tourPlacement';

// 第一次開始畫的時候的聚光燈導覽：畫面變暗，只亮一塊，旁邊一張小卡說那是什麼。
// 看的是白板的 class（.board-palette、.board-tools…），白板改了這裡要跟著改。

export interface TourStep {
  /** 要亮起來的元件（CSS 選擇器；逗號分隔時，用畫面上找得到的那一個） */
  target: string;
  title: string;
  body: string;
}

export interface TourText {
  next: string;
  back: string;
  done: string;
  skip: string;
  progress: (step: number, total: number) => string;
  label: string;
}

interface SpotlightTourProps {
  steps: readonly TourStep[];
  text: TourText;
  /** 看完或跳過（Esc 也算跳過） */
  onClose: () => void;
}

/** 亮起來的那塊比元件大一點，框線才不會貼著 */
const HOLE_PAD = 6;
/** 貼著畫面邊緣的元件（左邊的元件區、手機上整條的元件列）：亮的那塊縮回畫面裡，框線才看得到 */
const EDGE = 4;

function findTarget(selector: string): Box | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const left = Math.max(EDGE, r.left - HOLE_PAD);
  const top = Math.max(EDGE, r.top - HOLE_PAD);
  const right = Math.min(window.innerWidth - EDGE, r.right + HOLE_PAD);
  const bottom = Math.min(window.innerHeight - EDGE, r.bottom + HOLE_PAD);
  return { left, top, width: right - left, height: bottom - top };
}

export function SpotlightTour({ steps, text, onClose }: SpotlightTourProps) {
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // 量目標和卡片的大小，決定亮哪裡、卡片放哪裡；視窗大小改了（手機轉向）再量一次
  useLayoutEffect(() => {
    const measure = () => {
      const target = findTarget(step.target);
      setHole(target);
      const box = card.current;
      if (!box) return;
      setPosition(placeCard(target, { width: box.offsetWidth, height: box.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step]);

  useEffect(() => primary.current?.focus(), [index]);

  // 導覽開著時白板不能用（點不到、Tab 也跳不進去），白板自己的快捷鍵（S 記一步、Delete…）也不要收到
  useEffect(() => {
    const board = document.querySelector('.board');
    board?.setAttribute('inert', '');
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight' && !last) setIndex((i) => i + 1);
      else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      board?.removeAttribute('inert');
      window.removeEventListener('keydown', onKey, true);
    };
  }, [last, onClose]);

  return (
    <div className="app-tour" role="dialog" aria-modal="true" aria-label={text.label} aria-describedby="app-tour-body">
      {hole ? (
        <div className="app-tour-hole" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} aria-hidden />
      ) : (
        <div className="app-tour-dim" aria-hidden />
      )}
      <div
        ref={card}
        className="app-tour-card"
        // 第一次量好位置之前先藏起來，才不會在左上角閃一下
        style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
      >
        <p className="app-tour-progress">{text.progress(index + 1, steps.length)}</p>
        <h2 className="app-tour-title">{step.title}</h2>
        <p id="app-tour-body" className="app-tour-body">
          {step.body}
        </p>
        <div className="app-tour-actions">
          {!last && (
            <button type="button" className="btn btn-quiet btn-small app-tour-skip" onClick={onClose}>
              {text.skip}
            </button>
          )}
          {index > 0 && (
            <button type="button" className="btn btn-small" onClick={() => setIndex(index - 1)}>
              {text.back}
            </button>
          )}
          <button ref={primary} type="button" className="btn btn-small btn-primary" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? text.done : text.next}
          </button>
        </div>
      </div>
    </div>
  );
}
