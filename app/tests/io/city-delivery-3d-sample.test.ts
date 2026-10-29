// The 3D city board: districts, bots, traffic, lights, pedestrians, crashes and orders.
// Driving uses real WASD key snapshots from an autopilot that plans a route with the engine pathfinder (it slows down
// for cars in front of it, like a player would). Only the clearly labelled "fast" tests move things by hand.
// The board is large, so every sim-heavy test gets a generous timeout.
import { describe, expect, it } from 'vitest';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type InputSnapshot, type Runtime } from '../../src/engine/types';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { findPlanePath, planeGridFor } from '../../src/world/navigation';
import { createWorld } from '../../src/world/world';

const SLOW = 180_000;
const START_CLICK: InputSnapshot = {
  keysDown: new Set(),
  ui: { clicked: new Set(['hu-start']), held: new Set(), picked: new Set() },
};
const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

type Pt = { x: number; z: number };

const board = (): Board => listSamples().find((s) => s.id === 'city-delivery-3d')!.board;

interface Options {
  /** Pins the order dice so every run asks for the same houses (the real game rolls fresh numbers). */
  seed?: number;
  /** Removes the bot cars and the pedestrians, for tests about orders and rules only. */
  quiet?: boolean;
  /** Seconds the clock of one order runs (the real game uses 90). */
  orderSeconds?: number;
  /** Bot cars (by vehicle id) that stay on the board but stand still, as obstacles to run into; all other traffic is left out. */
  parked?: string[];
}

function setup(opts: Options = {}) {
  registerAllNodes();
  const b = board();
  if (opts.quiet || opts.parked) {
    const drop = (id: string): boolean => (id.startsWith('lp') || id.startsWith('ped')) && !(opts.parked ?? []).includes(id);
    b.graph.nodes = b.graph.nodes.filter((n) => !drop(n.id));
    const alive = new Set(b.graph.nodes.map((n) => n.id));
    b.graph.wires = b.graph.wires.filter((w) => alive.has(w.from.node) && alive.has(w.to.node));
    delete b.graph.groups;
  }
  const byId = (id: string) => b.graph.nodes.find((n) => n.id === id)!;
  byId('od-roll').params.seed = opts.seed ?? 3;
  if (opts.orderSeconds !== undefined) byId('od-timer').params.seconds = opts.orderSeconds;
  const world = createWorld(b.mode);
  const rt: Runtime = createRuntime(b.graph, world, b.mode);
  const step = (input: InputSnapshot): void => {
    rt.tick(input);
    world.step(TICK_DT);
  };
  const find = (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!;
  const num = (node: string, port: string): number => Number(rt.getOutput(node, port));
  const flag = (node: string, port: string): boolean => rt.getOutput(node, port) === true;
  return { world, rt, step, find, num, flag, begin: () => step(START_CLICK), seconds: () => rt.tickIndex * TICK_DT };
}
type Game = ReturnType<typeof setup>;

// ---- the map, as a player sees it

const BAY: Record<string, Pt> = { rau: { x: -26, z: -20 }, 'quặng': { x: 26, z: -20 }, 'thùng': { x: 0, z: 20 } };
const TYPE_NODE: Record<string, string> = { rau: 'tk-cargo-rau', 'quặng': 'tk-cargo-quang', 'thùng': 'tk-cargo-thung' };
const DISTRICT: Record<string, Pt> = {
  hoasen: { x: 0, z: -26 }, phoco: { x: -26, z: 0 }, bosong: { x: -26, z: 26 }, cholon: { x: 0, z: 0 }, doixanh: { x: 26, z: 26 }, congtruong: { x: 26, z: 0 },
};
/** Same order table as the board: house and goods type per slot. */
const SLOTS: { d: string; house: number; type: string }[] = [
  { d: 'hoasen', house: 1, type: 'rau' },
  { d: 'phoco', house: 2, type: 'thùng' },
  { d: 'bosong', house: 1, type: 'thùng' },
  { d: 'cholon', house: 1, type: 'rau' },
  { d: 'cholon', house: 2, type: 'thùng' },
  { d: 'doixanh', house: 1, type: 'rau' },
  { d: 'doixanh', house: 2, type: 'quặng' },
  { d: 'congtruong', house: 1, type: 'quặng' },
  { d: 'congtruong', house: 2, type: 'thùng' },
];
const NEED = 3;
const CAPACITY = 4;
const padOf = (slot: number): Pt => {
  const s = SLOTS[slot - 1]!;
  const c = DISTRICT[s.d]!;
  return { x: c.x + (s.house === 1 ? -4.4 : 4.4), z: c.z + 10.7 };
};

function activeSlot(g: Game): number {
  for (let k = 1; k <= 9; k++) {
    const on = k <= 6 ? g.flag('od-selA', `is${k}`) : g.flag('od-selB', `is${k - 6}`);
    if (on) return k;
  }
  return 0;
}
const onTruck = (g: Game, type: string): number => g.num(TYPE_NODE[type]!, 'typeCount');
const delivered = (g: Game): number => g.num('od-delivered', 'value');
/** Items riding on the truck right now (read from the world: the node output lags a node behind on the tick of a change). */
const carried = (g: Game): number => g.world.cargoOf(g.find('tk-truck').id).length;

// ---- driving

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

/** Plans around the buildings with the engine pathfinder, holds the WASD keys, and brakes for a car right in front. */
function autopilot(g: Game) {
  let route: Pt[] = [];
  let routeGoal: Pt | null = null;
  let age = 0;
  /** Ticks spent braking for a car; a player who has waited long enough noses forward anyway. */
  let waited = 0;
  return (goal: Pt): InputSnapshot => {
    const truck = g.find('tk-truck');
    if (!routeGoal || routeGoal.x !== goal.x || routeGoal.z !== goal.z || age++ % 30 === 0) {
      routeGoal = goal;
      const grid = planeGridFor(g.world, { halfWidth: 1.9, height: 1.2 }, 0);
      route = grid ? (findPlanePath(grid, { x: truck.position.x, z: truck.position.z }, goal)?.points ?? []) : [];
    }
    while (route.length > 1 && Math.hypot(route[0]!.x - truck.position.x, route[0]!.z - truck.position.z) < 1.2) route.shift();
    const next = route[0] ?? goal;
    const want = keysToward(truck.position, next);
    if (want.length === 0) return keys();
    // Brake when another vehicle is close and in the direction of travel.
    const dir = { x: next.x - truck.position.x, z: next.z - truck.position.z };
    const len = Math.hypot(dir.x, dir.z) || 1;
    for (const e of g.world.entities()) {
      if (e.kind !== 'vehicle' || e.ownerNodeId === 'tk-truck' || !e.visible) continue;
      const ox = e.position.x - truck.position.x;
      const oz = e.position.z - truck.position.z;
      const dist = Math.hypot(ox, oz);
      if (dist < 6 && (ox * dir.x + oz * dir.z) / (dist * len + 1e-9) > 0.6) {
        waited++;
        if (waited % 300 < 120) return keys(); // wait two seconds, then edge forward for three
        break;
      }
    }
    return keys(...want);
  };
}

/** Makes room by dumping one item with Space (the same key a player uses) when the truck is too full for what the order needs. */
function tapDumpIfClogged(g: Game, type: string): boolean {
  const have = onTruck(g, type);
  const short = Math.max(0, NEED - g.num('od-prog', 'value') - have);
  if (short === 0 || carried(g) + short <= CAPACITY) return false;
  g.step(keys('Space'));
  g.step(keys());
  return true;
}

/** Fills up with what the current order needs, then goes to the house. Returns true when the order was delivered. */
function serveOrder(g: Game, drive: (goal: Pt) => InputSnapshot, maxSeconds: number): boolean {
  const slot = activeSlot(g);
  const type = SLOTS[slot - 1]!.type;
  const before = delivered(g);
  const maxTicks = Math.round(maxSeconds / TICK_DT);
  for (let i = 0; i < maxTicks && !g.world.ended; i++) {
    if (delivered(g) > before) return true;
    if (activeSlot(g) !== slot) return false; // the order timed out
    const stillNeeded = NEED - g.num('od-prog', 'value');
    // Make room only once at the bay of the wanted goods (dumping inside another bay would just load the item again).
    const atBay = Math.hypot(g.find('tk-truck').position.x - BAY[type]!.x, g.find('tk-truck').position.z - BAY[type]!.z) < 4;
    if (onTruck(g, type) < stillNeeded && atBay && tapDumpIfClogged(g, type)) continue;
    const goal = onTruck(g, type) >= stillNeeded ? padOf(slot) : BAY[type]!;
    g.step(drive(goal));
  }
  return delivered(g) > before;
}

// ---------------------------------------------------------------- the board itself

describe('city-delivery-3d: board', () => {
  const b = board();

  it('is registered as a 3D sample with groups', () => {
    const s = listSamples().find((x) => x.id === 'city-delivery-3d')!;
    expect(s.label).toBe('Thành phố giao hàng 3D (nhiều khu, xe cộ, đèn giao thông)');
    expect(s.board.mode).toBe('3d');
    expect(b.graph.groups!.length).toBeGreaterThanOrEqual(25);
    expect(b.graph.nodes.length).toBeGreaterThan(400);
  });

  it('puts every node in exactly one named group', () => {
    const seen = new Set<string>();
    for (const g of b.graph.groups!) {
      expect(g.name.length).toBeGreaterThan(0);
      for (const id of g.nodeIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(b.graph.nodes.length);
  });

  it('has the groups the design asks for', () => {
    const names = b.graph.groups!.map((g) => g.name).join('|');
    for (const part of ['Nông trại', 'Mỏ đá', 'Cảng kho', 'Đèn giao thông 1', 'Vòng xe 1', 'Người đi bộ', 'Đơn hàng', 'Xe tải của bạn', 'Màn hình bắt đầu']) {
      expect(names).toContain(part);
    }
    for (const d of ['Khu Hoa Sen', 'Phố Cổ', 'Bờ Sông', 'Chợ Lớn', 'Đồi Xanh', 'Công Trường']) {
      expect(b.graph.groups!.some((g) => g.name.startsWith(d) && g.name.includes('nhà nhận hàng'))).toBe(true);
      expect(b.graph.groups!.some((g) => g.name.startsWith(d) && g.name.includes('cảnh quan'))).toBe(true);
    }
  });

  it('has 6-10 bot cars, 4 traffic lights and 4-6 pedestrians', () => {
    const cars = b.graph.nodes.filter((n) => n.kind === 'vehicle' && n.params.control === 'auto');
    expect(cars.length).toBeGreaterThanOrEqual(6);
    expect(cars.length).toBeLessThanOrEqual(10);
    expect(b.graph.nodes.filter((n) => n.kind === 'timer' && n.id.startsWith('lg')).length).toBe(4);
    const peds = b.graph.nodes.filter((n) => n.kind === 'character' && n.id.startsWith('ped'));
    expect(peds.length).toBeGreaterThanOrEqual(4);
    expect(peds.length).toBeLessThanOrEqual(6);
    expect(b.graph.nodes.filter((n) => n.kind === 'block' && n.params.style === 'trafficlight').length).toBeGreaterThanOrEqual(8);
  });

  it('lays out nodes in a group and group blocks on the board without overlap', () => {
    registerAllNodes();
    for (const g of b.graph.groups!) {
      const boxes = g.nodeIds.map((id) => {
        const n = b.graph.nodes.find((x) => x.id === id)!;
        return { id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) };
      });
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const p = boxes[i]!;
          const q = boxes[j]!;
          const overlap = p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
          expect(overlap, `${g.name}: ${p.id} overlaps ${q.id}`).toBe(false);
        }
      }
    }
    // Group blocks on the main board: same estimate as the generator used (width 380, 150 + 26 per port).
    const inside = new Map<string, string>();
    for (const g of b.graph.groups!) for (const id of g.nodeIds) inside.set(id, g.id);
    const ports = new Map<string, Set<string>>();
    for (const w of b.graph.wires) {
      const a = inside.get(w.from.node);
      const c = inside.get(w.to.node);
      if (a === c) continue;
      if (a) (ports.get(a) ?? ports.set(a, new Set()).get(a)!).add(`o|${w.from.node}|${w.from.port}`);
      if (c) (ports.get(c) ?? ports.set(c, new Set()).get(c)!).add(`i|${w.to.node}|${w.to.port}`);
    }
    const blocks = b.graph.groups!.map((g) => ({ id: g.id, x: g.x, y: g.y, w: 380, h: 120 + 26 * (ports.get(g.id)?.size ?? 0) }));
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const p = blocks[i]!;
        const q = blocks[j]!;
        expect(p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y, `${p.id} overlaps ${q.id}`).toBe(false);
      }
    }
  });

  it('keeps the solid blocks inside the area the path planner can handle', () => {
    registerAllNodes();
    const g = setup({ quiet: true });
    expect(planeGridFor(g.world, { halfWidth: 1.1, height: 1.2 }, 0)).not.toBeNull();
    expect(planeGridFor(g.world, { halfWidth: 0.4, height: 1 }, 0)).not.toBeNull();
  });
});

// ---------------------------------------------------------------- bots

describe('city-delivery-3d: bots', () => {
  it('the three bots keep stocking their bays with the right goods type', { timeout: SLOW }, () => {
    const g = setup({ quiet: true });
    g.begin();
    const stock = (prefix: string, bay: Pt): number =>
      g.world.entities().filter((e) => e.ownerNodeId.startsWith(prefix) && e.kind === 'item' && e.visible && Math.hypot(e.position.x - bay.x, e.position.z - bay.z) < 4.5).length;
    expect(stock('fm-goods', BAY.rau!)).toBe(2);
    expect(stock('mn-goods', BAY['quặng']!)).toBe(2);
    expect(stock('pt-', BAY['thùng']!)).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 90 * 60; i++) g.step(keys());
    expect(stock('fm-goods', BAY.rau!)).toBeGreaterThanOrEqual(5);
    expect(stock('mn-goods', BAY['quặng']!)).toBeGreaterThanOrEqual(5);
    expect(stock('pt-', BAY['thùng']!)).toBeGreaterThanOrEqual(5);
    // Goods carry their type tag.
    const farm = g.world.entities().find((e) => e.ownerNodeId === 'fm-goods-1')!;
    expect(g.world.tagOf(farm.id)).toBe('rau');
    expect(g.world.tagOf(g.find('mn-goods-1').id)).toBe('quặng');
    expect(g.world.tagOf(g.find('pt-ready-1').id)).toBe('thùng');
    expect(g.find('mn-goods-1').shape).toBe('ore');
    expect(g.find('fm-goods-1').shape).toBe('veggie');
  });
});

// ---------------------------------------------------------------- traffic

describe('city-delivery-3d: traffic', () => {
  it('bot cars keep rolling around their loops without crashing into each other', { timeout: SLOW }, () => {
    const g = setup();
    g.begin();
    const cars = g.world.entities().filter((e) => e.kind === 'vehicle' && e.ownerNodeId.startsWith('lp'));
    expect(cars.length).toBe(10);
    const travelled = new Map<string, number>();
    const last = new Map<string, Pt>();
    for (let i = 0; i < 60 * 60; i++) {
      g.step(keys());
      for (const c of g.world.entities().filter((e) => e.kind === 'vehicle' && e.ownerNodeId.startsWith('lp'))) {
        const p = last.get(c.id);
        if (p) travelled.set(c.id, (travelled.get(c.id) ?? 0) + Math.hypot(c.position.x - p.x, c.position.z - p.z));
        last.set(c.id, { x: c.position.x, z: c.position.z });
      }
    }
    for (const c of cars) expect(travelled.get(c.id) ?? 0, c.ownerNodeId).toBeGreaterThan(60);
    const hits = g.world.entities().filter((e) => e.ownerNodeId.startsWith('lp') && e.kind === 'vehicle').reduce((s, e) => s + (e.vehicle?.hitSeq ?? 0), 0);
    expect(hits).toBe(0);
  });

  it('cars stop at a red light and drive on when it turns green', { timeout: SLOW }, () => {
    const g = setup();
    g.begin();
    // A car waits while it touches one of its stop lines (the lines only show while the light is yellow or red).
    const watch = ['lp1-car1', 'lp1-car2', 'lp2-car1', 'lp2-car2', 'lp3-car1', 'lp3-car2', 'lp4-car1', 'lp4-car2'];
    const waiting = new Map<string, number>();
    const after: { car: string; at: Pt; tick: number }[] = [];
    let stoppedAtRed = 0;
    let movedOn = 0;
    let longest = 0;
    for (let i = 0; i < 150 * 60; i++) {
      g.step(keys());
      for (const car of watch) {
        const touching = touchesRed(g, car.slice(0, 3), car.slice(-1));
        const v = g.find(car);
        const speed = Math.abs(v.vehicle?.speed ?? 0);
        if (touching) {
          const n = (waiting.get(car) ?? 0) + 1;
          waiting.set(car, n);
          if (n === 30 && speed < 0.2) stoppedAtRed++; // standing still half a second after touching a red line
          longest = Math.max(longest, n);
        } else if (waiting.has(car)) {
          if ((waiting.get(car) ?? 0) > 30) after.push({ car, at: { x: v.position.x, z: v.position.z }, tick: i });
          waiting.delete(car);
        }
      }
      for (let k = after.length - 1; k >= 0; k--) {
        const w = after[k]!;
        if (i - w.tick < 180) continue;
        const v = g.find(w.car);
        if (Math.hypot(v.position.x - w.at.x, v.position.z - w.at.z) > 3) movedOn++;
        after.splice(k, 1);
      }
    }
    expect(stoppedAtRed).toBeGreaterThanOrEqual(3); // cars really queued at red lines
    expect(movedOn).toBeGreaterThanOrEqual(3); // and drove on three seconds after the light let them go
    expect(longest).toBeLessThan(30 * 60); // nobody is stuck for good
  });

  it('the lights cycle green, yellow and red on the poles', { timeout: SLOW }, () => {
    const g = setup({ quiet: true });
    g.begin();
    const colours = new Set<string>();
    for (let i = 0; i < 25 * 60; i++) {
      g.step(keys());
      colours.add(g.find('lg1-pole-ne').color);
    }
    expect(colours.size).toBe(3);
    expect(colours).toEqual(new Set(['#ef4444', '#facc15', '#22c55e']));
    // East-west and north-south never both go at once.
    for (let i = 0; i < 40 * 60; i++) {
      g.step(keys());
      expect(g.flag('lg1-oe', 'out') || g.flag('lg1-on', 'out')).toBe(true);
    }
  });

  it('pedestrians walk back and forth across the streets', { timeout: SLOW }, () => {
    const g = setup();
    g.begin();
    const before = g.find('ped1-who').position.x;
    let minX = before;
    let maxX = before;
    for (let i = 0; i < 40 * 60; i++) {
      g.step(keys());
      const x = g.find('ped1-who').position.x;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    expect(maxX - minX).toBeGreaterThan(8);
  });
});

/** True when the car (by loop key and number) currently touches one of its red stop lines. */
function touchesRed(g: Game, loop: string, k: string): boolean {
  for (let n = 1; n <= 6; n++) {
    try {
      if (g.rt.getOutput(`${loop}-t${k}-${n}`, 'touching') === true) return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------- rules: start screen, loading, orders

describe('city-delivery-3d: game rules', () => {
  it('waits on the start screen: the truck is braked, the order clock does not run, then the click starts everything', () => {
    const g = setup({ quiet: true });
    for (let i = 0; i < 120; i++) g.step(keys('KeyW'));
    const truck = g.find('tk-truck');
    expect(Math.hypot(truck.position.x, truck.position.z - 13)).toBeLessThan(0.5);
    expect(g.num('od-timer', 'left')).toBe(90);
    const items = g.world.hudItems();
    expect(items.some((h) => h.widget?.type === 'start' && !h.hidden)).toBe(true);
    g.begin();
    for (let i = 0; i < 120; i++) g.step(keys('KeyW'));
    expect(g.find('tk-truck').position.z).toBeLessThan(11);
    expect(g.num('od-timer', 'left')).toBeLessThan(89);
    expect(g.world.hudItems().find((h) => h.widget?.type === 'start')?.hidden).toBe(true);
  });

  it('the player is seated in the truck from the first moment', () => {
    const g = setup({ quiet: true });
    g.begin();
    for (let i = 0; i < 10; i++) g.step(keys());
    expect(g.find('tk-player').seatedIn).toBe(g.find('tk-truck').id);
  });

  it('shows the order text, the arrow and the "deliver here" label for the active house only', () => {
    const g = setup({ quiet: true, seed: 5 });
    g.begin();
    for (let i = 0; i < 5; i++) g.step(keys());
    const slot = activeSlot(g);
    expect(slot).toBeGreaterThan(0);
    const s = SLOTS[slot - 1]!;
    const shown = g.world.hudItems().filter((h) => !h.hidden && h.text?.startsWith('Đơn:'));
    expect(shown).toHaveLength(1);
    expect(shown[0]!.text).toContain(`Nhà ${s.house}`);
    expect(shown[0]!.text).toContain(`cần ${NEED} ${s.type}`);
    const arrows = g.world.hudItems().filter((h) => h.guide && !h.hidden);
    expect(arrows).toHaveLength(1);
    expect(g.world.hudItems().filter((h) => !h.hidden && h.text === 'Giao ở đây!')).toHaveLength(1);
  });

  it('every slot names a district, house and type that exist on the board', () => {
    const b = board();
    for (const s of SLOTS) {
      expect(b.graph.nodes.some((n) => n.id === `dl-${s.d}-house${s.house}`)).toBe(true);
      expect(b.graph.nodes.some((n) => n.id === `dl-${s.d}-pad${s.house}`)).toBe(true);
    }
    expect(new Set(SLOTS.map((s) => s.type))).toEqual(new Set(['rau', 'quặng', 'thùng']));
    for (const d of Object.keys(DISTRICT)) {
      const types = new Set(SLOTS.filter((s) => s.d === d).map((s) => s.type));
      expect(types.size).toBeGreaterThanOrEqual(1);
      expect(types.size).toBeLessThanOrEqual(2);
    }
  });

  it('driving into a bay loads only that bay\'s goods type, up to 4', { timeout: SLOW }, () => {
    const g = setup({ quiet: true });
    g.begin();
    const drive = autopilot(g);
    for (let i = 0; i < 120 * 60; i++) g.step(keys()); // let the harbour bot bring a few more crates
    for (let i = 0; i < 40 * 60 && onTruck(g, 'thùng') < 4; i++) g.step(drive(BAY['thùng']!));
    expect(onTruck(g, 'thùng')).toBe(4);
    expect(onTruck(g, 'rau')).toBe(0);
    expect(onTruck(g, 'quặng')).toBe(0);
    expect(carried(g)).toBe(4);
    // Full: nothing more is taken.
    for (let i = 0; i < 3 * 60; i++) g.step(keys());
    expect(onTruck(g, 'thùng')).toBe(4);
    expect(g.world.cargoOf(g.find('tk-truck').id)).toHaveLength(4);
  });

  it('autopilot with real traffic: loads the right goods and delivers two orders', { timeout: SLOW }, () => {
    const g = setup({ seed: 3 });
    g.begin();
    const drive = autopilot(g);
    const done: { slot: number; type: string; seconds: number }[] = [];
    let crashes = 0;
    for (let n = 0; n < 8 && done.length < 2 && !g.world.ended; n++) {
      const slot = activeSlot(g);
      const type = SLOTS[slot - 1]!.type;
      const t0 = g.seconds();
      const before = delivered(g);
      const maxTicks = 150 * 60;
      for (let i = 0; i < maxTicks && !g.world.ended && delivered(g) === before && activeSlot(g) === slot; i++) {
        const nearBay = Math.hypot(g.find('tk-truck').position.x - BAY[type]!.x, g.find('tk-truck').position.z - BAY[type]!.z) < 4;
        if (nearBay && onTruck(g, type) < NEED - g.num('od-prog', 'value') && tapDumpIfClogged(g, type)) continue;
        const stillNeeded = NEED - g.num('od-prog', 'value');
        g.step(drive(onTruck(g, type) >= stillNeeded ? padOf(slot) : BAY[type]!));
        if (g.flag('tk-truck', 'crashed')) crashes++;
      }
      if (delivered(g) > before) done.push({ slot, type, seconds: g.seconds() - t0 });
    }
    // Crashes and late orders can happen in traffic; what matters is that real driving gets two orders through.
    expect(done.length, `crashes ${crashes}, hearts ${g.num('od-hearts', 'value')}`).toBe(2);
    expect(delivered(g)).toBeGreaterThanOrEqual(2);
    expect(g.num('od-money', 'out')).toBeGreaterThanOrEqual(80);
    // The goods that rode on the truck at the end were never anything but the three known types.
    expect(g.world.cargoOf(g.find('tk-truck').id).every((id) => ['rau', 'quặng', 'thùng'].includes(g.world.tagOf(id)))).toBe(true);
  });

  it('delivery takes only the needed type and only inside the active house\'s pad', { timeout: SLOW }, () => {
    const g = setup({ quiet: true, seed: 3 });
    g.begin();
    const drive = autopilot(g);
    const slot = activeSlot(g);
    const wanted = SLOTS[slot - 1]!.type;
    // Collect the wrong type on purpose.
    const wrong = wanted === 'thùng' ? 'rau' : 'thùng';
    for (let i = 0; i < 25 * 60; i++) g.step(keys());
    for (let i = 0; i < 80 * 60 && onTruck(g, wrong) < 2; i++) g.step(drive(BAY[wrong]!));
    expect(onTruck(g, wrong)).toBeGreaterThanOrEqual(2);
    // Drive to the house that wants something else: nothing is accepted.
    for (let i = 0; i < 100 * 60 && Math.hypot(g.find('tk-truck').position.x - padOf(slot).x, g.find('tk-truck').position.z - padOf(slot).z) > 1; i++) g.step(drive(padOf(slot)));
    const held = onTruck(g, wrong);
    expect(held).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 120; i++) g.step(keys());
    expect(onTruck(g, wrong)).toBe(held);
    expect(delivered(g)).toBe(0);
    expect(g.num('od-prog', 'value')).toBe(0);
    // Passing through another house's pad does not unload either.
    const other = SLOTS.findIndex((s, i) => i + 1 !== slot && s.type === wrong) + 1;
    expect(other).toBeGreaterThan(0);
    for (let i = 0; i < 100 * 60 && Math.hypot(g.find('tk-truck').position.x - padOf(other).x, g.find('tk-truck').position.z - padOf(other).z) > 1; i++) g.step(drive(padOf(other)));
    for (let i = 0; i < 120; i++) g.step(keys());
    expect(onTruck(g, wrong)).toBe(held);
  });

  it('a delivery needs both items: one item counts as progress, two complete the order and start the next', { timeout: SLOW }, () => {
    const g = setup({ quiet: true, seed: 3 });
    g.begin();
    const drive = autopilot(g);
    const slot = activeSlot(g);
    const type = SLOTS[slot - 1]!.type;
    for (let i = 0; i < 30 * 60; i++) g.step(keys());
    for (let i = 0; i < 80 * 60 && onTruck(g, type) < 2; i++) g.step(drive(BAY[type]!));
    expect(onTruck(g, type)).toBeGreaterThanOrEqual(2);
    const money0 = g.num('od-money', 'out');
    let sawProgress = false;
    let have = 0; // what the truck carried when it got to the house
    for (let i = 0; i < 120 * 60 && delivered(g) === 0; i++) {
      g.step(drive(padOf(slot)));
      if (g.num('od-prog', 'value') === 0) have = Math.max(have, onTruck(g, type));
      if (g.num('od-prog', 'value') === 1) sawProgress = true;
    }
    expect(sawProgress).toBe(true);
    expect(delivered(g)).toBe(1);
    expect(onTruck(g, type)).toBe(have - NEED); // exactly the two needed items left the truck
    expect(g.num('od-money', 'out')).toBeGreaterThan(money0);
    for (let i = 0; i < 5; i++) g.step(keys());
    expect(g.num('od-prog', 'value')).toBe(0); // fresh order
    expect(g.num('od-timer', 'left')).toBeGreaterThan(80);
  });
});

describe('city-delivery-3d: crash', () => {
  it('ramming a bot car stalls the truck for 5 seconds and drops one item', { timeout: SLOW }, () => {
    // One bot car stands still as the obstacle; the rest of the traffic is left out so the crash is the only event.
    const g = setup({ seed: 3, parked: ['lp3-car1'] });
    g.begin();
    const drive = autopilot(g);
    for (let i = 0; i < 20 * 60; i++) g.step(keys());
    for (let i = 0; i < 40 * 60 && carried(g) < 3; i++) g.step(drive(BAY['thùng']!));
    expect(carried(g)).toBeGreaterThanOrEqual(2);
    // Line the truck up facing east, then park the car (placed by hand) straight ahead of it and drive into it.
    for (let i = 0; i < 90; i++) g.step(keys('KeyD'));
    const cargo = carried(g);
    const at = g.find('tk-truck').position;
    const placed = g.world.teleport(g.find('lp3-car1').id, { x: at.x + 6, y: 0.4, z: at.z }, false);
    expect(placed).not.toBeNull();
    let crashed = false;
    for (let i = 0; i < 8 * 60 && !crashed; i++) {
      g.step(keys('KeyD'));
      crashed = g.flag('tk-truck', 'crashed');
    }
    expect(crashed).toBe(true);
    // Right after the crash: stalled, one item lost, message shown.
    for (let q = 0; q < 12; q++) g.step(keys('KeyD')); // the drop and the message follow the crash by a few ticks
    expect(g.flag('tk-stall', 'on')).toBe(true);
    expect(carried(g)).toBe(cargo - 1);
    expect(g.world.hudItems().some((h) => !h.hidden && h.text === 'Va chạm! Mất 1 món hàng, chờ 5 giây')).toBe(true);
    // For 5 seconds the truck does not move even though D is held.
    const stuckAt = { ...g.find('tk-truck').position };
    let maxMove = 0;
    let stallTicks = 0;
    for (let i = 0; i < 4.8 * 60; i++) {
      g.step(keys('KeyD'));
      const p = g.find('tk-truck').position;
      maxMove = Math.max(maxMove, Math.hypot(p.x - stuckAt.x, p.z - stuckAt.z));
      if (g.flag('tk-stall', 'on')) stallTicks++;
    }
    expect(maxMove).toBeLessThan(0.6);
    expect(stallTicks).toBeGreaterThan(4.5 * 60);
    // Then the stall ends and the truck drives away again.
    for (let i = 0; i < 2 * 60; i++) g.step(keys('KeyA'));
    expect(g.flag('tk-stall', 'on')).toBe(false);
    const after = g.find('tk-truck').position;
    expect(Math.hypot(after.x - stuckAt.x, after.z - stuckAt.z)).toBeGreaterThan(2);
    expect(g.world.hudItems().some((h) => !h.hidden && h.text?.startsWith('Va chạm'))).toBe(false);
    // The crash drop is not a delivery.
    expect(delivered(g)).toBe(0);
    expect(g.num('od-prog', 'value')).toBe(0);
  });

  it('a crash with an empty truck still stalls it and shows the short message', { timeout: SLOW }, () => {
    const g = setup({ seed: 3, parked: ['lp3-car1'] });
    g.begin();
    g.world.teleport(g.find('lp3-car1').id, { x: 9, y: 0.4, z: 13 }, false);
    let hit = false;
    for (let i = 0; i < 8 * 60 && !hit; i++) {
      g.step(keys('KeyD'));
      hit = g.flag('tk-truck', 'crashed');
    }
    expect(hit).toBe(true);
    for (let q = 0; q < 12; q++) g.step(keys());
    expect(g.flag('tk-stall', 'on')).toBe(true);
    expect(carried(g)).toBe(0);
    expect(g.world.hudItems().some((h) => !h.hidden && h.text === 'Va chạm! Chờ 5 giây')).toBe(true);
    expect(g.world.hudItems().some((h) => !h.hidden && h.text === 'Va chạm! Mất 1 món hàng, chờ 5 giây')).toBe(false);
  });

  it('Space drops one item to make room, and that is not a crash', { timeout: SLOW }, () => {
    const g = setup({ quiet: true, seed: 3 });
    g.begin();
    const drive = autopilot(g);
    for (let i = 0; i < 20 * 60; i++) g.step(keys());
    for (let i = 0; i < 40 * 60 && carried(g) < 2; i++) g.step(drive(BAY['thùng']!));
    // Leave the bay first so the dropped item is not loaded again.
    for (let i = 0; i < 6 * 60; i++) g.step(drive(padOf(2)));
    const before = carried(g);
    expect(before).toBeGreaterThanOrEqual(2);
    g.step(keys('Space'));
    g.step(keys());
    expect(carried(g)).toBe(before - 1);
    expect(g.flag('tk-stall', 'on')).toBe(false);
    expect(g.world.hudItems().some((h) => !h.hidden && h.text?.startsWith('Va chạm'))).toBe(false);
    // A later crash with nothing lost must not claim an item was lost.
    expect(g.flag('tk-lost', 'on')).toBe(false);
  });
});

// ---------------------------------------------------------------- winning and losing

describe('city-delivery-3d: winning and losing', () => {
  it('three late orders lose the game (idle player, 20 second clock to keep the test short)', { timeout: SLOW }, () => {
    const g = setup({ quiet: true, orderSeconds: 20 });
    g.begin();
    for (let i = 0; i < 70 * 60 && !g.world.ended; i++) g.step(keys());
    expect(g.world.ended?.result).toBe('lose');
    expect(g.num('od-hearts', 'value')).toBe(0);
    expect(g.seconds()).toBeGreaterThan(59);
    expect(g.seconds()).toBeLessThan(63);
  });

  it('one late order costs exactly one heart and starts a fresh order', () => {
    const g = setup({ quiet: true, orderSeconds: 20 });
    g.begin();
    for (let i = 0; i < 21 * 60; i++) g.step(keys());
    expect(g.num('od-hearts', 'value')).toBe(2);
    expect(g.num('od-timer', 'left')).toBeGreaterThan(18);
    expect(activeSlot(g)).toBeGreaterThan(0);
    expect(g.world.ended).toBeNull();
  });

  it('a careful autopilot delivers six orders and wins (quiet streets, real driving)', { timeout: 600_000 }, () => {
    const g = setup({ quiet: true, seed: 11 });
    g.begin();
    const drive = autopilot(g);
    for (let n = 0; n < 12 && !g.world.ended && delivered(g) < 6; n++) serveOrder(g, drive, 200);
    expect(g.world.ended?.result).toBe('win');
    expect(delivered(g)).toBe(6);
    expect(g.num('od-hearts', 'value')).toBe(3);
    // Even a perfect run is a real drive across the city.
    expect(g.seconds()).toBeGreaterThan(90);
    expect(g.seconds()).toBeLessThan(240);
  });

  it('FAST (hand-placed truck): six deliveries win, with a different order mix', { timeout: SLOW }, () => {
    // Labelled shortcut: the truck is moved onto the bay / house pads with teleport; everything else (loading, typed
    // unloading, counting, win) runs through the normal rules.
    const g = setup({ quiet: true, seed: 21 });
    g.begin();
    for (let i = 0; i < 100 * 60; i++) g.step(keys()); // bots stock the bays
    const truckId = g.find('tk-truck').id;
    const goTo = (p: Pt): void => {
      g.world.teleport(truckId, { x: p.x, y: 0.7, z: p.z }, false);
      for (let i = 0; i < 90; i++) g.step(keys());
    };
    for (let n = 0; n < 6 && !g.world.ended; n++) {
      const slot = activeSlot(g);
      const type = SLOTS[slot - 1]!.type;
      while (tapDumpIfClogged(g, type)) { /* press Space until there is room */ }
      goTo(BAY[type]!);
      expect(onTruck(g, type)).toBeGreaterThanOrEqual(NEED);
      goTo(padOf(slot));
      expect(delivered(g)).toBe(n + 1);
    }
    expect(g.world.ended?.result).toBe('win');
    expect(g.world.ended?.message).toContain('6 đơn');
  });
});

describe('city-delivery-3d: robustness', () => {
  it('runs 3 minutes of erratic driving in full traffic without throwing', { timeout: 600_000 }, () => {
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
