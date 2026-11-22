// 聚光燈導覽的說明卡放在哪：不蓋住亮起來的那一塊，也不超出畫面。

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** 卡片跟亮起來那一塊之間的距離 */
const GAP = 14;
/** 卡片跟畫面邊緣至少留這麼多 */
const MARGIN = 12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * 依序試：下面、右邊、上面、左邊，第一個放得下的就用。左邊一整條的元件區放右邊，
 * 上面的工具列放下面，右下角的「?」放上面。都放不下（手機上很大的一塊）就貼著畫面下緣。
 * 沒有目標（找不到那個元件）就放在畫面中間。
 */
export function placeCard(target: Box | null, card: Size, view: Size): { left: number; top: number } {
  const maxLeft = view.width - card.width - MARGIN;
  const maxTop = view.height - card.height - MARGIN;
  const centred = clamp((view.width - card.width) / 2, MARGIN, maxLeft);
  if (!target) return { left: centred, top: clamp((view.height - card.height) / 2, MARGIN, maxTop) };

  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const alignedLeft = clamp(target.left, MARGIN, maxLeft);
  const alignedTop = clamp(target.top, MARGIN, maxTop);

  if (bottom + GAP + card.height <= view.height - MARGIN) return { left: alignedLeft, top: bottom + GAP };
  if (right + GAP + card.width <= view.width - MARGIN) return { left: right + GAP, top: alignedTop };
  if (target.top - GAP - card.height >= MARGIN) return { left: alignedLeft, top: target.top - GAP - card.height };
  if (target.left - GAP - card.width >= MARGIN) return { left: target.left - GAP - card.width, top: alignedTop };
  return { left: centred, top: maxTop };
}
