import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type InputSnapshot, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });
const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

function session() {
  const lesson = findLesson('chance-zones')!;
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
      expect(state.connect(from, to)).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      tick();
    },
    idOf: (kind: string, where?: (params: Record<string, unknown>) => boolean) =>
      state.getGraph().nodes.find((n) => n.kind === kind && (!where || where(n.params)))!.id,
  };
}

/** Walk the whole lesson; returns the ids of the nodes the learner added. */
function buildLesson() {
  const s = session();
  const at = (id: string): void => expect(s.stepId()).toBe(id);
  at('intro');
  s.runner.next();
  at('watch');
  s.play(true);
  at('back-to-edit');
  s.play(false);
  at('add-zone');
  const zone = s.add('zone');
  at('add-random');
  const dice = s.add('random');
  at('add-and');
  const and = s.add('and');
  at('wire-and-in');
  const keyE = s.idOf('key', (pr) => pr.key === 'KeyE');
  s.wire(p(keyE, 'pressed'), p(and, 'a'));
  at('wire-and-in');
  s.wire(p(zone, 'inside'), p(and, 'b'));
  at('wire-roll');
  s.wire(p(and, 'out'), p(dice, 'roll'));
  at('add-show');
  const showDice = s.add('show-number');
  at('wire-show');
  s.wire(p(dice, 'value'), p(showDice, 'value'));
  at('add-compare');
  const cmp = s.add('compare');
  at('add-const');
  const five = s.add('const');
  at('set-five');
  s.state.setParam(five, 'value', 5);
  s.tick();
  at('wire-compare');
  s.wire(p(dice, 'value'), p(cmp, 'a'));
  at('wire-compare');
  s.wire(p(five, 'value'), p(cmp, 'b'));
  at('add-latch');
  const latch = s.add('latch');
  at('wire-latch');
  s.wire(p(cmp, 'out'), p(latch, 'set'));
  at('wire-gate');
  const gate = s.idOf('block', (pr) => pr.type !== 'pickup' && (pr.size as { y: number }).y >= 3);
  s.wire(p(latch, 'on'), p(gate, 'hide'));
  at('play-roll');
  s.play(true);
  at('back-to-edit-2');
  s.play(false);
  at('add-distance');
  const dist = s.add('distance');
  at('wire-distance');
  const hero = s.idOf('character');
  const flag = s.idOf('block', (pr) => pr.type === 'pickup' && pr.color === '#ef4444');
  s.wire(p(hero, 'self'), p(dist, 'a'));
  at('wire-distance');
  s.wire(p(flag, 'self'), p(dist, 'b'));
  at('add-show-2');
  const showDist = s.add('show-number');
  at('wire-show-2');
  s.wire(p(dist, 'distance'), p(showDist, 'value'));
  at('add-end');
  const end = s.add('win-lose');
  at('wire-win');
  s.wire(p(dist, 'within'), p(end, 'win'));
  at('play-final');
  s.play(true);
  at('win');
  return { s, dice, gate, hero, keyE };
}

describe('lesson 11: dice and zones', () => {
  it('starts in side view with a hero, a gate, a flag and a pre-placed E key', () => {
    const lesson = findLesson('chance-zones')!;
    expect(lesson.title).toBe('11. Xúc xắc và vùng');
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-side');
    expect(board.graph.nodes.filter((n) => n.kind === 'key' && n.params.key === 'KeyE')).toHaveLength(1);
    expect(board.graph.nodes.some((n) => n.kind === 'zone' || n.kind === 'random')).toBe(false);
  });

  it('does not accept wrong-kind wires as progress', () => {
    const s = session();
    s.runner.next();
    s.play(true);
    s.play(false);
    s.add('zone');
    s.add('random');
    s.add('and');
    expect(s.stepId()).toBe('wire-and-in');
    const zone = s.idOf('zone');
    const and = s.idOf('and');
    s.wire(p(zone, 'inside'), p(and, 'a'));
    expect(s.stepId()).toBe('wire-and-in');
  });

  it('walks every step; the learner board is blocked by the gate, then wins by rolling 5+ and running to the flag', () => {
    const { s, dice, gate, hero } = buildLesson();
    // Fixed seed so the test is repeatable; a learner with seed 0 simply rolls again until a 5 or 6 shows up.
    s.state.setParam(dice, 'seed', 7);

    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const entity = (id: string) => world.entities().find((e) => e.ownerNodeId === id)!;
    // Entity views are snapshots: look them up again on every read.
    const heroX = (): number => entity(hero).position.x;
    const gateVisible = (): boolean => entity(gate).visible;

    const frame = (...k: string[]): void => {
      rt.tick(keys(...k));
      world.step(TICK_DT);
    };
    for (let i = 0; i < 30; i++) frame();

    // Without rolling, running right is stopped by the gate.
    for (let i = 0; i < 240; i++) frame('ArrowRight');
    expect(world.ended).toBeNull();
    expect(gateVisible()).toBe(true);
    expect(heroX()).toBeGreaterThan(3);
    expect(heroX()).toBeLessThan(6);

    // Walk back onto the pad (|x| < 1.5 centre); standing still, tap E until the gate opens.
    for (let i = 0; i < 90 && heroX() > 0.5; i++) frame('ArrowLeft');
    for (let i = 0; i < 30; i++) frame();
    expect(Math.abs(heroX())).toBeLessThan(2);
    let rolls = 0;
    while (gateVisible() && rolls < 200) {
      frame('KeyE');
      frame();
      frame();
      rolls++;
    }
    expect(gateVisible()).toBe(false);
    expect(rolls).toBeGreaterThan(0);

    for (let i = 0; i < 600 && !world.ended; i++) frame('ArrowRight');
    expect(world.ended?.result).toBe('win');
    s.tick('win');
    expect(s.stepId()).toBe('done');
  });

  it('rolling E outside the pad never opens the gate', () => {
    const { s, dice, gate } = buildLesson();
    s.state.setParam(dice, 'seed', 7);
    const world = createWorld('2d-side');
    const rt = createRuntime(s.state.getGraph(), world, '2d-side');
    const gateVisible = (): boolean => world.entities().find((e) => e.ownerNodeId === gate)!.visible;
    for (let i = 0; i < 60; i++) {
      rt.tick(keys('KeyE'));
      world.step(TICK_DT);
      rt.tick(keys());
      world.step(TICK_DT);
    }
    expect(gateVisible()).toBe(true);
  });
});
