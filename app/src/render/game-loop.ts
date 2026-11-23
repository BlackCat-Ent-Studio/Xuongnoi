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

export interface SimPacer {
  /** Fixed steps to run for this frame: 0 while paused (except a requested single step). */
  stepsFor(frameSeconds: number): number;
  pause(): void;
  /** Leaves pause without replaying the time spent paused. */
  resume(): void;
  /** While paused: the next stepsFor() returns exactly 1. Ignored when running. */
  requestStep(): void;
  isPaused(): boolean;
  /** Back to running with no pending step or leftover time (new session). */
  reset(): void;
}

/** Wraps an Accumulator with pause / single-step so paused time never turns into a burst of ticks. */
export function createSimPacer(acc: Accumulator): SimPacer {
  let paused = false;
  let stepPending = false;
  return {
    stepsFor(frameSeconds: number): number {
      if (paused) {
        const n = stepPending ? 1 : 0;
        stepPending = false;
        return n;
      }
      return acc.advance(frameSeconds);
    },
    pause(): void {
      paused = true;
      stepPending = false;
    },
    resume(): void {
      paused = false;
      stepPending = false;
      acc.reset();
    },
    requestStep(): void {
      if (paused) stepPending = true;
    },
    isPaused: () => paused,
    reset(): void {
      paused = false;
      stepPending = false;
      acc.reset();
    },
  };
}
