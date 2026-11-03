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
  const lesson = findLesson('sight-forecast')!;
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

describe('sight-forecast lesson', () => {
  it('is registered once in a chapter, ends on an info step, and has unique step ids', () => {
    const lesson = findLesson('sight-forecast')!;
    expect(LESSONS.filter((l) => l.id === 'sight-forecast')).toHaveLength(1);
    expect(chapterOf('sight-forecast')).toBeDefined();
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('starts as a valid board with the guard, its eyes and its walk, but not the piece it teaches', () => {
    const board = findLesson('sight-forecast')!.createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    expect(kinds).not.toContain('sight-forecast');
    for (const k of ['patrol', 'vision-sensor', 'show-number']) expect(kinds).toContain(k);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  function solve() {
    const s = session();
    const g = (): Graph => s.state.getGraph();
    const byColor = (color: string): string => g().nodes.find((n) => n.kind === 'character' && n.params.color === color)!.id;
    const one = (kind: string): string => g().nodes.find((n) => n.kind === kind)!.id;
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b, { replace: true })).toEqual({ ok: true }));
    const guard = byColor('#ef4444');
    const you = byColor('#3b82f6');
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-forecast');
    let fore = '';
    s.do(() => {
      fore = s.state.addNode('sight-forecast', { x: 40, y: 700 })!;
    });
    expect(s.stepId()).toBe('wire-viewer');
    connect(p(guard, 'self'), p(fore, 'viewer'));
    expect(s.stepId()).toBe('wire-viewer'); // the patrol wire is still missing
    connect(p(one('patrol'), 'route'), p(fore, 'patrol'));
    expect(s.stepId()).toBe('wire-target');
    connect(p(you, 'self'), p(fore, 'target'));
    expect(s.stepId()).toBe('wire-out');
    connect(p(fore, 'window'), p(one('show-number'), 'value'));
    expect(s.stepId()).toBe('wire-out');
    connect(p(fore, 'safe'), p(one('show-text'), 'show'));
    expect(s.stepId()).toBe('play');
    return { s, fore, guard, you };
  }

  it('every step with a target resolves while it is the current one, and playing it reaches the end', () => {
    const { s } = solve();
    const snap = takeSnapshot(s.state, null);
    for (const st of s.lesson.steps) {
      if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    }
    s.do(() => s.state.setPlaying(true));
    expect(s.stepId()).toBe('back-to-edit');
    s.do(() => s.state.setPlaying(false));
    expect(s.stepId()).toBe('done');
  });

  it('the finished board counts down to the sight and says "an toàn" while it is far off', () => {
    const { s, fore } = solve();
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const lefts: number[] = [];
    const safes: boolean[] = [];
    let seen = false;
    for (let i = 0; i < 60 * 14; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      lefts.push(rt.getOutput(fore, 'window') as number);
      safes.push(rt.getOutput(fore, 'safe') === true);
      seen ||= rt.getOutput(s.state.getGraph().nodes.find((n) => n.kind === 'vision-sensor')!.id, 'seen') === true;
    }
    // The guard sees the player at some point, and the forecast counts down to it first.
    expect(seen).toBe(true);
    const firstSeen = lefts.findIndex((v, i) => i > 5 && v === 0);
    expect(firstSeen).toBeGreaterThan(30);
    expect(lefts[firstSeen - 30]!).toBeGreaterThan(0.3);
    expect(lefts[firstSeen - 30]!).toBeLessThan(0.8);
    expect(safes.filter(Boolean).length).toBeLessThan(lefts.length);
  });
});
