import type { StepBreak } from '../app-contracts';
import { createRuntime } from '../engine/runtime';
import { TICK_DT, type InputSnapshot, type World } from '../engine/types';
import { registerAllNodes } from '../nodes';
import { stepBreakKeys } from '../render/step-break';
import { createWorld } from '../world/world';
import { buildPlayGraph } from './run-level';
import type { PuzzleAnswer, PuzzleLevel, PuzzleRunResult } from './types';
import { puzzleWorldOptions } from './world-options';

const NO_KEYS: InputSnapshot = { keysDown: new Set<string>() };

export type StepRunEvent =
  /** The game froze after tick number `tick` (0-based) because these shown outputs (`${node}|${port}`) rose. */
  | { kind: 'pause'; tick: number; fired: ReadonlySet<string> }
  | { kind: 'end'; result: PuzzleRunResult };

export interface StepRunSession {
  /** Runs ticks until a shown output rises (a pause) or the run ends. Call again to continue after a pause. */
  next(): StepRunEvent;
  world(): World;
}

/**
 * The step run played without a screen: the same engine, world and tick order as `runLevel`, frozen after every tick
 * in which an output accepted by `rule` rose. Pausing only stops the loop, so stepping through every pause ends in the
 * same state and result as `runLevel`. The time limit counts ticks run, never the time spent paused.
 */
export function createStepSession(
  level: PuzzleLevel,
  answer: PuzzleAnswer,
  rule: Pick<StepBreak, 'accepts' | 'moveKeys'>,
  timeLimit = level.timeLimit,
): StepRunSession {
  registerAllNodes();
  const world = createWorld(level.mode, puzzleWorldOptions(level.mode));
  const rt = createRuntime(buildPlayGraph(level, answer), world, level.mode);
  const maxTicks = Math.ceil(timeLimit / TICK_DT);
  let ticks = 0;
  const moving = new Set<string>();
  const finish = (): StepRunEvent => {
    const ended = world.ended;
    const seconds = ticks * TICK_DT;
    if (!ended) return { kind: 'end', result: { outcome: 'timeout', seconds, message: '' } };
    return { kind: 'end', result: { outcome: ended.result === 'win' ? 'win' : 'lose', seconds, message: ended.message } };
  };
  return {
    world: () => world,
    next() {
      while (ticks < maxTicks && !world.ended) {
        rt.tick(NO_KEYS);
        world.step(TICK_DT);
        ticks++;
        const fired = world.ended ? null : stepBreakKeys(rule, rt, moving);
        if (fired) return { kind: 'pause', tick: ticks - 1, fired };
      }
      return finish();
    },
  };
}
