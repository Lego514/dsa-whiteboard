import { z } from 'zod';
import { BOARD_COLORS, CELL_COLORS } from './constants';

export * from './constants';

// 白板內容的資料格式。刷題教練存檔、同步前也用這份檢查。

const text = (max: number) => z.string().max(max);


const boardElementId = z.string().regex(/^[a-z0-9]{1,12}$/);
const coord = z.number().min(-1e6).max(1e6);
const cell = text(40);
const boardEnd = z.union([z.object({ id: boardElementId }), z.object({ x: coord, y: coord })]);
const placed = { id: boardElementId, x: coord, y: coord };

/** 白板上的一個元件；陣列、表格這些結構化元件存的是內容，畫面依內容排版 */
export const boardElementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    ...placed,
    variant: z.enum(['heading', 'text', 'code', 'sticky']),
    text: text(2000),
    w: z.number().min(40).max(2000),
    /** 程式碼逐行追蹤：現在跑到第幾行（從 0 數）；沒寫就是沒在追蹤 */
    line: z.number().int().min(0).max(399).optional(),
  }),
  z.object({
    type: z.literal('list'),
    ...placed,
    /** bits 是一排 0/1（位元運算），第一格是最高位 */
    variant: z.enum(['array', 'stack', 'queue', 'set', 'linked', 'heap', 'bits']),
    label: text(40),
    items: z.array(cell).max(64),
    /** 每一格的底色，跟 items 一一對應；沒有上色就沒有這一項 */
    colors: z.array(z.enum(CELL_COLORS).nullable()).max(64).optional(),
    /** 鏈結串列：第 i 個和第 i+1 個節點之間的連線，往後、反過來或斷開；沒寫就全部往後 */
    links: z.array(z.enum(['next', 'prev', 'none'])).max(63).optional(),
    /** 鏈結串列：尾巴接回第幾個節點（有環）；沒寫就是接到 null */
    cycle: z.number().int().min(0).max(63).optional(),
    /** 堆積：最小堆或最大堆（沒寫是最小堆） */
    order: z.enum(['min', 'max']).optional(),
    /** 堆積：只畫陣列或只畫樹；沒寫就兩個都畫 */
    view: z.enum(['array', 'tree']).optional(),
  }),
  z.object({ type: z.literal('table'), ...placed, variant: z.enum(['dict', 'grid', 'table']), label: text(40), rows: z.array(z.array(cell).max(26)).min(1).max(26) }),
  z.object({ type: z.literal('var'), ...placed, name: text(40), value: text(80) }),
  /** 二元樹：依層序存，第 i 個節點的子節點是 2i+1 和 2i+2，null 是沒有節點；最多 6 層 */
  z.object({
    type: z.literal('tree'),
    ...placed,
    label: text(40),
    nodes: z.array(cell.nullable()).min(1).max(63),
    colors: z.array(z.enum(CELL_COLORS).nullable()).max(63).optional(),
  }),
  z.object({ type: z.literal('node'), ...placed, variant: z.enum(['tree', 'list', 'graph']), value: cell }),
  /** 框出重點用的矩形框或圓形框；裡面是空的，不會擋到框住的元件 */
  z.object({
    type: z.literal('shape'),
    ...placed,
    variant: z.enum(['rect', 'ellipse']),
    w: z.number().min(8).max(4000),
    h: z.number().min(8).max(4000),
    color: z.enum(BOARD_COLORS),
  }),
  z.object({
    type: z.literal('pointer'),
    ...placed,
    name: text(12),
    /** 吸附在陣列、鏈結串列的哪一格，或二元樹的哪個節點；有吸附時位置跟著它走 */
    attach: z.object({ id: boardElementId, index: z.number().int().min(0).max(63) }).optional(),
  }),
  z.object({
    type: z.literal('arrow'),
    id: boardElementId,
    from: boardEnd,
    to: boardEnd,
    color: z.enum(BOARD_COLORS),
    /** none 是沒有箭頭的直線（例如無向圖的邊）；沒寫就是有箭頭 */
    head: z.enum(['end', 'none']).optional(),
  }),
  /** 圖：節點自動排成一圈；邊從 a 連到 b（有向時是 a → b），可以有權重、可以標記成走過 */
  z.object({
    type: z.literal('graph'),
    ...placed,
    label: text(40),
    nodes: z.array(cell).min(1).max(20),
    edges: z
      .array(
        z.object({
          a: z.number().int().min(0).max(19),
          b: z.number().int().min(0).max(19),
          w: text(12).optional(),
          mark: z.boolean().optional(),
        }),
      )
      .max(60),
    directed: z.boolean().optional(),
    colors: z.array(z.enum(CELL_COLORS).nullable()).max(20).optional(),
  }),
  /**
   * 遞迴樹（多叉樹）：依呼叫的順序（前序）存，parent 是呼叫它的節點的位置，一定排在自己前面（根節點是 -1）；
   * 同一個父節點的子節點由左到右依位置排
   */
  z.object({
    type: z.literal('recursion'),
    ...placed,
    label: text(40),
    nodes: z
      .array(
        z.object({
          text: cell,
          parent: z.number().int().min(-1).max(62),
          /** 從父節點連下來的邊上寫的字，例如這一步選了哪個數字 */
          edge: text(12).optional(),
          /** 回傳值 */
          ret: text(12).optional(),
          /** 剪枝（或備忘錄直接回傳）：這一枝和底下都畫成淡的 */
          cut: z.boolean().optional(),
          color: z.enum(CELL_COLORS).optional(),
        }),
      )
      .min(1)
      .max(63)
      .refine((nodes) => nodes.every((node, i) => (i === 0 ? node.parent === -1 : node.parent >= 0 && node.parent < i)), 'parents come first'),
    /** 字一樣的呼叫標同一個顏色，看出哪裡重複算 */
    repeats: z.boolean().optional(),
  }),
  /**
   * DP 表：一格一格填，正在填的那一格（at）用箭頭標出它從哪幾格算來；只有一列時是一維的 dp[i]。
   * 空字串是還沒填；rowHead、colHead 是標在列和欄旁邊的字（例如兩個字串的字元）
   */
  z.object({
    type: z.literal('dp'),
    ...placed,
    label: text(40),
    cells: z
      .array(z.array(cell).min(1).max(30))
      .min(1)
      .max(26)
      .refine((rows) => rows.every((row) => row.length === rows[0].length), 'rows have the same length'),
    rowHead: z.array(cell).max(26).optional(),
    colHead: z.array(cell).max(30).optional(),
    /** 每一格從哪幾格算來 */
    deps: z.enum(['prev1', 'prev2', 'before', 'steps', 'upLeft', 'upLeftDiag', 'diag', 'upDiag', 'downLeft']).optional(),
    /** deps 是 steps 時往回看幾格，例如硬幣 [1,2,5] */
    steps: z.array(z.number().int().min(1).max(29)).min(1).max(6).optional(),
    /** 填表的順序：沒寫是由上往下一列一列填，up 是從最下面一列往上（例如回文） */
    order: z.enum(['up']).optional(),
    at: z.object({ r: z.number().int().min(0).max(25), c: z.number().int().min(0).max(29) }).optional(),
  }),
  /**
   * 區間：每個區間一列，畫在同一條數線上，重疊的一眼看得出來；
   * removed 是要移除的（畫成虛線），sweep 是掃描線停在數線上的哪個值
   */
  z.object({
    type: z.literal('intervals'),
    ...placed,
    label: text(40),
    items: z
      .array(
        z.object({
          a: z.number().min(-1e9).max(1e9),
          b: z.number().min(-1e9).max(1e9),
          color: z.enum(CELL_COLORS).optional(),
          removed: z.boolean().optional(),
        }),
      )
      .max(30),
    sweep: z.number().min(-1e9).max(1e9).optional(),
  }),
  /**
   * 並查集：節點是 0 到 n-1，parent[i] 是 i 的父節點，根節點指向自己；同一份資料畫成一片樹和 parent 陣列。
   * 有 rank 時合併照 rank（union by rank）；path 是最近一次 find 走過的節點，畫面上標出來
   */
  z.object({
    type: z.literal('unionFind'),
    ...placed,
    label: text(40),
    parent: z
      .array(z.number().int().min(0).max(19))
      .min(1)
      .max(20)
      .refine((parent) => parent.every((p) => p < parent.length), 'parents are nodes'),
    rank: z.array(z.number().int().min(0).max(19)).max(20).optional(),
    path: z.array(z.number().int().min(0).max(19)).max(20).optional(),
  }),
  /** 字典樹：存放進去的字，樹由這些字長出來（同一層依字母排）；at 是正在找的字或前綴，路徑標出來 */
  z.object({
    type: z.literal('trie'),
    ...placed,
    label: text(40),
    words: z.array(text(16)).max(30),
    at: text(16).optional(),
  }),
  /** 範圍框：框住同一個陣列上兩個指標之間的格子，指標移動時跟著變（滑動視窗）；位置由指標決定，不存座標 */
  z.object({
    type: z.literal('range'),
    id: boardElementId,
    from: boardElementId,
    to: boardElementId,
    color: z.enum(BOARD_COLORS),
  }),
  z.object({
    type: z.literal('stroke'),
    id: boardElementId,
    color: z.enum(BOARD_COLORS),
    /** 攤平的整數座標 x0, y0, x1, y1, … */
    points: z.array(z.number().int().min(-1e6).max(1e6)).min(2).max(4000),
  }),
]);

/** 逐步播放的一步：當時整張白板的快照，加上一句說明 */
export const boardStepSchema = z.object({
  id: boardElementId,
  caption: text(200),
  elements: z.array(boardElementSchema).max(800),
});

export const boardDocSchema = z.object({
  elements: z.array(boardElementSchema).max(800),
  /** 記下來的步驟，最多 50 步；沒記過就沒有這一項 */
  steps: z.array(boardStepSchema).max(50).optional(),
});
export type BoardDoc = z.infer<typeof boardDocSchema>;
export type BoardElement = BoardDoc['elements'][number];
