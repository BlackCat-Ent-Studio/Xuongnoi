// Drive scripts: the truck is steered with real WASD key snapshots by an autopilot that plans a route around the
// buildings (same pathfinder the bots use). Nothing is teleported. Order dice are pinned per test for repeatable runs.
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type InputSnapshot, type Runtime } from '../../src/engine/types';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { findPlanePath, planeGridFor } from '../../src/world/navigation';
import { createWorld } from '../../src/world/world';

const board = (): Board => listAllSamples().find((s) => s.id === 'city-delivery')!.board;

const START_CLICK: InputSnapshot = {
  keysDown: new Set(),
  ui: { clicked: new Set(['ui-start']), held: new Set(), picked: new Set() },
};
const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

type Pt = { x: number; z: number };

/** `seed` pins the order dice so every run asks for the same houses (the real game rolls fresh numbers each time). */
function setup(seed = 7) {
  registerAllNodes();
  const b = board();
  b.graph.nodes.find((n) => n.id === 'order-roll')!.params.seed = seed;
  const world = createWorld(b.mode);
  const rt: Runtime = createRuntime(b.graph, world, b.mode);
  const step = (input: InputSnapshot): void => {
    rt.tick(input);
    world.step(TICK_DT);
  };
  const find = (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!;
  const num = (node: string, port: string): number => Number(rt.getOutput(node, port));
  /** The player presses the start button on the first screen. */
  const begin = (): void => step(START_CLICK);
  const seconds = (): number => rt.tickIndex * TICK_DT;
  return { world, rt, step, find, num, begin, seconds };
}
type Game = ReturnType<typeof setup>;

/** WASD keys that point the truck toward a world point (top view: up = -z). */
function keysToward(from: Pt, to: Pt): string[] {
  const out: string[] = [];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx > 0.3) out.push('KeyD');
  else if (dx < -0.3) out.push('KeyA');
  if (dz > 0.3) out.push('KeyS');
  else if (dz < -0.3) out.push('KeyW');
  return out;
}

const BAY_GOODS = ['farm-goods', 'mine-goods', 'pile-crate'] as const;
const BAY_CENTER: Record<string, Pt> = { 'farm-goods': { x: -20, z: 11 }, 'mine-goods': { x: 20, z: 11 }, 'pile-crate': { x: 0, z: 11 } };
const HOUSE: Pt[] = [{ x: -20, z: -9.5 }, { x: 0, z: -9.5 }, { x: 20, z: -9.5 }];

/** Number of goods showing within the bay (the pile of waiting crates elsewhere does not count). */
function goodsVisible(g: Game, prefix: string): number {
  const c = BAY_CENTER[prefix]!;
  return g.world.entities().filter((e) => e.ownerNodeId.startsWith(prefix) && e.visible && Math.hypot(e.position.x - c.x, e.position.z - c.z) < 4.5).length;
}

/**
 * Autopilot for the truck: plans a route around the buildings and holds the matching WASD keys.
 * Needs no engine hooks: it reads only what a player sees (positions and the orders on screen).
 */
function autopilot(g: Game) {
  let route: Pt[] = [];
  let routeGoal: Pt | null = null;
  let age = 0;
  return (goal: Pt): InputSnapshot => {
    const truck = g.find('truck');
    if (!routeGoal || routeGoal.x !== goal.x || routeGoal.z !== goal.z || age++ % 30 === 0) {
      routeGoal = goal;
      const grid = planeGridFor(g.world, { halfWidth: 1.1, height: 1.2 }, 0);
      route = grid ? (findPlanePath(grid, { x: truck.position.x, z: truck.position.z }, goal)?.points ?? []) : [];
    }
    while (route.length > 1 && Math.hypot(route[0]!.x - truck.position.x, route[0]!.z - truck.position.z) < 1.2) route.shift();
    const next = route[0] ?? goal;
    return keys(...keysToward(truck.position, next));
  };
}

function activeHouse(g: Game): number {
  for (let k = 1; k <= 3; k++) if (g.rt.getOutput('order-pick', `is${k}`) === true) return k;
  return 0;
}

/** Plays the game like a careful player would: fill up at the nearest stocked bay, then go to the house asked for. */
function playUntilEnd(g: Game, maxSeconds: number, onDelivery?: (n: number, t: number) => void): void {
  const drive = autopilot(g);
  let delivered = 0;
  for (let i = 0; i < maxSeconds * 60 && !g.world.ended; i++) {
    const cargo = g.num('cargo', 'count');
    const house = activeHouse(g);
    let goal: Pt;
    if (cargo === 0 || house === 0) {
      // Nearest bay that still has goods lying around.
      const truck = g.find('truck').position;
      const stocked = BAY_GOODS.filter((p) => goodsVisible(g, p) > 0).map((p) => BAY_CENTER[p]!);
      stocked.sort((a, b) => Math.hypot(a.x - truck.x, a.z - truck.z) - Math.hypot(b.x - truck.x, b.z - truck.z));
      goal = stocked[0] ?? { x: 0, z: -7 };
    } else {
      goal = HOUSE[house - 1]!;
    }
    g.step(drive(goal));
    const d = g.num('delivered', 'value');
    if (d !== delivered) {
      delivered = d;
      onDelivery?.(d, g.seconds());
    }
  }
}

describe('city-delivery sample', () => {
  it('lays the board out in labelled sections without overlapping nodes', () => {
    registerAllNodes();
    const b = board();
    const titles = (b.notes ?? []).map((n) => n.text.split('\n')[0]);
    for (const t of ['Thành phố', 'Bot nông dân', 'Bot thợ mỏ', 'Bot bốc vác', 'Xe của bạn', 'Đơn hàng', 'Thắng / Thua', 'Màn hình']) expect(titles).toContain(t);
    const boxes = b.graph.nodes.map((n) => ({ id: n.id, ...n.pos, ...estimateNodeSize(n) }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const c = boxes[j]!;
        const overlap = a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y;
        expect(overlap, `${a.id} overlaps ${c.id}`).toBe(false);
      }
  });

  it('is built from existing nodes only and ends with the truck seated and the clock waiting for the start button', () => {
    const g = setup();
    for (let i = 0; i < 120; i++) g.step(keys());
    expect(g.find('player').seatedIn).toBe(g.find('truck').id);
    expect(g.num('order-timer', 'left')).toBe(50);
    expect(g.num('hearts', 'value')).toBe(3);
  });

  it('the three bots stock all three bays with goods within 25 seconds', () => {
    const g = setup();
    g.begin();
    for (let i = 0; i < 25 * 60; i++) g.step(keys());
    expect(goodsVisible(g, 'farm-goods')).toBeGreaterThanOrEqual(2);
    expect(goodsVisible(g, 'mine-goods')).toBeGreaterThanOrEqual(2);
    // The loader drops crates one by one; the first one lands well within the window.
    const crates = g.world.entities().filter((e) => e.ownerNodeId.startsWith('pile-crate'));
    const atBay = crates.filter((e) => Math.hypot(e.position.x - 0, e.position.z - 11) < 3);
    expect(atBay.length).toBeGreaterThanOrEqual(1);
  });

  it('farm and mine goods keep appearing until every slot is used', () => {
    const g = setup();
    g.begin();
    for (let i = 0; i < 60 * 60; i++) g.step(keys());
    expect(goodsVisible(g, 'farm-goods')).toBe(6);
    expect(goodsVisible(g, 'mine-goods')).toBe(6);
  });

  it('driving into a bay loads goods onto the truck, and the house asked for takes one and counts the delivery', () => {
    const g = setup();
    g.begin();
    const drive = autopilot(g);
    // Wait for the farm to have stock, then drive in.
    for (let i = 0; i < 12 * 60; i++) g.step(keys());
    expect(goodsVisible(g, 'farm-goods')).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 25 * 60 && g.num('cargo', 'count') < 2; i++) g.step(drive(BAY_CENTER['farm-goods']!));
    expect(g.num('cargo', 'count')).toBeGreaterThanOrEqual(2);
    expect(g.num('delivered', 'value')).toBe(0);
    const house = activeHouse(g);
    expect(house).toBeGreaterThan(0);
    let onBoard = g.num('cargo', 'count');
    let beforeDrop = onBoard;
    for (let i = 0; i < 40 * 60 && g.num('delivered', 'value') < 1; i++) {
      beforeDrop = onBoard;
      g.step(drive(HOUSE[house - 1]!));
      onBoard = g.num('cargo', 'count');
    }
    expect(g.num('delivered', 'value')).toBe(1);
    expect(onBoard).toBe(beforeDrop - 1);
    expect(g.num('money', 'out')).toBe(10);
    expect(g.num('order-timer', 'left')).toBeGreaterThan(40); // fresh clock for the next order
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('a careful player wins by delivering 5 orders without losing a heart (dice seed %i)', (seed) => {
    const g = setup(seed);
    g.begin();
    const times: number[] = [];
    playUntilEnd(g, 300, (_n, t) => times.push(t));
    expect(g.world.ended?.result).toBe('win');
    expect(g.num('delivered', 'value')).toBe(5);
    expect(g.num('hearts', 'value')).toBe(3);
    expect(times).toHaveLength(5);
    // A perfect run is far quicker than a first-time player will be; it must still take a real drive.
    expect(g.seconds()).toBeGreaterThan(30);
    expect(g.seconds()).toBeLessThan(200);
  });

  it('three late orders lose the game (idle player)', () => {
    const g = setup();
    g.begin();
    for (let i = 0; i < 60 * 60 * 3 && !g.world.ended; i++) {
      g.step(keys());
      // Hearts drop one by one, 50 seconds apart.
    }
    expect(g.world.ended?.result).toBe('lose');
    expect(g.num('hearts', 'value')).toBe(0);
    expect(g.seconds()).toBeGreaterThan(149);
    expect(g.seconds()).toBeLessThan(156);
  });

  it('one late order costs exactly one heart and starts a fresh order', () => {
    const g = setup();
    g.begin();
    for (let i = 0; i < 51 * 60; i++) g.step(keys());
    expect(g.num('hearts', 'value')).toBe(2);
    expect(g.num('order-timer', 'left')).toBeGreaterThan(45);
    expect(activeHouse(g)).toBeGreaterThan(0);
    expect(g.world.ended).toBeNull();
  });

  it('runs 3 minutes of erratic driving without throwing', () => {
    const g = setup();
    g.begin();
    const all = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
    let seed = 12345;
    const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let held: string[] = [];
    expect(() => {
      for (let i = 0; i < 3 * 60 * 60 && !g.world.ended; i++) {
        if (i % 40 === 0) held = all.filter(() => rnd() < 0.4);
        g.step(keys(...held));
      }
    }).not.toThrow();
  });
});
