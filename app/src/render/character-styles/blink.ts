/** One blink lasts this long (seconds): both eyes close and open again. */
export const BLINK_DURATION = 0.14;
/** Chance that a blink is followed at once by a second one. */
export const DOUBLE_BLINK_CHANCE = 0.3;
const DOUBLE_GAP = 0.09;
const MIN_GAP = 2;
const MAX_GAP = 5;

export interface Blinker {
  /** Advances by `dt` seconds at clock `time`; returns eye closure 0 (open) .. 1 (shut). Allocation-free. */
  step(time: number, dt: number): number;
}

/**
 * Natural blinking: every 2-5 s a quick blink, and about 30% of the time it is a double blink.
 * `rand` returns [0, 1) and is injectable so the schedule is testable.
 */
export function createBlinker(rand: () => number = Math.random): Blinker {
  let nextAt = 1 + rand() * 1.5;
  let t = -1;
  let wasDouble = false;
  return {
    step(time, dt) {
      if (t < 0) {
        if (time < nextAt) return 0;
        t = 0;
      }
      t += dt;
      const q = t / BLINK_DURATION;
      if (q < 1) return Math.sin(q * Math.PI);
      t = -1;
      if (!wasDouble && rand() < DOUBLE_BLINK_CHANCE) {
        wasDouble = true;
        nextAt = time + DOUBLE_GAP;
      } else {
        wasDouble = false;
        nextAt = time + MIN_GAP + rand() * (MAX_GAP - MIN_GAP);
      }
      return 0;
    },
  };
}
