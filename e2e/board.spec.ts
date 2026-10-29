import { expect, test } from '@playwright/test';

test('sketches an array with a pointer and keeps it after reloading', async ({ page }) => {
  await page.goto('./');
  const board = page.getByRole('dialog', { name: 'DSA Whiteboard' });
  await expect(board).toContainText('Click or drag in an element');

  // 先加陣列，陣列還選著時加指標，指標會放在第一格
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await page.getByRole('button', { name: 'Pointer', exact: true }).click();
  const pointer = page.getByRole('group', { name: /^Pointer i/ });
  await expect(pointer).toHaveAccessibleName('Pointer i at index 0');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(pointer).toHaveAccessibleName('Pointer i at index 2');

  // 第二個指標自動叫 j
  await page.getByRole('group', { name: /^Array nums/ }).click();
  await page.getByRole('button', { name: 'Pointer', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Pointer j at index 0' })).toBeVisible();

  // 雙擊編輯格子，Enter 結束；復原一次會回到編輯前
  const array = page.getByRole('group', { name: /^Array nums/ });
  await array.dblclick();
  await page.getByRole('textbox', { name: 'Cell 0' }).fill('x');
  await page.keyboard.press('Enter');
  await expect(array).toHaveAccessibleName('Array nums: x, 2, 3, 4');
  await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
  await expect(page.getByRole('group', { name: 'Array nums: 1, 2, 3, 4' })).toBeVisible();
  await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).click();
  await expect(page.getByRole('group', { name: 'Array nums: x, 2, 3, 4' })).toBeVisible();

  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Array nums: x, 2, 3, 4' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Pointer i at index 2' })).toBeVisible();
});

test('adds, highlights, and inserts single cells of an array', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  const array = page.getByRole('group', { name: /^Array nums/ });

  // 陣列最後的「＋」多一格，直接輸入
  await page.getByRole('button', { name: 'Add cell' }).click();
  await page.keyboard.type('5');
  await page.keyboard.press('Enter');
  await expect(array).toHaveAccessibleName('Array nums: 1, 2, 3, 4, 5');

  // 點一格：上底色、在這格加指標
  await array.getByTitle('3', { exact: true }).click();
  const cellBar = page.getByRole('toolbar', { name: 'Selected element' });
  await expect(cellBar).toContainText('Cell 2');
  await cellBar.getByRole('button', { name: 'Yellow' }).click();
  await cellBar.getByRole('button', { name: '+ Pointer' }).click();
  await expect(page.getByRole('group', { name: 'Pointer i at index 2' })).toBeVisible();

  // 在第 1 格左邊插入：指標跟著原本的值往後一格
  await array.getByTitle('2', { exact: true }).click();
  await cellBar.getByRole('button', { name: 'Insert left' }).click();
  await page.keyboard.type('9');
  await page.keyboard.press('Enter');
  await expect(array).toHaveAccessibleName('Array nums: 1, 9, 2, 3, 4, 5');
  await expect(page.getByRole('group', { name: 'Pointer i at index 3' })).toBeVisible();
});

test('keeps the view where it is after adding something', async ({ page }) => {
  await page.goto('./');
  const canvas = page.getByRole('region', { name: 'Whiteboard canvas' });
  const world = canvas.locator('.board-world');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(page.getByText('Saved on this device')).toBeVisible();

  // 用手掌工具平移畫面，再放一個元件；存檔之後畫面不應該跳回中間
  await page.keyboard.press('h');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height - 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + box.height - 220, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press('v');
  const panned = await world.getAttribute('style');

  await page.getByRole('button', { name: 'Variable', exact: true }).click();
  await expect(page.getByText('Saving…')).toBeVisible();
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await world.getAttribute('style')).toBe(panned);
});

test('clears the canvas after confirming, and undo brings it back', async ({ page }) => {
  await page.goto('./');
  const clear = page.getByRole('button', { name: 'Clear canvas' });
  await expect(clear).toBeDisabled();
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await page.getByRole('button', { name: 'Sticky note', exact: true }).click();

  // 先問一次；取消就什麼都不動
  await clear.click();
  const confirm = page.getByRole('dialog', { name: 'Clear the whole whiteboard?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('group', { name: /^Array nums/ })).toBeVisible();

  await clear.click();
  await confirm.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByText('Click or drag in an element')).toBeVisible();
  await expect(clear).toBeDisabled();

  await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
  await expect(page.getByRole('group', { name: /^Array nums/ })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Sticky note/ })).toBeVisible();
});

test('frames part of an array with a rectangle without blocking it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  const array = page.getByRole('group', { name: /^Array nums/ });
  const first = (await array.getByTitle('2', { exact: true }).boundingBox())!;
  const second = (await array.getByTitle('3', { exact: true }).boundingBox())!;

  // R 畫矩形框，框住第 1、2 格
  await page.keyboard.press('r');
  await page.mouse.move(first.x - 12, first.y - 12);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width + 12, second.y + second.height + 12, { steps: 5 });
  await page.mouse.up();
  const frame = page.getByRole('group', { name: 'Rectangle' });
  await expect(frame).toBeVisible();

  // 框住的格子照樣點得到
  await array.getByTitle('2', { exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Selected element' })).toContainText('Cell 1');

  // 點框線選取框框，拖右下角變大，Delete 刪掉
  const box = (await frame.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 1);
  await expect(page.getByRole('toolbar', { name: 'Selected element' })).not.toContainText('Cell');
  await page.mouse.move(box.x + box.width + 2, box.y + box.height + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 42, box.y + box.height + 22, { steps: 4 });
  await page.mouse.up();
  expect((await frame.boundingBox())!.width).toBeGreaterThan(box.width + 30);
  await page.keyboard.press('Delete');
  await expect(frame).toBeHidden();
  await expect(array).toBeVisible();
});

test('connects elements with a plain line, then selects, duplicates, and deletes a group with a box', async ({ page }) => {
  await page.goto('./');
  // 元件庫已經沒有單一的圖節點，用兩個變數來連
  await page.getByRole('button', { name: 'Variable', exact: true }).click();
  await page.getByRole('button', { name: 'Variable', exact: true }).click();
  const nodes = page.getByRole('group', { name: /^Variable/ });
  const a = (await nodes.nth(0).boundingBox())!;
  const b = (await nodes.nth(1).boundingBox())!;

  // L 畫直線（沒有箭頭），點一下可以選取並改成箭頭
  await page.keyboard.press('l');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press('v');
  const selection = page.getByRole('toolbar', { name: 'Selected element' });
  const midX = (a.x + a.width / 2 + b.x + b.width / 2) / 2;
  const midY = (a.y + a.height / 2 + b.y + b.height / 2) / 2;
  await page.mouse.click(midX, midY);
  await expect(selection.getByRole('button', { name: 'Add an arrowhead' })).toBeVisible();

  // 在空白處拖曳框住兩個節點和直線：一起複製，再一起刪掉
  const left = Math.min(a.x, b.x) - 24;
  const top = Math.min(a.y, b.y) - 24;
  const right = Math.max(a.x + a.width, b.x + b.width) + 24;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + 24;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(right, bottom, { steps: 5 });
  await page.mouse.up();
  await expect(selection).toContainText('3 selected');
  await page.keyboard.press('Control+d');
  await expect(nodes).toHaveCount(4);
  await expect(selection).toContainText('3 selected');
  await page.keyboard.press('Delete');
  await expect(nodes).toHaveCount(2);
});

test('records steps and plays them back with notes', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await page.getByRole('button', { name: 'Pointer', exact: true }).click();
  const pointer = page.getByRole('group', { name: /^Pointer i/ });

  // 每一步：記下畫面，再把指標往右移一格
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('s');
    await pointer.click();
    await page.keyboard.press('ArrowRight');
  }
  await expect(pointer).toHaveAccessibleName('Pointer i at index 3');

  await page.getByRole('button', { name: 'Play all 3 steps from the start' }).click();
  const playback = page.getByRole('toolbar', { name: 'Step playback' });
  await expect(playback).toContainText('Step 1 of 3');
  await expect(pointer).toHaveAccessibleName('Pointer i at index 0');
  await playback.getByRole('textbox', { name: 'What happens in step 1' }).fill('i starts at the first cell');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await expect(playback).toContainText('Step 2 of 3');
  await expect(pointer).toHaveAccessibleName('Pointer i at index 1');
  // 播放時不能編輯，元件庫停用
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeHidden();

  // 從第 2 步繼續編輯：畫面換成那一步
  await playback.getByRole('button', { name: 'Continue editing from here' }).click();
  await expect(playback).toBeHidden();
  await expect(pointer).toHaveAccessibleName('Pointer i at index 1');

  // 說明會存起來
  await page.getByRole('button', { name: 'Play all 3 steps from the start' }).click();
  await expect(playback.getByRole('textbox', { name: 'What happens in step 1' })).toHaveValue('i starts at the first cell');
  await playback.getByRole('button', { name: 'Delete step' }).click();
  await expect(playback).toContainText('Step 1 of 2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Play all 2 steps from the start' })).toBeVisible();
});

test('exports the board, or the step being played, as a PNG', async ({ page }) => {
  await page.goto('./');
  const exportButton = page.getByRole('button', { name: 'Export image' });
  await expect(exportButton).toBeDisabled();
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await page.getByRole('button', { name: 'Pointer', exact: true }).click();

  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  expect(download.suggestedFilename()).toBe('dsa-whiteboard.png');
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const png = readFileSync(path);
  // PNG 檔頭，而且不是空白小圖
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(2000);

  // 播放時匯出的是那一步
  await page.keyboard.press('s');
  await page.getByRole('button', { name: 'Play the step from the start' }).click();
  const [stepDownload] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  expect(stepDownload.suggestedFilename()).toBe('dsa-whiteboard-step-1.png');
});

test('builds a linked list from text, flips a link, and points the tail back', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Linked list', exact: true }).click();
  const list = page.getByRole('group', { name: /^Linked list head/ });
  await expect(list).toHaveAccessibleName('Linked list head: 1 → 2 → 3');

  // 直接貼題目的範例
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  const input = selbar.getByRole('textbox', { name: 'Build from text' });
  await expect(input).toHaveValue('1->2->3');
  await input.fill('1->2->3->4->5');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(list).toHaveAccessibleName('Linked list head: 1 → 2 → 3 → 4 → 5');
  await expect(list).toContainText('null');

  // 點兩個節點之間的箭頭：往後 → 反過來 → 斷開
  await list.getByRole('button', { name: /^Link between node 0 and 1: forward/ }).click();
  await expect(list.getByRole('button', { name: /^Link between node 0 and 1: reversed/ })).toBeVisible();
  await list.getByRole('button', { name: /^Link between node 0 and 1: reversed/ }).click();
  await expect(list.getByRole('button', { name: /^Link between node 0 and 1: cut/ })).toBeVisible();

  // 選著串列時加指標，指標吸附在第一個節點下面，方向鍵一格一格走
  await page.getByRole('button', { name: 'Pointer', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Pointer i at index 0' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('group', { name: 'Pointer i at index 1' })).toBeVisible();

  // 點一個節點，讓尾巴接回這裡（有環），尾巴就不再接 null
  await list.locator('[data-cell="1"]').click();
  await selbar.getByRole('button', { name: 'Point the tail here' }).click();
  await expect(list).not.toContainText('null');
  await expect(selbar.getByRole('button', { name: 'Remove cycle' })).toBeVisible();
});

test('builds a binary tree from LeetCode’s format and edits it node by node', async ({ page, isMobile }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Binary tree', exact: true }).click();
  const tree = page.getByRole('group', { name: /^Binary tree root/ });
  await expect(tree).toHaveAccessibleName('Binary tree root: [1,2,3]');

  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  const input = selbar.getByRole('textbox', { name: 'Build from text' });
  await input.fill('[1,null,2,null,3,null,4,null,5,null,6,null,7]');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(selbar.getByRole('alert')).toContainText('at most 6 levels');
  await input.fill('[3,9,20,null,null,15,7]');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(tree).toHaveAccessibleName('Binary tree root: [3,9,20,null,null,15,7]');

  // 選節點 9，加右子節點，直接輸入值。桌面版點畫布上虛線的位置；手機畫面窄，那個位置可能在畫面外，用上方的按鈕
  await tree.locator('[data-cell="1"]').click();
  await expect(selbar).toContainText('Node 9');
  await expect(tree.getByRole('button', { name: '+ Left child' })).toHaveCount(1);
  if (isMobile) await selbar.getByRole('button', { name: '+ Right child' }).click();
  else await tree.getByRole('button', { name: '+ Right child' }).click();
  await page.getByRole('textbox', { name: 'Tree position 4' }).fill('8');
  await page.keyboard.press('Enter');
  await expect(tree).toHaveAccessibleName('Binary tree root: [3,9,20,null,8,15,7]');

  // 在根節點加指標，用方向鍵走到右子節點
  await tree.locator('[data-cell="0"]').click();
  await selbar.getByRole('button', { name: '+ Pointer' }).click();
  await expect(page.getByRole('group', { name: 'Pointer i at node 3' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('group', { name: 'Pointer i at node 20' })).toBeVisible();

  // 刪掉 20 的子樹，指標留在原地；根節點不能刪
  await tree.locator('[data-cell="2"]').click();
  await selbar.getByRole('button', { name: 'Delete this subtree' }).click();
  await expect(tree).toHaveAccessibleName('Binary tree root: [3,9,null,null,8]');
  await expect(page.getByRole('group', { name: 'Pointer i', exact: true })).toBeVisible();
  await tree.locator('[data-cell="0"]').click();
  await expect(selbar.getByRole('button', { name: 'Delete this subtree' })).toBeDisabled();

  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Binary tree root: [3,9,null,null,8]' })).toBeVisible();
});

test('sets up a whole scene from a template, and turns text into a heading', async ({ page }) => {
  await page.goto('./');
  const templates = page.getByRole('region', { name: 'Templates' });
  await templates.getByRole('button', { name: /^Reverse linked list/ }).click();
  await expect(page.getByRole('group', { name: 'Linked list head: 1 → 2 → 3 → 4 → 5' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Pointer curr at index 0' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Pointer next at index 1' })).toBeVisible();
  // prev 一開始是 None，不吸附在節點上
  await expect(page.getByRole('group', { name: 'Pointer prev', exact: true })).toBeVisible();
  // 整組一起選取，可以直接拖動或刪除
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await expect(selbar).toContainText('4 selected');

  await templates.getByRole('button', { name: /^Grid BFS/ }).click();
  await expect(page.getByRole('group', { name: /^2D array grid/ })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Queue queue/ })).toBeVisible();
  await expect(selbar).toContainText('3 selected');

  // 元件庫只有「文字」，選取後切換成標題
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await selbar.getByRole('button', { name: 'Make heading' }).click();
  await expect(page.getByRole('group', { name: /^Heading:/ })).toBeVisible();
  await selbar.getByRole('button', { name: 'Make body text' }).click();
  await expect(page.getByRole('group', { name: /^Text:/ })).toBeVisible();
});

test('frames the range between two pointers and keeps it in step as they move', async ({ page }) => {
  await page.goto('./');
  const templates = page.getByRole('region', { name: 'Templates' });
  await templates.getByRole('button', { name: /^Two pointers/ }).click();

  // 選兩個指標，按「框住兩個指標之間」
  await page.getByRole('group', { name: 'Pointer l at index 0' }).click();
  await page.getByRole('group', { name: 'Pointer r at index 5' }).click({ modifiers: ['Shift'] });
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('button', { name: 'Frame between pointers' }).click();
  const frame = page.locator('.board-range');
  await expect(frame).toHaveCount(1);
  const width = async () => Number(await frame.getAttribute('width'));
  const full = await width();

  // r 往左移兩格，框跟著變窄
  await page.getByRole('group', { name: 'Pointer r at index 5' }).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('group', { name: 'Pointer r at index 3' })).toBeVisible();
  expect(await width()).toBe(full - 2 * 44);

  // 刪掉指標，框也一起刪
  await page.keyboard.press('Delete');
  await expect(frame).toHaveCount(0);

  // 滑動視窗模板一開始就有範圍框
  await templates.getByRole('button', { name: /^Sliding window/ }).click();
  await expect(frame).toHaveCount(1);
});

test('builds a graph from an edge list, connects nodes, and marks an edge', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  const graph = page.getByRole('group', { name: /^Graph graph/ });
  await expect(graph).toHaveAccessibleName('Graph graph: n = 4, edges = [[0,1],[0,2],[1,3]]');

  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('n = 5, edges = [[0,1],[0,2],[1,3],[2,4]]');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(graph).toHaveAccessibleName('Graph graph: n = 5, edges = [[0,1],[0,2],[1,3],[2,4]]');
  await selbar.getByRole('button', { name: 'Make directed' }).click();
  await expect(graph).toHaveAccessibleName(/^Graph graph \(directed\)/);

  // 點最上面的節點 0，用 ← 繞到節點 3（手機上下方的選取列會擋住下面的節點），再連到 4
  await graph.locator('[data-cell="0"]').click();
  await expect(selbar).toContainText('Node 0');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(selbar).toContainText('Node 3');
  await selbar.getByRole('combobox', { name: 'Connect to…' }).selectOption('4');
  await expect(graph).toHaveAccessibleName(/\[3,4\]\]$/);

  // 點第一條邊：標記走過、寫權重
  await graph.locator('[data-edge="0"]').click();
  await expect(selbar).toContainText('Edge 0 → 1');
  await selbar.getByRole('button', { name: 'Mark as visited' }).click();
  await expect(graph.locator('g[data-marked]')).toHaveCount(1);
  const weight = selbar.getByRole('textbox', { name: 'Weight' });
  await weight.fill('4');
  await weight.press('Enter');
  await expect(graph).toHaveAccessibleName(/\[0,1,4\]/);
  await selbar.getByRole('button', { name: 'Delete this edge' }).click();
  await expect(graph).toHaveAccessibleName('Graph graph (directed): n = 5, edges = [[0,2],[1,3],[2,4],[3,4]]');
});

test('fills an array and a dict by pasting a problem’s example', async ({ page }) => {
  await page.goto('./');
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  const build = async (text: string) => {
    await selbar.getByRole('button', { name: 'Build from text' }).click();
    const input = selbar.getByRole('textbox', { name: 'Build from text' });
    await input.fill(text);
    await selbar.getByRole('button', { name: 'Apply' }).click();
  };

  // 貼 LeetCode 範例：取第一個陣列，名稱也改成 nums
  await page.getByRole('button', { name: 'Array', exact: true }).click();
  await build('nums = [2,7,11,15], target = 9');
  await expect(page.getByRole('group', { name: 'Array nums: 2, 7, 11, 15' })).toBeVisible();

  // 字串拆成一格一格
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await build('"abc"');
  await expect(page.getByRole('group', { name: 'Queue queue: a, b, c' })).toBeVisible();

  // 字典用 Python 的寫法
  await page.getByRole('button', { name: 'Dict', exact: true }).click();
  await build("seen = {'a': 0, 'b': 1}");
  await expect(page.getByRole('group', { name: 'Dict seen: a 0; b 1' })).toBeVisible();
});

test('pushes and pops a heap, records each swap, and fixes a broken order', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Heap', exact: true }).click();
  const heap = page.getByRole('group', { name: /^Heap heap/ });
  await expect(heap).toHaveAccessibleName('Heap heap (min-heap): 1, 3, 2, 7, 4');
  // 樹和陣列畫的是同一份資料
  await expect(heap.locator('.board-tree-node')).toHaveCount(5);
  await expect(heap.locator('.board-heap-array .board-cell')).toHaveCount(5);

  // 記錄每一步：push 0 會往上換兩次，總共三步
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('checkbox', { name: 'Record each step for playback' }).check();
  await selbar.getByRole('textbox', { name: 'Value to push' }).fill('0');
  await selbar.getByRole('button', { name: 'Push', exact: true }).click();
  await expect(heap).toHaveAccessibleName('Heap heap (min-heap): 0, 3, 1, 7, 4, 2');
  await expect(page.getByRole('button', { name: 'Play all 3 steps from the start' })).toBeVisible();

  await selbar.getByRole('button', { name: 'Pop', exact: true }).click();
  await expect(page.getByText('Popped 0')).toBeVisible();
  await expect(heap).toHaveAccessibleName('Heap heap (min-heap): 1, 3, 2, 7, 4');

  // 換成最大堆積：順序不對的節點變紅，Heapify 一次修好
  await expect(selbar.getByRole('button', { name: 'Heapify' })).toBeDisabled();
  await selbar.getByRole('button', { name: 'Make max-heap' }).click();
  await expect(heap).toHaveAccessibleName(/^Heap heap \(max-heap\)/);
  await expect(heap.locator('.board-heap-bad')).not.toHaveCount(0);
  await selbar.getByRole('button', { name: 'Heapify' }).click();
  await expect(heap).toHaveAccessibleName('Heap heap (max-heap): 7, 4, 2, 3, 1');
  await expect(heap.locator('.board-heap-bad')).toHaveCount(0);

  // 切換顯示：只看陣列，再只看樹
  await selbar.getByRole('button', { name: 'Show: tree + array' }).click();
  await expect(heap.locator('.board-tree-node')).toHaveCount(0);
  await selbar.getByRole('button', { name: 'Show: array' }).click();
  await expect(heap.locator('.board-heap-array')).toHaveCount(0);
  await expect(selbar.getByRole('button', { name: 'Show: tree' })).toBeVisible();
});

test('traces a recursion tree: returns, pruning, child calls, and a pointer walking in call order', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Recursion tree', exact: true }).click();
  const tree = page.getByRole('group', { name: /^Recursion tree fib/ });
  await expect(tree).toHaveAccessibleName('Recursion tree fib: f(4) (f(3) (f(2) (f(1), f(0)), f(1)), f(2) (f(1), f(0)))');
  // 重複的呼叫標同一個顏色：f(2) 兩次、f(1) 三次
  await expect(tree.locator('.board-rec-node[data-color="yellow"]')).toHaveCount(2);
  await expect(tree.locator('.board-rec-node[data-color="blue"]')).toHaveCount(3);

  // 點右邊的 f(2)：寫回傳值、剪掉這枝、加一個子呼叫
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await tree.locator('[data-cell="6"]').click();
  await expect(selbar).toContainText('Node f(2)');
  const ret = selbar.getByRole('textbox', { name: 'Returns' });
  await ret.fill('1');
  await ret.press('Enter');
  await selbar.getByRole('button', { name: 'Prune here' }).click();
  await expect(tree).toHaveAccessibleName(/, f\(2\) = 1 ✕ \(f\(1\), f\(0\)\)\)$/);
  await expect(tree.locator('.board-rec-node[data-pruned]')).toHaveCount(3);
  await selbar.getByRole('button', { name: '+ Child call' }).click();
  await page.getByRole('textbox', { name: 'Call 9' }).fill('f(-1)');
  await page.keyboard.press('Enter');
  await expect(tree).toHaveAccessibleName(/f\(2\) = 1 ✕ \(f\(1\), f\(0\), f\(-1\)\)\)$/);

  // 指標照呼叫的順序走：f(4) → f(3) → f(2)，↑ 回到呼叫者
  await tree.locator('[data-cell="0"]').click();
  await selbar.getByRole('button', { name: '+ Pointer' }).click();
  const pointer = page.getByRole('group', { name: /^Pointer i/ });
  await expect(pointer).toHaveAccessibleName('Pointer i at node f(4)');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(pointer).toHaveAccessibleName('Pointer i at node f(2)');
  await selbar.getByRole('button', { name: 'Back to caller' }).click();
  await expect(pointer).toHaveAccessibleName('Pointer i at node f(3)');

  // 用縮排的文字整個換掉；指標還指得到就留著
  // 前面選了最下面的呼叫，畫面往上挪過；先顯示全部，再點名稱選整棵樹
  await page.getByRole('button', { name: 'Show everything (0)' }).click();
  await tree.locator('.board-label').click();
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('f(2) => 1\n  f(1) => 1\n  f(0) => 0');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(tree).toHaveAccessibleName('Recursion tree fib: f(2) = 1 (f(1) = 1, f(0) = 0)');
  await expect(pointer).toHaveAccessibleName('Pointer i at node f(1)');
  await selbar.getByRole('button', { name: 'Stop coloring repeats' }).click();
  await expect(selbar.getByRole('button', { name: 'Color repeated calls' })).toBeVisible();
});

test('fills a DP table cell by cell with arrows, and builds one from the problem’s input', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'DP table', exact: true }).click();
  const table = page.getByRole('group', { name: /^DP table dp/ });
  await expect(table).toHaveAccessibleName('DP table dp (filling dp[1][1]): 0 0 0 0; 0 · · ·; 0 · · ·; 0 · · ·; 0 · · ·; 0 · · ·');
  // LCS：dp[1][1] 從上、左、左上三格算來
  await expect(table.locator('.board-dp-arrow')).toHaveCount(3);

  // 輸入值按 Enter：填進去並跳到下一格，每一格記成一步
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('checkbox', { name: 'Record each filled cell' }).check();
  const value = selbar.getByRole('textbox', { name: 'Value' });
  await value.fill('1');
  await value.press('Enter');
  await value.fill('1');
  await value.press('Enter');
  await expect(table).toHaveAccessibleName(/^DP table dp \(filling dp\[1\]\[3\]\): 0 0 0 0; 0 1 1 ·;/);
  await expect(page.getByRole('button', { name: 'Play all 2 steps from the start' })).toBeVisible();

  // 點一格、用方向鍵移動；換成只看上和左
  await table.locator('[data-cell="11"]').click();
  await expect(table).toHaveAccessibleName(/\(filling dp\[2\]\[3\]\)/);
  await page.keyboard.press('ArrowLeft');
  await expect(table).toHaveAccessibleName(/\(filling dp\[2\]\[2\]\)/);
  await selbar.getByRole('combobox', { name: 'Depends on' }).selectOption('upLeft');
  await expect(table.locator('.board-dp-arrow')).toHaveCount(2);

  // 直接貼題目的輸入：硬幣 [1,2,5]、金額 6，dp[6] 從 dp[5]、dp[4]、dp[1] 算來
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('coins = [1,2,5], amount = 6');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(table).toHaveAccessibleName('DP table dp (filling dp[0]): · · · · · · ·');
  await expect(selbar.getByRole('textbox', { name: 'Steps back' })).toHaveValue('1, 2, 5');
  await table.locator('[data-cell="6"]').click();
  await expect(table.locator('.board-dp-arrow')).toHaveCount(3);
});

test('lines up intervals, merges after sorting, and sweeps to count the meeting rooms', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Intervals', exact: true }).click();
  const line = page.getByRole('group', { name: /^Intervals intervals/ });
  await expect(line).toHaveAccessibleName('Intervals intervals: [1,3], [2,6], [8,10], [15,18]');

  // 點第一列，和下一列合併
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await line.locator('[data-cell="0"]').click();
  await expect(selbar).toContainText('[1,3]');
  await selbar.getByRole('button', { name: 'Merge with next' }).click();
  await expect(line).toHaveAccessibleName('Intervals intervals: [1,6], [8,10], [15,18]');
  await expect(selbar.getByRole('button', { name: 'Merge with next' })).toBeDisabled();

  // 換成會議室的例子，排序後用掃描線數同時進行的會議
  await line.locator('.board-label').click();
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('intervals = [[0,30],[15,20],[5,10]]');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await selbar.getByRole('button', { name: 'Sort by start' }).click();
  await expect(line).toHaveAccessibleName('Intervals intervals: [0,30], [5,10], [15,20]');
  await selbar.getByRole('button', { name: 'Sweep line' }).click();
  await expect(line).toHaveAccessibleName(/^Intervals intervals \(t = 0: 1 active\)/);
  await selbar.getByRole('button', { name: 'Next point' }).click();
  await expect(line).toHaveAccessibleName(/\(t = 5: 2 active\)/);
  await page.keyboard.press('ArrowRight');
  await expect(line).toHaveAccessibleName(/\(t = 10: 1 active\)/);

  // 標成移除的不算進行中
  await line.locator('[data-cell="0"]').click();
  await selbar.getByRole('button', { name: 'Mark removed' }).click();
  await expect(line).toHaveAccessibleName('Intervals intervals (t = 10: 0 active): [0,30] ✕, [5,10], [15,20]');
});

test('traces code line by line and records each line for playback', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  const code = page.getByRole('group', { name: /^Code/ });
  await code.dblclick();
  await page.getByRole('textbox', { name: 'Code' }).fill('total = 0\nfor x in nums:\n\n    total += x\nreturn total');
  await page.keyboard.press('Escape');

  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('button', { name: 'Trace line by line' }).click();
  await expect(code).toHaveAccessibleName(/^Code \(Line 1\)/);
  await selbar.getByRole('checkbox', { name: 'Record each line' }).check();

  // ↓ 走到下一行，空白行跳過；點一行直接走到那裡
  await page.keyboard.press('ArrowDown');
  await expect(code).toHaveAccessibleName(/^Code \(Line 2\)/);
  await page.keyboard.press('ArrowDown');
  await expect(code).toHaveAccessibleName(/^Code \(Line 4\)/);
  await code.locator('[data-cell="4"]').click();
  await expect(code).toHaveAccessibleName(/^Code \(Line 5\)/);
  await expect(code.locator('[data-current]')).toHaveText(/return total/);

  // 每走一步都記下了走之前那一行
  await page.getByRole('button', { name: 'Play all 3 steps from the start' }).click();
  await expect(code).toHaveAccessibleName(/^Code \(Line 1\)/);
  await page.keyboard.press('ArrowRight');
  await expect(code).toHaveAccessibleName(/^Code \(Line 2\)/);
  await page.keyboard.press('Escape');

  await code.click();
  await selbar.getByRole('button', { name: 'Stop tracing' }).click();
  await expect(code).toHaveAccessibleName(/^Code: total = 0/);
});

test('types code like an editor: Python colors, indentation after a colon, and Shift+Tab', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  const code = page.getByRole('group', { name: /^Code/ });
  // 預設是 LeetCode 的 class Solution 範本，關鍵字上色
  await expect(code.locator('.tok-keyword', { hasText: 'class' })).toBeVisible();
  await expect(code.locator('.tok-function', { hasText: 'solve' })).toBeVisible();

  await code.dblclick();
  const area = page.getByRole('textbox', { name: 'Code' });
  await area.fill('');
  await page.keyboard.type('for x in nums:');
  await page.keyboard.press('Enter');
  await page.keyboard.type('total += x');
  await expect(area).toHaveValue('for x in nums:\n    total += x');
  await page.keyboard.press('Shift+Tab');
  await expect(area).toHaveValue('for x in nums:\ntotal += x');
  await page.keyboard.press('Escape');
  await expect(area).toBeHidden();
  await expect(code).toHaveAccessibleName(/^Code: for x in nums:\s+total \+= x$/);
  await expect(code.locator('.board-code-no')).toHaveText(['1', '2']);
});

test('picks tree nodes level by level and adds a child from the canvas, even on a phone', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Binary tree', exact: true }).click();
  const tree = page.getByRole('group', { name: /^Binary tree root/ });
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('[3,9,20,4,5,15,7]');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(tree).toHaveAccessibleName('Binary tree root: [3,9,20,4,5,15,7]');

  const viewport = page.viewportSize()!;
  /** 整個露在畫面裡，而且沒被選取列擋住 */
  const expectReachable = async (locator: ReturnType<typeof page.locator>) => {
    const box = (await locator.boundingBox())!;
    const bar = (await selbar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    const overlaps = box.y < bar.y + bar.height && bar.y < box.y + box.height && box.x < bar.x + bar.width && bar.x < box.x + box.width;
    expect(overlaps).toBe(false);
  };

  // 一層一層往下選：選到的節點，它的子節點都會露出來，點得到
  await tree.locator('[data-cell="0"]').click();
  await expect(selbar).toContainText('Node 3');
  await expectReachable(tree.locator('[data-cell="1"]'));
  await expectReachable(tree.locator('[data-cell="2"]'));
  await tree.locator('[data-cell="2"]').click();
  await expect(selbar).toContainText('Node 20');
  await expectReachable(tree.locator('[data-cell="5"]'));
  await expectReachable(tree.locator('[data-cell="6"]'));

  // 最下面一層的 15：加子節點的按鈕排在最前面，畫布上的「+」也點得到
  await tree.locator('[data-cell="5"]').click();
  await expect(selbar).toContainText('Node 15');
  await expect(selbar.getByRole('button').first()).toHaveAccessibleName('+ Left child');
  const slot = tree.getByRole('button', { name: '+ Right child' });
  await expectReachable(slot);
  await slot.click();
  await page.getByRole('textbox', { name: 'Tree position 12' }).fill('1');
  await page.keyboard.press('Enter');
  await expect(tree).toHaveAccessibleName('Binary tree root: [3,9,20,4,5,15,7,null,null,null,null,null,1]');
});

test('after adding a node and typing its value, clicking another node selects it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Binary tree', exact: true }).click();
  const tree = page.getByRole('group', { name: /^Binary tree root/ });
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });

  // 選 2，加左子節點，輸入值，不按 Enter 直接點另一個節點
  await tree.locator('[data-cell="1"]').click();
  await selbar.getByRole('button', { name: '+ Left child' }).click();
  const input = page.getByRole('textbox', { name: 'Tree position 3' });
  await expect(input).toBeFocused();
  await input.fill('4');
  await tree.locator('[data-cell="2"]').click();

  // 結束輸入、選到 3，值有留下來；接著可以直接幫 3 加子節點
  await expect(page.getByRole('textbox', { name: /^Tree position/ })).toHaveCount(0);
  await expect(selbar).toContainText('Node 3');
  await expect(tree).toHaveAccessibleName('Binary tree root: [1,2,3,4]');
  await selbar.getByRole('button', { name: '+ Right child' }).click();
  await page.getByRole('textbox', { name: 'Tree position 6' }).fill('7');
  await page.keyboard.press('Enter');
  await expect(tree).toHaveAccessibleName('Binary tree root: [1,2,3,4,null,null,7]');

  // 點正在輸入的那一格，還是繼續輸入
  await tree.locator('[data-cell="0"]').dblclick();
  const root = page.getByRole('textbox', { name: 'Tree position 0' });
  await root.click();
  await expect(root).toBeFocused();
});

test('keeps the selection toolbar off the steps buttons on a narrow desktop', async ({ page, isMobile }) => {
  // 手機上選取列在下面，本來就不會碰到
  test.skip(isMobile, 'desktop layout only');
  const apart = async () => {
    const steps = (await page.getByRole('group', { name: 'Steps' }).boundingBox())!;
    const bar = (await page.getByRole('toolbar', { name: 'Selected element' }).boundingBox())!;
    expect(bar.x >= steps.x + steps.width || bar.y >= steps.y + steps.height).toBe(true);
    // 被蓋住的話這一下會點到選取列
    await page.getByRole('button', { name: /^Save the current board/ }).click({ trial: true });
  };
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('./');
  await page.getByRole('button', { name: /^Tree DFS/ }).click();
  await page.keyboard.press('Escape');
  // 選一個樹節點：選取列很寬，以前置中時會蓋住左上角的「記一步」
  await page.locator('.board-tree-node').first().click();
  await apart();
  // 再窄一點，選取列換行，還是在右邊
  await page.setViewportSize({ width: 860, height: 800 });
  await apart();
});

test('flips, shifts, and clears bits, and reads LeetCode’s 32-bit input', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Bits', exact: true }).click();
  const bits = page.getByRole('group', { name: /^Bits n/ });
  await expect(bits).toHaveAccessibleName('Bits n = 11 (3 ones): 00001011');
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });

  // n & (n-1) 每次清掉最低位的 1
  await selbar.getByRole('button', { name: 'n & (n-1)' }).click();
  await expect(bits).toHaveAccessibleName('Bits n = 10 (2 ones): 00001010');
  await selbar.getByRole('button', { name: 'Shift left << 1' }).click();
  await expect(bits).toHaveAccessibleName('Bits n = 20 (2 ones): 00010100');

  // 點一格，翻轉那一位（第 7 位是最左邊那格）
  await bits.locator('[data-cell="0"]').click();
  await expect(selbar.getByText('Bit 7')).toBeVisible();
  await selbar.getByRole('button', { name: 'Flip this bit' }).click();
  await expect(bits).toHaveAccessibleName('Bits n = 148 (3 ones): 10010100');

  // 用文字建立：LeetCode 191 的 32 位寫法
  // 點索引那一列（不是格子）改選整排；手機上元件比畫面寬，名稱可能在畫面外
  await bits.locator('.board-indices span').nth(4).click();
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('n = 00000000000000000000000010000000');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(bits).toHaveAccessibleName(/^Bits n = 128 \(1 one\): 0{24}10{7}$/);
});

test('merges a Union-Find from edges, finds with path compression, and unions by rank', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Union-Find', exact: true }).click();
  const uf = page.getByRole('group', { name: /^Union-Find uf/ });
  await expect(uf).toHaveAccessibleName('Union-Find uf (3 sets): parent = [0,0,1,3,4]');
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });

  // 貼題目的邊，照順序合併
  await selbar.getByRole('button', { name: 'Build from text' }).click();
  await selbar.getByRole('textbox', { name: 'Build from text' }).fill('n = 6, edges = [[0,1],[1,2],[3,4]]');
  await selbar.getByRole('button', { name: 'Apply' }).click();
  await expect(uf).toHaveAccessibleName('Union-Find uf (3 sets): parent = [0,0,0,3,3,5]');

  // 點節點 4，跟 2 合併，每一步記下來
  await uf.locator('.board-uf-node[data-cell="4"]').click();
  await expect(selbar.getByText('Node 4 (root 3)')).toBeVisible();
  await selbar.getByRole('checkbox', { name: 'Record each step for playback' }).check();
  // 2 的根（0）接到 4 的根（3）底下
  await selbar.getByRole('combobox', { name: 'Union(4, …)' }).selectOption('2');
  await expect(uf).toHaveAccessibleName('Union-Find uf (2 sets): parent = [3,0,0,3,3,5]');
  // find(4)、find(2) 都只有一步（不用壓縮），再加上接起來那一步
  await expect(page.getByRole('button', { name: 'Play all 3 steps from the start' })).toBeVisible();

  // 已經同一組：跳出提示
  await selbar.getByRole('combobox', { name: 'Union(4, …)' }).selectOption('1');
  await expect(page.getByText('4 and 1 are already in the same set')).toBeVisible();
  // 找 1 的根時順便把 1 壓縮到根底下
  await expect(uf).toHaveAccessibleName('Union-Find uf (2 sets): parent = [3,3,0,3,3,5]');

  // Find(2) 走 2 → 0 → 3，路徑壓縮把 2 直接接到根
  await uf.locator('.board-uf-node[data-cell="2"]').click();
  await selbar.getByRole('button', { name: 'Find(2)' }).click();
  await expect(uf).toHaveAccessibleName('Union-Find uf (2 sets): parent = [3,3,3,3,3,5]');

  // Union by rank 多一列 rank（從樹的高度算起）
  await uf.locator('.board-uf-indices span').nth(3).click();
  await selbar.getByRole('button', { name: 'Union by rank' }).click();
  await expect(uf).toHaveAccessibleName('Union-Find uf (2 sets): parent = [3,3,3,3,3,5], rank = [0,0,0,1,0,0]');
  await expect(uf.locator('.board-uf-row')).toHaveCount(2);
});

test('inserts and searches words in a trie, step by step', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Trie', exact: true }).click();
  const trie = page.getByRole('group', { name: /^Trie trie/ });
  await expect(trie).toHaveAccessibleName('Trie trie: app, apple, apt, bat');
  await expect(trie.locator('.board-trie-node')).toHaveCount(10);
  const selbar = page.getByRole('toolbar', { name: 'Selected element' });

  // insert 先沿著 b、ba 走，再長出 d：記成三步
  await selbar.getByRole('checkbox', { name: 'Record each step for playback' }).check();
  await selbar.getByRole('textbox', { name: 'Word' }).fill('bad');
  await selbar.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(trie).toHaveAccessibleName('Trie trie (search("bad"): found): app, apple, apt, bat, bad');
  await expect(trie.locator('.board-trie-node')).toHaveCount(11);
  await expect(page.getByRole('button', { name: 'Play all 3 steps from the start' })).toBeVisible();

  // 只是前綴、找不到
  await selbar.getByRole('textbox', { name: 'Word' }).fill('ap');
  await selbar.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(trie.getByText('search("ap"): prefix only')).toBeVisible();
  await selbar.getByRole('textbox', { name: 'Word' }).fill('apx');
  await selbar.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(trie.getByText('search("apx"): not found')).toBeVisible();
  await expect(trie.locator('.board-trie-node[data-path]')).toHaveCount(3);

  // 點字的結尾，把這個字拿掉
  await trie.locator('.board-trie-node[title="Prefix apt"]').click();
  await selbar.getByRole('button', { name: 'Remove "apt"' }).click();
  await expect(trie).toHaveAccessibleName(/: app, apple, bat, bad$/);
});

test('pastes a whole example and draws every argument at once', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Paste example/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Paste a problem’s example' });
  const box = dialog.getByRole('textbox', { name: 'Problem example' });

  // 看不懂的留在對話框裡說明原因
  await box.fill('nums = [1, 2');
  await dialog.getByRole('button', { name: 'Draw it' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Couldn’t read that. See the example in the box.');

  // 從題目整段複製：Input 和 Output 都在
  await box.fill('Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]');
  await dialog.getByRole('button', { name: 'Draw it' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('group', { name: 'Array nums: 2, 7, 11, 15' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Variable target = 9' })).toBeVisible();
  // 整組選取，可以直接拖走
  await expect(page.getByRole('toolbar', { name: 'Selected element' })).toContainText('2 selected');

  // 圖：n 併進圖裡
  await page.getByRole('button', { name: /^Paste example/ }).click();
  await box.fill('n = 4, edges = [[0,1],[1,2],[2,3]]');
  await box.press('Control+Enter');
  await expect(page.getByRole('group', { name: /^Graph edges: n = 4, edges = \[\[0,1\],\[1,2\],\[2,3\]\]/ })).toBeVisible();
});

test('switches between light and dark from the top right, and remembers the choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  // 網站的標題列只放「DSA Whiteboard」，沒有上面那行小字
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DSA Whiteboard');
  await expect(page.locator('.board-caption')).toHaveCount(0);
  const html = page.locator('html');
  const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await paper();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect.poll(paper).not.toBe(light);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0e1829');

  // 重新整理還是深色：在畫面出來前就套上，不會先閃一下淺色
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect.poll(paper).toBe(light);
});
