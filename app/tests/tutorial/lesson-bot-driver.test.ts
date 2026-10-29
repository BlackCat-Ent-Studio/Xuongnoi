import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session() {
  const lesson = findLesson('bot-driver')!;
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

describe('lesson 10: a bot that drives', () => {
  it('is lesson 10, starts in top view with a bot, a car and a flag', () => {
    const lesson = findLesson('bot-driver')!;
    expect(LESSONS).toContain(lesson);
    expect(lesson.title).toBe('10. Bot lái xe');
    const board = lesson.createBoard();
    expect(board.mode).toBe('2d-top');
    const kinds = board.graph.nodes.map((n) => n.kind);
    expect(kinds).toContain('vehicle');
    expect(kinds.filter((k) => k === 'character')).toHaveLength(1);
    expect(board.graph.wires).toHaveLength(0);
  });

  it('walks through every step, and the finished board drives the bot to a win', () => {
    const s = session();
    const expectStep = (id: string): void => expect(s.stepId()).toBe(id);
    expectStep('intro');
    s.runner.next();
    expectStep('watch');
    s.play(true);
    expectStep('back-to-edit');
    s.play(false);
    expectStep('add-sequence');
    const seq = s.add('sequence');
    expectStep('add-goto-walk');
    const walk = s.add('go-to');
    expectStep('wire-walk-who');
    const bot = s.idOf('character');
    const car = s.idOf('vehicle');
    const flag = s.idOf('block', (pr) => pr.type === 'pickup');
    s.wire(p(bot, 'self'), p(walk, 'self'));
    expectStep('wire-walk-who');
    s.wire(p(car, 'self'), p(walk, 'target'));
    expectStep('wire-walk-move');
    s.wire(p(walk, 'moveX'), p(bot, 'moveX'));
    s.wire(p(walk, 'moveY'), p(bot, 'moveY'));
    expectStep('walk-stop');
    s.state.setParam(walk, 'stopDistance', 1.5);
    s.tick();
    expectStep('wire-step1');
    s.wire(p(seq, 'step1'), p(walk, 'go'));
    expectStep('add-enter');
    const enter = s.add('enter-exit');
    expectStep('wire-enter-who');
    s.wire(p(bot, 'self'), p(enter, 'character'));
    expectStep('wire-arrive');
    s.wire(p(walk, 'arrivedPulse'), p(enter, 'press'));
    expectStep('wire-arrive');
    s.wire(p(walk, 'arrivedPulse'), p(seq, 'next'));
    expectStep('add-goto-drive');
    const drive = s.add('go-to');
    expectStep('wire-drive-who');
    s.wire(p(car, 'self'), p(drive, 'self'));
    s.wire(p(flag, 'self'), p(drive, 'target'));
    expectStep('wire-step2');
    s.wire(p(seq, 'step2'), p(drive, 'go'));
    expectStep('wire-drive-move');
    s.wire(p(drive, 'moveX'), p(car, 'moveX'));
    s.wire(p(drive, 'moveY'), p(car, 'moveY'));
    expectStep('add-touch');
    const touch = s.add('touch');
    expectStep('wire-touch');
    s.wire(p(car, 'self'), p(touch, 'a'));
    s.wire(p(flag, 'self'), p(touch, 'b'));
    expectStep('add-end');
    const end = s.add('win-lose');
    expectStep('wire-win');
    s.wire(p(touch, 'touching'), p(end, 'win'));
    expectStep('play-trip');
    s.play(true);
    expectStep('win');

    // Play the learner's board for real: the bot must reach the car, board it and drive the bend to the flag.
    const world = createWorld('2d-top');
    const rt = createRuntime(s.state.getGraph(), world, '2d-top');
    const ownerOf = (id: string) => world.entities().find((e) => e.ownerNodeId === id)!;
    let boardedAt = -1;
    const MAX_SECONDS = 40;
    let endedAt = -1;
    for (let i = 0; i < MAX_SECONDS * 60 && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      if (boardedAt < 0 && ownerOf(bot).seatedIn !== undefined) boardedAt = i * TICK_DT;
      endedAt = i * TICK_DT;
    }
    expect(boardedAt).toBeGreaterThan(0);
    expect(world.ended?.result).toBe('win');
    expect(endedAt).toBeLessThan(MAX_SECONDS);
    console.log('boarded', boardedAt.toFixed(1), 'won', endedAt.toFixed(1));
    s.tick('win');
    expectStep('done');
  });
});
