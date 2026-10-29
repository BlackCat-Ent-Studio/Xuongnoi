import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type GameResult, type InputSnapshot, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });
const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

function session() {
  const lesson = findLesson('vehicles')!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  let ended: GameResult | null = null;
  const tick = (): void => {
    const snap: Snapshot = { graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended };
    runner.evaluate(snap);
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
    param(id: string, name: string, v: Parameters<typeof state.setParam>[2]): void {
      state.setParam(id, name, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to)).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      tick();
    },
    idOf: (kind: string) => state.getGraph().nodes.find((n) => n.kind === kind)!.id,
  };
}

describe('lesson 10: drive a vehicle', () => {
  it('is the ninth-or-later lesson and only uses known nodes and ports', () => {
    const lesson = findLesson('vehicles')!;
    expect(LESSONS).toContain(lesson);
    expect(lesson.title).toBe('10. Lái xe');
    expect(lesson.createBoard().mode).toBe('2d-side');
  });

  it('walks through the build and ends with a working, drivable car', () => {
    const s = session();
    expect(s.stepId()).toBe('intro');
    s.runner.next();
    expect(s.stepId()).toBe('add-vehicle');
    const car = s.add('vehicle');
    expect(s.stepId()).toBe('wire-drive');
    const hero = s.idOf('character');
    s.wire(p(s.idOf('stick'), 'x'), p(car, 'moveX'));
    expect(s.stepId()).toBe('add-enter');
    const enter = s.add('enter-exit');
    expect(s.stepId()).toBe('wire-who');
    s.wire(p(hero, 'self'), p(enter, 'character'));
    expect(s.stepId()).toBe('add-key');
    const keyE = s.add('key');
    expect(s.stepId()).toBe('key-e');
    s.param(keyE, 'key', 'KeyE');
    expect(s.stepId()).toBe('wire-press');
    s.wire(p(keyE, 'pressed'), p(enter, 'press'));
    expect(s.stepId()).toBe('play-drive');
    s.play(true);
    expect(s.stepId()).toBe('back-to-edit');
    s.play(false);
    expect(s.stepId()).toBe('change-model');
    s.param(car, 'model', 'bike');
    expect(s.stepId()).toBe('done');
    s.runner.next();
    expect(s.runner.isFinished()).toBe(true);

    // The result really works: walk to the car, climb in with E, drive right, climb out.
    const board = s.state.getGraph();
    const world = createWorld('2d-side');
    const rt = createRuntime(board, world, '2d-side');
    const step = (input: InputSnapshot): void => {
      rt.tick(input);
      world.step(TICK_DT);
    };
    const find = (kind: string) => world.entities().find((e) => e.ownerNodeId === s.idOf(kind))!;
    for (let i = 0; i < 60; i++) step(keys('ArrowRight'));
    step(keys('KeyE'));
    step(keys());
    expect(find('character').seatedIn).toBe(find('vehicle').id);
    for (let i = 0; i < 90; i++) step(keys('ArrowRight'));
    expect(find('vehicle').position.x).toBeGreaterThan(4);
    expect(find('character').position.x).toBeCloseTo(find('vehicle').position.x, 5);
    for (let i = 0; i < 60; i++) step(keys());
    step(keys('KeyE'));
    step(keys());
    expect(find('character').seatedIn).toBeUndefined();
  });
});
