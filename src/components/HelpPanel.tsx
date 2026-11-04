import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

// 使用說明：快捷鍵畫成鍵帽和小滑鼠，掃一眼就找得到；各元件的用法收起來，用到再點開。
// 一整頁的文字沒有人會讀完，要查的通常只是「哪個鍵」或「這個元件怎麼用」

/** 一顆鍵帽：底下比較厚，看起來像按得下去的鍵；用 <kbd>，螢幕閱讀器會唸出鍵名 */
function Key({ children }: { children: string }) {
  return <kbd className="board-key">{children}</kbd>;
}

/** 按鍵組合中間的「+」 */
const Plus = () => (
  <span className="board-key-join" aria-hidden>
    +
  </span>
);

type MouseAction = 'click' | 'double' | 'drag' | 'scroll' | 'middle';

/**
 * 小滑鼠：要按的地方亮起來（左鍵或滾輪），旁邊再畫動作：點兩下寫 ×2、拖曳畫箭頭、滾動畫上下箭頭。
 * 整個當成一張圖，名稱寫動作（「滑鼠點兩下」）
 */
function Mouse({ action }: { action: MouseAction }) {
  const { t } = useI18n();
  const wheel = action === 'scroll' || action === 'middle';
  const drag = action === 'drag' || action === 'middle';
  return (
    <span className="board-mouse" role="img" aria-label={t.board.mouse[action]}>
      <svg viewBox="0 0 16 24" width="16" height="24" aria-hidden>
        <rect className="board-mouse-body" x="1" y="1" width="14" height="22" rx="7" />
        <path className={wheel ? 'board-mouse-btn' : 'board-mouse-btn board-mouse-on'} d="M1 10 V8 A7 7 0 0 1 8 1 V10 Z" />
        <path className="board-mouse-line" d="M8 1 V10 M1 10 H15" />
        <rect className={wheel ? 'board-mouse-wheel board-mouse-on' : 'board-mouse-wheel'} x="5.75" y="3" width="4.5" height="6.5" rx="2.25" />
      </svg>
      {action === 'double' && <span className="board-mouse-times">×2</span>}
      {drag && (
        <svg className="board-mouse-motion" viewBox="0 0 12 24" width="12" height="24" aria-hidden>
          <path d="M1 12 H10 M7 9 L10 12 L7 15" />
        </svg>
      )}
      {action === 'scroll' && (
        <svg className="board-mouse-motion" viewBox="0 0 12 24" width="12" height="24" aria-hidden>
          <path d="M6 4 V20 M3 7 L6 4 L9 7 M3 17 L6 20 L9 17" />
        </svg>
      )}
    </span>
  );
}

/** 手機螢幕上的指尖：一指點兩下（標 ×2），或兩指往外推（平移、捏合縮放） */
function Touch({ fingers }: { fingers: 1 | 2 }) {
  const { t } = useI18n();
  return (
    <span className="board-mouse" role="img" aria-label={fingers === 1 ? t.board.mouse.tap : t.board.mouse.fingers}>
      <svg className="board-touch" viewBox="0 0 18 26" width="18" height="26" aria-hidden>
        <rect x="1" y="1" width="16" height="24" rx="3" />
        {fingers === 1 ? (
          <circle cx="9" cy="13" r="3" />
        ) : (
          <>
            <circle cx="6.5" cy="16" r="2.6" />
            <circle cx="11.5" cy="10" r="2.6" />
            <path d="M4 19 L2.5 20.5 M14 7 L15.5 5.5" />
          </>
        )}
      </svg>
      {fingers === 1 && <span className="board-mouse-times">×2</span>}
    </span>
  );
}

/** 兩種做法擇一的分隔：「或」 */
function Or() {
  const { t } = useI18n();
  return <span className="board-key-or">{t.board.or}</span>;
}

const TOOL_KEYS = [
  ['V', 'select'],
  ['H', 'hand'],
  ['A', 'arrow'],
  ['L', 'line'],
  ['R', 'rect'],
  ['O', 'ellipse'],
  ['P', 'pen'],
  ['E', 'eraser'],
] as const;

export function HelpPanel() {
  const { t } = useI18n();
  const g = t.board.helpGroups;
  const k = t.board.keys;
  const groups: [string, [ReactNode, string][]][] = [
    [
      g.edit,
      [
        [<Mouse action="double" />, k.edit],
        [
          <>
            <Key>Enter</Key>
            <Or />
            <Key>Esc</Key>
          </>,
          k.finish,
        ],
        [<Mouse action="drag" />, k.box],
        [
          <>
            <Key>Shift</Key>
            <Plus />
            <Mouse action="click" />
          </>,
          k.addSelect,
        ],
        [
          <>
            <Key>Ctrl</Key>
            <Plus />
            <Key>A</Key>
          </>,
          k.selectAll,
        ],
        [
          <>
            <Key>Ctrl</Key>
            <Plus />
            <Key>D</Key>
          </>,
          k.duplicate,
        ],
        [<Key>Delete</Key>, k.remove],
        [
          <>
            <Key>Ctrl</Key>
            <Plus />
            <Key>Z</Key>
          </>,
          k.undo,
        ],
        [
          <>
            <Key>Ctrl</Key>
            <Plus />
            <Key>Shift</Key>
            <Plus />
            <Key>Z</Key>
          </>,
          k.redo,
        ],
        [
          <>
            <Key>Shift</Key>
            <Or />
            <Key>Ctrl</Key>
            <Plus />
            <Mouse action="drag" />
          </>,
          k.shape,
        ],
      ],
    ],
    [
      g.view,
      [
        [<Mouse action="scroll" />, k.pan],
        [
          <>
            <Key>Space</Key>
            <Plus />
            <Mouse action="drag" />
            <Or />
            <Mouse action="middle" />
          </>,
          k.dragPan,
        ],
        [
          <>
            <Key>Ctrl</Key>
            <Plus />
            <Mouse action="scroll" />
          </>,
          k.zoom,
        ],
        [<Key>0</Key>, k.fit],
      ],
    ],
    [
      g.steps,
      [
        [
          <>
            <Key>←</Key>
            <Key>→</Key>
          </>,
          k.move,
        ],
        [<Key>S</Key>, k.step],
        [<Key>Space</Key>, k.play],
        [<Key>Esc</Key>, k.stop],
      ],
    ],
  ];

  const section = (title: string, rows: [ReactNode, string][], className?: string) => (
    <section key={title} aria-label={title} className={className}>
      <h3>{title}</h3>
      <dl className="board-help-keys">
        {rows.map(([how, what]) => (
          <div key={what}>
            <dt>{how}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  return (
    <div className="board-help" data-ui>
      <h2>{t.board.help}</h2>
      {/* 手機、平板沒有鍵盤和滑鼠：換成觸控的兩個手勢（CSS 看 pointer: coarse 切換） */}
      <div className="board-help-keyboard">
        <h3>{g.tools}</h3>
        <ul className="board-help-tools">
          {TOOL_KEYS.map(([key, tool]) => (
            <li key={tool}>
              <Key>{key}</Key>
              {t.board.toolNames[tool]}
            </li>
          ))}
        </ul>
        {groups.map(([title, rows]) => section(title, rows))}
      </div>
      {section(
        g.touch,
        [
          [<Touch fingers={1} />, k.tapEdit],
          [<Touch fingers={2} />, k.touch],
        ],
        'board-help-touch',
      )}
      <h3>{g.elements}</h3>
      <div className="board-help-tips">
        {t.board.tips.map((tip) => (
          <details key={tip.title}>
            <summary>{tip.title}</summary>
            <p>{tip.body}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
