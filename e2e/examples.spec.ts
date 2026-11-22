import { expect, test, type Page } from '@playwright/test';
import { asReturningVisitor, skipTour, tour } from './returning';

// 網站上的範例：第一次來自動播放 206 一輪；#example=… 的連結（放在履歷、README）不管來過幾次都打開那一題；
// 範例不存，按「拿這張來改」才變成自己的白板

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const position = (page: Page) => page.getByText(/^Step \d+ of \d+$/);

test('plays the 206 example once on a first visit, then stops on the last step', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await expect(heading(page)).toHaveText('206. Reverse Linked List');
  // 手機上標題下面那行換成存檔狀態，只在寬的畫面看得到
  // 第一次來的人先看到一句話說這是什麼
  if ((page.viewportSize()?.width ?? 1280) > 560) {
    await expect(page.getByText('DSA Whiteboard: sketch a solution, then replay it step by step')).toBeVisible();
  }
  // 範例不會存：存檔狀態那裡說清楚
  await expect(page.locator('.board-save')).toHaveText('Example, not saved');
  // 一打開就在播放：第一步，說明是講法的第一句
  await expect(position(page)).toHaveText('Step 1 of 7');
  await expect(page.getByText(/^The key insight is that reversing a list/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause (Space)' })).toBeVisible();

  // 說明長的步驟停久一點，讀得完才換
  await page.clock.runFor(3000);
  await expect(position(page)).toHaveText('Step 1 of 7');
  await page.clock.runFor(4000);
  await expect(position(page)).toHaveText('Step 2 of 7');

  // 播完一輪停在最後一步，可以再按播放（下一步的計時在畫面更新後才排上去，所以一點一點快轉）
  await expect
    .poll(
      async () => {
        await page.clock.runFor(5000);
        return position(page).textContent();
      },
      { timeout: 20_000 },
    )
    .toBe('Step 7 of 7');
  // 最後一步也停到讀完，才換回「播放」
  const play = page.getByRole('button', { name: 'Play (Space)' });
  await expect
    .poll(
      async () => {
        await page.clock.runFor(2000);
        return play.isVisible();
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  await expect(position(page)).toHaveText('Step 7 of 7');
  // 步驟是做好的：不能從某一步繼續編輯或刪掉
  await expect(page.getByRole('button', { name: /^Continue editing from here/ })).toHaveCount(0);
});

test('starts a blank board from the example, and does not show the example again', async ({ page }) => {
  await page.goto('./');
  await expect(heading(page)).toHaveText('206. Reverse Linked List');
  await page.getByRole('button', { name: 'Blank board' }).click();
  await skipTour(page);
  await expect(heading(page)).toHaveText('DSA Whiteboard');
  await expect(page.getByRole('complementary', { name: 'Elements' })).toBeVisible();
  await expect(position(page)).toHaveCount(0);

  await page.reload();
  await expect(heading(page)).toHaveText('DSA Whiteboard');
});

test('keeps the example as my own board with Edit this board', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Edit this board' }).click();
  await skipTour(page);
  await expect(heading(page)).toHaveText('DSA Whiteboard');
  await expect(page).not.toHaveURL(/#/);
  // 範例的內容和步驟都變成自己的，可以編輯，重新整理還在
  await expect(page.getByRole('group', { name: /^Linked list/ }).first()).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Elements' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: /^Linked list/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Play all 7 steps/ })).toBeVisible();
});

test('opens an example from a link even for a returning visitor, and switches between examples', async ({ page }) => {
  await asReturningVisitor(page);
  await page.goto('./');
  // 來過的人打開首頁就是自己的白板
  await expect(heading(page)).toHaveText('DSA Whiteboard');

  await page.goto('./#example=1143');
  await expect(heading(page)).toHaveText('1143. Longest Common Subsequence');
  await expect(position(page)).toHaveText('Step 1 of 6');

  // 換範例：網址跟著換，可以直接傳給別人。寬的畫面按題型（看不懂題號也知道是哪一種），手機上在「⋯」選單裡
  const width = page.viewportSize()?.width ?? 1280;
  if (width <= 560) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Example: 200. Number of Islands' }).click();
  } else {
    const examples = page.getByRole('group', { name: 'Examples' });
    await expect(examples.getByRole('button', { pressed: true })).toHaveText('DP');
    await examples.getByRole('button', { name: 'Graph: 200. Number of Islands' }).click();
    await expect(examples.getByRole('button', { pressed: true })).toHaveText('Graph');
  }
  await expect(heading(page)).toHaveText('200. Number of Islands');
  await expect(page).toHaveURL(/#example=200$/);

  // 回到自己的白板
  await page.getByRole('button', { name: 'My board' }).click();
  await expect(heading(page)).toHaveText('DSA Whiteboard');
  await expect(page).not.toHaveURL(/#/);
});

test('switches examples from a menu when the header is too narrow for the topic buttons', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) <= 560, '手機上換範例在「⋯」選單裡，上一個測試測過');
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto('./#example=206');
  await expect(page.getByRole('group', { name: 'Examples' })).toHaveCount(0);
  // 按鈕寫現在的題型，打開列出三個範例的完整題名
  await page.getByRole('button', { name: 'Examples: 206. Reverse Linked List' }).click();
  await expect(page.getByRole('button', { name: /^206\. Reverse Linked List/ })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: /^1143\. Longest Common Subsequence/ }).click();
  await expect(heading(page)).toHaveText('1143. Longest Common Subsequence');
  await expect(page).toHaveURL(/#example=1143$/);
  await expect(page.getByRole('button', { name: 'Examples: 1143. Longest Common Subsequence' })).toHaveText('DP');
});

test('opens an example from my own board, and comes back to the board', async ({ page }) => {
  await asReturningVisitor(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await expect(page.getByRole('group', { name: /^Array nums/ })).toBeVisible();

  // 畫到一半也能回去看範例：寬的畫面在標題列的「Examples」，手機上在「⋯」選單
  if ((page.viewportSize()?.width ?? 1280) <= 560) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('button', { name: 'Example: 1143. Longest Common Subsequence' }).click();
  } else {
    await page.getByRole('button', { name: 'Examples', exact: true }).click();
    await page.getByRole('button', { name: /^1143\. Longest Common Subsequence/ }).click();
  }
  await expect(heading(page)).toHaveText('1143. Longest Common Subsequence');

  // 自己的白板還在
  await page.getByRole('button', { name: 'My board' }).click();
  await expect(heading(page)).toHaveText('DSA Whiteboard');
  await expect(page.getByRole('group', { name: /^Array nums/ })).toBeVisible();
});

// 手機放不下整張白板（206 最後一步左邊是串列、右邊是複雜度和便利貼，要縮到 30% 左右）：
// 不縮成一小塊，每一步把那一步放在播放列上面、看得清楚的大小；元件庫收起來、步驟改成一排小圓點
test('on a phone, follows each step at a readable size instead of shrinking the whole board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#example=206');
  await expect(position(page)).toHaveText('Step 1 of 7');
  await page.getByRole('button', { name: 'Pause (Space)' }).click();
  const zoom = page.getByRole('button', { name: 'Reset zoom to 100%' });
  const percent = async () => Number((await zoom.textContent())?.replace('%', ''));
  const onScreen = async (name: string | RegExp) => {
    const box = await page.getByText(name).first().boundingBox();
    const bar = await page.locator('.board-playback').boundingBox();
    const width = await page.evaluate(() => window.innerWidth);
    return box !== null && bar !== null && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= bar.y;
  };

  // 元件庫播放時用不到：收起來
  await expect(page.getByRole('button', { name: 'Array', exact: true })).toBeHidden();
  // 收起來的元件庫量出來是 (0, 0) 的空框：鍵盤按下去的點擊座標是 (0, 0)，不能當成點到元件庫
  await page.getByRole('button', { name: 'Go to step 1' }).dispatchEvent('click', { clientX: 0, clientY: 0 });
  await expect(page.getByText('The example is playing')).toHaveCount(0);
  // 小圓點跟「第幾步」排在同一行
  const count = await position(page).boundingBox();
  const dot = await page.getByRole('button', { name: 'Go to step 7' }).boundingBox();
  expect(Math.abs((count?.y ?? 0) + (count?.height ?? 0) / 2 - ((dot?.y ?? 0) + (dot?.height ?? 0) / 2))).toBeLessThan(8);

  // 第一步只有串列：整條在畫面裡、看得清楚（以前是 50%、擠在左邊；390 寬的手機是 100%）
  await expect.poll(() => onScreen('null')).toBe(true);
  expect(await percent()).toBeGreaterThanOrEqual(60);
  // 複雜度那一步：畫面移到複雜度，字還看得清楚
  await page.getByRole('button', { name: 'Go to step 6' }).click();
  await expect.poll(() => onScreen('O(n)')).toBe(true);
  expect(await percent()).toBeGreaterThanOrEqual(60);
  // 最後一步：便利貼
  await page.getByRole('button', { name: 'Go to step 7' }).click();
  await expect.poll(() => onScreen(/^Empty list or a single node/)).toBe(true);
  expect(await percent()).toBeGreaterThanOrEqual(60);

  // 結束播放：元件庫回來
  await page.getByRole('button', { name: 'Stop playback (Esc)' }).click();
  await expect(page.getByRole('button', { name: 'Array', exact: true })).toBeVisible();
});

test('explains why the elements do nothing while an example plays, and offers a way to draw', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) <= 760, '手機上播放時元件庫整條收起來，點不到');
  await page.goto('./');
  await expect(position(page)).toHaveText('Step 1 of 7');
  // 播放時元件區不能用（點擊穿過去，所以用 force）：按了要說為什麼，不是沒反應
  const array = page.getByRole('button', { name: 'Array', exact: true });
  await array.click({ force: true });
  const prompt = page.getByRole('status').filter({ hasText: 'The example is playing' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Close' }).click();
  await expect(prompt).toHaveCount(0);

  await array.click({ force: true });
  await prompt.getByRole('button', { name: 'Blank board' }).click();
  await skipTour(page);
  await expect(heading(page)).toHaveText('DSA Whiteboard');
  await expect(prompt).toHaveCount(0);
  // 現在可以畫了
  await array.click();
  await expect(page.getByRole('group', { name: /^Array nums/ })).toBeVisible();
});

test('asks before an example replaces a board I already drew on', async ({ page }) => {
  await asReturningVisitor(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await page.goto('./#example=206');
  let asked = '';
  page.once('dialog', (dialog) => {
    asked = dialog.message();
    void dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Edit this board' }).click();
  expect(asked).toContain('Replace your own board with this example?');
  // 不取代：還在看範例，自己的白板沒變
  await expect(heading(page)).toHaveText('206. Reverse Linked List');
  await page.getByRole('button', { name: 'My board' }).click();
  await expect(page.getByRole('group', { name: /^Array nums/ })).toBeVisible();
});

test('shows a four-step tour the first time I start drawing, once, and replays it from Help', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Blank board' }).click();
  const card = tour(page);
  await expect(card).toBeVisible();
  // 一步一步：元件、工具列、記步驟、操作說明
  for (const [i, title] of ['Elements', 'Toolbar', 'Record steps', 'Help'].entries()) {
    await expect(card.getByRole('heading')).toHaveText(title);
    await expect(card).toContainText(`${i + 1} of 4`);
    if (i < 3) await card.getByRole('button', { name: 'Next' }).click();
  }
  await card.getByRole('button', { name: 'Back' }).click();
  await expect(card.getByRole('heading')).toHaveText('Record steps');
  await card.getByRole('button', { name: 'Next' }).click();
  await card.getByRole('button', { name: 'Start drawing' }).click();
  await expect(card).toHaveCount(0);

  // 看過就不再出現
  await page.reload();
  await expect(heading(page)).toHaveText('DSA Whiteboard');
  await expect(card).toHaveCount(0);

  // 「?」裡可以再看一次；導覽開著時白板的快捷鍵不作用（S 不會記一步），Esc 關掉
  await page.getByRole('button', { name: 'How to use', exact: true }).click();
  await page.getByRole('button', { name: 'Show the tour again' }).click();
  await expect(card.getByRole('heading')).toHaveText('Elements');
  await page.keyboard.press('ArrowRight');
  await expect(card.getByRole('heading')).toHaveText('Toolbar');
  await page.keyboard.press('s');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Play all 0 steps/ })).toBeDisabled();
});
