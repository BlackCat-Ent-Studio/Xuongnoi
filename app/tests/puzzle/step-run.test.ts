import { describe, expect, it } from 'vitest';
import { createAccumulator, createSimPacer } from '../../src/render/game-loop';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel, timeIsUp } from '../../src/puzzle/run-level';
import { createStepSession, type StepRunEvent } from '../../src/puzzle/step-run';
import { isPortShown, isSceneryNode } from '../../src/puzzle/ui/board-state';
import type { PuzzleAnswer, PuzzleLevel } from '../../src/puzzle/types';
import { TICK_DT } from '../../src/engine/types';

type Rule = { accepts(key: string): boolean };

/** An output pin the board shows: placed pieces with every port, locked cards that are not scenery with their shown output ports. */
function shownRule(level: PuzzleLevel, answer: PuzzleAnswer): Rule {
  const placed = new Set(answer.nodes.map((n) => n.id));
  return {
    accepts(key: string): boolean {
      const [node = '', port = ''] = key.split('|');
      if (placed.has(node)) return true;
      return !isSceneryNode(level, node) && isPortShown(level, node, port, 'out');
    },
  };
}

/** The step rule: a shown output pin that has at least one drawn wire (both ends on screen) going out. */
function wiredRule(level: PuzzleLevel, answer: PuzzleAnswer): Rule {
  const shown = shownRule(level, answer);
  const placed = new Set(answer.nodes.map((n) => n.id));
  const wires = [...level.base.wires, ...answer.wires];
  const inShown = (node: string, port: string): boolean => placed.has(node) || (!isSceneryNode(level, node) && isPortShown(level, node, port, 'in'));
  return {
    accepts: (key) => {
      const [node = '', port = ''] = key.split('|');
      return shown.accepts(key) && wires.some((w) => w.from.node === node && w.from.port === port && inShown(w.to.node, w.to.port));
    },
  };
}
const everything: Rule = { accepts: () => true };

/** Steps through every pause; returns the pauses, the end and the world as it was at each pause. */
function stepThrough(level: PuzzleLevel, answer: PuzzleAnswer, rule: Rule = wiredRule(level, answer), limit = level.timeLimit) {
  const session = createStepSession(level, answer, rule, limit);
  const pauses: Extract<StepRunEvent, { kind: 'pause' }>[] = [];
  const entityAt = new Map<number, string>();
  for (;;) {
    const ev = session.next();
    if (ev.kind === 'end') return { pauses, end: ev.result, entityAt, finalState: JSON.stringify(session.world().entities()) };
    pauses.push(ev);
    entityAt.set(ev.tick, JSON.stringify(session.world().entities()));
  }
}

/** The normal run's entities after every tick, its last state and its result. */
function normalRun(level: PuzzleLevel, answer: PuzzleAnswer) {
  const states: string[] = [];
  const result = runLevel(level, answer, level.timeLimit, (world, tick) => {
    states[tick] = JSON.stringify(world.entities());
  });
  return { result, states, lastState: states[states.length - 1] ?? '' };
}

const tiny: PuzzleLevel = {
  id: 'tiny',
  order: 1,
  title: 'Thử',
  task: '',
  hint: '',
  mode: '2d-side',
  cast: [],
  base: { nodes: [{ id: 'end', kind: 'win-lose', params: {}, pos: { x: 0, y: 0 } }], wires: [] },
  shownPorts: { end: {} },
  tray: [{ kind: 'on-start', count: 1 }],
  par: 1,
  freeHints: 1,
  timeLimit: 2,
  solution: {
    nodes: [{ id: 'p1', kind: 'on-start', params: {}, pos: { x: 0, y: 0 } }],
    wires: [{ id: 'w1', from: { node: 'p1', port: 'fired' }, to: { node: 'end', port: 'win' } }],
  },
};
const startOnly: PuzzleAnswer = { nodes: tiny.solution.nodes, wires: [] };

describe('step run is the same run, only frozen at the pauses', () => {
  for (const level of PUZZLE_LEVELS) {
    it(`level ${level.order}: same state at every pause, same final state and result as runLevel`, () => {
      const normal = normalRun(level, level.solution);
      const stepped = stepThrough(level, level.solution);
      expect(stepped.end).toEqual(normal.result);
      expect(stepped.pauses.length).toBeGreaterThan(0);
      for (const p of stepped.pauses) expect(stepped.entityAt.get(p.tick)).toBe(normal.states[p.tick]);
      expect(stepped.finalState).toBe(normal.lastState);
    });
  }

  it('a run that never wins ends the same way (timeout) and keeps its trajectory', () => {
    const level = PUZZLE_LEVELS[0]!;
    const empty: PuzzleAnswer = { nodes: [], wires: [] };
    const normal = normalRun(level, empty);
    const stepped = stepThrough(level, empty);
    expect(stepped.end).toEqual(normal.result);
    expect(stepped.finalState).toBe(normal.lastState);
  });
});

describe('what makes a pause', () => {
  it('the first pause is the wired start card firing at tick 0', () => {
    const level = PUZZLE_LEVELS[1]!;
    const start = level.solution.nodes.find((n) => n.kind === 'on-start' && level.solution.wires.some((w) => w.from.node === n.id));
    const { pauses } = stepThrough(level, level.solution);
    expect(pauses[0]?.tick).toBe(0);
    expect([...(pauses[0]?.fired ?? [])].some((k) => k.startsWith(`${start?.id}|`))).toBe(true);
  });

  it('a rising output with no wire out never pauses', () => {
    // Without a wire the start card only feeds the hidden win plumbing, so nothing is worth a pause.
    expect(stepThrough(tiny, tiny.solution).pauses).toHaveLength(0);
    expect(stepThrough(tiny, startOnly, everything).pauses.length).toBeGreaterThan(0);
    let fewer = false;
    for (const level of PUZZLE_LEVELS) {
      const wired = wiredRule(level, level.solution);
      const wiredPauses = stepThrough(level, level.solution);
      const shownPauses = stepThrough(level, level.solution, shownRule(level, level.solution));
      for (const p of wiredPauses.pauses) for (const k of p.fired) expect(wired.accepts(k)).toBe(true);
      if (shownPauses.pauses.length > wiredPauses.pauses.length) fewer = true;
      expect(wiredPauses.end).toEqual(shownPauses.end);
    }
    expect(fewer).toBe(true);
  });

  it('hidden scenery never pauses, though its outputs do rise', () => {
    // Win plumbing rises in the win tick of the tiny level; with every output counted that tick would pause, with the board rule it does not.
    const counted = stepThrough(tiny, tiny.solution, everything);
    const shown = stepThrough(tiny, tiny.solution);
    expect(shown.end.outcome).toBe('win');
    for (const p of shown.pauses) for (const k of p.fired) expect(k.startsWith('end|')).toBe(false);
    expect(counted.pauses.length).toBeGreaterThanOrEqual(shown.pauses.length);
  });

  it('on every level no pause comes from a scenery card or a hidden port', () => {
    for (const level of PUZZLE_LEVELS) {
      const rule = shownRule(level, level.solution);
      for (const p of stepThrough(level, level.solution).pauses) {
        for (const k of p.fired) {
          expect(rule.accepts(k)).toBe(true);
          expect(isSceneryNode(level, k.split('|')[0] ?? '')).toBe(false);
        }
      }
    }
  });

  it('an output the board does not show never pauses', () => {
    const rule: Rule = { accepts: (key) => key === 'p1|never' };
    expect(stepThrough(tiny, startOnly, rule).pauses).toHaveLength(0);
  });

  it('one pause per tick, even when several outputs rise together; ticks strictly increase', () => {
    let sawSeveral = false;
    for (const level of PUZZLE_LEVELS) {
      const { pauses } = stepThrough(level, level.solution);
      const ticks = pauses.map((p) => p.tick);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
      if (pauses.some((p) => p.fired.size > 1)) sawSeveral = true;
    }
    expect(sawSeveral).toBe(true);
  });
});

describe('the time limit counts game time only', () => {
  it('timeIsUp follows ticks run, not wall time', () => {
    expect(timeIsUp(0, 2)).toBe(false);
    expect(timeIsUp(Math.round(2 / TICK_DT) - 1, 2)).toBe(false);
    expect(timeIsUp(Math.round(2 / TICK_DT), 2)).toBe(true);
  });

  it('a frozen pacer runs no ticks however long the pause lasts, and resuming does not replay it', () => {
    const pacer = createSimPacer(createAccumulator());
    pacer.pause();
    let ticks = 0;
    for (let i = 0; i < 600; i++) ticks += pacer.stepsFor(0.1); // a minute of wall time
    expect(ticks).toBe(0);
    pacer.resume();
    expect(pacer.stepsFor(0.0167)).toBeLessThanOrEqual(1);
  });

  it('a run with pauses ends at exactly the limit, the same as without pauses', () => {
    const level = PUZZLE_LEVELS[1]!;
    const normal = runLevel(level, level.solution, 0.5);
    const stepped = stepThrough(level, level.solution, undefined, 0.5);
    expect(normal.outcome).toBe('timeout');
    expect(stepped.pauses.length).toBeGreaterThan(0);
    expect(stepped.end).toEqual(normal);
    expect(stepped.end.seconds).toBeCloseTo(0.5, 5);
  });
});
