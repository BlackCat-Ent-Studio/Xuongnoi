import { describe, expect, it } from 'vitest';
import { createRateLimiter, createStarCounter, midiToHz, mulberry32, pentatonicMidi } from '../../src/puzzle/ui/sound/notes';

describe('note tables', () => {
  it('converts MIDI to Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(81)).toBeCloseTo(880, 5);
  });

  it('walks the pentatonic scale across octaves, also downwards', () => {
    const steps = [0, 1, 2, 3, 4, 5].map((d) => pentatonicMidi(60, d));
    expect(steps).toEqual([60, 62, 64, 67, 69, 72]);
    expect(pentatonicMidi(60, -1)).toBe(57);
    expect(pentatonicMidi(60, -5)).toBe(48);
  });

  it('random generator is deterministic and in [0,1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rate limiter', () => {
  it('blocks the same key inside the gap and allows it after', () => {
    const allow = createRateLimiter(40);
    expect(allow('tap', 1000)).toBe(true);
    expect(allow('tap', 1020)).toBe(false);
    expect(allow('tap', 1039)).toBe(false);
    expect(allow('tap', 1040)).toBe(true);
  });

  it('treats different keys independently', () => {
    const allow = createRateLimiter(40);
    expect(allow('tap', 1000)).toBe(true);
    expect(allow('wire', 1001)).toBe(true);
  });

  it('a blocked call does not extend the gap', () => {
    const allow = createRateLimiter(40);
    allow('tap', 1000);
    allow('tap', 1030);
    expect(allow('tap', 1041)).toBe(true);
  });
});

describe('star counter', () => {
  it('rises per call, caps, and resets after a quiet gap or reset()', () => {
    const c = createStarCounter(2500, 2);
    expect([c.next(0), c.next(400), c.next(800), c.next(1200)]).toEqual([0, 1, 2, 2]);
    expect(c.next(5000)).toBe(0);
    c.next(5100);
    c.reset();
    expect(c.next(5200)).toBe(0);
  });
});
