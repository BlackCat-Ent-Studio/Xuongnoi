import { describe, expect, it } from 'vitest';
import { readableStyle } from '../../src/render/hud-widgets';

function lum(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('readableStyle', () => {
  it('defaults to white text on a dark backdrop with contrast >= 4.5 even over pure white', () => {
    const s = readableStyle();
    expect(s.color).toBe('#ffffff');
    const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(s.background);
    expect(m).not.toBeNull();
    const a = Number(m?.[4]);
    const blended = [1, 2, 3].map((i) => 255 * (1 - a) + Number(m?.[i]) * a);
    expect(1.05 / (lum(blended) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps an explicit colour and lightens the backdrop for dark colours', () => {
    expect(readableStyle('#ffcc00').color).toBe('#ffcc00');
    expect(readableStyle('#ffcc00').background).toContain('10,12,16');
    expect(readableStyle('#111111').background).toContain('255,255,255');
  });
});
