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
  const lesson = findLesson('nearest-bot')!;
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

describe('nearest-bot lesson', () => {
  it('is registered once in a chapter, ends on an info step, and has unique step ids', () => {
    const lesson = findLesson('nearest-bot')!;
    expect(LESSONS.filter((l) => l.id === 'nearest-bot')).toHaveLength(1);
    expect(chapterOf('nearest-bot')).toBeDefined();
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('starts as a valid board without the pieces it teaches', () => {
    const board = findLesson('nearest-bot')!.createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    for (const k of ['nearest-item', 'go-to']) expect(kinds).not.toContain(k);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  /** Plays the lesson through the editor API, asserting each step waits for its edit. */
  function solve() {
    const s = session();
    const g = (): Graph => s.state.getGraph();
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b)).toEqual({ ok: true }));
    const add = (kind: string): string => {
      let id = '';
      s.do(() => {
        id = s.state.addNode(kind, { x: 40, y: 700 })!;
      });
      return id;
    };
    const bot = g().nodes.find((n) => n.kind === 'character')!.id;

    s.runner.next();
    expect(s.stepId()).toBe('add-finder');
    const finder = add('nearest-item');
    expect(s.stepId()).toBe('wire-who');
    connect(p(bot, 'self'), p(finder, 'who'));
    expect(s.stepId()).toBe('add-go-to');
    const go = add('go-to');
    expect(s.stepId()).toBe('wire-go');
    connect(p(bot, 'self'), p(go, 'self'));
    connect(p(finder, 'item'), p(go, 'target'));
    expect(s.stepId()).toBe('wire-go');
    connect(p(finder, 'found'), p(go, 'go'));
    expect(s.stepId()).toBe('wire-go');
    connect(p(go, 'moveX'), p(bot, 'moveX'));
    expect(s.stepId()).toBe('play');
    return { s, bot };
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

  it('the finished board works: the bot walks to the nearer crate, not the far one', () => {
    const { s, bot } = solve();
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    for (let i = 0; i < 60 * 8; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const x = world.entities().find((e) => e.ownerNodeId === bot)!.position.x;
    expect(x).toBeGreaterThan(3.5);
    expect(x).toBeLessThan(5.2);
  });
});
