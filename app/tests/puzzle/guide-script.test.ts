import { describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel } from '../../src/puzzle/run-level';
import { EMPTY_BOARD, connect, placePiece, setParam, toAnswer, type BoardState } from '../../src/puzzle/ui/board-state';
import {
  buildGuideSteps,
  currentStepIndex,
  hasGuide,
  isStepDone,
  newKindsOf,
  resolveSolutionNode,
  solutionSteps,
  type GuideStep,
} from '../../src/puzzle/ui/guide-script';

registerAllNodes();

const GUIDED = PUZZLE_LEVELS.filter((l) => l.order <= 7);
const level8 = PUZZLE_LEVELS.find((l) => l.order === 8);

/** Does what the step asks, the way the player would. */
function perform(step: GuideStep, level: (typeof GUIDED)[number], state: BoardState): BoardState {
  switch (step.type) {
    case 'piece': {
      const next = placePiece(level, state, step.slot, { x: 0, y: 0 });
      if (!next) throw new Error(`cannot place ${step.kind}`);
      return next;
    }
    case 'param': {
      const id = resolveSolutionNode(level, state, step.solNode);
      if (!id) throw new Error('piece not placed');
      return setParam(level, state, id, step.paramId, step.value);
    }
    case 'wire': {
      const from = resolveSolutionNode(level, state, step.wire.from.node);
      const to = resolveSolutionNode(level, state, step.wire.to.node);
      if (!from || !to) throw new Error('piece not placed');
      const res = connect(level, state, { node: from, port: step.wire.from.port, dir: 'out' }, { node: to, port: step.wire.to.port, dir: 'in' });
      if (res.ok) return res.state;
      throw new Error(res.message);
    }
    default:
      return state;
  }
}

describe('guide steps', () => {
  it('covers 7 guided levels and leaves level 8 alone', () => {
    expect(GUIDED).toHaveLength(7);
    expect(level8).toBeDefined();
    if (level8) {
      expect(hasGuide(level8)).toBe(false);
      expect(buildGuideSteps(level8)).toEqual([]);
      expect(solutionSteps(level8).length).toBeGreaterThan(0); // the "?" hint still works there
    }
  });

  describe.each(GUIDED.map((l) => [l.order, l] as const))('level %i', (_order, level) => {
    const steps = buildGuideSteps(level);

    it('opens with a line, ends with "press run", and keeps lines short', () => {
      expect(hasGuide(level)).toBe(true);
      expect(steps[0]?.type).toBe('intro');
      expect(steps[steps.length - 1]?.type).toBe('run');
      for (const s of steps) {
        const words = s.text.trim().split(/\s+/).length;
        expect(words, s.text).toBeGreaterThanOrEqual(3);
        expect(words, s.text).toBeLessThanOrEqual(16);
      }
    });

    it('has a step for every solution piece and every solution wire', () => {
      const pieces = steps.filter((s) => s.type === 'piece').map((s) => (s.type === 'piece' ? s.solNode : ''));
      expect(pieces.sort()).toEqual(level.solution.nodes.map((n) => n.id).sort());
      const wires = steps.filter((s) => s.type === 'wire').map((s) => (s.type === 'wire' ? s.wire.id : ''));
      expect(wires.sort()).toEqual(level.solution.wires.map((w) => w.id).sort());
    });

    it('takes a piece before any wire that uses it', () => {
      const placed = new Set<string>();
      for (const s of steps) {
        if (s.type === 'piece') placed.add(s.solNode);
        if (s.type === 'wire') {
          for (const end of [s.wire.from.node, s.wire.to.node]) {
            if (level.solution.nodes.some((n) => n.id === end)) expect(placed.has(end), `${s.wire.id} needs ${end}`).toBe(true);
          }
        }
      }
    });

    it('introduces each new kind once, with "Mảnh mới!"', () => {
      const fresh = newKindsOf(level);
      const intros = steps.filter((s) => s.type === 'piece' && s.isNew);
      for (const s of intros) expect(s.text.startsWith('Mảnh mới!')).toBe(true);
      const usedFresh = new Set(level.solution.nodes.map((n) => n.kind).filter((k) => fresh.has(k)));
      expect(intros.map((s) => (s.type === 'piece' ? s.kind : '')).sort()).toEqual([...usedFresh].sort());
    });

    it('follows to a real win, one step at a time', () => {
      let state = EMPTY_BOARD;
      introDoneLoop: for (let guard = 0; guard < 60; guard++) {
        const idx = currentStepIndex(steps, level, state, false, true);
        const step = steps[idx];
        expect(step).toBeDefined();
        if (!step || step.type === 'run') break introDoneLoop;
        expect(isStepDone(step, level, state, false)).toBe(false);
        state = perform(step, level, state);
        expect(isStepDone(step, level, state, false)).toBe(true);
      }
      expect(currentStepIndex(steps, level, state, false, true)).toBe(steps.length - 1);
      expect(currentStepIndex(steps, level, state, true, true)).toBe(steps.length);
      expect(runLevel(level, toAnswer(state)).outcome).toBe('win');
    });

    it('goes back a step when the player undoes something', () => {
      let state = EMPTY_BOARD;
      for (const s of steps) state = perform(s, level, state);
      expect(currentStepIndex(steps, level, state, false, true)).toBe(steps.length - 1);
      const lastWire = state.wires[state.wires.length - 1];
      if (!lastWire) throw new Error('no wire');
      const undone = { ...state, wires: state.wires.slice(0, -1) };
      const back = steps[currentStepIndex(steps, level, undone, false, true)];
      expect(back?.type === 'wire' && back.wire.to.port === lastWire.to.port).toBe(true);
    });
  });

  it('asks for the non-default number where the solution needs one', () => {
    const level3 = GUIDED.find((l) => l.order === 3);
    const level6 = GUIDED.find((l) => l.order === 6);
    const level7 = GUIDED.find((l) => l.order === 7);
    const params = (l: typeof level3) => (l ? solutionSteps(l).filter((s) => s.type === 'param') : []);
    expect(params(level3).map((s) => (s.type === 'param' ? [s.paramId, s.value] : null))).toEqual([['value', 3]]);
    expect(params(level6).map((s) => (s.type === 'param' ? [s.paramId, s.value] : null))).toEqual([['threshold', 3]]);
    expect(params(level7).map((s) => (s.type === 'param' ? [s.paramId, s.value] : null))).toEqual([['seconds', 3]]);
    expect(params(GUIDED.find((l) => l.order === 1))).toEqual([]);
  });
});
