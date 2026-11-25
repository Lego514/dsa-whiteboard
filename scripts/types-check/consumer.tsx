// 用套件的人怎麼 import：從 dist 的型別檢查，不是從 src。
// 每一種 moduleResolution 都要能找到所有東西，而且型別不能變成 any（issue #34：node16/nodenext 找不到 .d.ts 裡沒有副檔名的 import）。
// 執行：npm run check:types（要先 npm run build:lib）
import { BOARD_MAX_BYTES, EMPTY_DOC, fitsSizeLimit, newRoomId, ShareControls, Whiteboard, type BoardDoc, type Locale } from 'dsa-whiteboard';
import { boardDocSchema, fitsSizeLimit as schemaFits, type BoardElement } from 'dsa-whiteboard/schema';

export const limit: number = BOARD_MAX_BYTES;
export const fits: boolean = fitsSizeLimit(EMPTY_DOC) && schemaFits(EMPTY_DOC);
export const room: string = newRoomId();
export const locale: Locale = 'en';
export const parsed: BoardDoc = boardDocSchema.parse(EMPTY_DOC);
export const first: BoardElement | undefined = parsed.elements[0];

// Whiteboard 是 any 的話這兩行不會報錯，@ts-expect-error 自己就會變成錯誤
// @ts-expect-error 不存在的 prop
export const board = <Whiteboard nonExistentProp={123} />;
// @ts-expect-error 元件不是 symbol
export const notASymbol: symbol = ShareControls;
