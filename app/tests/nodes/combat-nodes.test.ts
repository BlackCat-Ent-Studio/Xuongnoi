import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import {
  TICK_DT,
  type EntityView,
  type Graph,
  type GraphNode,
  type InputSnapshot,
  type Params,
  type Runtime,
  type Vec3,
  type ViewMode,
  type World,
} from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { fightNode } from '../../src/nodes/fight';
import { healthNode } from '../../src/nodes/health';
import { createWorld } from '../../src/world/world';
import { makeWorld, runNode } from './fake-world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

const v = (x: number, y: number, z = 0): Vec3 => ({ x, y, z });
type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

function sim(mode: ViewMode, nodes: NodeSpec[], wires: WireSpec[]) {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world: World = createWorld(mode);
  const rt: Runtime = createRuntime(wireStarts(graph, mode), world, mode);
  return {
    world,
    rt,
    step(n = 1, keys: string[] = []) {
      const input: InputSnapshot = { keysDown: new Set(keys) };
      for (let i = 0; i < n; i++) {
        rt.tick(input);
        world.step(TICK_DT);
      }
    },
    view: (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!,
    out: (node: string, port: string) => rt.getOutput(node, port),
  };
}

const floorFor = (mode: ViewMode): NodeSpec[] =>
  mode === '2d-top'
    ? []
    : [['floor', 'block', { position: v(0, -0.5), size: mode === '3d' ? v(30, 1, 30) : v(30, 1, 1), color: '#0a0', type: 'solid' }]];

/** An idle player and a fighting bot 6 units away, both with health; the bot's strikes go through a hand-tool. */
function duelBoard(mode: ViewMode, fight: Params = {}, botHp = 5, playerHp = 5): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const y = mode === '2d-top' ? 0 : 1;
  return {
    nodes: [
      ...floorFor(mode),
      ['player', 'character', { position: v(-3, y), role: 'player' }],
      ['bot', 'character', { position: v(3, y), role: 'bot', speed: 4 }],
      ['fight', 'fight', { sightRange: 30, ...fight }],
      ['hand', 'hand-tool', {}],
      ['hp-player', 'health', { maxHp: playerHp }],
      ['hp-bot', 'health', { maxHp: botHp }],
    ],
    wires: [
      ['bot', 'self', 'fight', 'self'],
      ['player', 'self', 'fight', 'target'],
      ['fight', 'moveX', 'bot', 'moveX'],
      ['fight', 'moveY', 'bot', 'moveY'],
      ['fight', 'jump', 'bot', 'jump'],
      ['bot', 'self', 'hand', 'character'],
      ['fight', 'attack', 'hand', 'use'],
      ['player', 'self', 'hp-player', 'self'],
      ['bot', 'self', 'hp-bot', 'self'],
    ],
  };
}

describe('health node', () => {
  it('registers health on the wired character and reports hp / hurt pulse / dead', () => {
    const w = createWorld('2d-side');
    const id = w.spawn({ kind: 'character', ownerNodeId: 'c', position: v(0, 1), size: v(1, 1, 1), color: '#fff', solid: true });
    const out = runNode(healthNode, [{ inputs: { self: id } }, { inputs: { self: id } }], { maxHp: 4 }, w);
    expect(out[0]).toEqual({ hp: 4, hurtPulse: false, dead: false });
    expect(w.getEntity(id)?.health).toEqual({ hp: 4, max: 4, bar: true });
  });

  it('shows nothing without a wire and hides the bar when asked', () => {
    const fake = makeWorld();
    expect(runNode(healthNode, [{}], {}, fake)[0]).toEqual({ hp: 0, hurtPulse: false, dead: false });
    const w = createWorld('2d-side');
    const id = w.spawn({ kind: 'character', ownerNodeId: 'c', position: v(0, 1), size: v(1, 1, 1), color: '#fff', solid: true });
    runNode(healthNode, [{ inputs: { self: id } }], { showBar: 'no' }, w);
    expect(w.getEntity(id)?.health?.bar).toBe(false);
  });

  it('heals on a rising edge of Hồi máu only', () => {
    const w = createWorld('2d-side');
    const id = w.spawn({ kind: 'character', ownerNodeId: 'c', position: v(0, 1), size: v(1, 1, 1), color: '#fff', solid: true });
    const attacker = w.spawn({ kind: 'character', ownerNodeId: 'a', position: v(-1, 1), size: v(1, 1, 1), color: '#fff', solid: true });
    runNode(healthNode, [{ inputs: { self: id } }], { maxHp: 5 }, w);
    w.setCharacterIntent(attacker, { moveX: 1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
    w.step(TICK_DT);
    w.step(TICK_DT);
    w.useTool(attacker, 2);
    expect(w.healthOf(id)?.hp).toBe(4);
    const steps = [{ inputs: { self: id, heal: false } }, { inputs: { self: id, heal: true } }, { inputs: { self: id, heal: true } }];
    const out = runNode(healthNode, steps, { maxHp: 5, healAmount: 1 }, w);
    expect(out.map((o) => o.hp)).toEqual([4, 5, 5]);
    w.heal(id, 0);
  });
});

describe.each<ViewMode>(['2d-side', '2d-top', '3d'])('fight node in %s', (mode) => {
  it('a fighting bot defeats an idle player, who tips over and disappears', () => {
    const { nodes, wires } = duelBoard(mode);
    const s = sim(mode, nodes, wires);
    s.step(60 * 25);
    expect(s.out('hp-player', 'dead')).toBe(true);
    expect(s.world.healthOf(s.view('player').id)?.dead).toBe(true);
    expect(s.view('player').visible).toBe(false);
    expect(s.view('bot').health?.hp).toBe(5);
  });

  it('attacks come as single-tick pulses spaced by the cooldown', () => {
    const { nodes, wires } = duelBoard(mode, { attackCooldown: 0.5 }, 5, 100);
    const s = sim(mode, nodes, wires);
    const pulses: number[] = [];
    for (let i = 0; i < 60 * 8; i++) {
      s.step();
      if (s.out('fight', 'attack') === true) pulses.push(i);
    }
    expect(pulses.length).toBeGreaterThanOrEqual(4);
    for (let k = 1; k < pulses.length; k++) expect(pulses[k]! - pulses[k - 1]!).toBeGreaterThanOrEqual(30);
    expect(s.view('player').health!.hp).toBeLessThan(100);
  });

  it('stays idle when the target is out of sight', () => {
    const { nodes, wires } = duelBoard(mode, { sightRange: 2 });
    const s = sim(mode, nodes, wires);
    s.step(60 * 3);
    expect(s.view('bot').position.x).toBeCloseTo(3, 0);
    expect(s.out('fight', 'attack')).toBe(false);
    expect(s.view('player').health!.hp).toBe(5);
  });

  it('stops once the target is dead', () => {
    const { nodes, wires } = duelBoard(mode, {}, 5, 1);
    const s = sim(mode, nodes, wires);
    s.step(60 * 15);
    expect(s.out('hp-player', 'dead')).toBe(true);
    for (let i = 0; i < 120; i++) {
      s.step();
      expect(s.out('fight', 'attack')).toBe(false);
    }
  });
});

describe('fight node outputs', () => {
  it('is idle with nothing wired', () => {
    const out = runNode(fightNode, [{}, {}])[1]!;
    expect(out).toEqual({ moveX: 0, moveY: 0, jump: false, attack: false });
  });
});
