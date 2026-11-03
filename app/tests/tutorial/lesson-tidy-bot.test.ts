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
  const lesson = findLesson('tidy-bot')!;
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

describe('tidy-bot lesson', () => {
  it('is registered once in a chapter, ends on an info step, and has unique step ids', () => {
    const lesson = findLesson('tidy-bot')!;
    expect(LESSONS.filter((l) => l.id === 'tidy-bot')).toHaveLength(1);
    expect(chapterOf('tidy-bot')).toBeDefined();
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('starts as a valid board without the pieces it teaches', () => {
    const board = findLesson('tidy-bot')!.createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    for (const k of ['route-follow', 'next-free-slot', 'go-to']) expect(kinds).not.toContain(k);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  /** Plays the lesson through the editor API, asserting each step waits for its edit. */
  function solve() {
    const s = session();
    const g = (): Graph => s.state.getGraph();
    const byParam = (kind: string, key: string, value: unknown): string =>
      g().nodes.find((n) => n.kind === kind && n.params[key] === value)!.id;
    const slotAt = (x: number): string => g().nodes.find((n) => n.params.color === '#f59e0b' && (n.params.position as { x: number }).x === x)!.id;
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    const add = (kind: string): string => {
      let id = '';
      s.do(() => {
        id = s.state.addNode(kind, { x: 40, y: 700 })!;
      });
      return id;
    };
    const guard = byParam('character', 'color', '#ef4444');
    const porter = byParam('character', 'color', '#3b82f6');

    s.runner.next();
    expect(s.stepId()).toBe('add-route');
    const route = add('route-follow');
    expect(s.stepId()).toBe('wire-route');
    connect(p(guard, 'self'), p(route, 'self'));
    expect(s.stepId()).toBe('wire-route');
    connect(p(route, 'moveX'), p(guard, 'moveX'));
    expect(s.stepId()).toBe('start-route-follow-on');
    const start = g().nodes.find((n) => n.kind === 'on-start')!.id;
    connect(p(start, 'started'), p(route, 'on'));
    expect(s.stepId()).toBe('stop-for');
    s.do(() => s.state.setParam(route, 'stopFor', 0));
    expect(s.stepId()).toBe('stop-for');
    s.do(() => s.state.setParam(route, 'stopFor', 1));
    expect(s.stepId()).toBe('watch-guard');
    s.do(() => s.state.setPlaying(true));
    expect(s.stepId()).toBe('back-to-edit');
    s.do(() => s.state.setPlaying(false));
    expect(s.stepId()).toBe('add-picker');
    const picker = add('next-free-slot');
    expect(s.stepId()).toBe('wire-slots');
    connect(p(slotAt(6), 'self'), p(picker, 's1'));
    expect(s.stepId()).toBe('wire-slots');
    connect(p(slotAt(10), 'self'), p(picker, 's2'));
    expect(s.stepId()).toBe('add-go-to');
    const go = add('go-to');
    expect(s.stepId()).toBe('wire-go');
    connect(p(porter, 'self'), p(go, 'self'));
    connect(p(picker, 'slot'), p(go, 'target'));
    expect(s.stepId()).toBe('wire-go');
    connect(p(go, 'moveX'), p(porter, 'moveX'));
    expect(s.stepId()).toBe('start-go-to-go');
    connect(p(start, 'started'), p(go, 'go'));
    expect(s.stepId()).toBe('play');
    return { s, guard, porter };
  }

  it('every step with a target resolves while it is the current one', () => {
    const { s } = solve();
    const snap = takeSnapshot(s.state, null);
    for (const st of s.lesson.steps) {
      if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    }
    s.do(() => s.state.setPlaying(true));
    expect(s.stepId()).toBe('done');
  });

  it('the finished board works: the guard stops at its points and the porter walks to the free slot', () => {
    const { s, guard, porter } = solve();
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const stops: boolean[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      stops.push(rt.getOutput(s.state.getGraph().nodes.find((n) => n.kind === 'route-follow')!.id, 'atPoint') === true);
    }
    expect(stops.filter(Boolean).length).toBeGreaterThan(60);
    const at = (owner: string): number => world.entities().find((e) => e.ownerNodeId === owner)!.position.x;
    expect(Math.abs(at(porter) - 10)).toBeLessThan(0.8);
    expect(at(guard)).toBeGreaterThan(-9);
  });
});
