import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  EMPTY_DOC,
  guestName,
  isOldGuestName,
  newRoomId,
  ROOM_ID,
  ShareControls,
  VIEW_ID,
  Whiteboard,
  type BoardDoc,
  type HeaderMenuItem,
  type Locale,
} from '../src';
import { useNarrowHeader } from '../src/components/HeaderMenu';
import { boardDocSchema } from '../src/schema';
import {
  ExampleDrawPrompt,
  ExamplePicker,
  ExampleSwitcher,
  isPaletteClickDuringPlayback,
  openExample,
  useCompactExamples,
} from './ExampleControls';
import { DEFAULT_EXAMPLE, EXAMPLE_IDS, exampleOf, isExampleId, type ExampleId } from './examples';
import { SpotlightTour, type TourStep } from './SpotlightTour';

// 獨立的白板網站：一張白板存在這個瀏覽器裡，不用登入。
// 按「共用」會建立一個共用房間，網址後面加上 #room=…，把網址傳給別人就能一起編輯；
// #view=… 是同一個房間只能看的連結。
// 第一次來（還沒有自己的白板）先自動播放一個範例，#example=206 這種連結不管來過幾次都打開那個範例（app/examples.ts）。

const DOC_KEY = 'dsa-whiteboard:doc';
const LOCALE_KEY = 'dsa-whiteboard:locale';
const NAME_KEY = 'dsa-whiteboard:name';
/** 自己選的深色或淺色；沒選過就跟著系統（index.html 在畫面出來前先套上） */
const THEME_KEY = 'dsa-whiteboard:theme';
/** 看過（或跳過）聚光燈導覽了；「?」裡可以再看一次 */
const TOUR_KEY = 'dsa-whiteboard:tour';
const PAPER = { light: '#f3f5f8', dark: '#0e1829' };
const REPO_URL = 'https://github.com/Lego514/dsa-whiteboard';
/** 共用房間的伺服器；建置時沒設定就不顯示「共用」 */
const COLLAB_URL = import.meta.env.VITE_COLLAB_URL;

const TEXT = {
  'zh-TW': {
    switchTo: 'EN',
    switchLabel: 'Switch to English',
    toDark: '切換成深色',
    toLight: '切換成淺色',
    source: 'GitHub 上的原始碼',
    storageFull: '瀏覽器的儲存空間滿了，這次的修改沒有存起來。',
    saveCopyConfirm: '要用這張共用白板取代你自己的白板嗎？你原本的白板會被蓋掉。',
    savedCopy: '已存到你的白板',
    // 第一次來的人和 HR 先看到這句：這是什麼、能拿來做什麼
    exampleCaption: 'DSA 白板：把解法畫出來，一步一步播放',
    drawDuringExample: '範例正在播放，不能直接畫。要自己畫，可以拿這張來改，或開一張空白白板。',
    closePrompt: '關閉',
    exampleNotSaved: '範例，不會存',
    examples: '範例',
    exampleItem: (title: string) => `範例：${title}`,
    editExample: '拿這張來改',
    blankBoard: '開空白白板',
    myBoard: '我的白板',
    replaceWithExample: '要用這個範例取代你自己的白板嗎？你原本的白板會被蓋掉。',
    replayTour: '再看一次導覽',
    tour: {
      label: '白板導覽',
      next: '下一步',
      back: '上一步',
      done: '開始畫',
      skip: '跳過',
      progress: (step: number, total: number) => `${step} / ${total}`,
    },
    tourSteps: [
      {
        title: '元件',
        body: '陣列、樹、鏈結串列、圖⋯點一下放到白板上，或拖到想放的位置。第一個「貼上範例」：貼 LeetCode 範例的 Input，一次畫好。',
      },
      { title: '工具列', body: '選取、移動畫面、箭頭、形狀、畫筆和顏色。選了白板上的東西，這裡會換成改它的按鈕，例如複製、刪除。' },
      { title: '一步一步記下來', body: '畫好一個狀態按 ● 記一步（鍵盤 S），改一改再記下一步。按 ▶ 從頭播放，播放時下面那一列可以寫每一步的說明。' },
      { title: '操作說明', body: '快捷鍵和每個元件怎麼用都在這裡。這個導覽也可以從這裡再看一次。' },
    ],
  },
  en: {
    switchTo: '中',
    switchLabel: '切換成中文',
    toDark: 'Switch to dark mode',
    toLight: 'Switch to light mode',
    source: 'Source code on GitHub',
    storageFull: 'Browser storage is full, so the latest change wasn’t saved.',
    saveCopyConfirm: 'Replace your own board with this shared one? Your current board will be overwritten.',
    savedCopy: 'Saved to your board',
    exampleCaption: 'DSA Whiteboard: sketch a solution, then replay it step by step',
    drawDuringExample: 'The example is playing, so you can’t draw on it. Edit this board, or start a blank one.',
    closePrompt: 'Close',
    exampleNotSaved: 'Example, not saved',
    examples: 'Examples',
    exampleItem: (title: string) => `Example: ${title}`,
    editExample: 'Edit this board',
    blankBoard: 'Blank board',
    myBoard: 'My board',
    replaceWithExample: 'Replace your own board with this example? Your current board will be overwritten.',
    replayTour: 'Show the tour again',
    tour: {
      label: 'Whiteboard tour',
      next: 'Next',
      back: 'Back',
      done: 'Start drawing',
      skip: 'Skip',
      progress: (step: number, total: number) => `${step} of ${total}`,
    },
    tourSteps: [
      {
        title: 'Elements',
        body: 'Arrays, trees, linked lists, graphs… Click one to add it, or drag it where you want. The first one, “Paste example”, draws a LeetCode example’s Input in one go.',
      },
      {
        title: 'Toolbar',
        body: 'Select, move the view, arrows, shapes, pen and colours. When something on the board is selected, this turns into buttons for it, like duplicate and delete.',
      },
      {
        title: 'Record steps',
        body: 'Draw a state and press ● to record a step (S on a keyboard), change it, record the next. Press ▶ to replay from the start; during playback, the bar at the bottom holds each step’s caption.',
      },
      { title: 'Help', body: 'Shortcuts and how each element works are in here. You can also replay this tour from here.' },
    ],
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

/** 這個瀏覽器存過自己的白板（就算是空的）：來過、開始用了，就不再自動放範例 */
function hasOwnBoard(): boolean {
  return Boolean(storage()?.getItem(DOC_KEY));
}

/**
 * 要放哪個範例：網址有 #example=… 就放那一個；沒有的話，第一次來（沒有自己的白板、也不是共用房間）放 206。
 * 共用房間的連結一律直接進房間
 */
function exampleFromLocation(): ExampleId | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.has('room') || params.has('view')) return null;
  const linked = params.get('example');
  if (isExampleId(linked)) return linked;
  return hasOwnBoard() ? null : DEFAULT_EXAMPLE;
}

/** 導覽每一步亮哪裡，跟 TEXT 的 tourSteps 一一對應。工具列在選了東西時換成選取列，兩個都可以 */
const TOUR_TARGETS = ['.board-palette', '.board-tools, .board-selbar', '.board-steps-widget', '.board-zoom [aria-expanded]'] as const;

function tourSeen(): boolean {
  return storage()?.getItem(TOUR_KEY) === 'done';
}

function initialLocale(): Locale {
  const saved = storage()?.getItem(LOCALE_KEY);
  if (saved === 'zh-TW' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

type Theme = 'light' | 'dark';

function savedTheme(): Theme | null {
  const saved = storage()?.getItem(THEME_KEY);
  return saved === 'dark' || saved === 'light' ? saved : null;
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * 深色或淺色：選過就用選的，沒選過跟著系統（系統換了也跟著換）。
 * 白板的樣式看 <html data-theme>，所以只要改這個屬性
 */
function useTheme(): { dark: boolean; toggle: () => void } {
  const [chosen, setChosen] = useState(savedTheme);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    const query = darkQuery();
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const dark = chosen ? chosen === 'dark' : systemDark;
  // 手機瀏覽器的網址列顏色跟著換
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? PAPER.dark : PAPER.light);
  }, [dark]);
  const toggle = () => {
    const next: Theme = dark ? 'light' : 'dark';
    setChosen(next);
    document.documentElement.dataset.theme = next;
    storage()?.setItem(THEME_KEY, next);
  };
  return { dark, toggle };
}

/** 網址裡的房間：#room=… 能改，#view=… 只能看（網站沒設定共用伺服器時當作沒有） */
interface RoomLink {
  id: string;
  viewOnly: boolean;
}

function roomFromHash(): RoomLink | null {
  if (!COLLAB_URL) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const room = params.get('room');
  if (room && ROOM_ID.test(room)) return { id: room, viewOnly: false };
  const view = params.get('view');
  return view && VIEW_ID.test(view) ? { id: view, viewOnly: true } : null;
}

const sameRoom = (a: RoomLink | null, b: RoomLink | null) => a?.id === b?.id && a?.viewOnly === b?.viewOnly;

/** 只能看的連結：同一頁、#view=… */
const viewLinkOf = (viewId: string) => `${window.location.origin}${window.location.pathname}${window.location.search}#view=${viewId}`;

/** 共用時別人看到的名字：第一次用時取一個形容詞加動物；舊版自動取的「Guest 17」也換掉，自己取的名字不動 */
function initialName(locale: Locale): string {
  const saved = storage()?.getItem(NAME_KEY)?.trim();
  if (saved && !isOldGuestName(saved)) return saved;
  const name = guestName(locale);
  storage()?.setItem(NAME_KEY, name);
  return name;
}

/** 深色時顯示太陽（按了換成淺色），淺色時顯示月亮 */
const SUN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
);

/** 「⋯」選單裡範例那幾項的圖示：一張有步驟的白板（題號已經寫在名稱裡，不再寫一次） */
const EXAMPLE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="4.5" width="17" height="12" rx="1.5" />
    <path d="m10.5 8 4 2.5-4 2.5ZM9 20.5h6M12 16.5v4" />
  </svg>
);

const MOON_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);





export function App() {
  const [locale, setLocale] = useState(initialLocale);
  const [localDoc, setLocalDoc] = useState(loadDoc);
  const [room, setRoom] = useState(roomFromHash);
  const [example, setExample] = useState(exampleFromLocation);
  /** 這個分頁建立的房間：房間是空的時候，把自己的白板放上去 */
  const [created, setCreated] = useState<string | null>(null);
  const [name, setName] = useState(() => initialName(locale));
  /** 白板現在的內容（共用時是房間的內容）：共用時放進房間、「存一份」時用 */
  const current = useRef<BoardDoc>(localDoc);
  /** 看範例時改過的內容（哪一個範例、改成怎樣）；沒改過就用範例本身 */
  const exampleEdits = useRef<{ id: ExampleId; doc: BoardDoc } | null>(null);
  const text = TEXT[locale];
  const theme = useTheme();
  const narrowHeader = useNarrowHeader();
  const compactExamples = useCompactExamples();
  /** 範例播放時按了左邊的元件：顯示 ExampleDrawPrompt */
  const [drawPrompt, setDrawPrompt] = useState(false);
  /** 第一次在自己的白板上（看完範例、開始畫的時候）放聚光燈導覽；看過就不再放，「?」裡可以再看 */
  const [touring, setTouring] = useState(() => !tourSeen());
  const endTour = () => {
    setTouring(false);
    storage()?.setItem(TOUR_KEY, 'done');
  };

  // 上一頁、下一頁或手動改網址時，跟著換房間
  const onHashChange = useEffectEvent(() => {
    setExample(exampleFromLocation());
    setDrawPrompt(false);
    const next = roomFromHash();
    if (sameRoom(next, room)) return;
    setRoom(next);
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
    window.location.hash = `room=${id}`;
    setRoom({ id, viewOnly: false });
    return window.location.href;
  };

  const leave = () => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setRoom(null);
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

  /** 不看範例了：網址拿掉 #example=…，回到自己的白板 */
  const leaveExample = () => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setExample(null);
    setLocalDoc(loadDoc());
    setDrawPrompt(false);
  };

  /** 拿範例來改：存成自己的白板（自己原本有東西就先問） */
  const editExample = () => {
    if (!example) return;
    if (loadDoc().elements.length > 0 && !window.confirm(text.replaceWithExample)) return;
    const doc = exampleEdits.current?.id === example ? exampleEdits.current.doc : exampleOf(example).doc;
    try {
      storage()?.setItem(DOC_KEY, JSON.stringify(doc));
    } catch {
      window.alert(text.storageFull);
      return;
    }
    leaveExample();
  };

  /** 回到自己的白板；第一次來還沒有的話開一張空白的，存起來之後就不會再自動放範例 */
  const closeExample = () => {
    if (!hasOwnBoard()) storage()?.setItem(DOC_KEY, JSON.stringify(EMPTY_DOC));
    leaveExample();
  };

  const rename = (next: string) => {
    setName(next);
    storage()?.setItem(NAME_KEY, next);
  };

  const actions = (
    <span className="app-actions">
      {/* 畫到一半也能回去看範例；自己的白板留著，範例那邊按「我的白板」回來。共用房間裡不放，免得不小心離開房間 */}
      {!room && !narrowHeader && <ExamplePicker locale={locale} label={text.examples} />}
      <ShareControls
        onShare={COLLAB_URL ? share : undefined}
        link={room ? window.location.href : undefined}
        viewLink={viewLinkOf}
        onRename={rename}
        onSaveCopy={saveCopy}
        onLeave={leave}
      />
    </span>
  );

  // 語言、深淺色、原始碼：寬的畫面排成一排小圖示，手機上收進「⋯」選單
  const menu: HeaderMenuItem[] = [
    { label: text.switchLabel, icon: text.switchTo, lang: locale === 'en' ? 'zh-Hant' : 'en', onSelect: switchLocale },
    { label: theme.dark ? text.toLight : text.toDark, icon: theme.dark ? SUN_ICON : MOON_ICON, onSelect: theme.toggle },
    { label: text.source, icon: GITHUB_ICON, href: REPO_URL },
  ];

  /** 手機上換範例收進白板的「⋯」選單，寫完整題名 */
  const exampleMenu = (except?: ExampleId): HeaderMenuItem[] =>
    narrowHeader
      ? EXAMPLE_IDS.filter((id) => id !== except).map((id) => ({
          label: text.exampleItem(exampleOf(id).title),
          icon: EXAMPLE_ICON,
          onSelect: () => openExample(id),
        }))
      : [];

  if (example) {
    const shown = exampleOf(example);
    // 寬的畫面用 ExampleSwitcher、中等寬度用 ExamplePicker、手機上在「⋯」選單（exampleMenu）
    const others = exampleMenu(example);
    const switcher = narrowHeader ? null : compactExamples ? (
      <ExamplePicker current={example} locale={locale} label={text.examples} />
    ) : (
      <ExampleSwitcher current={example} locale={locale} label={text.examples} />
    );
    const ownBoardLabel = hasOwnBoard() ? text.myBoard : text.blankBoard;
    return (
      // 範例播放時按左邊的元件沒有反應，第一次來的人會以為壞了：攔下來說為什麼，給兩條路。
      // display: contents，不影響白板的版面
      <div
        className="app-example-frame"
        onClickCapture={(event) => {
          if (isPaletteClickDuringPlayback(event)) setDrawPrompt(true);
        }}
        // 點別的地方（包括停止播放之後的元件區）就收起來。要在冒泡的時候收：在捕獲的時候收，
        // 提示卡上的按鈕還沒收到點擊就被拿掉了（React 的捕獲和冒泡分開處理）
        onClick={(event) => {
          if (!isPaletteClickDuringPlayback(event)) setDrawPrompt(false);
        }}
      >
        <Whiteboard
          key={`example:${example}`}
          locale={locale}
          initial={shown.doc}
          // 範例不存：按「拿這張來改」才存成自己的白板
          onSave={() => undefined}
          onChange={(doc) => (exampleEdits.current = { id: example, doc })}
          title={shown.title}
          caption={text.exampleCaption}
          // 存檔狀態那裡說清楚：範例不會存，要按「拿這張來改」
          savedLabel={text.exampleNotSaved}
          exportName={`dsa-whiteboard-${example}`}
          menu={[...others, ...menu]}
          actions={
            <span className="app-actions app-actions-example">
              {switcher}
              <button type="button" className="btn btn-small" onClick={closeExample}>
                {ownBoardLabel}
              </button>
              <button type="button" className="btn btn-small btn-primary" onClick={editExample}>
                {text.editExample}
              </button>
            </span>
          }
          // 一打開就從第一步自動播放一輪，停在最後一步；說明只能看
          startAtStep={0}
          autoPlay
          readOnlySteps
        />
        {drawPrompt && (
          <ExampleDrawPrompt
            message={text.drawDuringExample}
            closeLabel={text.closePrompt}
            actions={[
              { label: text.editExample, primary: true, onClick: editExample },
              { label: ownBoardLabel, onClick: closeExample },
            ]}
            onClose={() => setDrawPrompt(false)}
          />
        )}
      </div>
    );
  }

  const collab =
    room && COLLAB_URL
      ? {
          url: `${COLLAB_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/${room.viewOnly ? 'view' : 'room'}/${room.id}`,
          name,
          seed: !room.viewOnly && created === room.id,
          viewOnly: room.viewOnly,
        }
      : undefined;

  const tourSteps: TourStep[] = text.tourSteps.map((step, i) => ({ ...step, target: TOUR_TARGETS[i] }));

  return (
    <>
      <Whiteboard
        key={room ? `${room.viewOnly ? 'view' : 'room'}:${room.id}` : 'local'}
        locale={locale}
        initial={room ? (created === room.id ? localDoc : EMPTY_DOC) : localDoc}
        onSave={save}
        onChange={(doc) => (current.current = doc)}
        title="DSA Whiteboard"
        exportName="dsa-whiteboard"
        menu={room ? menu : [...exampleMenu(), ...menu]}
        actions={actions}
        collab={collab}
        // 共用房間裡不放導覽：別人正在畫，蓋住畫面會打斷
        helpActions={room ? undefined : [{ label: text.replayTour, onSelect: () => setTouring(true) }]}
      />
      {touring && !room && <SpotlightTour steps={tourSteps} text={text.tour} onClose={endTour} />}
    </>
  );
}
