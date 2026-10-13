import { useState } from 'react';
import { EMPTY_DOC, Whiteboard, type BoardDoc, type Locale } from '../src';
import { boardDocSchema } from '../src/schema';

// 獨立的白板網站：一張白板存在這個瀏覽器裡，不用登入。

const DOC_KEY = 'dsa-whiteboard:doc';
const LOCALE_KEY = 'dsa-whiteboard:locale';
const REPO_URL = 'https://github.com/Lego514/dsa-whiteboard';

const TEXT: Record<Locale, { caption: string; switchTo: string; switchLabel: string; source: string; storageFull: string }> = {
  'zh-TW': {
    caption: '資料結構與演算法白板',
    switchTo: 'EN',
    switchLabel: 'Switch to English',
    source: 'GitHub 上的原始碼',
    storageFull: '瀏覽器的儲存空間滿了，這次的修改沒有存起來。',
  },
  en: {
    caption: 'Data structures & algorithms',
    switchTo: '中',
    switchLabel: '切換成中文',
    source: 'Source code on GitHub',
    storageFull: 'Browser storage is full, so the latest change wasn’t saved.',
  },
};

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

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);

export function App() {
  const [locale, setLocale] = useState(initialLocale);
  const [initial] = useState(loadDoc);
  const text = TEXT[locale];

  const switchLocale = () => {
    const next: Locale = locale === 'en' ? 'zh-TW' : 'en';
    setLocale(next);
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-Hant';
    storage()?.setItem(LOCALE_KEY, next);
  };

  const save = (doc: BoardDoc) => {
    try {
      storage()?.setItem(DOC_KEY, JSON.stringify(doc));
    } catch {
      window.alert(text.storageFull);
    }
  };

  return (
    <Whiteboard
      locale={locale}
      initial={initial}
      onSave={save}
      title="DSA Whiteboard"
      caption={text.caption}
      exportName="dsa-whiteboard"
      actions={
        <span className="app-actions">
          <button type="button" className="btn btn-quiet btn-small" aria-label={text.switchLabel} title={text.switchLabel} onClick={switchLocale}>
            {text.switchTo}
          </button>
          <a className="btn btn-quiet btn-small app-icon-link" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label={text.source} title={text.source}>
            {GITHUB_ICON}
          </a>
        </span>
      }
    />
  );
}
