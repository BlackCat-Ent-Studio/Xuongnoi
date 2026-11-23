import { describe, expect, it } from 'vitest';
import { formatHudValue } from '../../src/render/hud';

describe('hud value format', () => {
  it('keeps whole numbers as-is', () => {
    expect(formatHudValue(0)).toBe('0');
    expect(formatHudValue(5)).toBe('5');
    expect(formatHudValue(-3)).toBe('-3');
  });

  it('rounds fractional values to one decimal (running timer)', () => {
    expect(formatHudValue(28.36666666666676)).toBe('28.4');
    expect(formatHudValue(0.04)).toBe('0.0');
    expect(formatHudValue(-1.25)).toBe('-1.3');
  });

  it('shows 0 for non-finite values', () => {
    expect(formatHudValue(Number.NaN)).toBe('0');
    expect(formatHudValue(Number.POSITIVE_INFINITY)).toBe('0');
  });
});
