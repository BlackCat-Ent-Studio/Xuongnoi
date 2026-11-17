import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { GRIP_FORCE_N } from '../../src/tutorial/lesson-robot-arm';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

/**
 * The learner's arm, built step by step on the lesson's board, then played the way the lesson says: hold the down arrow
 * until the hand is at the crate, hold Space to close, then hold the up arrow. New gripper cards take a crate lying
 * between their fingers, so this checks the crate on the table is still gripped at the lowest angle the arrow gives.
 */
describe('robot-arm lesson: the crate is grabbed by a new (between-the-fingers) gripper', () => {
  const lesson = () => findLesson('robot-arm')!;

  function build() {
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
    const idOf = (kind: string, where?: (params: Record<string, unknown>) => boolean): string =>
      g().nodes.find((n) => n.kind === kind && (!where || where(n.params)))!.id;
    look();
    const cap = idOf('block', (pr) => pr.color === '#f59e0b');
    const scale = idOf('map-range');
    const go = idOf('on-start');
    const key = idOf('key');
    const step = (): string => runner.step().id;
    runner.next();
    let joint = '';
    let link = '';
    let gripper = '';
    expect(step()).toBe('add-joint');
    doIt(() => {
      joint = state.addNode('joint', { x: 40, y: 900 })!;
    });
    expect(step()).toBe('wire-joint-base');
    connect(p(cap, 'self'), p(joint, 'base'));
    expect(step()).toBe('add-link');
    doIt(() => {
      link = state.addNode('link', { x: 300, y: 900 })!;
    });
    connect(p(joint, 'tip'), p(link, 'base'));
    expect(step()).toBe('add-gripper');
    doIt(() => {
      gripper = state.addNode('gripper', { x: 560, y: 900 })!;
    });
    connect(p(link, 'tip'), p(gripper, 'base'));
    expect(step()).toBe('wire-angle');
    connect(p(scale, 'value'), p(joint, 'angle'));
    expect(step()).toBe('wire-power');
    connect(p(go, 'started'), p(joint, 'power'));
    expect(step()).toBe('wire-close');
    connect(p(key, 'held'), p(gripper, 'close'));
    expect(step()).toBe('play-1');
    return { state, runner, doIt, joint, gripper, step, g };
  }

  it('a new gripper card is set to grip what lies between its fingers', () => {
    const s = build();
    const node = s.g().nodes.find((n) => n.id === s.gripper)!;
    expect(node.params.grip).toBe('between');
  });

  function play(force: number) {
    const s = build();
    s.doIt(() => s.state.setParam(s.gripper, 'defaultForce', force));
    const board = s.state.getBoard();
    const world = createWorld(board.mode);
    const rt = createRuntime(board.graph, world, board.mode);
    const crate = () => world.entities().find((e) => e.kind === 'item')!;
    const phase = (keys: string[], seconds: number): void => {
      for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
        rt.tick({ keysDown: new Set(keys) });
        world.step(TICK_DT);
      }
    };
    phase(['ArrowDown'], 2.5);
    const lowered = { inReach: rt.getOutput(s.gripper, 'inReach'), angle: rt.getOutput(s.joint, 'angleNow') as number, crate: { ...crate().position } };
    phase(['ArrowDown', 'Space'], 1);
    const gripped = rt.getOutput(s.gripper, 'holding');
    phase(['ArrowUp', 'Space'], 3);
    return { lowered, gripped, crate: crate().position, holding: rt.getOutput(s.gripper, 'holding') };
  }

  it('holding the down arrow puts the crate between the fingers, and Space grips it', () => {
    const r = play(GRIP_FORCE_N);
    expect(r.lowered.angle).toBeCloseTo(-15, 0);
    expect(r.lowered.inReach).toBe(true);
    expect(r.gripped).toBe(true);
  });

  it('with the default 20 N the lifted crate slips (the lesson step "Thử gắp"); with the lesson force it stays in the hand', () => {
    const slip = play(20);
    expect(slip.crate.y).toBeLessThan(1);
    expect(slip.holding).toBe(false);
    const hold = play(GRIP_FORCE_N);
    expect(hold.crate.y).toBeGreaterThan(1.5);
    expect(hold.holding).toBe(true);
  });

  it('is in the Robot chapter', () => {
    expect(chapterOf('robot-arm')?.id).toBe('robots');
  });
});
