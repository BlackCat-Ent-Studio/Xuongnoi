import type { Lesson, Snapshot, Step } from './types';

/**
 * Step state machine for one lesson run. No DOM, so it is unit-testable.
 * Checks auto-advance; going back "holds" the earlier step (its check is already true)
 * until the learner presses Tiếp.
 */
export interface Runner {
  readonly lesson: Lesson;
  index(): number;
  total(): number;
  step(): Step;
  /** True after going back: the step waits for a manual "Tiếp". */
  isHeld(): boolean;
  isLast(): boolean;
  isFinished(): boolean;
  /** Advance over every step whose check passes. Returns true when anything changed. */
  evaluate(snap: Snapshot): boolean;
  /** Manual advance (Tiếp / skip). Past the last step the run is finished. */
  next(): void;
  back(): void;
}

export function createRunner(lesson: Lesson): Runner {
  if (lesson.steps.length === 0) throw new Error(`Lesson ${lesson.id} has no steps`);
  let i = 0;
  let held = false;
  let finished = false;
  const last = lesson.steps.length - 1;
  const current = (): Step => lesson.steps[i] ?? lesson.steps[last]!;

  return {
    lesson,
    index: () => i,
    total: () => lesson.steps.length,
    step: current,
    isHeld: () => held,
    isLast: () => i === last,
    isFinished: () => finished,
    evaluate(snap) {
      if (finished || held) return false;
      let changed = false;
      for (;;) {
        const check = current().check;
        if (!check || !check(snap)) break;
        changed = true;
        if (i >= last) {
          finished = true;
          break;
        }
        i++;
      }
      return changed;
    },
    next() {
      held = false;
      if (i >= last) finished = true;
      else i++;
    },
    back() {
      if (i === 0) return;
      i--;
      held = true;
    },
  };
}
