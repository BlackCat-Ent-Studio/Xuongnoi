import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { stepBreakKeys } from '../../src/render/step-break';
import { chapterOf } from '../../src/tutorial/course';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Lesson, Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const lesson = (): Lesson => findLesson('step-run') as Lesson;

describe('lesson: Xem dây chạy từng bước', () => {
  it('sits in the first chapter and ends on an info step', () => {
    expect(chapterOf('step-run')?.id).toBe('basics');
    const steps = lesson().steps;
    expect(steps[steps.length - 1]?.check).toBeUndefined();
  });

  it('the ready board fires wired outputs on its own, so a step run has something to stop on', () => {
    const board = lesson().createBoard();
    const wired = new Set(board.graph.wires.map((w) => `${w.from.node}|${w.from.port}`));
    const world = createWorld(board.mode);
    const rt = createRuntime(board.graph, world, board.mode);
    let breaks = 0;
    for (let i = 0; i < 60 * 20; i++) {
      rt.tick({ keysDown: new Set<string>() });
      world.step(TICK_DT);
      if (stepBreakKeys({ accepts: (k) => wired.has(k) }, rt)) breaks++;
    }
    expect(breaks).toBeGreaterThanOrEqual(2);
  });

  it('moves on by what the learner presses: play, step, frozen, next', () => {
    const runner = createRunner(lesson());
    const snap = (extra: Partial<Snapshot>): Snapshot => ({ graph: lesson().createBoard().graph, mode: '2d-side', playing: false, ended: null, ...extra });
    runner.evaluate(snap({}));
    expect(runner.step().id).toBe('intro'); // info step waits for its button
    runner.evaluate(snap({ playing: false }));
    expect(runner.step().id).toBe('intro');
  });

  it('checks read only the step facts', () => {
    const l = lesson();
    const by = (id: string) => l.steps.find((s) => s.id === id)!.check!;
    const base: Snapshot = { graph: l.createBoard().graph, mode: '2d-side', playing: true, ended: null };
    expect(by('play')(base)).toBe(true);
    expect(by('step')(base)).toBe(false);
    expect(by('step')({ ...base, stepping: true })).toBe(true);
    expect(by('wait')({ ...base, stepping: true })).toBe(false);
    expect(by('wait')({ ...base, stepWaiting: true })).toBe(true);
    expect(by('next')({ ...base, stepBreaks: 1 })).toBe(false);
    expect(by('next')({ ...base, stepBreaks: 2 })).toBe(true);
  });
});
