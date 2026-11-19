import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

// 網址貼到 LinkedIn、Slack 時的預覽卡片：index.html 的 og 標籤，圖在 public/og.png
// 圖要真的在 public/ 裡，部署後 og:image 的網址才抓得到
const images = import.meta.glob('../public/og.png', { query: '?url', eager: true });

function meta(property: string): string | undefined {
  const match = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`));
  return match?.[1];
}

describe('share preview', () => {
  it('has a title, description and large image card', () => {
    expect(meta('og:title')).toBe('DSA Whiteboard');
    expect(meta('og:description')?.length).toBeGreaterThan(40);
    expect(meta('twitter:card')).toBe('summary_large_image');
  });

  it('points the image at an absolute URL that exists in public/', () => {
    expect(meta('og:image')).toMatch(/^https:\/\/[^/]+\/og\.png$/);
    expect(Object.keys(images)).toEqual(['../public/og.png']);
  });
});
