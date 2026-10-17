// 多叉樹（一片樹）的排版：並查集和字典樹共用。
// 不從 model 讀常數：model 也引用這裡，互相引用時頂層用到對方的值會出錯。

export interface ForestPoint {
  x: number;
  y: number;
}

export interface ForestLayout {
  /** 每個節點的中心，相對於排版的左上角 */
  centers: Map<number, ForestPoint>;
  w: number;
  h: number;
}

export interface ForestOptions {
  /** 節點的寬度（圓的直徑） */
  node: number;
  /** 兄弟子樹之間至少隔多遠 */
  gap: number;
  /** 上下兩層節點中心的距離 */
  level: number;
  /** 第一層節點中心的 y */
  top: number;
}

/**
 * 由上往下排：每個子樹佔一段寬度，子樹之間留一點空，父節點放在第一個和最後一個子節點的正中間；
 * 好幾棵樹（並查集的每一組）由左到右排開。走過的節點不再走，children 裡有環也不會無限遞迴
 */
export function forestLayout(roots: readonly number[], children: readonly (readonly number[])[], options: ForestOptions): ForestLayout {
  const { node, gap, level, top } = options;
  const span = new Map<number, number>();
  const kidsOf = new Map<number, number[]>();
  const seen = new Set<number>();
  const gaps = (count: number) => gap * Math.max(0, count - 1);
  const measure = (i: number): number => {
    const kids = (children[i] ?? []).filter((k) => !seen.has(k));
    kids.forEach((k) => seen.add(k));
    kidsOf.set(i, kids);
    const width = Math.max(node, kids.reduce((sum, k) => sum + measure(k), 0) + gaps(kids.length));
    span.set(i, width);
    return width;
  };
  const trees: number[] = [];
  for (const r of roots) {
    if (seen.has(r)) continue;
    seen.add(r);
    measure(r);
    trees.push(r);
  }
  const centers = new Map<number, ForestPoint>();
  let deepest = 0;
  const place = (i: number, left: number, depth: number) => {
    deepest = Math.max(deepest, depth);
    const kids = kidsOf.get(i) ?? [];
    let x = left + span.get(i)! / 2;
    if (kids.length > 0) {
      let start = left + (span.get(i)! - kids.reduce((sum, k) => sum + span.get(k)!, 0) - gaps(kids.length)) / 2;
      for (const k of kids) {
        place(k, start, depth + 1);
        start += span.get(k)! + gap;
      }
      x = (centers.get(kids[0])!.x + centers.get(kids[kids.length - 1])!.x) / 2;
    }
    centers.set(i, { x: Math.round(x), y: top + depth * level });
  };
  let left = 0;
  for (const r of trees) {
    place(r, left, 0);
    left += span.get(r)! + gap;
  }
  return { centers, w: Math.max(node, left - gap), h: top + deepest * level + node / 2 };
}
