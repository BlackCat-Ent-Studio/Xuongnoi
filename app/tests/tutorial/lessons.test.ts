import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState, type EditorState } from '../../src/editor/editor-state';
import { getNodeDef } from '../../src/engine/registry';
import type { GameResult, PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { hasWire } from '../../src/tutorial/graph-checks';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner, type Runner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';

beforeAll(() => registerAllNodes());

/** Drives a lesson with real editor-state operations, like the learner would. */
function session(lessonId: string) {
  const lesson = findLesson(lessonId);
  if (!lesson) throw new Error(`no lesson ${lessonId}`);
  const state = createEditorState(lesson.createBoard());
  const runner: Runner = createRunner(lesson);
  let ended: GameResult | null = null;
  const snap = (): Snapshot => ({
    graph: state.getGraph(),
    mode: state.getMode(),
    playing: state.isPlaying(),
    ended,
  });
  const tick = (): void => {
    runner.evaluate(snap());
  };
  tick();
  return {
    state,
    runner,
    stepId: () => runner.step().id,
    add(kind: string): string {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(`cannot add ${kind}`);
      tick();
      return id;
    },
    param(id: string, p: string, v: Parameters<EditorState['setParam']>[2]): void {
      state.setParam(id, p, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      const res = state.connect(from, to);
      expect(res).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      if (on) ended = null;
      tick();
    },
    end(result: GameResult): void {
      ended = result;
      tick();
    },
    idOf(kind: string): string {
      const n = state.getGraph().nodes.find((x) => x.kind === kind);
      if (!n) throw new Error(`no ${kind}`);
      return n.id;
    },
  };
}

const p = (node: string, port: string): PortRef => ({ node, port });

describe('lesson boards', () => {
  it('build without errors and only use known nodes and ports', () => {
    for (const lesson of LESSONS) {
      const board = lesson.createBoard();
      expect(board.mode).toBe('2d-side');
      for (const n of board.graph.nodes) expect(getNodeDef(n.kind)).toBeDefined();
      for (const w of board.graph.wires) {
        const from = board.graph.nodes.find((n) => n.id === w.from.node);
        const to = board.graph.nodes.find((n) => n.id === w.to.node);
        expect(getNodeDef(from?.kind ?? '')?.outputs.some((o) => o.id === w.from.port)).toBe(true);
        expect(getNodeDef(to?.kind ?? '')?.inputs.some((i) => i.id === w.to.port)).toBe(true);
      }
    }
  });

  it('gives a fresh independent board each time', () => {
    const lesson = LESSONS[1]!;
    const a = lesson.createBoard();
    a.graph.nodes.pop();
    expect(lesson.createBoard().graph.nodes.length).toBeGreaterThan(a.graph.nodes.length);
  });

  it('does not start with any step already finished', () => {
    for (const lesson of LESSONS) {
      const s = session(lesson.id);
      expect(s.runner.index()).toBe(0);
    }
  });

  it('has unique step ids and Vietnamese text on every step', () => {
    for (const lesson of LESSONS) {
      const ids = lesson.steps.map((st) => st.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const st of lesson.steps) {
        expect(st.title.length).toBeGreaterThan(0);
        expect(st.text.length).toBeGreaterThan(0);
      }
      expect(lesson.steps[lesson.steps.length - 1]?.check).toBeUndefined();
    }
  });
});

describe('lesson 1: walk and jump', () => {
  it('advances step by step as the learner builds', () => {
    const s = session('walk-jump');
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-floor');
    const floor = s.add('block');
    expect(s.stepId()).toBe('floor-size');
    s.param(floor, 'size', { x: 3, y: 1, z: 1 });
    expect(s.stepId()).toBe('floor-size'); // too short to be a floor
    s.param(floor, 'size', { x: 20, y: 1, z: 1 });
    expect(s.stepId()).toBe('add-hero');
    const hero = s.add('character');
    expect(s.stepId()).toBe('first-play');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('add-stick');
    const stick = s.add('stick');
    expect(s.stepId()).toBe('wire-stick');
    s.wire(p(stick, 'x'), p(hero, 'moveX'));
    expect(s.stepId()).toBe('add-key');
    const key = s.add('key');
    expect(s.stepId()).toBe('wire-key');
    s.wire(p(key, 'held'), p(hero, 'jump'));
    expect(s.stepId()).toBe('play-move');
    s.play(true);
    expect(s.stepId()).toBe('done');
    s.runner.next();
    expect(s.runner.isFinished()).toBe(true);
  });

  it('skips ahead over steps that are already satisfied', () => {
    const s = session('walk-jump');
    s.runner.next();
    const floor = s.add('block');
    s.add('character');
    s.param(floor, 'size', { x: 12, y: 1, z: 1 });
    expect(s.stepId()).toBe('first-play');
  });

  it('accepts the stick wired in either order of creation', () => {
    const s = session('walk-jump');
    s.runner.next();
    const hero = s.add('character');
    const stick = s.add('stick');
    s.wire(p(stick, 'x'), p(hero, 'moveX'));
    expect(hasWire(s.state.getGraph(), { kind: 'stick', port: 'x' }, { kind: 'character', port: 'moveX' })).toBe(true);
  });
});

describe('lesson 2: collect stars', () => {
  it('starts with a character that already moves, and teaches the star chain', () => {
    const s = session('collect-stars');
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-star');
    const hero = s.idOf('character');
    const star = s.add('block');
    expect(s.stepId()).toBe('star-type');
    s.param(star, 'type', 'pickup');
    expect(s.stepId()).toBe('star-place');
    s.param(star, 'position', { x: 4, y: 1, z: 0 });
    expect(s.stepId()).toBe('add-touch');
    const touch = s.add('touch');
    s.wire(p(hero, 'self'), p(touch, 'a'));
    expect(s.stepId()).toBe('wire-touch-b');
    s.wire(p(star, 'self'), p(touch, 'b'));
    expect(s.stepId()).toBe('wire-hide');
    s.wire(p(touch, 'touching'), p(star, 'hide'));
    expect(s.stepId()).toBe('add-counter');
    const counter = s.add('counter');
    s.wire(p(touch, 'began'), p(counter, 'up'));
    expect(s.stepId()).toBe('add-show');
    const show = s.add('show-number');
    s.wire(p(counter, 'value'), p(show, 'value'));
    expect(s.stepId()).toBe('play-collect');
    s.play(true);
    expect(s.stepId()).toBe('done');
  });
});

describe('lesson 3: win and lose', () => {
  it('walks through win condition, lose condition and the win result', () => {
    const s = session('win-lose');
    s.runner.next();
    expect(s.stepId()).toBe('goal');
    const counter = s.idOf('counter');
    s.param(counter, 'target', 1);
    expect(s.stepId()).toBe('add-end');
    const end = s.add('win-lose');
    s.wire(p(counter, 'reached'), p(end, 'win'));
    expect(s.stepId()).toBe('add-compare');
    const cmp = s.add('compare');
    const hero = s.idOf('character');
    s.wire(p(hero, 'y'), p(cmp, 'a'));
    expect(s.stepId()).toBe('compare-op');
    s.param(cmp, 'op', 'lt');
    expect(s.stepId()).toBe('add-const');
    const c = s.add('const');
    expect(s.stepId()).toBe('const-value');
    s.param(c, 'value', -5);
    expect(s.stepId()).toBe('wire-limit');
    s.wire(p(c, 'value'), p(cmp, 'b'));
    expect(s.stepId()).toBe('wire-lose');
    s.wire(p(cmp, 'out'), p(end, 'lose'));
    expect(s.stepId()).toBe('play-win');
    s.play(true);
    expect(s.stepId()).toBe('win');
    s.end('lose');
    expect(s.stepId()).toBe('win');
    s.play(false);
    s.play(true);
    s.end('win');
    expect(s.stepId()).toBe('done');
  });

  it('rejects a counter goal that more stars than exist could never reach', () => {
    const s = session('win-lose');
    s.runner.next();
    expect(s.stepId()).toBe('goal');
    s.param(s.idOf('counter'), 'target', 5);
    expect(s.stepId()).toBe('goal');
  });
});

describe('step targets', () => {
  it('resolve to selectors for every step of every lesson on the starting board', () => {
    for (const lesson of LESSONS) {
      const state = createEditorState(lesson.createBoard());
      const snap: Snapshot = { graph: state.getGraph(), mode: state.getMode(), playing: false, ended: null };
      for (const step of lesson.steps) {
        const list = step.target?.(snap) ?? [];
        for (const t of list) {
          for (const sel of typeof t === 'string' ? [t] : t) expect(sel.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
