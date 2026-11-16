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

describe('pid-control lesson', () => {
  const lesson = () => findLesson('pid-control')!;

  it('is registered once in a chapter, ends on an info step, and has unique step ids', () => {
    expect(LESSONS.filter((l) => l.id === 'pid-control')).toHaveLength(1);
    expect(chapterOf('pid-control')).toBeDefined();
    expect(lesson().steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson().steps.map((st) => st.id)).size).toBe(lesson().steps.length);
  });

  it('starts as a valid board without the pieces it teaches', () => {
    const board = lesson().createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    for (const k of ['pid', 'signal-plot']) expect(kinds).not.toContain(k);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  it('can be solved step by step, and the finished board keeps the robot on the target', () => {
    const state = createEditorState(lesson().createBoard());
    const runner = createRunner(lesson());
    const look = (): void => {
      runner.evaluate(takeSnapshot(state, null));
    };
    const g = (): Graph => state.getGraph();
    const doIt = (fn: () => void): void => {
      fn();
      look();
    };
    const connect = (a: PortRef, b: PortRef): void => doIt(() => expect(state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    const add = (kind: string): string => {
      let id = '';
      doIt(() => {
        id = state.addNode(kind, { x: 40, y: 800 })!;
      });
      return id;
    };
    look();
    const robot = g().nodes.find((n) => n.kind === 'character')!.id;
    const target = g().nodes.find((n) => n.kind === 'map-range')!.id;

    runner.next();
    expect(runner.step().id).toBe('add-pid');
    const pid = add('pid');
    expect(runner.step().id).toBe('wire-in');
    connect(p(robot, 'x'), p(pid, 'measured'));
    expect(runner.step().id).toBe('wire-in');
    connect(p(target, 'value'), p(pid, 'target'));
    expect(runner.step().id).toBe('wire-out');
    connect(p(pid, 'out'), p(robot, 'moveX'));
    expect(runner.step().id).toBe('add-plot');
    const plot = add('signal-plot');
    expect(runner.step().id).toBe('wire-plot');
    connect(p(target, 'value'), p(plot, 'a'));
    connect(p(robot, 'x'), p(plot, 'b'));
    expect(runner.step().id).toBe('wire-plot');
    connect(p(pid, 'out'), p(plot, 'c'));
    expect(runner.step().id).toBe('play');

    const snap = takeSnapshot(state, null);
    for (const st of lesson().steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    doIt(() => state.setPlaying(true));
    expect(runner.step().id).toBe('done');

    const world = createWorld('2d-side');
    const rt = createRuntime(state.getGraph(), world, '2d-side');
    for (let i = 0; i < 60 * 4; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const x = world.entities().find((e) => e.ownerNodeId === robot)!.position.x;
    expect(x).toBeGreaterThan(4);
  });
});
