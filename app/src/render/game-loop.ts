import { TICK_DT } from '../engine/types';

export interface Accumulator {
  /** Feed elapsed real seconds; returns how many fixed steps to run now. */
  advance(frameSeconds: number): number;
  reset(): void;
}

/**
 * Fixed-step accumulator. At most `maxSteps` steps per call; leftover time beyond that
 * is dropped so a slow frame cannot snowball into a spiral of death.
 */
export function createAccumulator(dt: number = TICK_DT, maxSteps = 5): Accumulator {
  let acc = 0;
  const EPS = 1e-9;
  return {
    advance(frameSeconds: number): number {
      if (!Number.isFinite(frameSeconds) || frameSeconds <= 0) return 0;
      acc += Math.min(frameSeconds, dt * maxSteps * 2);
      let steps = 0;
      while (acc + EPS >= dt && steps < maxSteps) {
        acc -= dt;
        steps++;
      }
      if (acc < 0) acc = 0;
      if (acc >= dt) acc = 0;
      return steps;
    },
    reset(): void {
      acc = 0;
    },
  };
}
