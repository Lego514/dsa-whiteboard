# AGENTS.md：給 AI 協作者的交接說明

這份給在這個 repo 工作的 AI（Codex、Claude Code 等）看。先讀完再動手；做了跟這裡衝突的改動，順便更新這份。

## 這是什麼

**DSA Whiteboard**：畫資料結構和演算法的白板，從頭用 React + TypeScript 寫的（沒有用繪圖套件）。同一份程式碼有三種用法：

- **套件**：`dsa-whiteboard`，從 GitHub 的版本 tag 安裝（還沒上 npm）。主要使用者是刷題教練：https://github.com/Lego514/leetcode-coach（本機 `C:\dev\leetCode guide`），那邊也有一份 AGENTS.md。
- **獨立網站**：https://lego514.github.io/dsa-whiteboard/ （`app/`，GitHub Pages）
- **一起編輯的伺服器**：Cloudflare Worker + 每個房間一個 Durable Object（`worker/`），網址 https://dsa-whiteboard-collab.ray1998514.workers.dev

公開、MIT 授權。使用者是正在找工作的 MSCS 學生，這個 repo 也是履歷上的作品。

## 跟使用者合作的方式

- **用繁體中文回覆**；程式碼註解也是繁中，說明「為什麼」。
- **流程**：開分支做 → 自己驗證（測試、改到畫面就截圖）→ 用繁中報告 → **等使用者說「commit 並開 PR」才 commit、push、開 PR**。「合併」＝CI 通過後合併那個 PR，再更新本機 main。不要直接 push 到 main，不要自己合併。
- **commit 訊息**：英文，第一行寫使用者看得到的改變，內文寫為什麼。PR 描述分「What changes」和「Tests」。
- 不要 commit 或貼出秘密；不要代使用者註冊或登入任何服務；改 repo 設定（secrets、variables、Pages）之前先問。

## 指令

```bash
npm install
npm run dev          # 獨立網站 http://localhost:5180
npm test             # 單元測試（Vitest），含 worker/ 的測試
npm run test:e2e     # vite build --mode e2e，再跑 Playwright（Chromium + iPhone WebKit）；會自己用 wrangler dev 開共用伺服器
npm run lint
npm run typecheck    # tsc -b（含 worker 的 tsconfig）
npm run build        # 套件（dist/）和網站（dist-app/）
npm run worker:dev   # 共用伺服器 http://localhost:8787，不用 Cloudflare 帳號
```

本機試一起編輯：`npm run worker:dev`，再在 `.env.local` 放 `VITE_COLLAB_URL=http://localhost:8787` 開網站。

## 架構地圖

```
src/
  lib/          不含 React 的純邏輯：model.ts（白板資料和所有編輯操作、復原紀錄）、版面、
                「從文字建立」的解析、模板、Python 上色、SVG 匯出。大部分單元測試在這。
                後來加的元件各自一個檔：bits.ts、unionFind.ts、trie.ts（共用 forest.ts 的多叉樹排版）
  components/   Whiteboard.tsx（編輯器本體）、BoardElements.tsx（各種元件）、BoardSteps.tsx（步驟播放）、
                ShareControls.tsx（共用的按鈕和房間選單）、StructureActions.tsx（位元、並查集、字典樹的選取列）
  collab/       一起編輯：ops.ts（修改的格式、套用、復原紀錄重算）、client.ts（WebSocket 連線、批次送出、
                重新連線）、useCollab.ts、context.ts、messages.ts（前後端的訊息型別）
  schema.ts     zod 定義的白板格式（dsa-whiteboard/schema）
  constants.ts  不靠 zod 的常數（顏色、大小上限），元件本體只用這個
  i18n/         介面文字，en.ts 和 zh-TW.ts
  styles/       board.css（白板本身）、base.css（沒有自己樣式的網站才需要）
app/            獨立網站（GitHub Pages）
worker/         Cloudflare Worker：index.ts（路由、Durable Object Room）、room.ts（訊息驗證、套用修改）
e2e/            Playwright；collab.spec.ts 用兩個瀏覽器測一起編輯
```

## 一定要守的規則

- **套件的元件本體不能帶進 zod**：`src/index.ts` 只匯出型別和 `constants.ts`，zod 的 schema 放在 `dsa-whiteboard/schema`。之前在入口匯出 schema，讓刷題教練的 bundle 多了 37KB。
- **介面文字只放在 `src/i18n/`**，兩個語言的 key 要一樣（有測試檢查）。
- **純邏輯放 `src/lib/`、寫成純函式並寫單元測試**；元件只負責畫面和事件。
- **`model.ts` 和 `bits.ts`、`unionFind.ts`、`trie.ts` 互相引用**：這些檔案的頂層（常數、`const x = ...`）不能用到 model 的值，只能在函式裡用，不然看誰先載入，會讀到還沒初始化的值。
- **一起編輯的同步規則**：每個元件為單位，伺服器收到的順序決定誰贏（last-write-wins）；自己還沒被確認的修改，不套用別人對同一個元件的修改；復原只退回自己的動作（別人的修改會套進復原紀錄的每個版本）。改這部分要跑 `src/collab/client.test.ts`（模擬網路的收斂測試）。
- **共用伺服器只接受 `wrangler.jsonc` 裡 `ALLOWED_ORIGINS` 列的網址**；新的網站要用共用，就加在這裡。
- 新增的套件釘版本；Playwright 固定在 1.63.0（要跟裝好的瀏覽器版本一樣）。

## 測試

- 純邏輯寫單元測試；畫面流程寫 Playwright（`e2e/board.spec.ts`、`e2e/collab.spec.ts`）。
- `npm run test:e2e` 會先建置；只跑 `npx playwright test` 的話記得先 `npx vite build --mode e2e`，不然測到的是舊版。
- **本機的 iPhone 測試不可信**：這台 Windows 電腦的顯示縮放是 125%，模擬的 iPhone 寬度會變小，固定在畫面上的元素會擋住點擊。iPhone 看 CI（Linux）的結果。
- 截圖確認畫面：用 Playwright 寫個暫時的腳本截圖，用完刪掉。

## CI、部署、發版

- CI（`.github/workflows/ci.yml`）：`check`（lint、typecheck、單元測試、建置、`wrangler deploy --dry-run`）和 `e2e`。
- **網站**：main 有新 commit 就部署到 GitHub Pages（`pages.yml`），建置時讀 repo variable `COLLAB_URL`（已設定）。
- **共用伺服器**：main 上 `worker/`、`src/collab/`、`wrangler.jsonc` 等有改動時，`worker.yml` 用 repo secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`（使用者已設定）部署到 Cloudflare。免費方案。
- **發新版給刷題教練用**：
  1. 在這個 repo 開 PR：功能，加上 `package.json`（和 `package-lock.json`）的版本號、README 安裝指令裡的 tag。
  2. CI 通過、使用者說合併後：`git tag -a vX.Y.Z -m vX.Y.Z`、`git push origin vX.Y.Z`、`gh release create vX.Y.Z`（寫這版的改變）。
  3. 到刷題教練開 PR，把依賴改成新的 tag：`npm install "dsa-whiteboard@github:Lego514/dsa-whiteboard#vX.Y.Z"`。套件安裝時會跑 `prepare` 建出 `dist/`。
- 目前最新版：v0.1.5（桌機上選取列不再蓋住逐步播放）。v0.1.4 加了一起編輯、ShareControls。還沒發佈到 npm：要等使用者建 npm 帳號並在 repo 加 `NPM_TOKEN`。

## 這台電腦的坑（Windows）

- Shell 是 Git Bash / PowerShell。檔案用 LF；Python 寫檔用 `write_bytes` 和 `python -X utf8`。很長的 Bash heredoc 容易壞掉，改用編輯工具寫檔。
- `wrangler dev` 會開好幾層程序（node、workerd），測完要把整串都關掉，不然 8787 會一直被占用。
- 用到的 port：5180（開發）、4180（e2e 的 preview）、8787（wrangler dev）。

## 多個 AI 一起工作

- 動手前先 `git pull` main、看 `gh pr list`，不要改到別人正在改的檔案。
- 一個改動一個分支、一個 PR。Codex 的分支用 `codex/<主題>`，Claude 用 `feature/`、`fix/`、`docs/`。
- 不要在別人的分支上 commit，除非使用者要你接手。

## 待辦（使用者提過、還沒做的）

- 先暫緩（使用者說「先不要」）：N 元樹（當成遞迴樹的變化）、元件庫重新分組。現在每組 6/7/5/4 個，一排 4 個；新元件放進還沒滿兩排的組不會多一排，筆記那組（4 個）再加就會多一排。
- 發佈到 npm（需要使用者的 npm 帳號）。
- 共用房間沒有密碼：拿到連結的人都能編輯。
