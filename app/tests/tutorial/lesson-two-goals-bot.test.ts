import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

describe('two-goals-bot lesson', () => {
  const lesson = findLesson('two-goals-bot')!;

  it('is registered once in a chapter, ends on an info step, unique step ids', () => {
    expect(LESSONS.filter((l) => l.id === 'two-goals-bot')).toHaveLength(1);
    expect(chapterOf('two-goals-bot')).toBeDefined();
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((st) => st.id)).size).toBe(lesson.steps.length);
  });

  function play(held: boolean): number {
    const state = createEditorState(lesson.createBoard());
    const runner = createRunner(lesson);
    const look = (): void => {
      runner.evaluate(takeSnapshot(state, null));
    };
    const connect = (a: PortRef, b: PortRef): void => {
      expect(state.connect(a, b)).toEqual({ ok: true });
      look();
    };
    look();
    runner.next();
    expect(runner.step().id).toBe('add-go-to');
    const go = state.addNode('go-to', { x: 40, y: 700 })!;
    look();
    const g = state.getGraph();
    const id = (name: string): string => g.nodes.find((n) => n.params.name === name)!.id;
    const bot = g.nodes.find((n) => n.kind === 'character')!.id;
    const key = g.nodes.find((n) => n.kind === 'key')!.id;
    expect(runner.step().id).toBe('wire-go');
    connect(p(bot, 'self'), p(go, 'self'));
    connect(p(id('Ô xanh lá'), 'self'), p(go, 'target'));
    connect(p(id('Ô vàng'), 'self'), p(go, 'target2'));
    connect(p(go, 'moveX'), p(bot, 'moveX'));
    expect(runner.step().id).toBe('wire-switch');
    connect(p(key, 'held'), p(go, 'useTarget2'));
    expect(runner.step().id).toBe('play');

    const world = createWorld('2d-side');
    const rt = createRuntime(state.getGraph(), world, '2d-side');
    for (let i = 0; i < 60 * 8; i++) {
      rt.tick({ keysDown: new Set(held ? ['Space'] : []) });
      world.step(TICK_DT);
    }
    return world.entities().find((e) => e.ownerNodeId === bot)!.position.x;
  }

  it('walks to the green mark, or to the yellow mark while the key is held', () => {
    expect(play(false)).toBeLessThan(-5);
    expect(play(true)).toBeGreaterThan(5);
  });
});
