import { describe, expect, it } from 'vitest';
import { placeCard } from './tourPlacement';

const view = { width: 1280, height: 800 };
const card = { width: 320, height: 160 };

describe('placeCard', () => {
  it('puts the card below a toolbar at the top', () => {
    expect(placeCard({ left: 400, top: 70, width: 500, height: 44 }, card, view)).toEqual({ left: 400, top: 128 });
  });

  it('puts the card to the right of the full-height palette', () => {
    expect(placeCard({ left: 0, top: 60, width: 240, height: 740 }, card, view)).toEqual({ left: 254, top: 60 });
  });

  it('puts the card above the help button in the bottom-right corner', () => {
    const placed = placeCard({ left: 1230, top: 740, width: 36, height: 36 }, card, view);
    expect(placed.top).toBe(740 - 14 - 160);
    // 往左推，不超出畫面右邊
    expect(placed.left).toBe(1280 - 320 - 12);
  });

  it('keeps the card on screen when nothing fits around a large target on a phone', () => {
    const phone = { width: 390, height: 844 };
    const placed = placeCard({ left: 0, top: 100, width: 390, height: 700 }, { width: 366, height: 180 }, phone);
    expect(placed).toEqual({ left: 12, top: 844 - 180 - 12 });
  });

  it('centres the card when the target is missing', () => {
    expect(placeCard(null, card, view)).toEqual({ left: 480, top: 320 });
  });
});
