import type { Page } from '@playwright/test';

/**
 * 當成來過的人：瀏覽器裡已經有自己的（空白）白板，打開網站就是自己的白板，不會自動放範例。
 * 已經存過的不動，重新整理後還是那張
 */
export async function asReturningVisitor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem('dsa-whiteboard:doc')) localStorage.setItem('dsa-whiteboard:doc', JSON.stringify({ elements: [] }));
  });
}
