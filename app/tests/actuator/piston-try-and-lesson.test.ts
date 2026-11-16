import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Graph, type PortRef } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { PUSH_FORCE_N } from '../../src/tutorial/lesson-piston-push';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const p = (node: string, port: string): PortRef => ({ node, port });

interface Play {
  y: number;
  x: number;
  overloaded: boolean;
  extended: boolean;
  force: number;
}

/** Plays a board for `seconds` and reports where the crate ended up and what the piston said. */
function play(board: Board, tweak?: (g: Graph) => Graph, seconds = 8): Play {
  const graph = tweak ? tweak(board.graph) : board.graph;
  const world = createWorld(board.mode, worldOptionsForGraph(graph));
  const rt = createRuntime(graph, world, board.mode);
  const piston = graph.nodes.find((n) => n.kind === 'linear-actuator')!.id;
  let peak = 0;
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set<string>() });
    world.step(TICK_DT);
    peak = Math.max(peak, (rt.getOutput(piston, 'force') as number) ?? 0);
  }
  const crate = world.entities().find((e) => e.kind === 'item')!;
  return {
    x: crate.position.x,
    y: crate.position.y,
    overloaded: rt.getOutput(piston, 'overloaded') === true,
    extended: rt.getOutput(piston, 'extended') === true,
    force: peak,
  };
}

const withCrateMass = (kg: number) => (g: Graph): Graph => ({
  ...g,
  nodes: g.nodes.map((n) => (n.kind === 'item' ? { ...n, params: { ...n.params, mass: kg } } : n)),
});
const withMaxForce = (n: number) => (g: Graph): Graph => ({
  ...g,
  nodes: g.nodes.map((x) => (x.kind === 'linear-actuator' ? { ...x, params: { ...x.params, maxForce: n } } : x)),
});
const without = (from: string, to: string) => (g: Graph): Graph => ({
  ...g,
  wires: g.wires.filter((w) => !(g.nodes.find((n) => n.id === w.from.node)?.kind === from && g.nodes.find((n) => n.id === w.to.node)?.kind === to)),
});

describe('handbook "Thử ngay" board of the Xi lanh đẩy', () => {
  const board = handbookEntry('linear-actuator')!.tryBoard();

  it('a zone sensor triggers the piston: the 10 kg crate is pushed off the platform and falls', () => {
    const r = play(board);
    expect(r.y).toBeLessThan(-2);
    expect(r.x).toBeGreaterThan(4.7);
    expect(r.overloaded).toBe(false);
    expect(r.force).toBeCloseTo(49.05, 3);
  });

  it('a 30 kg crate stalls the piston (Quá tải) until the maximum force is raised above 147 N', () => {
    const heavy = play(board, withCrateMass(30));
    expect(heavy.y).toBeCloseTo(0.3, 2);
    expect(heavy.x).toBeCloseTo(4, 2);
    expect(heavy.overloaded).toBe(true);
    expect(heavy.force).toBeCloseTo(100, 6);
    const raised = play(board, (g) => withMaxForce(150)(withCrateMass(30)(g)));
    expect(raised.overloaded).toBe(false);
    expect(raised.y).toBeLessThan(-2);
  });

  it('anti-forced: without the trigger wire into "Đẩy ra" (or without the zone) nothing is pushed', () => {
    for (const cut of [without('latch', 'linear-actuator'), without('zone', 'latch')]) {
      const r = play(board, cut);
      expect(r.x).toBeCloseTo(4, 3);
      expect(r.y).toBeCloseTo(0.3, 2);
      expect(r.force).toBe(0);
    }
  });
});

describe('lesson "Xi lanh đẩy thùng" (piston-push)', () => {
  it('is registered once, in the Robot chapter, ends on an info step and has unique step ids', () => {
    const lesson = findLesson('piston-push')!;
    expect(LESSONS.filter((l) => l.id === 'piston-push')).toHaveLength(1);
    expect(chapterOf('piston-push')?.id).toBe('robots');
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((s) => s.id)).size).toBe(lesson.steps.length);
  });

  it('can be solved step by step; the first run stalls, the raised force pushes the crate off', () => {
    const lesson = findLesson('piston-push')!;
    const state = createEditorState(lesson.createBoard());
    const runner = createRunner(lesson);
    const look = (): void => {
      runner.evaluate(takeSnapshot(state, null));
    };
    const step = (): string => runner.step().id;
    look();
    expect(step()).toBe('intro');
    runner.next();
    expect(step()).toBe('add-piston');
    const g = (): Graph => state.getGraph();
    const one = (kind: string): string => g().nodes.find((n) => n.kind === kind)!.id;
    expect(g().nodes.some((n) => n.kind === 'linear-actuator')).toBe(false);
    const piston = state.addNode('linear-actuator', { x: 860, y: 20 })!;
    look();
    expect(step()).toBe('wire-extend');
    expect(state.connect(p(one('latch'), 'on'), p(piston, 'extend'), { replace: true })).toEqual({ ok: true });
    look();
    expect(step()).toBe('wire-reset');
    expect(state.connect(p(piston, 'extended'), p(one('latch'), 'reset'), { replace: true })).toEqual({ ok: true });
    look();
    expect(step()).toBe('play-1');

    const snap = takeSnapshot(state, null);
    for (const st of lesson.steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);

    // As built the piston has 100 N and the crate needs 147 N.
    const board: Board = { name: 'x', mode: '2d-side', graph: g() };
    const first = play(board);
    expect(first.overloaded).toBe(true);
    expect(first.x).toBeCloseTo(4, 2);

    state.setPlaying(true);
    look();
    state.setPlaying(false);
    look();
    expect(step()).toBe('push-force');
    state.setParam(piston, 'maxForce', PUSH_FORCE_N);
    look();
    expect(step()).toBe('play-2');
    const second = play({ ...board, graph: g() });
    expect(second.overloaded).toBe(false);
    expect(second.y).toBeLessThan(-2);
  });
});
