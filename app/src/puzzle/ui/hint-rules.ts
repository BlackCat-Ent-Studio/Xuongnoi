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
