import { createContext, useContext } from 'react';
import { en } from './en';
import { zhTW, type Messages } from './zh-TW';

export type { Messages };

export type Locale = 'zh-TW' | 'en';

export const MESSAGES: Record<Locale, Messages> = { 'zh-TW': zhTW, en };

const I18nContext = createContext<{ t: Messages; locale: Locale }>({ t: en, locale: 'en' });

export const I18nProvider = I18nContext.Provider;

/** 白板內部用的介面文字；語言由 Whiteboard 的 locale 決定 */
export function useI18n() {
  return useContext(I18nContext);
}
