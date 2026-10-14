import { expect, test, type Page } from '@playwright/test';

// 一起編輯：兩個瀏覽器（兩份 localStorage）連到本機 wrangler dev 跑的房間

/** 標題列上的連線狀態（手機上可能被截短，看文字就好） */
const status = (page: Page) => page.locator('.board-save');

async function named(page: Page, name: string) {
  await page.addInitScript((n) => window.localStorage.setItem('dsa-whiteboard:name', n), name);
}

test('two people edit one shared board together', async ({ page: alice, browser }) => {
  await named(alice, 'Alice');
  await alice.goto('./');
  // Alice 自己的白板上先有一個陣列
  await alice.getByRole('button', { name: 'Array', exact: true }).click();
  await expect(alice.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' })).toBeVisible();

  // 按「共用」：網址多了房間代碼，自己的白板被放進房間
  await alice.getByRole('button', { name: 'Share' }).click();
  await expect(alice).toHaveURL(/#room=[a-z0-9]{16}$/);
  await expect(status(alice)).toHaveText('1 person here');
  const link = alice.url();

  // Bob 打開連結，看到同一張白板
  const context = await browser.newContext({ locale: 'en-US' });
  const bob = await context.newPage();
  await named(bob, 'Bob');
  await bob.goto(link);
  await expect(bob.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' })).toBeVisible();
  await expect(status(bob)).toHaveText('2 people here');
  await expect(status(alice)).toHaveText('2 people here');
  // 點頭像看房間裡有誰
  await alice.getByRole('button', { name: /^Shared room/ }).click();
  const people = alice.getByRole('list', { name: 'Shared room' });
  await expect(people).toContainText('Alice (you)');
  await expect(people).toContainText('Bob');
  await alice.keyboard.press('Escape');
  await expect(people).toBeHidden();

  // Bob 加一個變數，Alice 那邊也出現
  await bob.getByRole('button', { name: 'Variable', exact: true }).click();
  await expect(alice.getByRole('group', { name: /^Variable / })).toBeVisible();

  // Alice 改陣列，Bob 那邊跟著變
  const array = alice.getByRole('group', { name: /^Array nums/ });
  await array.dblclick();
  await alice.getByRole('textbox', { name: 'Cell 0' }).fill('7');
  await alice.keyboard.press('Enter');
  await expect(bob.getByRole('group', { name: 'Array nums: 7, 2, 3, 4' })).toBeVisible();

  // Bob 的游標出現在 Alice 的白板上，帶著名字
  const canvas = bob.locator('.board-viewport');
  const box = (await canvas.boundingBox())!;
  await bob.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await bob.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10);
  await expect(alice.locator('.board-peer-cursor', { hasText: 'Bob' })).toBeVisible();

  // Alice 復原只退回自己改的陣列，Bob 加的變數還在
  await alice.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
  for (const p of [alice, bob]) {
    await expect(p.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' })).toBeVisible();
    await expect(p.getByRole('group', { name: /^Variable / })).toBeVisible();
  }

  // 重新整理後還在同一個房間，內容也在
  await bob.reload();
  await expect(bob.getByRole('group', { name: /^Variable / })).toBeVisible();
  await expect(status(bob)).toHaveText('2 people here');

  // Alice 離開共用：回到自己的白板，房間裡的變數不會跑進來
  await alice.getByRole('button', { name: /^Shared room/ }).click();
  await alice.getByRole('button', { name: 'Leave' }).click();
  await expect(alice).not.toHaveURL(/#room=/);
  await expect(alice.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' })).toBeVisible();
  await expect(alice.getByRole('group', { name: /^Variable / })).toHaveCount(0);
  await expect(status(bob)).toHaveText('1 person here');

  await context.close();
});

test('a wrong room link opens the local board', async ({ page }) => {
  await page.goto('./#room=NOT_A_ROOM');
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
  await expect(page.getByText('Saved on this device')).toBeVisible();
});
