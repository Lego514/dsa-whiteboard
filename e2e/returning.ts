import type { Page } from '@playwright/test';

/**
 * 當成來過的人：瀏覽器裡已經有自己的（空白）白板，打開網站就是自己的白板，不會自動放範例，也看過導覽了。
 * 已經存過的不動，重新整理後還是那張
 */
export async function asReturningVisitor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem('dsa-whiteboard:doc')) localStorage.setItem('dsa-whiteboard:doc', JSON.stringify({ elements: [] }));
    localStorage.setItem('dsa-whiteboard:tour', 'done');
  });
}

/** 第一次開始畫時的聚光燈導覽 */
export const tour = (page: Page) => page.getByRole('dialog', { name: 'Whiteboard tour' });

/** 第一次來的人離開範例後會先看到導覽：按「跳過」 */
export async function skipTour(page: Page): Promise<void> {
  await tour(page).getByRole('button', { name: 'Skip' }).click();
  await tour(page).waitFor({ state: 'detached' });
}
