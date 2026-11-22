import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { PALETTE_COLORS } from '../../src/nodes/color-palette';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { poseOf } from '../helpers/nav-rig';
import { bot, deckRig, f, holeDeck, join, marker, seconds } from './deck-rig';

/**
 * SPIKE ONLY. Questions 4 and 5: one robot on the deck (2.6 m) and one on the ground floor directly under it, driving the same
 * line in opposite directions at the same time. Do they disturb each other, and do the sensors tell the levels apart?
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOP = 2.6;

interface Opts {
  a: boolean;
  b: boolean;
  /** Height of the floor robot A drives on (TOP = the deck, 0 = the ground: the control). */
  aFloor: number;
}

function board(o: Opts): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const deck = holeDeck(TOP, 6, [-2, 0, 2], [-2, 0, 2], 0.7);
  for (const n of deck) n[2]!.color = PALETTE_COLORS[2]!;
  const parts: { nodes: NodeSpec[]; wires: WireSpec[] }[] = [
    {
      nodes: [
        ...deck,
        marker(1, 3, 1, o.aFloor, 0.6),
        marker(2, -3, 1, 0, 0.6),
        // A marker on the deck and one on the ground, both on the shared line.
        marker(7, 0.8, 1, TOP, 0.6),
        marker(8, -0.8, 1, 0, 0.6),
        // A painted patch on the ground (not solid), "Màu 1".
        ['patch', 'block', { position: { x: 0, y: 0.005, z: 1 }, size: { x: 12, y: 0.01, z: 1.3 }, type: 'pickup', color: PALETTE_COLORS[0]! }],
        ['z-ground', 'zone', { center: { x: 0, y: 0.5, z: 1 }, size: { x: 2, y: 1, z: 1.3 }, filter: 'robot' }],
        ['z-deck', 'zone', { center: { x: 0, y: TOP + 0.5, z: 1 }, size: { x: 2, y: 1, z: 1.3 }, filter: 'robot' }],
        ['z-tall', 'zone', { center: { x: 0, y: 1.5, z: 1 }, size: { x: 2, y: 6, z: 1.3 }, filter: 'robot' }],
        ['z-default', 'zone', { center: { x: 0, y: 1, z: 1 }, size: { x: 2, y: 3, z: 1.3 }, filter: 'robot' }],
        ['zi-ground', 'zone', { center: { x: 0, y: 0.6, z: 1 }, size: { x: 2, y: 1.2, z: 1.3 }, filter: 'item' }],
        ['zi-deck', 'zone', { center: { x: 0, y: TOP + 0.6, z: 1 }, size: { x: 2, y: 1.2, z: 1.3 }, filter: 'item' }],
      ],
      wires: [],
    },
  ];
  const sensors = (id: string): { nodes: NodeSpec[]; wires: WireSpec[] } => ({
    nodes: [
      [`${id}-mark`, 'floor-marker-sensor', {}],
      [`${id}-color`, 'color-sensor', { where: 'feet' }],
      [`${id}-eye`, 'ahead-sensor', { reach: 3 }],
    ],
    wires: [
      [id, 'self', `${id}-mark`, 'who'],
      [id, 'self', `${id}-color`, 'who'],
      [id, 'self', `${id}-eye`, 'who'],
    ],
  });
  if (o.a) parts.push(bot({ id: 'a', x: -3, z: 1, floor: o.aFloor, heading: 0, goal: 1, tilt: 0 }), sensors('a'));
  if (o.b) parts.push(bot({ id: 'b', x: 3, z: 1, floor: 0, heading: 180, goal: 2, tilt: 0 }), sensors('b'));
  if (o.a && o.b) parts.push({ nodes: [['gap', 'distance', {}]], wires: [['a', 'self', 'gap', 'a'], ['b', 'self', 'gap', 'b']] });
  return join(...parts);
}

interface Seen {
  path: { x: number; z: number; h: number; y: number }[];
  arrived: number;
  markers: Set<number>;
  colors: Set<number>;
  blocked: number;
  eyeMin: number;
  pushing: number;
  payload: Set<string>;
}

interface Result {
  a?: Seen;
  b?: Seen;
  zones: Record<string, number>;
  gapMin: number;
  /** Smallest distance between the two chassis middles on the ground plane. */
  flatMin: number;
  touched: number;
}

function run(o: Opts): Result {
  const { nodes, wires } = board(o);
  const r = deckRig(nodes, wires, rapier);
  const fresh = (): Seen => ({ path: [], arrived: -1, markers: new Set(), colors: new Set(), blocked: 0, eyeMin: Infinity, pushing: 0, payload: new Set() });
  const res: Result = { ...(o.a ? { a: fresh() } : {}), ...(o.b ? { b: fresh() } : {}), zones: {}, gapMin: Infinity, flatMin: Infinity, touched: 0 };
  for (let k = 0; k < seconds(14); k++) {
    r.tick();
    for (const id of ['a', 'b'] as const) {
      const s = res[id];
      if (!s) continue;
      const e = r.entity(id)!;
      const p = poseOf(e);
      s.path.push({ x: p.x, z: p.z, h: p.heading, y: e.position.y });
      if (s.arrived < 0 && r.out(`${id}-go`, 'arrived') === true) s.arrived = (k + 1) / 60;
      s.markers.add(r.out(`${id}-mark`, 'number') as number);
      s.colors.add(r.out(`${id}-color`, 'index') as number);
      if (r.out(`${id}-eye`, 'blocked') === true) s.blocked++;
      s.eyeMin = Math.min(s.eyeMin, r.out(`${id}-eye`, 'distance') as number);
      if (r.out(id, 'pushing') === true) s.pushing++;
      if (k > 30) s.payload.add((r.out(id, 'payload') as number).toFixed(2));
    }
    for (const z of ['z-ground', 'z-deck', 'z-tall', 'z-default', 'zi-ground', 'zi-deck']) res.zones[z] = Math.max(res.zones[z] ?? 0, r.out(z, 'count') as number);
    if (o.a && o.b) {
      res.gapMin = Math.min(res.gapMin, r.out('gap', 'distance') as number);
      const ea = r.entity('a')!;
      const eb = r.entity('b')!;
      res.flatMin = Math.min(res.flatMin, Math.hypot(ea.position.x - eb.position.x, ea.position.z - eb.position.z));
      const mine = (id: string): string[] => r.world.entities().filter((e) => e.ownerNodeId === id || e.ownerNodeId.startsWith(`${id}-`)).map((e) => e.id);
      if (mine('a').some((x) => mine('b').some((y) => r.world.isTouching(x, y)))) res.touched++;
    }
  }
  r.world.dispose?.();
  return res;
}

function pathDiff(p: Seen, q: Seen): number {
  let d = 0;
  for (let k = 0; k < p.path.length; k++) d = Math.max(d, Math.abs(p.path[k]!.x - q.path[k]!.x), Math.abs(p.path[k]!.z - q.path[k]!.z), Math.abs(p.path[k]!.y - q.path[k]!.y), Math.abs(p.path[k]!.h - q.path[k]!.h) / 57.3);
  return d;
}

const list = (s: Set<number> | Set<string>): string => [...s].sort().join(',');

describe('SPIKE q4/q5: a robot on the deck and one on the ground under it, same line, opposite directions', () => {
  it('prints what each robot does and reads, alone and together, and the control with both on the ground', () => {
    const both = run({ a: true, b: true, aFloor: TOP });
    const aAlone = run({ a: true, b: false, aFloor: TOP });
    const bAlone = run({ a: false, b: true, aFloor: TOP });
    const control = run({ a: true, b: true, aFloor: 0 });
    const row = (name: string, s: Seen): string =>
      `| ${name} | ${f(s.arrived, 2)} | ${s.pushing} | ${s.blocked} | ${f(s.eyeMin, 2)} | ${list(s.markers)} | ${list(s.colors)} | ${list(s.payload)} |`;
    console.log(
      [
        '| run / robot | arrived s | ticks "Đang đẩy vật" | ticks ahead-sensor blocked | ahead distance min | marker numbers read | colour indexes read | payload kg read |',
        '|---|---|---|---|---|---|---|---|',
        row('two levels / A (deck)', both.a!),
        row('two levels / B (ground)', both.b!),
        row('A alone (deck)', aAlone.a!),
        row('B alone (ground)', bAlone.b!),
        row('control same floor / A', control.a!),
        row('control same floor / B', control.b!),
      ].join('\n'),
    );
    console.log(
      `path of A with B under it vs A alone: max difference ${pathDiff(both.a!, aAlone.a!).toExponential(2)}\n` +
        `path of B with A above it vs B alone: max difference ${pathDiff(both.b!, bAlone.b!).toExponential(2)}\n` +
        `control (same floor) path of A vs A alone on the deck (x, z, heading only matter): ${pathDiff(control.a!, aAlone.a!).toExponential(2)}\n` +
        `two levels: smallest ground-plane distance between the chassis middles ${f(both.flatMin)} m; "Đo khoảng cách" smallest ${f(both.gapMin)} m; ticks any piece of A touched any piece of B: ${both.touched}\n` +
        `control: smallest ground-plane distance ${f(control.flatMin)} m; "Đo khoảng cách" smallest ${f(control.gapMin)} m; touching ticks ${control.touched}\n` +
        `zones, most robots / items counted at once (two levels): ${JSON.stringify(both.zones)}\n` +
        `zones (A alone): ${JSON.stringify(aAlone.zones)}\nzones (B alone): ${JSON.stringify(bAlone.zones)}`,
    );
    expect(both.a!.arrived).toBeGreaterThan(0);
    expect(both.b!.arrived).toBeGreaterThan(0);
  });

  it('a loose heavy crate on the deck with a parked robot on the ground right under it: does the deck robot meet the crate the same way?', () => {
    const go = (under: boolean, kg: number): string => {
      const a = bot({ id: 'a', x: -3, z: 1, floor: TOP, heading: 0, goal: 1, bare: true });
      const b = bot({ id: 'b', x: 0, z: 1, floor: 0, heading: 0, bare: true });
      const nodes: NodeSpec[] = [
        ...holeDeck(TOP, 6, [-2, 0, 2], [-2, 0, 2], 0.7),
        marker(1, 3, 1, TOP, 0.6),
        ['box', 'item', { shape: 'crate', position: { x: 0, y: TOP + 0.2, z: 1 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: kg }],
        ...a.nodes,
        ...(under ? b.nodes : []),
      ];
      const r = deckRig(nodes, [...a.wires, ...(under ? b.wires : [])], rapier);
      let pushing = 0;
      let force = 0;
      let bPayload = 0;
      for (let k = 0; k < seconds(12); k++) {
        r.tick();
        if (r.out('a', 'pushing') === true) pushing++;
        force = Math.max(force, r.out('a', 'pushForce') as number);
        if (under) bPayload = Math.max(bPayload, r.out('b', 'payload') as number);
      }
      const ax = r.entity('a')!.position.x;
      const box = r.entity('box')!.position;
      r.world.dispose?.();
      return `| ${kg} | ${under ? 'yes' : 'no'} | ${f(ax, 2)} | ${f(box.x, 2)} | ${f(box.y, 2)} | ${pushing} | ${f(force, 1)} | ${under ? f(bPayload, 2) : '-'} |`;
    };
    const rows = ['| crate kg | robot parked under the crate on the ground | A ends at x | crate ends at x | crate y | ticks A says pushing | A push force max N | payload the ground robot reads |', '|---|---|---|---|---|---|---|---|'];
    for (const kg of [2, 60]) for (const under of [false, true]) rows.push(go(under, kg));
    console.log(rows.join('\n'));
  });
});
