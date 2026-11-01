import { describe, expect, it } from 'vitest';
import type { PuzzleLevel } from '../../src/puzzle/types';
import { PROGRESS_KEY, isUnlocked, loadProgress, saveProgress, starsOf, withBest } from '../../src/puzzle/ui/progress';

const lv = (id: string, order: number) => ({ id, order }) as PuzzleLevel;
const levels = [lv('a', 1), lv('b', 2), lv('c', 3)];

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PROGRESS_KEY, initial);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe('progress', () => {
  it('keeps the best stars', () => {
    let m = withBest({}, 'a', 2);
    m = withBest(m, 'a', 1);
    expect(starsOf(m, 'a')).toBe(2);
    m = withBest(m, 'a', 3);
    expect(starsOf(m, 'a')).toBe(3);
    expect(starsOf(m, 'zzz')).toBe(0);
  });

  it('opens level 1 always and the next level after a solve', () => {
    expect(isUnlocked(levels, 0, {})).toBe(true);
    expect(isUnlocked(levels, 1, {})).toBe(false);
    expect(isUnlocked(levels, 1, { a: { stars: 1 } })).toBe(true);
    expect(isUnlocked(levels, 2, { a: { stars: 3 } })).toBe(false);
  });

  it('round-trips through storage and ignores bad data', () => {
    const s = memory();
    expect(saveProgress({ a: { stars: 2 } }, s)).toBe(true);
    expect(loadProgress(s)).toEqual({ a: { stars: 2 } });
    expect(loadProgress(memory('not json'))).toEqual({});
    expect(loadProgress(memory('[1,2]'))).toEqual({});
    expect(loadProgress(memory('{"a":{"stars":9},"b":{"stars":1},"c":null}'))).toEqual({ b: { stars: 1 } });
    expect(loadProgress(null)).toEqual({});
  });
});
