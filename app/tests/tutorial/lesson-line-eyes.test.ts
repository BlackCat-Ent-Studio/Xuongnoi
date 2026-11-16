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
  const lesson = findLesson('line-eyes')!;
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

describe('line-eyes lesson', () => {
  it('is registered once in a chapter, ends on an info step, and has unique step ids', () => {
    const lesson = findLesson('line-eyes')!;
    expect(LESSONS.filter((l) => l.id === 'line-eyes')).toHaveLength(1);
    expect(chapterOf('line-eyes')).toBeDefined();
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('starts as a valid top-down board with the character, stick and read-outs but not the two pieces it teaches', () => {
    const board = findLesson('line-eyes')!.createBoard();
    expect(board.mode).toBe('2d-top');
    const kinds = board.graph.nodes.map((n) => n.kind);
    expect(kinds).not.toContain('line-track');
    expect(kinds).not.toContain('line-sensor');
    for (const k of ['stick', 'character', 'show-number', 'show-text']) expect(kinds).toContain(k);
  });

  it('can be solved step by step, and the finished board reads the line while walking over it', () => {
    const s = session();
    const g = (): Graph => s.state.getGraph();
    const one = (kind: string): string => g().nodes.find((n) => n.kind === kind)!.id;
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-track');
    let track = '';
    s.do(() => {
      track = s.state.addNode('line-track', { x: 40, y: 700 })!;
    });
    expect(s.stepId()).toBe('add-eye');
    let eye = '';
    s.do(() => {
      eye = s.state.addNode('line-sensor', { x: 400, y: 700 })!;
    });
    expect(s.stepId()).toBe('wire-who');
    connect(p(one('character'), 'self'), p(eye, 'who'));
    expect(s.stepId()).toBe('wire-who'); // the line is still missing
    connect(p(track, 'self'), p(eye, 'track'));
    expect(s.stepId()).toBe('wire-out');
    connect(p(eye, 'level'), p(one('show-number'), 'value'));
    expect(s.stepId()).toBe('wire-out');
    connect(p(eye, 'onLine'), p(one('show-text'), 'show'));
    expect(s.stepId()).toBe('set-side');
    s.do(() => s.state.setParam(eye, 'side', 0.25));
    expect(s.stepId()).toBe('play');

    const snap = takeSnapshot(s.state, null);
    for (const st of s.lesson.steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);

    // Walk along the top edge of the oval with the eye back in the middle: it sees the line, then the character walks away from it.
    const centred: Graph = { ...g(), nodes: g().nodes.map((n) => (n.id === eye ? { ...n, params: { ...n.params, side: 0 } } : n)) };
    const world = createWorld('2d-top');
    const rt = createRuntime(centred, world, '2d-top');
    const on: boolean[] = [];
    for (let i = 0; i < 60 * 8; i++) {
      rt.tick({ keysDown: new Set(['ArrowRight', 'KeyD']) });
      world.step(TICK_DT);
      on.push(rt.getOutput(eye, 'onLine') === true);
    }
    expect(on.some(Boolean)).toBe(true);
    expect(on.at(-1)).toBe(false);

    s.do(() => s.state.setPlaying(true));
    expect(s.stepId()).toBe('back-to-edit');
    s.do(() => s.state.setPlaying(false));
    expect(s.stepId()).toBe('done');
  });
});
