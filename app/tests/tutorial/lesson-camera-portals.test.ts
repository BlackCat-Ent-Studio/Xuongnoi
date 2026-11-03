import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { lessonName } from '../../src/tutorial/course';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session() {
  const lesson = findLesson('camera-portals')!;
  const state = createEditorState(lesson.createBoard());
  const runner = createRunner(lesson);
  const tick = (ended: Snapshot['ended'] = null): void => {
    runner.evaluate({ graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended });
  };
  tick();
  return {
    state,
    runner,
    tick,
    stepId: () => runner.step().id,
    add(kind: string): string {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(`cannot add ${kind}`);
      tick();
      return id;
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      tick();
    },
  };
}

describe('lesson 14: camera and portals', () => {
  it('starts side-view with a ready-wired hero, a gap and a flag, and no step done', () => {
    const lesson = findLesson('camera-portals')!;
    expect(lessonName(lesson.title)).toBe('Máy quay và cổng');
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-side');
    expect(board.graph.nodes.filter((n) => n.kind === 'portal')).toHaveLength(0);
    expect(board.graph.wires).toHaveLength(2);
    expect(createRunner(lesson).index()).toBe(0);
  });

  it('accepts a shared pair code instead of a partner wire', () => {
    const s = session();
    s.runner.next();
    s.play(true);
    s.play(false);
    const a = s.add('portal');
    const b = s.add('portal');
    s.state.setParam(b, 'position', { x: 22, y: 1, z: 0 });
    s.tick();
    expect(s.stepId()).toBe('pair-portals');
    s.state.setParam(a, 'pair', 'x1');
    s.state.setParam(b, 'pair', 'x1');
    s.tick();
    expect(s.stepId()).toBe('start-portal-on');
    const start = s.state.getGraph().nodes.find((n) => n.kind === 'on-start')!.id;
    s.wire(p(start, 'started'), p(a, 'on'));
    s.wire(p(start, 'started'), p(b, 'on'));
    expect(s.stepId()).toBe('try-portals');
  });

  it('walks every step, and the finished board crosses by portal, zooms, shakes, teleports home and wins', () => {
    const s = session();
    const expectStep = (id: string): void => expect(s.stepId()).toBe(id);
    expectStep('intro');
    s.runner.next();
    expectStep('watch');
    s.play(true);
    expectStep('back-to-edit');
    s.play(false);
    expectStep('add-portals');
    const a = s.add('portal');
    expectStep('add-portals');
    const b = s.add('portal');
    expectStep('place-portal');
    s.state.setParam(b, 'position', { x: 22, y: 1, z: 0 });
    s.tick();
    expectStep('pair-portals');
    s.wire(p(b, 'self'), p(a, 'partner'));
    expectStep('start-portal-on');
    const start = s.state.getGraph().nodes.find((n) => n.kind === 'on-start')!.id;
    s.wire(p(start, 'started'), p(a, 'on'));
    expectStep('start-portal-on');
    s.wire(p(start, 'started'), p(b, 'on'));
    expectStep('try-portals');
    s.play(true);
    expectStep('back-to-edit-2');
    s.play(false);
    expectStep('add-distance');
    const dist = s.add('distance');
    const hero = s.state.getGraph().nodes.find((n) => n.kind === 'character')!.id;
    const flag = s.state.getGraph().nodes.find((n) => n.kind === 'block' && n.params.type === 'pickup')!.id;
    expectStep('wire-distance');
    s.wire(p(hero, 'self'), p(dist, 'a'));
    expectStep('wire-distance');
    s.wire(p(flag, 'self'), p(dist, 'b'));
    expectStep('distance-threshold');
    s.state.setParam(dist, 'threshold', 8);
    s.tick();
    expectStep('add-camera');
    const cam = s.add('camera');
    expectStep('wire-camera-on');
    s.wire(p(dist, 'within'), p(cam, 'on'));
    expectStep('camera-zoom');
    s.state.setParam(cam, 'zoom', 1.8);
    s.tick();
    expectStep('wire-shake');
    s.wire(p(a, 'used'), p(cam, 'shake'));
    expectStep('add-key-r');
    const keyR = s.add('key');
    expectStep('add-key-r');
    s.state.setParam(keyR, 'key', 'KeyR');
    s.tick();
    expectStep('add-teleport');
    const tele = s.add('teleport');
    expectStep('wire-teleport');
    s.wire(p(hero, 'self'), p(tele, 'who'));
    s.wire(p(keyR, 'pressed'), p(tele, 'go'));
    expectStep('teleport-home');
    s.state.setParam(tele, 'position', { x: -8, y: 1, z: 0 });
    s.tick();
    expectStep('add-win-nodes');
    const touch = s.add('touch');
    expectStep('add-win-nodes');
    const end = s.add('win-lose');
    expectStep('wire-win');
    s.wire(p(hero, 'self'), p(touch, 'a'));
    s.wire(p(flag, 'self'), p(touch, 'b'));
    s.wire(p(touch, 'touching'), p(end, 'win'));
    expectStep('play-all');
    s.play(true);
    expectStep('win');

    // Play the finished board for real.
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const heroX = (): number => world.entities().find((e) => e.ownerNodeId === hero)!.position.x;
    const run = (keys: string[], ticks: number, stopWhen?: () => boolean): void => {
      for (let i = 0; i < ticks && !world.ended; i++) {
        rt.tick({ keysDown: new Set(keys) });
        world.step(TICK_DT);
        if (stopWhen?.()) return;
      }
    };
    expect(world.cameraCommand()).toBeNull();

    let shook = false;
    let zoomed = false;
    const watchCamera = (): void => {
      const c = world.cameraCommand();
      if (c && c.shake > 0) shook = true;
      if (c && c.zoom >= 1.8) zoomed = true;
    };
    run(['ArrowRight'], 60 * 10, () => {
      watchCamera();
      return heroX() >= 20;
    });
    expect(heroX()).toBeGreaterThanOrEqual(20);
    run([], 10, () => (watchCamera(), false));
    expect(shook).toBe(true);
    expect(zoomed).toBe(true);

    run(['KeyR'], 1);
    run([], 2);
    expect(heroX()).toBeLessThan(-6);

    run(['ArrowRight'], 60 * 20);
    expect(world.ended?.result).toBe('win');
    s.tick('win');
    expectStep('done');
  });
});
