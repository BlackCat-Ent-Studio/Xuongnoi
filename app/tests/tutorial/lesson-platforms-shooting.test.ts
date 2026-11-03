import { chapterOf } from '../../src/tutorial/course';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type GameResult, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import type { Snapshot } from '../../src/tutorial/types';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const p = (node: string, port: string): PortRef => ({ node, port });

function session() {
  const lesson = findLesson('platforms-shooting')!;
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
    at: (id: string): void => expect(runner.step().id).toBe(id),
    add(kind: string): string {
      const id = state.addNode(kind, { x: 0, y: 0 });
      if (!id) throw new Error(kind);
      tick();
      return id;
    },
    param(id: string, name: string, v: Parameters<typeof state.setParam>[2]): void {
      state.setParam(id, name, v);
      tick();
    },
    wire(from: PortRef, to: PortRef): void {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      tick();
    },
    play(on: boolean): void {
      state.setPlaying(on);
      if (on) ended = null;
      tick();
    },
    end(result: GameResult): void {
      ended = result;
      tick();
    },
  };
}

/** Follows the whole lesson as the learner would; returns the finished graph's ids. */
function build() {
  const s = session();
  const g = () => s.state.getGraph().nodes;
  const hero = g().find((n) => n.kind === 'character' && n.params.role !== 'bot')!.id;
  const health = g().find((n) => n.kind === 'health')!.id;
  const fireKey = g().find((n) => n.kind === 'key' && n.params.key === 'KeyJ')!.id;
  const orId = g().find((n) => n.kind === 'or')!.id;

  s.at('intro');
  s.runner.next();
  s.at('add-platform');
  const plat = s.add('moving-platform');
  s.at('platform-a');
  s.param(plat, 'position', { x: 0, y: 0, z: 0 });
  s.at('platform-a'); // the default A is not beside the left bank
  s.param(plat, 'position', { x: -2, y: -0.25, z: 0 });
  s.at('platform-b');
  s.param(plat, 'to', { x: 2, y: -0.25, z: 0 });
  s.at('start-moving-platform-run');
  const start = g().find((n) => n.kind === 'on-start')!.id;
  s.wire(p(start, 'started'), p(plat, 'run'));
  s.at('play-ride');
  s.play(true);
  s.at('back-1');
  s.play(false);
  s.at('add-shooter');
  const gun = s.add('shooter');
  s.at('wire-shooter');
  s.wire(p(hero, 'self'), p(gun, 'shooter'));
  s.at('wire-fire');
  s.wire(p(fireKey, 'held'), p(gun, 'fire'));
  s.at('play-shoot');
  s.play(true);
  s.at('hit-target');
  s.play(false);
  s.at('add-spawner');
  const spawner = s.add('spawner');
  s.at('spawner-setup');
  s.param(spawner, 'position', { x: 10.5, y: 6, z: 0 });
  s.at('spawner-setup'); // default life of 5 seconds would bury the path in rocks
  s.param(spawner, 'lifetime', 1);
  s.at('wire-toucher');
  s.wire(p(hero, 'self'), p(spawner, 'toucher'));
  s.at('wire-lose');
  s.wire(p(spawner, 'touched'), p(orId, 'b'));
  s.at('add-timer');
  const timer = s.add('timer');
  s.at('add-timer'); // default 30 seconds is too slow
  s.param(timer, 'seconds', 3);
  s.at('start-timer-run');
  s.wire(p(start, 'started'), p(timer, 'run'));
  s.at('wire-spawn');
  s.wire(p(timer, 'done'), p(spawner, 'spawn'));
  s.at('add-loop-or');
  const loop = s.add('or');
  s.at('wire-loop-in');
  s.wire(p(timer, 'done'), p(loop, 'a'));
  s.at('wire-loop-out');
  s.wire(p(loop, 'out'), p(timer, 'reset'));
  s.at('add-rotating');
  const gate = s.add('rotating-platform');
  s.at('rotating-setup');
  s.param(gate, 'position', { x: 13, y: 2, z: 0 });
  s.at('rotating-setup'); // default size is a flat bar
  s.param(gate, 'size', { x: 0.5, y: 4, z: 1 });
  s.at('wire-turn');
  s.wire(p(health, 'dead'), p(gate, 'turn'));
  s.at('play-final');
  s.play(true);
  s.at('win');
  return { s, hero, health, gate, spawner, timer, plat };
}

describe('lesson 13: platforms and shooting', () => {
  it('is registered as lesson 13 with a 2d-side board', () => {
    const lesson = findLesson('platforms-shooting')!;
    expect(chapterOf(lesson.id)?.id).toBe('fighting');
    expect(lesson.createBoard().mode).toBe('2d-side');
    expect(lesson.steps.length).toBeGreaterThanOrEqual(18);
    expect(lesson.steps.length).toBeLessThanOrEqual(28); // 26 steps of the lesson itself + the two start wires the wire rule asks for
  });

  it('walks through every step in order and finishes on win', () => {
    const { s } = build();
    s.end('win');
    s.at('done');
  });

  it('the starting board is a pit, a target with health and a flag: nothing to cross with yet', () => {
    const board = findLesson('platforms-shooting')!.createBoard();
    expect(board.graph.nodes.filter((n) => n.kind === 'health')).toHaveLength(1);
    for (const kind of ['moving-platform', 'shooter', 'spawner', 'rotating-platform', 'timer']) {
      expect(board.graph.nodes.some((n) => n.kind === kind)).toBe(false);
    }
    // Without a bridge the walker falls into the pit and loses.
    const world = createWorld('2d-side');
    const rt = createRuntime(board.graph, world, '2d-side');
    for (let i = 0; i < 60 * 10 && !world.ended; i++) {
      rt.tick({ keysDown: new Set(['ArrowRight']) });
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('lose');
  });

  /** Plays the finished board with a scripted player; `cutGate` removes the wire that turns the gate. */
  function playScript(cutGate: boolean) {
    const { s, hero, health, gate, spawner, timer, plat } = build();
    const graph = s.state.getGraph();
    const wires = cutGate ? graph.wires.filter((w) => !(w.to.node === gate && w.to.port === 'turn')) : graph.wires;
    const world = createWorld('2d-side');
    const rt = createRuntime({ ...graph, wires }, world, '2d-side');
    const view = (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!;
    const num = (node: string, port: string): number => Number(rt.getOutput(node, port));

    let phase: 'approach' | 'wait' | 'board' | 'ride' | 'cross' | 'shoot' | 'gate' | 'run' = 'approach';
    let shots = 0;
    let sawGateOpen = false;
    for (let i = 0; i < 60 * 60 && !world.ended; i++) {
      const hx = view(hero).position.x;
      const px = view(plat).position.x;
      const keys = new Set<string>();
      if (phase === 'approach') {
        keys.add('ArrowRight');
        if (hx >= -4.2) phase = 'wait';
      } else if (phase === 'wait') {
        if (px <= -1.95) phase = 'board';
      } else if (phase === 'board') {
        keys.add('ArrowRight');
        if (hx >= -1.2) phase = 'ride';
      } else if (phase === 'ride') {
        if (px >= 1.95) phase = 'cross';
      } else if (phase === 'cross') {
        keys.add('ArrowRight');
        if (hx >= 4.5) phase = 'shoot';
      } else if (phase === 'shoot') {
        // Tap J every half second until the target is down.
        if (i % 30 === 0) {
          keys.add('KeyJ');
          shots++;
        }
        if (rt.getOutput(health, 'dead') === true) phase = 'gate';
      } else if (phase === 'gate') {
        if (num(gate, 'angle') === 90) sawGateOpen = true;
        // Rocks last one second out of three: leave right after one has vanished.
        if ((sawGateOpen || cutGate) && num(spawner, 'count') === 0 && num(timer, 'left') <= 2.1 && num(timer, 'left') > 1.5) phase = 'run';
      } else {
        keys.add('ArrowRight');
      }
      rt.tick({ keysDown: keys });
      world.step(TICK_DT);
    }
    return { world, shots, sawGateOpen };
  }

  it('the finished board wins by riding the platform, shooting three times, and slipping under the opened gate', () => {
    const { world, shots, sawGateOpen } = playScript(false);
    expect(shots).toBeLessThanOrEqual(8);
    expect(sawGateOpen).toBe(true);
    expect(world.ended?.result).toBe('win');
  });

  it('without the turn wire the gate stays shut and the flag is out of reach', () => {
    const { world } = playScript(true);
    expect(world.ended).toBeNull();
  });
});
