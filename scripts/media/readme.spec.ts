import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import gifenc from 'gifenc';
import { PNG } from 'pngjs';

// README 的圖：一張白板截圖（淺色、深色），和兩個視窗一起編輯的動畫（GIF）。
// 執行：npm run media

const OUT = path.resolve('docs/images');
// gifenc 是 CommonJS，只能整包匯入
const { applyPalette, GIFEncoder, quantize } = gifenc;

async function named(page: Page, name: string) {
  await page.addInitScript((n) => window.localStorage.setItem('dsa-whiteboard:name', n), name);
}

test('still screenshots', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('./');
  // 樹的深度優先搜尋：樹、堆疊、指著目前節點的指標，再記一步
  await page.getByRole('button', { name: /^Tree DFS/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.board-save')).toHaveText('Saved on this device');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `board-${scheme}.png`) });
  }
  await context.close();
});

test('co-editing animation', async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  // 桌面版的寬度，截圖時切掉左邊的元件庫，只留畫布和標題列，縮小顯示時字才看得清楚
  const size = { width: 900, height: 540 };
  const palette = 236;
  const shot = { x: palette, y: 0, width: size.width - palette, height: size.height };
  const open = async (name: string) => {
    const context = await browser.newContext({ viewport: size, locale: 'en-US', colorScheme: 'light' });
    const page = await context.newPage();
    await named(page, name);
    return page;
  };
  const alice = await open('Alice');
  const bob = await open('Bob');

  // 每一格動畫：兩個視窗並排（中間留一條縫），停 delay 毫秒
  const frames: { rgba: Uint8Array; delay: number }[] = [];
  const gap = 16;
  const width = shot.width * 2 + gap;
  const frame = async (delay: number) => {
    const [a, b] = await Promise.all([alice.screenshot({ clip: shot }), bob.screenshot({ clip: shot })]).then((shots) =>
      shots.map((s) => PNG.sync.read(s)),
    );
    const out = new PNG({ width, height: shot.height });
    out.data.fill(255);
    PNG.bitblt(a, out, 0, 0, shot.width, shot.height, 0, 0);
    PNG.bitblt(b, out, 0, 0, shot.width, shot.height, shot.width + gap, 0);
    frames.push({ rgba: new Uint8Array(out.data), delay });
  };

  // Alice 畫了雙指標，按「共用」
  await alice.goto('./');
  await alice.getByRole('button', { name: /^Two pointers/ }).click();
  await alice.keyboard.press('Escape');
  await expect(alice.locator('.board-save')).toHaveText('Saved on this device');
  await bob.goto('./');
  await frame(1200);
  await alice.getByRole('button', { name: 'Share' }).click();
  await expect(alice).toHaveURL(/#room=/);
  await expect(alice.locator('.board-save')).toHaveText('1 person here');

  // Bob 打開連結
  await bob.goto(alice.url());
  await expect(bob.locator('.board-save')).toHaveText('2 people here');
  await expect(alice.locator('.board-save')).toHaveText('2 people here');
  await frame(1400);

  // Bob 的游標在 Alice 那邊移動
  const canvas = (await bob.locator('.board-viewport').boundingBox())!;
  for (let i = 0; i <= 6; i += 1) {
    await bob.mouse.move(canvas.x + canvas.width * (0.25 + i * 0.06), canvas.y + canvas.height * (0.62 - i * 0.03));
    await alice.waitForTimeout(120);
    await frame(160);
  }

  // Bob 拖一個變數到右上角，Alice 那邊也出現
  await bob.getByRole('button', { name: 'Variable', exact: true }).dragTo(bob.locator('.board-viewport'), {
    targetPosition: { x: Math.round(canvas.width * 0.68), y: Math.round(canvas.height * 0.3) },
  });
  await expect(alice.getByRole('group', { name: /^Variable / })).toBeVisible();
  await bob.keyboard.press('Escape');
  await frame(1300);

  // Alice 把右指標往左移，Bob 那邊跟著動
  const right = alice.getByRole('group', { name: /^Pointer r/ });
  await right.click();
  for (let i = 0; i < 3; i += 1) {
    await alice.keyboard.press('ArrowLeft');
    // 等 Bob 那邊也移到同一格
    const where = await right.getAttribute('aria-label');
    await expect(bob.getByRole('group', { name: where ?? '' })).toBeVisible();
    await frame(700);
  }
  await alice.keyboard.press('Escape');
  await frame(1800);

  // 編成 GIF：每一格自己的調色盤，畫面清楚
  const gif = GIFEncoder();
  for (const { rgba, delay } of frames) {
    const colors = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, colors), width, shot.height, { palette: colors, delay });
  }
  gif.finish();
  writeFileSync(path.join(OUT, 'co-editing.gif'), gif.bytes());
  await alice.context().close();
  await bob.context().close();
});
