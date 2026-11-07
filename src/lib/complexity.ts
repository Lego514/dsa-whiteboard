// 複雜度區塊：面試講解的最後一定會被問「時間、空間複雜度是多少，為什麼」。
// 這裡只放不含 React 的部分：常用的答案、把打的字整理成好看的寫法。

/** 編輯時輸入框的建議；照常見程度排 */
export const COMMON_BIG_O = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)', 'O(V+E)', 'O(m·n)'] as const;

const SUPERSCRIPT: Record<string, string> = { '2': '²', '3': '³', n: 'ⁿ', k: 'ᵏ', m: 'ᵐ' };

/**
 * 顯示用的寫法：n^2 → n²、2^n → 2ⁿ、* → ·、nlogn → n log n，沒寫 O( 的包上 O(…)。
 * 存的是使用者打的字，畫面和匯出都經過這裡，手機上不用找上標也打得出來
 */
export function formatBigO(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const pretty = value
    // ^2、^(2)：括號是寫給次方的才拿掉，O(2^n) 最後那個括號要留著
    .replace(/\^(?:\(([23nkm])\)|([23nkm]))/g, (_, inParens?: string, bare?: string) => SUPERSCRIPT[inParens ?? bare ?? ''] ?? '')
    .replace(/\s*\*\s*/g, '·')
    .replace(/([a-z0-9])?\s*log\s*n\b/gi, (_, before?: string) => (before ? `${before} log n` : 'log n'));
  if (/^[OΘΩ]\s*\(/.test(pretty)) return pretty;
  if (/^[oθω]\s*\(/.test(pretty)) return pretty[0].toUpperCase() + pretty.slice(1);
  return `O(${pretty})`;
}
