import type { BoardDoc } from '../src';
import { boardDocSchema } from '../src/schema';
import reverseList from './examples/206.json';
import islands from './examples/200.json';
import lcs from './examples/1143.json';

// 網站上的範例：做好的白板，每一步的說明是怎麼講這一題的一句話，打開就自動播放一輪。
// 第一次來（瀏覽器裡還沒有自己的白板）先看到 206；#example=1143 這種連結（放在履歷、README）不管來過幾次都打開那一題。
// 內容是從刷題教練（leetcode-coach）的參考板書匯出的，跟那邊的講解一致。

export const EXAMPLE_IDS = ['206', '1143', '200'] as const;
export type ExampleId = (typeof EXAMPLE_IDS)[number];

/** 第一次來先看這一題：指標一步一步移動，最直覺 */
export const DEFAULT_EXAMPLE: ExampleId = '206';

export interface Example {
  id: ExampleId;
  /** LeetCode 的題號和題名，英文和中文畫面都一樣 */
  title: string;
  doc: BoardDoc;
}

/** 讀進來的檔案先照白板的格式檢查一次，壞掉的話在測試就會發現 */
const EXAMPLES: Record<ExampleId, Example> = {
  '206': { id: '206', title: '206. Reverse Linked List', doc: boardDocSchema.parse(reverseList) },
  '1143': { id: '1143', title: '1143. Longest Common Subsequence', doc: boardDocSchema.parse(lcs) },
  '200': { id: '200', title: '200. Number of Islands', doc: boardDocSchema.parse(islands) },
};

export function isExampleId(value: string | null | undefined): value is ExampleId {
  return (EXAMPLE_IDS as readonly string[]).includes(value ?? '');
}

export function exampleOf(id: ExampleId): Example {
  return EXAMPLES[id];
}
