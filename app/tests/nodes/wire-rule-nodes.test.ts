import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT, type Graph, type GraphNode, type NodeDef, type Params, type ViewMode, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chaseNode } from '../../src/nodes/chase';
import { enterExitNode } from '../../src/nodes/enter-exit';
import { fightNode } from '../../src/nodes/fight';
import { goToNode } from '../../src/nodes/go-to';
import { handToolNode } from '../../src/nodes/hand-tool';
import { onStartNode } from '../../src/nodes/on-start';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld } from './fake-world';

beforeAll(() => registerAllNodes());

const v = (x: number, y: number, z: number) => ({ x, y, z });
type Spec = [id: string, kind: string, params?: Params];
type Wire = [from: string, fromPort: string, to: string, toPort: string];

function play(mode: ViewMode, specs: Spec[], wires: Wire[], ticks: number): { world: World; out: (n: string, p: string) => unknown } {
  const graph: Graph = {
    nodes: specs.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld(mode);
  const rt = createRuntime(graph, world, mode);
  for (let i = 0; i < ticks; i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
  }
  return { world, out: (n, p) => rt.getOutput(n, p) };
}

const floor: Spec = ['floor', 'block', { position: v(0, -0.5, 0), size: v(40, 1, 1) }];
const bot = (x: number): Spec => ['bot', 'character', { position: v(x, 1, 0), role: 'bot', speed: 4 }];
const at = (w: World, owner: string): number => w.entities().find((e) => e.ownerNodeId === owner)!.position.x;

describe('Khi bắt đầu', () => {
  it('keeps "Đã bắt đầu" on from the first tick while "Khi bắt đầu" is one tick only', () => {
    const w = makeWorld();
    const out = [0, 1, 2].map((tick) => onStartNode.evaluate(makeCtx(w, { tick }), {}, {}, null));
    expect(out.map((o) => o.fired)).toEqual([true, false, false]);
    expect(out.map((o) => o.started)).toEqual([true, true, true]);
  });
});

describe('inputs that switch a piece on are off until wired', () => {
  const walk: Wire[] = [
    ['bot', 'self', 'go', 'self'],
    ['go', 'moveX', 'bot', 'moveX'],
  ];
  const goTo: Spec = ['go', 'go-to', { targetPos: v(8, 1, 0), pathfind: 'off' }];

  it('go-to stands still with "Bật" empty and walks once "Khi bắt đầu" is wired in', () => {
    const idle = play('2d-side', [floor, bot(0), goTo], walk, 120);
    expect(at(idle.world, 'bot')).toBeCloseTo(0, 1);
    const moving = play('2d-side', [floor, bot(0), goTo, ['s', 'on-start']], [...walk, ['s', 'started', 'go', 'go']], 120);
    expect(at(moving.world, 'bot')).toBeGreaterThan(3);
  });

  it('the one-tick pulse "Khi bắt đầu" is not a standing order: the bot barely moves', () => {
    const pulse = play('2d-side', [floor, bot(0), goTo, ['s', 'on-start']], [...walk, ['s', 'fired', 'go', 'go']], 120);
    expect(at(pulse.world, 'bot')).toBeLessThan(0.5);
  });

  it('every changed piece lists its "on" input without a default', () => {
    const inputs: [string, string][] = [
      ['go-to', 'go'],
      ['patrol', 'on'],
      ['route-follow', 'on'],
      ['timer', 'run'],
      ['moving-platform', 'run'],
      ['rotating-platform', 'run'],
      ['block', 'run'],
      ['portal', 'on'],
      ['camera', 'on'],
      ['show-text', 'show'],
      ['guide-arrow', 'show'],
      ['ui-button', 'show'],
      ['ui-meter', 'show'],
      ['chase', 'go'],
      ['fight', 'go'],
    ];
    for (const [kind, port] of inputs) {
      const p = getNodeDef(kind)!.inputs.find((x) => x.id === port);
      expect(p, `${kind}.${port}`).toBeDefined();
      expect(p!.type).toBe('bool');
      expect(p!.default, `${kind}.${port}`).toBeUndefined();
    }
  });

  it('chase and fight do nothing until "Bật" is on', () => {
    const w = createWorld('2d-side');
    const self = w.spawn({ kind: 'character', ownerNodeId: 'a', position: v(0, 0.5, 0), size: v(1, 1, 1), color: '#f00', solid: true, role: 'bot' });
    const target = w.spawn({ kind: 'character', ownerNodeId: 'b', position: v(2, 0.5, 0), size: v(1, 1, 1), color: '#00f', solid: true });
    const check = (def: NodeDef<any>): void => {
      const params = defaultParams(def);
      const state = def.create!(makeCtx(w), params);
      const off = def.evaluate(makeCtx(w), { self, target }, params, state);
      expect(off.moveX).toBe(0);
      const on = def.evaluate(makeCtx(w), { self, target, go: true }, params, state);
      expect(Math.abs(on.moveX as number) + (on.attack === true ? 1 : 0)).toBeGreaterThan(0);
    };
    check(chaseNode);
    check(fightNode);
  });
});

describe('go-to tells which goal it reached', () => {
  it('"Đã đến điểm đến" while heading for the first goal, "Đã đến điểm đến 2" while heading for the second', () => {
    const w = createWorld('2d-side');
    w.spawn({ kind: 'block', ownerNodeId: 'f', position: v(0, -0.5, 0), size: v(40, 1, 1), color: '#777', solid: true });
    const me = w.spawn({ kind: 'character', ownerNodeId: 'me', position: v(0, 1, 0), size: v(1, 1, 1), color: '#f00', solid: true, role: 'bot' });
    const one = w.spawn({ kind: 'block', ownerNodeId: 'one', position: v(0.3, 0.5, 0), size: v(0.5, 0.5, 0.5), color: '#0f0', solid: false });
    const two = w.spawn({ kind: 'block', ownerNodeId: 'two', position: v(0.2, 0.5, 0), size: v(0.5, 0.5, 0.5), color: '#00f', solid: false });
    for (let i = 0; i < 30; i++) w.step(TICK_DT);
    const params = defaultParams(goToNode, { stopDistance: 1 });
    const state = goToNode.create!(makeCtx(w), params);
    const first = goToNode.evaluate(makeCtx(w), { self: me, target: one, target2: two, go: true }, params, state);
    expect([first.arrived, first.arrivedAt1, first.arrivedAt2]).toEqual([true, true, false]);
    const second = goToNode.evaluate(makeCtx(w), { self: me, target: one, target2: two, go: true, useTarget2: true }, params, state);
    expect([second.arrived, second.arrivedAt1, second.arrivedAt2]).toEqual([true, false, true]);
    const off = goToNode.evaluate(makeCtx(w), { self: me, target: one, target2: two }, params, state);
    expect([off.arrivedAt1, off.arrivedAt2]).toEqual([false, false]);
  });
});

describe('one input, one action', () => {
  const setup = () => {
    const world = createWorld('2d-top');
    const ctx = makeCtx(world);
    const vParams = defaultParams(getNodeDef('vehicle')!);
    getNodeDef('vehicle')!.create!(ctx, vParams);
    const person = world.spawn({ kind: 'character', ownerNodeId: 'p', position: v(1.5, 0.5, 0), size: v(1, 1, 1), color: '#00f', solid: true });
    const params = defaultParams(enterExitNode);
    const state = enterExitNode.create!(ctx, params);
    const run = (inputs: Record<string, boolean>) => enterExitNode.evaluate(ctx, { character: person, ...inputs }, params, state);
    return { run };
  };

  it('"Lên xe" only boards and "Xuống xe" only gets out', () => {
    const { run } = setup();
    expect(run({ exit: true }).inVehicle).toBe(false);
    run({ exit: false });
    expect(run({ enter: true }).inVehicle).toBe(true);
    run({ enter: false });
    expect(run({ enter: true }).inVehicle).toBe(true);
    run({ enter: false });
    expect(run({ exit: true }).inVehicle).toBe(false);
  });

  it('"Cầm" only equips and "Cất" only puts away', () => {
    const w = createWorld('2d-side');
    w.spawn({ kind: 'block', ownerNodeId: 'f', position: v(0, -0.5, 0), size: v(20, 1, 1), color: '#777', solid: true });
    const c = w.spawn({ kind: 'character', ownerNodeId: 'c', position: v(0, 0.5, 0), size: v(1, 1, 1), color: '#f00', solid: true });
    w.spawn({ kind: 'item', ownerNodeId: 'i', position: v(0.6, 0.3, 0), size: v(0.6, 0.6, 0.6), color: '#ff0', solid: false, shape: 'pickaxe', holdStyle: 'hand' });
    for (let i = 0; i < 30; i++) w.step(TICK_DT);
    const params = defaultParams(handToolNode);
    const state = handToolNode.create!(makeCtx(w), params);
    const ev = (inputs: Record<string, boolean>) => handToolNode.evaluate(makeCtx(w), { character: c, ...inputs }, params, state);
    expect(ev({ unequip: true }).holding).toBe(false);
    ev({ unequip: false });
    expect(ev({ equip: true }).holding).toBe(true);
    ev({ equip: false });
    expect(ev({ equip: true }).holding).toBe(true);
    ev({ equip: false });
    expect(ev({ unequip: true }).holding).toBe(false);
  });

  it('the old shared inputs are marked legacy and the new ones are not', () => {
    const flag = (kind: string, port: string) => getNodeDef(kind)!.inputs.find((p) => p.id === port)?.legacy === true;
    expect(flag('enter-exit', 'press')).toBe(true);
    expect(flag('hand-tool', 'toggle')).toBe(true);
    expect(flag('block', 'hiddenWhile')).toBe(true);
    for (const [k, p] of [['enter-exit', 'enter'], ['enter-exit', 'exit'], ['hand-tool', 'equip'], ['hand-tool', 'unequip'], ['block', 'hide'], ['block', 'show']] as const) expect(flag(k, p), `${k}.${p}`).toBe(false);
  });
});

describe('the sight forecast knows only what is wired', () => {
  const guard = (): Spec => ['guard', 'character', { position: v(-9, 1, 0), role: 'bot', speed: 2 }];
  const specs = (): Spec[] => [
    floor,
    guard(),
    ['you', 'character', { position: v(5, 1, 0), role: 'bot' }],
    ['walk', 'patrol', { pointA: v(-9, 1, 0), pointB: v(0, 1, 0), wait: 1, pathfind: 'off' }],
    ['eyes', 'vision-sensor', { range: 6, angle: 90 }],
    ['fore', 'sight-forecast'],
    ['s', 'on-start'],
  ];
  const base: Wire[] = [
    ['guard', 'self', 'walk', 'self'],
    ['walk', 'moveX', 'guard', 'moveX'],
    ['guard', 'self', 'eyes', 'viewer'],
    ['you', 'self', 'eyes', 'target'],
    ['guard', 'self', 'fore', 'viewer'],
    ['you', 'self', 'fore', 'target'],
    ['s', 'started', 'walk', 'on'],
  ];

  it('with the patrol wired it counts down to the sight; without the wire it takes the guard to stand still', () => {
    const wired = play('2d-side', specs(), [...base, ['walk', 'route', 'fore', 'patrol']], 60 * 6);
    const unwired = play('2d-side', specs(), base, 60 * 6);
    // The guard walks east and sees the player at x=5 within the cone: the wired forecast has counted down and the unwired one has not moved on its own.
    expect(wired.out('fore', 'window') as number).toBeLessThan(unwired.out('fore', 'window') as number);
  });

  it('only a route wired from the Mục tiêu itself counts', () => {
    const route = getNodeDef('route-follow')!;
    expect(route.outputs.map((p) => p.id)).toContain('route');
    expect(getNodeDef('patrol')!.outputs.map((p) => p.id)).toContain('route');
    expect(getNodeDef('sight-forecast')!.inputs.map((p) => p.id)).toEqual(['viewer', 'target', 'patrol', 'route']);
  });
});
