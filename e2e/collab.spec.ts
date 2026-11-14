import { expect, test, type Page } from '@playwright/test';
import { asReturningVisitor } from './returning';

// 一起編輯：兩個瀏覽器（兩份 localStorage）連到本機 wrangler dev 跑的房間

/** 標題列上的連線狀態（手機上可能被截短，看文字就好） */
const status = (page: Page) => page.locator('.board-save');

async function named(page: Page, name: string) {
  await page.addInitScript((n) => window.localStorage.setItem('dsa-whiteboard:name', n), name);
}

/** 剪貼簿換成假的：ok 時記下複製的字，不 ok 時像沒有權限一樣丟錯 */
async function fakeClipboard(page: Page, ok: boolean) {
  await page.addInitScript((works) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (!works) return Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
          (window as unknown as { copied: string }).copied = text;
          return Promise.resolve();
        },
      },
    });
  }, ok);
}

// 這裡測的是自己的白板：當成來過的人，第一次來會自動播放的範例另外測（examples.spec.ts）
test.beforeEach(async ({ page }) => asReturningVisitor(page));

test('two people edit one shared board together', async ({ page: alice, browser }) => {
  await named(alice, 'Alice');
  await fakeClipboard(alice, true);
  await alice.goto('./');
  // Alice 自己的白板上先有一個陣列
  await alice.getByRole('button', { name: 'Array', exact: true }).click();
  await expect(alice.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' })).toBeVisible();

  // 按「共用」先看說明，按「建立連結」才開房間：網址多了房間代碼，自己的白板被放進房間
  await alice.getByRole('button', { name: 'Share' }).click();
  await alice.getByRole('dialog', { name: 'Share this board' }).getByRole('button', { name: 'Create link' }).click();
  await expect(alice).toHaveURL(/#room=[a-z0-9]{16}$/);
  await expect(status(alice)).toHaveText('1 person here');
  const link = alice.url();
  // 連結已經複製，選單打開給你看
  await expect(alice.getByRole('textbox', { name: 'Can edit' })).toHaveValue(link);
  await expect(alice.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await alice.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(link);
  await alice.keyboard.press('Escape');

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
  // 自己取的名字，頭像放第一個字
  await expect(people.getByRole('listitem').filter({ hasText: 'Alice' }).locator('.board-peer')).toHaveText('A');
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

test('explains sharing before making a room, and hands over the link when copying is blocked', async ({ page }) => {
  await fakeClipboard(page, false);
  // 舊版自動取的名字，進房間時換成形容詞加動物
  await named(page, 'Guest 17');
  await page.goto('./');
  await page.getByRole('button', { name: 'Share' }).click();
  const intro = page.getByRole('dialog', { name: 'Share this board' });
  await expect(intro).toContainText('You get two links: one to edit with you live, and one that can only watch');
  await expect(intro).toContainText('Your own board stays on this device');
  // 取消：沒有開房間
  await intro.getByRole('button', { name: 'Cancel' }).click();
  await expect(intro).toBeHidden();
  await expect(page).not.toHaveURL(/#room=/);

  // 剪貼簿不能用：選單打開、連結選好，說清楚要自己複製
  await page.getByRole('button', { name: 'Share' }).click();
  await intro.getByRole('button', { name: 'Create link' }).click();
  await expect(page).toHaveURL(/#room=[a-z0-9]{16}$/);
  const field = page.getByRole('textbox', { name: 'Can edit' });
  await expect(field).toHaveValue(page.url());
  await expect(page.getByRole('status').filter({ hasText: 'Couldn’t copy automatically' })).toBeVisible();
  await expect
    .poll(() => field.evaluate((input: HTMLInputElement) => input === document.activeElement && input.selectionEnd! - input.selectionStart! === input.value.length))
    .toBe(true);
  const people = page.getByRole('list', { name: 'Shared room' });
  // 頭像的字母緊接在名字前面，所以不從開頭比對
  await expect(people).toContainText(/[A-Z][a-z]+ [A-Z][a-z]+ \(you\)/);
  await expect(people).not.toContainText('Guest 17');
  // 預設名字的頭像是那種動物的小插圖
  await expect(people.locator('.board-peer[data-animal] svg')).toHaveCount(1);

  // 標題列的「複製連結」也一樣
  await page.keyboard.press('Escape');
  await expect(field).toBeHidden();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(field).toBeVisible();
});

test('a wrong room link opens the local board', async ({ page }) => {
  await page.goto('./#room=NOT_A_ROOM');
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
  await expect(page.getByText('Saved on this device')).toBeVisible();
});

test('a view-only link watches the board live but cannot change it', async ({ page: alice, browser }) => {
  test.skip(test.info().project.name === 'iphone', '兩個人的流程在桌機測過就好');
  await named(alice, 'Alice');
  await fakeClipboard(alice, true);
  await alice.goto('./');
  await alice.getByRole('button', { name: 'Array', exact: true }).click();
  await alice.getByRole('button', { name: 'Share' }).click();
  await alice.getByRole('dialog', { name: 'Share this board' }).getByRole('button', { name: 'Create link' }).click();
  await expect(status(alice)).toHaveText('1 person here');

  // 選單裡有兩個連結：能編輯的就是網址，只能看的是另一個代碼，看不出房間代碼
  const room = alice.url().match(/#room=([a-z0-9]+)$/)![1];
  const viewField = alice.getByRole('textbox', { name: 'View only' });
  await expect(viewField).toHaveValue(/#view=[a-z0-9]{24}$/);
  const viewLink = await viewField.inputValue();
  expect(viewLink).not.toContain(room);
  await alice.getByRole('button', { name: 'Copy: View only' }).click();
  await expect(alice.getByRole('status').filter({ hasText: 'View-only link copied' })).toBeVisible();
  expect(await alice.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(viewLink);
  await alice.keyboard.press('Escape');

  // Bob 用只能看的連結進來：看得到白板，沒有元件庫和工具列
  const context = await browser.newContext({ locale: 'en-US' });
  const bob = await context.newPage();
  await named(bob, 'Bob');
  await bob.goto(viewLink);
  const array = bob.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' });
  await expect(array).toBeVisible();
  await expect(status(bob)).toHaveText('View only · 2 people here');
  await expect(bob.getByRole('complementary', { name: 'Elements' })).toHaveCount(0);
  await expect(bob.getByRole('toolbar', { name: 'Tools' })).toHaveCount(0);
  await expect(bob.getByRole('button', { name: /next step/ })).toHaveCount(0);

  // 點兩下不會開始編輯，按 Delete、Ctrl+A 也沒有作用
  await array.dblclick();
  await expect(bob.getByRole('textbox', { name: 'Cell 0' })).toHaveCount(0);
  await bob.keyboard.press('Control+a');
  await bob.keyboard.press('Delete');
  await expect(array).toBeVisible();

  // Alice 那邊看得到 Bob 只能看；Alice 改的 Bob 馬上看到
  await alice.getByRole('button', { name: /^Shared room/ }).click();
  await expect(alice.getByRole('list', { name: 'Shared room' }).getByRole('listitem').filter({ hasText: 'Bob' })).toContainText('view only');
  await alice.keyboard.press('Escape');
  await alice.getByRole('group', { name: /^Array nums/ }).dblclick();
  await alice.getByRole('textbox', { name: 'Cell 0' }).fill('7');
  await alice.keyboard.press('Enter');
  await expect(bob.getByRole('group', { name: 'Array nums: 7, 2, 3, 4' })).toBeVisible();

  // 就算自己送修改給伺服器，也會被擋下來，Alice 的白板不變
  const reason = await bob.evaluate(async (url) => {
    const viewId = new URL(url).hash.slice('#view='.length);
    const ws = new WebSocket(`ws://127.0.0.1:8787/view/${viewId}`);
    return await new Promise<string>((resolve) => {
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data as string);
        if (message.t === 'init') ws.send(JSON.stringify({ t: 'ops', batch: 1, ops: [{ k: 'del', id: message.doc.elements[0].id }] }));
        if (message.t === 'reject') resolve(message.reason);
      };
    });
  }, viewLink);
  expect(reason).toBe('read_only');
  await expect(alice.getByRole('group', { name: 'Array nums: 7, 2, 3, 4' })).toBeVisible();

  await context.close();
});
