# DSA Whiteboard

A whiteboard for data structures and algorithms, built from scratch in React and TypeScript.

**Try it:** https://lego514.github.io/dsa-whiteboard/ (no sign-up; the board is saved in your browser)

Drag arrays, pointers, stacks, queues, dicts, sets, 2D arrays, variables, binary trees, linked lists, graphs, heaps, recursion trees, DP tables, intervals, tables, text, code, and sticky notes onto a pannable, zoomable canvas to trace an idea by hand.

Built for working through LeetCode-style problems by hand: sliding windows, linked list reversal, tree and graph traversals, heaps, backtracking, DP tables, and intervals. It started as the whiteboard in [LeetCode Coach](https://github.com/Lego514/leetcode-coach), which still uses it as a package.

## Features

- **Range frames** box the cells between two pointers on the same array and follow them as they move, for sliding windows: select the two pointers and choose "Frame between pointers".
- **Templates** set up a common scene in one click, with the pointers already named: two pointers, sliding window, reversing a linked list, tree DFS, grid BFS, and backtracking (the subsets decision tree with `path` and a `cur` pointer). The whole group is placed in free space and selected so it can be dragged at once.
- The palette is grouped by how often problems use each element, with line icons. Text switches to a heading from the selection bar.
- **Pointers** snap to array cells, step with the arrow keys, and are colored by name (i, j, k, l).
- **Single cells** can be selected one at a time to highlight them, put a pointer on them, insert next to them, or delete them. Pointers and highlights follow their values when cells move. A dashed "+" adds cells, rows, and columns.
- **Linked lists** are one element:
  - Each link between two nodes cycles between forward, reversed, and cut with a click, so reversing a list can be traced link by link.
  - The tail can point back to any node to show a cycle.
  - Pointers such as prev, curr, and next snap under nodes.
- **Binary trees** lay themselves out in order, so a binary search tree reads sorted from left to right.
  - Pick a node to add a left or right child from a dashed slot, color it, or delete its subtree.
  - Pointers sit above nodes and move to a child or the parent with the arrow keys.
  - Up to six levels.
- **Graphs** lay their nodes out on a circle.
  - Directed graphs get arrowheads, and opposite edges between the same two nodes curve apart.
  - Edges can carry weights and be marked as visited.
  - Pick a node to connect it to another, color it, add a pointer, or delete it. Pick an edge to mark it, weigh it, or delete it.
  - Up to 20 nodes and 60 edges.
- **Heaps** draw the same values as a tree and as an array with indices, or either one alone.
  - Push and Pop sift values into place by the heap rules; "Record each step for playback" saves every swap as a step, captioned like `swap 0 ↔ 2`.
  - Switch between a min-heap and a max-heap. Nodes that break the order turn red, and Heapify fixes them all at once.
  - Values compare as numbers when they are numbers. Up to 31 values (five levels).
- **Recursion trees** draw one node per call, laid out top-down so each caller sits over its calls, for backtracking, memoized DP, and tries.
  - Pick a call to add a child call, write its return value or the choice on the edge above it, or prune the branch (drawn dashed and faded).
  - "Color repeated calls" gives calls with the same label the same color, which shows what memoization would save.
  - A pointer steps through the calls in DFS order with ← →, and back to the caller with ↑, so a trace can be recorded step by step.
  - Up to 63 calls and eight levels.
- **DP tables** fill one cell at a time, 1D (`dp[i]`) or 2D (`dp[i][j]`), with the strings or numbers from the problem written beside the rows and columns.
  - Choose what each cell depends on (`dp[i-1], dp[i-2]`, every earlier `dp[j]`, `dp[i-k]` for coins, up/left/diagonal, or `dp[i+1][j-1]` filled from the bottom row for palindromes). The cell being filled then shows arrows from those cells, as arcs under a 1D table.
  - Type the value in the selection bar and press Enter to move to the next empty cell. With "Record each filled cell" on, every cell becomes a playback step captioned like `dp[2][3] = 2`, so the whole fill order can be replayed.
  - Up to 26 rows and 30 columns.
- **Intervals** sit on one number line with round ticks, one row per interval, so overlaps line up, for Merge Intervals, Insert Interval, Meeting Rooms, and the like.
  - "Sort by start" is the first step of merging. Pick an interval to change its start or end, merge it with the next row when they overlap (touching ends count), mark it removed (dashed), or color it.
  - The sweep line stops at each start and end point and shows how many intervals are in progress there, counting starts but not ends, so its peak is the answer to Meeting Rooms II.
  - Up to 30 intervals.
- **Code boxes** look and type like LeetCode's editor: a `Python3` header, line numbers, and Python colors in VS Code's light and dark themes, with no wrapping and the box sized to the code. New boxes start from a `class Solution:` template.
  - While editing, the colors stay on screen: a transparent text box sits exactly over the highlighted code. Tab and Shift+Tab indent and outdent, Enter keeps the indentation (one more level after a colon), and Backspace in the indentation removes a level.
- **Code tracing** turns a code box into a dry run, the Test step of an interview.
  - "Trace line by line" highlights the line running. Move with ↑ ↓ or by clicking a line; blank lines are skipped.
  - With "Record each line" on, every move first saves the board as a step with the line that just ran highlighted. Update the variables and arrays beside it as you go, and playback replays the whole run, with room for a one-line note per step.
- **Build from text**: arrays, stacks, queues, heaps, sets, dicts, 2D arrays, linked lists, trees, graphs, recursion trees, DP tables, and intervals can all be filled by pasting a problem's example instead of typing cell by cell:
  - `nums = [2,7,11,15], target = 9` takes the first value and renames the element `nums`
  - `"abcabcbb"` splits into characters
  - `{'a': 1}` or JSON for dicts, and `[[1,0],[0,1]]` for grids
  - `1->2->3` and `head = [...]` for linked lists, and LeetCode's level order `[3,9,20,null,null,15,7]` for trees
  - `n = 5, edges = [[0,1],[0,2]]` (with optional weights) or an adjacency list (0- or 1-based) for graphs
  - an indented outline for recursion trees, one call per line, such as `f(3) => 2` with `n-1 | f(2)` underneath (`|` puts a label on the edge, `=>` adds a return value); the output of the `tree` command also works
  - the problem's own input for DP tables: `text1 = "abcde", text2 = "ace"` makes a 6×4 table with the letters beside it, `m = 3, n = 7` a 3×7 grid, `n = 5` six cells, `coins = [1,2,5], amount = 11` twelve cells that look back 1, 2, and 5, and `s = "226"` or `nums = [...]` a row labeled with the characters or numbers
  - `intervals = [[1,3],[2,6]]` for intervals; a `newInterval = [4,8]` is added in yellow, and an employee `schedule` gets one color per person
- **Other tools**:
  - rectangle and ellipse frames, which draw on top but stay click-through except their outline
  - arrows and plain lines (for undirected edges) that follow the elements they connect
  - a pen, an eraser, and five colors
  - undo/redo and clear canvas
- **Box selection**: drag across empty space to select everything inside, then move, duplicate, delete, or recolor it together. Copies keep pointers on their copied arrays and rewire arrows to the copied elements.
- **Step playback**: "Record step" saves a snapshot of the board with an optional one-line note (writing it in English doubles as explanation practice). Playback steps through the snapshots with the arrow keys or plays them automatically; elements slide from one step to the next. You can continue editing from any step.
- **Export image**: the board, or the step being played, is redrawn from its data as an SVG and saved as a 2× PNG.

The interface is in English and Traditional Chinese.

## Use it in a React app

The package isn't on npm yet. Install it from GitHub at a release tag:

```bash
npm install github:Lego514/dsa-whiteboard#v0.1.1
```

React 19.2 or later and zod 4 are peer dependencies.

```tsx
import { Whiteboard, type BoardDoc } from 'dsa-whiteboard';
import 'dsa-whiteboard/base.css'; // design tokens, buttons, inputs, dialog; skip if your app has its own
import 'dsa-whiteboard/board.css';

export function MyBoard({ initial, save }: { initial?: BoardDoc; save: (doc: BoardDoc) => Promise<void> }) {
  return <Whiteboard title="Two Sum" initial={initial} onSave={save} locale="en" onClose={() => history.back()} />;
}
```

The board takes the whole screen. You own the storage: `onSave` is called about 0.6 s after the last change, and once more on close if something is unsaved.

| Prop | What it does |
| --- | --- |
| `initial` | The board to start from. Change the React `key` to load a different board. |
| `onSave(doc)` | Saves the board; may return a promise. |
| `title`, `caption`, `badge` | The header. `badge` sits next to the title, for example a difficulty tag. |
| `actions` | Extra buttons or links in the header, before Export. |
| `savedLabel` | What the header says once saved, such as "Synced". Defaults to "Saved on this device". |
| `locale` | `'en'` or `'zh-TW'`. |
| `onClose` | Shows a Close button. |
| `exportName` | File name for exported PNGs. |
| `onNotice(message)` | Shows messages (such as a failed export) with your app's toasts instead of the board's own. |
| `explain` | Adds an Explain button that plays the recorded steps. You provide `Session` (shown under the playback bar while explaining) and `Review` (shown over the board when done). LeetCode Coach uses it for spoken explanations with a timer, recording, and transcript. |

`dsa-whiteboard/schema` exports the zod schema for a board (`boardDocSchema`), its types, and the size limit, without React, so a server can validate boards before storing them.

## Develop

```bash
npm install
npm run dev          # the standalone site at http://localhost:5180
npm test             # unit tests (Vitest)
npm run test:e2e     # build the site, then run the Playwright tests (Chromium and iPhone WebKit)
npm run lint
npm run typecheck
npm run build        # the package (dist/) and the site (dist-app/)
```

The first time, run `npx playwright install chromium webkit`.

- `src/lib/`: pure logic with no React: the board model and every edit, layout, Build from text parsers, templates, Python highlighting and editing rules, and SVG export. Most of the unit tests are here.
- `src/components/`: the editor (`Whiteboard.tsx`), element views, and the steps and playback bar.
- `src/schema.ts`: the board format.
- `src/i18n/`: interface text in both languages.
- `src/styles/`: `board.css` for the board, `base.css` for apps without their own styles.
- `app/`: the standalone site deployed to GitHub Pages.

## License

MIT
