import { z } from 'zod';
import { applyOps, type Op } from '../src/collab/ops';
import { BOARD_MAX_BYTES, boardDocSchema, boardElementSchema, boardStepSchema, type BoardDoc } from '../src/schema';

// 共用房間的規則，不碰 Cloudflare 的 API，可以直接單元測試：
// 檢查用戶端送來的訊息、套用修改、白板不能超過大小上限。

const elementId = z.string().regex(/^[a-z0-9]{1,12}$/);
const point = z.object({ x: z.number().finite().min(-1e6).max(1e6), y: z.number().finite().min(-1e6).max(1e6) });

const opSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('put'), el: boardElementSchema }),
  z.object({ k: z.literal('del'), id: elementId }),
  z.object({ k: z.literal('steps'), steps: z.array(boardStepSchema).max(50) }),
]);

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ops'), batch: z.number().int().min(0), ops: z.array(opSchema).min(1).max(1000) }),
  z.object({ t: z.literal('cursor'), at: point.nullable() }),
  z.object({ t: z.literal('rename'), name: z.string() }),
]);
export type ParsedClientMessage = z.infer<typeof clientMessageSchema>;

/** 解析一則用戶端訊息；格式不對就是 null */
export function parseClientMessage(raw: string): ParsedClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = clientMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** 名字去頭尾空白、最多 30 個字，空的就用預設 */
export function cleanName(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return cleaned || fallback;
}

/** 套用一批修改；超過大小或元件數上限就不接受 */
export function applyBatch(doc: BoardDoc, ops: readonly Op[]): { ok: true; doc: BoardDoc } | { ok: false; reason: 'too_large' } {
  const next = applyOps(doc, ops);
  if (next.elements.length > 800 || JSON.stringify(next).length > BOARD_MAX_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true, doc: next };
}

/** 從儲存空間讀回來的內容；壞掉的就當成空白 */
export function loadDoc(raw: unknown): BoardDoc | null {
  if (raw === undefined || raw === null) return null;
  const parsed = boardDocSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
