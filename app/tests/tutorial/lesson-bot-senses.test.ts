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
const SENSORS = ['vision-sensor', 'speed-sensor', 'ahead-sensor', 'color-sensor'];

function session() {
  const lesson = findLesson('bot-senses')!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  let ended: 'win' | 'lose' | null = null;
  const look = (): void => {
    runner.evaluate(takeSnapshot(state, ended));
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
    finish(result: 'win' | 'lose'): void {
      ended = result;
      look();
    },
  };
}

describe('bot-senses lesson', () => {
  it('is registered once in a chapter, ends on an info step, and has unique step ids', () => {
    const lesson = findLesson('bot-senses')!;
    expect(LESSONS.filter((l) => l.id === 'bot-senses')).toHaveLength(1);
    expect(chapterOf('bot-senses')).toBeDefined();
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  it('starts as a valid board with none of the sensors yet', () => {
    const board = findLesson('bot-senses')!.createBoard();
    const kinds = board.graph.nodes.map((n) => n.kind);
    for (const k of SENSORS) expect(kinds).not.toContain(k);
    const ids = new Set(board.graph.nodes.map((n) => n.id));
    expect(board.graph.wires.every((w) => ids.has(w.from.node) && ids.has(w.to.node))).toBe(true);
  });

  /** Plays the lesson through the editor API, asserting each step waits for its edit. */
  function solve(heroSpeed: number) {
    const s = session();
    const g = (): Graph => s.state.getGraph();
    const byKind = (kind: string, where?: (n: Graph['nodes'][number]) => boolean) => g().nodes.find((n) => n.kind === kind && (!where || where(n)))!.id;
    const connect = (a: PortRef, b: PortRef): void => s.do(() => expect(s.state.connect(a, b)).toEqual({ ok: true }));
    const add = (kind: string): string => {
      let id = '';
      s.do(() => {
        id = s.state.addNode(kind, { x: 40, y: 700 })!;
      });
      return id;
    };
    const hero = byKind('character', (n) => n.params.role !== 'bot');
    const guard = byKind('character', (n) => n.params.role === 'bot');
    const both = byKind('and');
    const end = byKind('win-lose');
    const hint = byKind('show-text');

    s.runner.next();
    expect(s.stepId()).toBe('add-vision');
    const vision = add('vision-sensor');
    expect(s.stepId()).toBe('wire-viewer');
    connect(p(guard, 'self'), p(vision, 'viewer'));
    expect(s.stepId()).toBe('wire-target');
    connect(p(hero, 'self'), p(vision, 'target'));
    expect(s.stepId()).toBe('add-speed');
    const speed = add('speed-sensor');
    connect(p(hero, 'self'), p(speed, 'who'));
    expect(s.stepId()).toBe('wire-seen-fast');
    connect(p(vision, 'seen'), p(both, 'a'));
    expect(s.stepId()).toBe('wire-seen-fast');
    connect(p(speed, 'fast'), p(both, 'b'));
    expect(s.stepId()).toBe('wire-lose');
    connect(p(both, 'out'), p(end, 'lose'));
    expect(s.stepId()).toBe('add-ahead');
    const ahead = add('ahead-sensor');
    connect(p(hero, 'self'), p(ahead, 'who'));
    expect(s.stepId()).toBe('wire-ahead-text');
    connect(p(ahead, 'blocked'), p(hint, 'show'));
    expect(s.stepId()).toBe('add-color');
    const color = add('color-sensor');
    connect(p(hero, 'self'), p(color, 'who'));
    expect(s.stepId()).toBe('color-want');
    s.do(() => s.state.setParam(color, 'want', 2));
    expect(s.stepId()).toBe('color-want');
    s.do(() => s.state.setParam(color, 'want', 3));
    expect(s.stepId()).toBe('wire-win');
    connect(p(color, 'match'), p(end, 'win'));
    expect(s.stepId()).toBe('sneak');
    s.do(() => s.state.setParam(hero, 'speed', 4));
    expect(s.stepId()).toBe('sneak');
    s.do(() => s.state.setParam(hero, 'speed', heroSpeed));
    return s;
  }

  it('every step with a target resolves while it is the current one', () => {
    const s = solve(2);
    const snap = takeSnapshot(s.state, null);
    for (const st of s.lesson.steps) {
      if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);
    }
    expect(s.stepId()).toBe('play');
    s.do(() => s.state.setPlaying(true));
    expect(s.stepId()).toBe('won');
    s.finish('win');
    expect(s.stepId()).toBe('done');
  });

  function race(speed: number, ticksMax = 60 * 30) {
    const s = solve(speed);
    const graph = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    const keys = new Set(['ArrowRight', 'Space']);
    for (let i = 0; i < ticksMax && !world.ended; i++) {
      rt.tick({ keysDown: keys });
      world.step(TICK_DT);
    }
    return world;
  }

  it('sneaking past the guard (speed 2, jumping the wall) reaches the green strip and wins', () => {
    const world = race(2);
    expect(world.ended?.result).toBe('win');
  });

  it('running (speed 5) in front of the guard loses', () => {
    const world = race(5);
    expect(world.ended?.result).toBe('lose');
  });

  it('the unfinished board never ends the game', () => {
    const board = findLesson('bot-senses')!.createBoard();
    const world = createWorld('2d-side');
    const rt = createRuntime(board.graph, world, '2d-side');
    for (let i = 0; i < 60 * 20; i++) {
      rt.tick({ keysDown: new Set(['ArrowRight', 'Space']) });
      world.step(TICK_DT);
    }
    expect(world.ended).toBeNull();
  });
});
