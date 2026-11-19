import { beforeAll, describe, expect, it } from 'vitest';
import { expandBoard } from '../../src/circuits/expand';
import { runnableGraph } from '../../src/circuits/runnable';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Circuit, type EntityView, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { runBoard } from '../editor/solid-helpers';
import { circuit, copyOf, handBuilt, node, sampleBoard, wire, wrapped, type Place } from './circuit-helpers';

/** 600 ticks. */
const SECONDS = 10;

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await loadRapier();
});

/** The board's own world rules, with the crate engine loaded when it asks for real physics. */
const optionsOf = (b: Board) => {
  const wanted = worldOptionsForGraph(b.graph);
  return wanted?.realPhysics ? { ...wanted, rapier } : wanted;
};

interface Played {
  /** Hash of the whole entity state (the guard tests' hash). */
  hash: string;
  /** The same state written out with every owner id cut down to its last part, to compare boards whose ids differ only by a prefix. */
  plain: string;
  /** Where each robot went, by owner id, every 10 ticks. */
  tracks: Map<string, { x: number; z: number; heading: number }[]>;
}

function play(b: Board): Played {
  const tracks: Played['tracks'] = new Map();
  let plain = '';
  const round = (_k: string, v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
  const onTick = (tick: number, world: World): void => {
    if (tick % 10 !== 0) return;
    const all = world.entities() as readonly EntityView[];
    plain += JSON.stringify(all.map((e) => ({ ...e, ownerNodeId: e.ownerNodeId.slice(e.ownerNodeId.lastIndexOf('/') + 1) })), round);
    for (const e of all) {
      if (!e.robot) continue;
      const list = tracks.get(e.ownerNodeId) ?? [];
      list.push({ x: e.position.x, z: e.position.z, heading: e.robot.heading });
      tracks.set(e.ownerNodeId, list);
    }
  };
  const res = runBoard(b, optionsOf(b), { seconds: SECONDS, onTick });
  res.world?.dispose?.();
  expect(res.error).toBeNull();
  expect(res.ticks).toBe(600);
  return { hash: res.hash, plain, tracks };
}

describe('a machine wrapped in a circuit runs like the flat board', () => {
  for (const id of ['robot-square', 'robot-line-follow']) {
    it(`${id}: one copy at the identity placement gives the same entity hash over 600 ticks as the board built by hand`, { timeout: 120_000 }, () => {
      const sample = sampleBoard(id);
      expect(sample.graph.settings?.realPhysics).toBe(true);
      const viaCircuit = play(wrapped(sample, { m: { x: 0, z: 0 } }));
      const byHand = play(handBuilt(sample, { m: { x: 0, z: 0 } }));
      expect(viaCircuit.hash).toBe(byHand.hash);
      // And like the shipped board itself, whose ids have no prefix.
      const shipped = play(sample);
      expect(viaCircuit.plain).toBe(shipped.plain);
      const track = shipped.tracks.get('than')!;
      expect(Math.hypot(track.at(-1)!.x - track[0]!.x, track.at(-1)!.z - track[0]!.z)).toBeGreaterThan(0.5);
    });
  }
});

describe('several copies at different places, real physics on', () => {
  const two: Record<string, Place> = { r1: { x: -30, z: 0 }, r2: { x: 30, z: 40 } };
  const eight: Record<string, Place> = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`r${i + 1}`, { x: (i % 4) * 30 - 45, z: Math.floor(i / 4) * 24 }]));

  /** Each copy's robot drives the same path as the single machine, moved (and turned) to where the copy stands. */
  function expectSamePaths(run: Played, single: Played, copies: Record<string, Place>): void {
    const base = single.tracks.get('than')!;
    for (const [id, place] of Object.entries(copies)) {
      const track = run.tracks.get(`${id}/than`)!;
      expect(track.length, id).toBe(base.length);
      const rad = ((place.heading ?? 0) * Math.PI) / 180;
      for (const [i, p] of track.entries()) {
        const b = base[i]!;
        const wantX = b.x * Math.cos(rad) - b.z * Math.sin(rad) + place.x;
        const wantZ = b.x * Math.sin(rad) + b.z * Math.cos(rad) + place.z;
        expect(Math.hypot(p.x - wantX, p.z - wantZ), `${id} tick ${i * 10}`).toBeLessThan(0.02);
      }
    }
  }

  it('robot-square: two copies behave like two hand-shifted flat copies', { timeout: 120_000 }, () => {
    const sample = sampleBoard('robot-square');
    const viaCircuit = play(wrapped(sample, two));
    expect(viaCircuit.hash).toBe(play(handBuilt(sample, two)).hash);
    expectSamePaths(viaCircuit, play(sample), two);
  });

  it('robot-square: eight copies behave like eight hand-shifted flat copies', { timeout: 300_000 }, () => {
    const sample = sampleBoard('robot-square');
    const viaCircuit = play(wrapped(sample, eight));
    expect(viaCircuit.tracks.size).toBe(8);
    expect(viaCircuit.hash).toBe(play(handBuilt(sample, eight)).hash);
    expectSamePaths(viaCircuit, play(sample), eight);
  });

  it('robot-line-follow: two copies each follow their own line', { timeout: 120_000 }, () => {
    const sample = sampleBoard('robot-line-follow');
    const viaCircuit = play(wrapped(sample, two));
    expect(viaCircuit.hash).toBe(play(handBuilt(sample, two)).hash);
    expectSamePaths(viaCircuit, play(sample), two);
  });

  it('robot-square: a copy turned by a quarter turn drives the turned square', { timeout: 120_000 }, () => {
    const sample = sampleBoard('robot-square');
    const copies: Record<string, Place> = { r1: { x: 0, z: 0 }, r2: { x: 40, z: 0, heading: 90 } };
    const viaCircuit = play(wrapped(sample, copies));
    expect(viaCircuit.hash).toBe(play(handBuilt(sample, copies)).hash);
    expectSamePaths(viaCircuit, play(sample), copies);
  });
});

describe('each copy has its own state', () => {
  const tally = (): Circuit =>
    circuit(
      'tally',
      { nodes: [node('count', 'counter', { start: 0, target: 3 })], wires: [] },
      {
        pins: [
          { id: 'tick', label: 'Nhịp', dir: 'in', type: 'bool', inner: { node: 'count', port: 'up' } },
          { id: 'count', label: 'Số đếm', dir: 'out', type: 'number', inner: { node: 'count', port: 'value' } },
          { id: 'done', label: 'Xong', dir: 'out', type: 'bool', inner: { node: 'count', port: 'reached' } },
        ],
        exposed: [{ id: 'goal', label: 'Mục tiêu', inner: { node: 'count', param: 'target' } }],
      },
    );

  it('two counters in two copies count their own key and reach their own goal', () => {
    const b: Board = {
      name: 't',
      mode: '2d-top',
      graph: {
        nodes: [node('key-e', 'key', { key: 'KeyE' }), node('key-q', 'key', { key: 'KeyQ' }), copyOf('a', 'tally'), copyOf('b', 'tally', undefined, { goal: 1 })],
        wires: [wire('w1', 'key-e.pressed', 'a.tick'), wire('w2', 'key-q.pressed', 'b.tick')],
      },
      circuits: [tally()],
    };
    const { idMap } = expandBoard(b);
    const world = createWorld(b.mode);
    const rt = createRuntime(runnableGraph(b), world, b.mode);
    const press = (...keys: string[]): void => {
      rt.tick({ keysDown: new Set(keys) });
      world.step(TICK_DT);
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    };
    const read = (copy: string, pin: string) => {
      const port = idMap.pinPort([copy], pin)!;
      return rt.getOutput(port.node, port.port);
    };
    press('KeyE');
    press('KeyE');
    press('KeyQ');
    expect(read('a', 'count')).toBe(2);
    expect(read('b', 'count')).toBe(1);
    expect(read('a', 'done')).toBe(false);
    expect(read('b', 'done')).toBe(true);
    press('KeyE');
    expect(read('a', 'count')).toBe(3);
    expect(read('a', 'done')).toBe(true);
    expect(read('b', 'count')).toBe(1);
  });
});
