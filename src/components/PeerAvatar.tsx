import type { ReactNode } from 'react';
import { animalOf, type GuestAnimal } from '../collab/names';
import type { PeerColor } from '../collab/messages';

// 共用房間的頭像：預設名字（形容詞加動物）畫那種動物的臉，自己取的名字放第一個字。
// 底色是對方游標的顏色（CSS 的 --peer），動物一律白臉、深色五官，八種底色上都看得清楚。
// 畫在 24×24 裡、臉的中心在 (12, 12)，頭像是圓的，超出圓的部分會被裁掉。

const FACE = '#fff';
const INK = '#1e293b';
/** 嘴邊、耳朵裡面這些淺色的地方 */
const SOFT = '#e2e8f0';
const BEAK = '#f59e0b';
const PINK = '#f9a8d4';

export function PeerAvatar({ name, color, className = '' }: { name: string; color?: PeerColor; className?: string }) {
  const animal = animalOf(name);
  return (
    <span className={`board-peer ${className}`} data-peer={color} data-animal={animal} aria-hidden>
      {animal ? (
        <svg viewBox="0 0 24 24" aria-hidden>
          {ANIMAL_ART[animal]}
        </svg>
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

/** 頭像上的字：名字的第一個字 */
function initialOf(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? '?';
}

/** 兩隻眼睛 */
function eyes(y: number, gap: number, r = 0.95): ReactNode {
  return (
    <>
      <circle cx={12 - gap} cy={y} r={r} fill={INK} />
      <circle cx={12 + gap} cy={y} r={r} fill={INK} />
    </>
  );
}

const ANIMAL_ART: Record<GuestAnimal, ReactNode> = {
  // 水豚：方方長長的頭、頂上的小耳朵、一大塊深色的鼻子（不要畫鼻孔，會像豬）
  capybara: (
    <>
      <ellipse cx="7.6" cy="6.6" rx="1.6" ry="1.4" fill={FACE} />
      <ellipse cx="16.4" cy="6.6" rx="1.6" ry="1.4" fill={FACE} />
      <rect x="5.6" y="6.4" width="12.8" height="14.6" rx="5.6" fill={FACE} />
      {eyes(11, 3.1)}
      <rect x="9.2" y="14.2" width="5.6" height="3" rx="1.5" fill={INK} />
      <path d="M10.6 18.8Q12 19.6 13.4 18.8" fill="none" stroke={SOFT} strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
  // 水獺：圓臉、兩側的小耳朵、鼓鼓的嘴邊
  otter: (
    <>
      <circle cx="6.4" cy="9" r="1.9" fill={FACE} />
      <circle cx="17.6" cy="9" r="1.9" fill={FACE} />
      <circle cx="12" cy="13" r="7" fill={FACE} />
      <ellipse cx="10.4" cy="15.6" rx="2" ry="1.5" fill={SOFT} />
      <ellipse cx="13.6" cy="15.6" rx="2" ry="1.5" fill={SOFT} />
      <ellipse cx="12" cy="14.4" rx="1.3" ry="0.9" fill={INK} />
      {eyes(11.4, 2.9)}
    </>
  ),
  // 熊貓：黑耳朵、黑眼圈
  panda: (
    <>
      <circle cx="6.3" cy="7" r="2.6" fill={INK} />
      <circle cx="17.7" cy="7" r="2.6" fill={INK} />
      <circle cx="12" cy="13" r="7.6" fill={FACE} />
      <ellipse cx="9" cy="12.4" rx="1.8" ry="2.4" transform="rotate(30 9 12.4)" fill={INK} />
      <ellipse cx="15" cy="12.4" rx="1.8" ry="2.4" transform="rotate(-30 15 12.4)" fill={INK} />
      <circle cx="9.3" cy="12" r="0.6" fill={FACE} />
      <circle cx="14.7" cy="12" r="0.6" fill={FACE} />
      <ellipse cx="12" cy="15.6" rx="1.1" ry="0.75" fill={INK} />
    </>
  ),
  // 狐狸：尖耳朵、尖下巴
  fox: (
    <>
      <path d="M4.5 4.5 9.5 9h5l5-4.5-0.6 8.5C18.5 17 15.6 19.6 12 20.5 8.4 19.6 5.5 17 5.1 13Z" fill={FACE} />
      <path d="M6 6.6 8.4 8.8 6.4 10Z M18 6.6 15.6 8.8 17.6 10Z" fill={SOFT} />
      {eyes(12.6, 2.8)}
      <circle cx="12" cy="18.1" r="1.1" fill={INK} />
    </>
  ),
  // 無尾熊：很大的圓耳朵、很大的鼻子
  koala: (
    <>
      <circle cx="5.6" cy="9.2" r="3.7" fill={FACE} />
      <circle cx="18.4" cy="9.2" r="3.7" fill={FACE} />
      <circle cx="5.6" cy="9.2" r="2" fill={SOFT} />
      <circle cx="18.4" cy="9.2" r="2" fill={SOFT} />
      <circle cx="12" cy="13.4" r="6.6" fill={FACE} />
      <ellipse cx="12" cy="14.8" rx="1.9" ry="2.6" fill={INK} />
      {eyes(12, 3.2, 0.9)}
    </>
  ),
  // 企鵝：深色的頭、白色的臉、橘色的嘴
  penguin: (
    <>
      <circle cx="12" cy="12.5" r="8.2" fill={INK} />
      <circle cx="9.4" cy="12.6" r="3.4" fill={FACE} />
      <circle cx="14.6" cy="12.6" r="3.4" fill={FACE} />
      <ellipse cx="12" cy="16" rx="5.2" ry="3.4" fill={FACE} />
      {eyes(12.2, 2.5, 0.9)}
      <path d="M10.7 14.4h2.6L12 16.4Z" fill={BEAK} />
    </>
  ),
  // 貓頭鷹：頭上兩撮毛、很大的眼睛
  owl: (
    <>
      <path d="M5 5.5 8.4 9Q12 7.8 15.6 9L19 5.5 18.6 14Q18.2 20.2 12 20.6 5.8 20.2 5.4 14Z" fill={FACE} />
      <circle cx="9.2" cy="13" r="2.7" fill={SOFT} />
      <circle cx="14.8" cy="13" r="2.7" fill={SOFT} />
      {eyes(13, 2.8, 1.35)}
      <path d="M11 15.6h2L12 17.4Z" fill={BEAK} />
    </>
  ),
  // 兔子：長耳朵
  rabbit: (
    <>
      <ellipse cx="9.2" cy="6.6" rx="1.9" ry="4.7" fill={FACE} />
      <ellipse cx="14.8" cy="6.6" rx="1.9" ry="4.7" fill={FACE} />
      <ellipse cx="9.2" cy="6.8" rx="0.8" ry="3.3" fill={PINK} />
      <ellipse cx="14.8" cy="6.8" rx="0.8" ry="3.3" fill={PINK} />
      <circle cx="12" cy="14.6" r="5.9" fill={FACE} />
      {eyes(13.9, 2.2, 0.85)}
      <path d="M11.1 15.9h1.8L12 17Z" fill={PINK} />
    </>
  ),
  // 海豚：側面、往右游，背鰭和尖嘴；縮小一點放在圓的中間
  dolphin: (
    <g transform="translate(1.6 1.4) scale(0.86)">
      <path d="M9.8 7.4 8.6 3.6 13.4 6.9Z" fill={FACE} />
      <path d="M3 17C4.2 10.6 8.8 6.6 13.8 6.8 17 7 18.6 8.7 19.2 10.2L21.4 11.1C21.8 11.7 21.3 12.4 20.5 12.4L18.6 12.6C17 15.2 13.6 16.8 9.6 17.6 7.4 18.1 5 18.2 3 17Z" fill={FACE} />
      <path d="M2.2 14.6 4.4 17.2 1.6 19.4Z" fill={FACE} />
      <path d="M14.2 13.4Q16.6 13.6 18.3 12.5" fill="none" stroke={SOFT} strokeWidth="1" strokeLinecap="round" />
      <circle cx="15.8" cy="10" r="1.05" fill={INK} />
    </g>
  ),
  // 烏龜：從上面看，殼上有花紋，頭和四隻腳露出來
  turtle: (
    <>
      <circle cx="12" cy="5.4" r="2.4" fill={FACE} />
      <ellipse cx="6.6" cy="9" rx="1.6" ry="1.2" fill={FACE} />
      <ellipse cx="17.4" cy="9" rx="1.6" ry="1.2" fill={FACE} />
      <ellipse cx="6.8" cy="17.6" rx="1.6" ry="1.2" fill={FACE} />
      <ellipse cx="17.2" cy="17.6" rx="1.6" ry="1.2" fill={FACE} />
      <ellipse cx="12" cy="13.3" rx="6" ry="6.6" fill={FACE} />
      <path d="M12 10.4 14.4 11.8V14.8L12 16.2 9.6 14.8V11.8Z" fill="none" stroke={SOFT} strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="11.2" cy="4.8" r="0.5" fill={INK} />
      <circle cx="12.8" cy="4.8" r="0.5" fill={INK} />
    </>
  ),
  // 松鼠：後面一條很大的捲尾巴
  squirrel: (
    <>
      <path d="M14.5 20.5C21 21 22.5 14 19.6 10.4 17.8 8.2 18.6 5.2 21 5.4 20 2.6 15.2 2.8 14.8 7.4 14.5 10.6 17.4 12.6 16.4 16Z" fill={SOFT} />
      <path d="M6 6.4 8.2 9.2 6.2 10.2Z M14 6.4 11.8 9.2 13.8 10.2Z" fill={FACE} />
      <circle cx="10" cy="13.4" r="5.6" fill={FACE} />
      <circle cx="8" cy="12.8" r="0.9" fill={INK} />
      <circle cx="12" cy="12.8" r="0.9" fill={INK} />
      <ellipse cx="10" cy="15.4" rx="0.9" ry="0.65" fill={INK} />
    </>
  ),
  // 刺蝟：頭上一圈刺
  hedgehog: (
    <>
      <path
        d="M3.4 15 3.6 11.2 2.6 9.6 5 9 5 6.6 7.4 7 8.4 4.4 10.4 6 12 3.6 13.6 6 15.6 4.4 16.6 7 19 6.6 19 9 21.4 9.6 20.4 11.2 20.6 15Z"
        fill={SOFT}
      />
      <ellipse cx="12" cy="15" rx="6" ry="5" fill={FACE} />
      {eyes(14.2, 2.2, 0.85)}
      <circle cx="12" cy="16.8" r="1.1" fill={INK} />
    </>
  ),
};
