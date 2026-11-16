import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session() {
  const lesson = findLesson('two-motor-robot')!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  const look = (): void => {
    runner.evaluate(takeSnapshot(state, null));
  };
  look();
  return {
    lesson,
    state,
    runner,
    stepId: () => runner.step().id,
    do(fn: () => void): void {
      fn();
      look();
    },
  };
}

describe('two-motor-robot lesson', () => {
  it('is registered once in a chapter, is a top-down board, ends on an info step, has unique step ids', () => {
    const lesson = findLesson('two-motor-robot')!;
    expect(LESSONS.filter((l) => l.id === 'two-motor-robot')).toHaveLength(1);
    expect(chapterOf('two-motor-robot')).toBeDefined();
    expect(lesson.createBoard().mode).toBe('2d-top');
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('starts as a valid board without the chassis or the motors it teaches', () => {
    const board = findLesson('two-motor-robot')!.createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    expect(kinds).not.toContain('robot-body');
    expect(kinds).not.toContain('motor');
    expect(kinds.filter((k) => k === 'math')).toHaveLength(2);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  function solve() {
    const s = session();
    const g = (): Graph => s.state.getGraph();
    const mix = (op: string): string => g().nodes.find((n) => n.kind === 'math' && n.params.op === op)!.id;
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-body');
    let body = '';
    s.do(() => {
      body = s.state.addNode('robot-body', { x: 40, y: 700 })!;
    });
    expect(s.stepId()).toBe('add-motors');
    const motors: string[] = [];
    s.do(() => motors.push(s.state.addNode('motor', { x: 300, y: 700 })!));
    expect(s.stepId()).toBe('add-motors'); // two are needed
    s.do(() => motors.push(s.state.addNode('motor', { x: 560, y: 700 })!));
    expect(s.stepId()).toBe('mount');
    connect(p(body, 'self'), p(motors[0]!, 'body'));
    expect(s.stepId()).toBe('mount'); // the second one is still loose
    connect(p(body, 'self'), p(motors[1]!, 'body'));
    expect(s.stepId()).toBe('left-side');
    s.do(() => s.state.setParam(motors[1]!, 'side', 0.4));
    expect(s.stepId()).toBe('left-side');
    s.do(() => s.state.setParam(motors[1]!, 'side', -0.4));
    expect(s.stepId()).toBe('power');
    connect(p(mix('add'), 'out'), p(motors[1]!, 'power'));
    expect(s.stepId()).toBe('power');
    connect(p(mix('sub'), 'out'), p(motors[0]!, 'power'));
    expect(s.stepId()).toBe('play');
    return { s, body, motors };
  }

  it('every step with a target resolves while it is the current one, and playing it reaches the heavy-robot step', () => {
    const { s, body } = solve();
    const snap = takeSnapshot(s.state, null);
    for (const st of s.lesson.steps) {
      if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    }
    s.do(() => s.state.setPlaying(true));
    expect(s.stepId()).toBe('back-to-edit');
    s.do(() => s.state.setPlaying(false));
    expect(s.stepId()).toBe('heavy');
    s.do(() => s.state.setParam(body, 'mass', 5));
    expect(s.stepId()).toBe('heavy');
    s.do(() => s.state.setParam(body, 'mass', 10));
    expect(s.stepId()).toBe('done');
  });

  function drive(graph: Graph, keys: string[], seconds: number) {
    const world = createWorld('2d-top');
    const rt = createRuntime(graph, world, '2d-top');
    for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
      rt.tick({ keysDown: new Set(keys) });
      world.step(TICK_DT);
    }
    return world.entities().find((e) => e.kind === 'robot')!;
  }

  it('the finished board drives forward on Up, spins on Right alone, and turns on Up + Right', () => {
    const { s } = solve();
    const graph = s.state.getGraph();
    const forward = drive(graph, ['ArrowUp'], 2);
    expect(forward.position.x).toBeGreaterThan(2);
    expect(Math.abs(forward.position.z)).toBeLessThan(0.01);
    const spin = drive(graph, ['ArrowRight'], 0.5);
    expect(Math.hypot(spin.position.x, spin.position.z)).toBeLessThan(0.05);
    expect(spin.robot!.heading).toBeGreaterThan(0.5);
    const arc = drive(graph, ['ArrowUp', 'ArrowRight'], 1);
    expect(arc.robot!.heading).toBeGreaterThan(0.5);
    expect(arc.position.x).toBeGreaterThan(0.3);
    expect(arc.position.z).toBeGreaterThan(0.1);
  });

  it('is not forced: the unfinished board never moves, and a missing power wire changes the path', () => {
    const { s, motors } = solve();
    const graph = s.state.getGraph();
    expect(drive(createEditorState(findLesson('two-motor-robot')!.createBoard()).getGraph(), ['ArrowUp'], 1)).toBeUndefined();
    // One second in, the one-wheel circle (radius 0.4 m) has not closed yet and the heading has not wrapped.
    const full = drive(graph, ['ArrowUp'], 1);
    const cut: Graph = { ...graph, wires: graph.wires.filter((w) => !(w.to.node === motors[1] && w.to.port === 'power')) };
    const lame = drive(cut, ['ArrowUp'], 1);
    expect(lame.position.x).toBeLessThan(full.position.x - 0.8);
    expect(lame.robot!.heading).toBeLessThan(-0.3); // only the right wheel pushes: the nose swings left
  });
});
