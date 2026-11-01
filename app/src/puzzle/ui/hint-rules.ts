import type { PuzzleLevel } from '../types';

/**
 * Pure rules of the "?" button: each level has `freeHints` free presses, every press that reveals a step
 * beyond that costs a star (the star maths itself is `starsFor`).
 */

/** Free presses still left after `used` presses that revealed a step. */
export const hintsLeft = (level: PuzzleLevel, used: number): number => Math.max(0, level.freeHints - used);

/** Presses beyond the free ones: what `starsFor` takes off. */
export const extraHints = (level: PuzzleLevel, used: number): number => Math.max(0, used - level.freeHints);

export interface HintBadge {
  /** Free hints left (0 when none). */
  left: number;
  /** True when the next press costs a star: the badge shows red with a crossed star. */
  costly: boolean;
}

export function hintBadge(level: PuzzleLevel, used: number): HintBadge {
  const left = hintsLeft(level, used);
  return { left, costly: left === 0 };
}

/**
 * Records a "?" reveal. A step counts only the first time it is revealed during a visit to the level, so
 * pressing "?" again on the same step is free. Returns true when this press counts (and adds the key to `revealed`).
 */
export function countHint(revealed: Set<string>, key: string | null): boolean {
  if (key === null || revealed.has(key)) return false;
  revealed.add(key);
  return true;
}
