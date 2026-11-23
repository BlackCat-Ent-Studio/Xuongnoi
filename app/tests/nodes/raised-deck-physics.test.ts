import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type EntityView, type ParamValue } from '../../src/engine/types';
import { RAISED_DECK_LOOK, isDeckLeg } from '../../src/nodes/raised-deck';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { FLOOR, poseOf } from '../helpers/nav-rig';

/**
 * The deck card in a played world with "Vật lý thật" on and the crate engine loaded: a robot drives on it, a carton
 * tipped into a hole lands on the level below, and the two levels leave each other alone. Everything is measured from
 * the entity views.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** Height of the deck's upper face above the ground (the ground block's top is y = 0). */
const TOP = 2.6;
const CHASSIS = { length: 0.9, width: 0.7, height: 0.24 };
const TRAY = { length: 0.62, thickness: 0.05, width: 0.74 };
const CARTON = { x: 0.3, y: 0.22, z: 0.26 };
/** Tray above the chassis top, and the hinge line out from the chassis middle (m). */
const TRAY_GAP = 0.05;
const HINGE = 0.31;

type Parts = { nodes: NodeSpec[]; wires: WireSpec[] };
const join = (...parts: Parts[]): Parts => ({ nodes: parts.flatMap((p) => p.nodes), wires: parts.flatMap((p) => p.wires) });
const seconds = (s: number): number => Math.round(s / TICK_DT);

function deck(params: Record<string, ParamValue>): NodeSpec {
  return ['deck', 'raised-deck', { position: { x: 0, y: 0, z: 0 }, top: TOP, ...params }];
}

interface Bot {
  id: string;
  x: number;
  z: number;
  /** Height of the surface it starts on. */
  floor: number;
  heading?: number;
  /** Point "Đi tới điểm" drives to; absent = it stays where it is. */
  goal?: { x: number; z: number };
  drive?: Record<string, ParamValue>;
  /** A side tray with a carton on it that tips when the run starts: which side (1 = the robot's right), the carton's mass, and the parcel code printed on it (none = a plain crate). */
  tray?: { side: 1 | -1; kg: number; code?: number };
}

/** A two-motor chassis driven by "Đi tới điểm", optionally with the side-dump tray of the sorting robots. */
function bot(b: Bot): Parts {
  const id = b.id;
  const heading = b.heading ?? 0;
  const rad = (heading * Math.PI) / 180;
  const y0 = b.floor + CHASSIS.height / 2;
  const nodes: NodeSpec[] = [
    [id, 'robot-body', { position: { x: b.x, y: y0, z: b.z }, heading, ...CHASSIS, mass: 5, friction: 0.8 }],
    [`${id}-ml`, 'motor', { side: -(CHASSIS.width / 2 - 0.05), accel: 400 }],
    [`${id}-mr`, 'motor', { side: CHASSIS.width / 2 - 0.05, accel: 400 }],
    [`${id}-go`, 'robot-goto', { targetFrom: 'point', targetPos: { x: b.goal?.x ?? b.x, y: 0, z: b.goal?.z ?? b.z }, ...(b.drive ?? {}) }],
    [`${id}-on`, 'on-start', {}],
  ];
  const wires: WireSpec[] = [
    [id, 'self', `${id}-ml`, 'body'],
    [id, 'self', `${id}-mr`, 'body'],
    [id, 'self', `${id}-go`, 'robot'],
    [`${id}-go`, 'left', `${id}-ml`, 'power'],
    [`${id}-go`, 'right', `${id}-mr`, 'power'],
    ...(b.goal ? ([[`${id}-on`, 'started', `${id}-go`, 'go']] as WireSpec[]) : []),
  ];
  if (b.tray) {
    const side = b.tray.side;
    const up = CHASSIS.height / 2 + TRAY_GAP + TRAY.thickness / 2;
    const across = side * (HINGE - TRAY.length / 2);
    nodes.push(
      [`${id}-turn`, 'joint', { axis: 'yaw', start: side * 90, min: -180, max: 180, mount: { x: 0, y: up, z: side * HINGE }, solid: 'no' }],
      [`${id}-tilt`, 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: 60, solid: 'no' }],
      [`${id}-tray`, 'link', { length: TRAY.length, thickness: TRAY.thickness, width: TRAY.width, solid: 'yes', mass: 1 }],
      [`${id}-angle`, 'bool-to-number', { whenOn: 35, whenOff: 0 }],
      [`${id}-crate`, 'item', { shape: 'crate', position: { x: b.x - Math.sin(rad) * across, y: y0 + up + TRAY.thickness / 2 + CARTON.y / 2 + 0.005, z: b.z + Math.cos(rad) * across }, size: CARTON, mass: b.tray.kg, ...(b.tray.code !== undefined ? { look: 'parcel-carton', tag: String(b.tray.code) } : {}) }],
    );
    wires.push(
      [id, 'self', `${id}-turn`, 'base'],
      [`${id}-on`, 'started', `${id}-turn`, 'power'],
      [`${id}-turn`, 'tip', `${id}-tilt`, 'base'],
      [`${id}-on`, 'started', `${id}-tilt`, 'power'],
      [`${id}-tilt`, 'tip', `${id}-tray`, 'base'],
      [`${id}-on`, 'started', `${id}-angle`, 'on'],
      [`${id}-angle`, 'value', `${id}-tilt`, 'angle'],
    );
  }
  return { nodes, wires };
}

function play(...parts: Parts[]) {
  const all = join(...parts);
  return rig([FLOOR, ...all.nodes], all.wires, '3d', false, true, rapier);
}

/** Lowest point of a (possibly turned) crate. */
function crateBottom(v: EntityView): number {
  const q = v.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  // Second row of the rotation matrix: how much each local axis points up.
  const ux = 2 * (q.x * q.y + q.w * q.z);
  const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
  const uz = 2 * (q.y * q.z - q.w * q.x);
  return v.position.y - (Math.abs(ux) * v.size.x + Math.abs(uy) * v.size.y + Math.abs(uz) * v.size.z) / 2;
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Path {
  points: { x: number; y: number; z: number; heading: number }[];
  arrivedAt: number;
}

/** Plays the board and records where chassis `id` is after every tick. */
function drive(r: ReturnType<typeof play>, id: string, ticks: number): Path {
  const out: Path = { points: [], arrivedAt: -1 };
  for (let k = 0; k < ticks; k++) {
    r.tick();
    const e = r.entity(id)!;
    out.points.push({ x: e.position.x, y: e.position.y, z: e.position.z, heading: e.robot?.heading ?? 0 });
    if (out.arrivedAt < 0 && r.out(`${id}-go`, 'arrived') === true) out.arrivedAt = (k + 1) * TICK_DT;
  }
  return out;
}

const worstGap = (a: Path, b: Path, dy = 0): number =>
  a.points.reduce((worst, p, i) => {
    const o = b.points[i]!;
    return Math.max(worst, Math.abs(p.x - o.x), Math.abs(p.y - dy - o.y), Math.abs(p.z - o.z), Math.abs(p.heading - o.heading));
  }, 0);

describe('raised deck: a robot on it', () => {
  // A lane of a 3 x 3 deck: z = 1 runs between the middle and the last row of holes (holes at -2, 0, 2).
  const GOAL = { x: 3, z: 1 };
  const rider = (floor: number): Parts => bot({ id: 'a', x: -3, z: 1, floor, heading: 0, goal: GOAL, drive: { tolerance: 0.02 } });

  it('drives along a lane between the holes to a point and stops within 1 cm of it, never sinking', () => {
    const r = play({ nodes: [deck({ holeCols: 3, holeRows: 3 })], wires: [] }, rider(TOP));
    expect(r.world.entities().filter((e) => e.look === RAISED_DECK_LOOK)).toHaveLength(16);
    const path = drive(r, 'a', seconds(14));
    const end = poseOf(r.entity('a')!);
    expect(path.arrivedAt).toBeGreaterThan(0);
    expect(Math.hypot(end.x - GOAL.x, end.z - GOAL.z)).toBeLessThanOrEqual(0.01);
    for (const p of path.points) expect(Math.abs(p.y - (TOP + CHASSIS.height / 2))).toBeLessThan(1e-6);
    r.world.dispose?.();
  });

  it('drives on the deck exactly as it drives on the ground', () => {
    const up = play({ nodes: [deck({ holeCols: 3, holeRows: 3 })], wires: [] }, rider(TOP));
    const onDeck = drive(up, 'a', seconds(14));
    up.world.dispose?.();
    const down = play(rider(0));
    const onGround = drive(down, 'a', seconds(14));
    down.world.dispose?.();
    expect(onDeck.arrivedAt).toBe(onGround.arrivedAt);
    expect(worstGap(onDeck, onGround, TOP)).toBeLessThan(1e-9);
  });
});

describe('raised deck: a carton tipped into a hole', () => {
  interface Drop {
    hole: number;
    /** Metres from the robot's centre line to the hole centre. */
    d: number;
    kg: number;
    side: 1 | -1;
    heading: number;
  }

  /** The robot stands beside the one hole of the deck (at the origin) and tips its tray at once. Where is the carton 7 s later? */
  function drop(c: Drop): { where: 'ground' | 'deck' | 'edge' | 'robot' | 'lost'; y: number } {
    const rad = (c.heading * Math.PI) / 180;
    // The robot's right is (-sin, cos) of its heading on (x, z).
    const rx = -Math.sin(rad) * c.side;
    const rz = Math.cos(rad) * c.side;
    const r = play({ nodes: [deck({ hole: c.hole, margin: 4 })], wires: [] }, bot({ id: 'r', x: -rx * c.d, z: -rz * c.d, floor: TOP, heading: c.heading, tray: { side: c.side, kg: c.kg } }));
    r.tick(seconds(7));
    const crate = r.entity('r-crate')!;
    const low = crateBottom(crate);
    r.world.dispose?.();
    const where = Math.abs(low) < 0.02 ? 'ground' : low < -0.02 ? 'lost' : Math.abs(low - TOP) < 0.03 ? 'deck' : low > TOP + 0.03 ? 'robot' : 'edge';
    return { where, y: crate.position.y };
  }

  it('24 seeded drops (hole 0.6-0.8 m, 1-5 kg, both sides, four headings): every carton ends on the ground below, none on an edge', { timeout: 120_000 }, () => {
    const rnd = seeded(20261123);
    const cases: Drop[] = Array.from({ length: 24 }, (_, i) => ({
      hole: Math.round((0.6 + rnd() * 0.2) * 100) / 100,
      d: Math.round((0.55 + rnd() * 0.45) * 100) / 100,
      kg: Math.round((1 + rnd() * 4) * 10) / 10,
      side: i % 2 === 0 ? 1 : -1,
      heading: [0, 90, 180, 270][Math.floor(rnd() * 4)]!,
    }));
    const results = cases.map((c) => ({ ...c, ...drop(c) }));
    const failed = results.filter((x) => x.where !== 'ground');
    expect(failed, JSON.stringify(failed)).toEqual([]);
    // All four headings and both sides really took part.
    expect(new Set(cases.map((c) => c.heading)).size).toBe(4);
  });

  it('the same carton tipped onto a deck without a hole there stays up (the check can see a carton that did not fall)', () => {
    // The robot stands more than 4 m from the hole: its tray tips onto solid floor.
    const r = play({ nodes: [deck({ hole: 0.7, margin: 6 })], wires: [] }, bot({ id: 'r', x: 3, z: 3, floor: TOP, tray: { side: 1, kg: 2 } }));
    r.tick(seconds(7));
    expect(crateBottom(r.entity('r-crate')!)).toBeGreaterThan(TOP - 0.03);
    r.world.dispose?.();
  });
});

describe('raised deck: solid legs', () => {
  // A 3 x 3 deck is 7.3 m a side: legs stand 3.53 m from its middle, four to an edge, at -3.53, -1.177, 1.177 and 3.53.
  const LEG_AT = 3.65 - 0.12;
  const INNER_LEG = LEG_AT / 3;
  const under = (legs: string): Parts => ({ nodes: [deck({ holeCols: 3, holeRows: 3, legs })], wires: [] });
  const crosser = (z: number): Parts => bot({ id: 'b', x: -6, z, floor: 0, heading: 0, goal: { x: 6, z } });

  it('the deck of this test has a leg where the robot is sent', () => {
    const r = play(under('solid'));
    const posts = r.world.entities().filter(isDeckLeg);
    expect(posts).toHaveLength(12);
    expect(posts.some((p) => Math.abs(p.position.x + LEG_AT) < 1e-9 && Math.abs(p.position.z + INNER_LEG) < 1e-9)).toBe(true);
    // Nothing stands between z = -1.177 and z = 1.177 on the edge the robot of the next test enters by.
    expect(posts.filter((p) => Math.abs(p.position.z) < INNER_LEG - 1e-6 && Math.abs(Math.abs(p.position.x) - LEG_AT) < 1e-9)).toEqual([]);
    r.world.dispose?.();
  });

  it('a robot on the ground driving straight at a solid leg is stopped by it; with drawn legs it drives through', { timeout: 60_000 }, () => {
    const solid = play(under('solid'), crosser(-INNER_LEG));
    const blocked = drive(solid, 'b', seconds(20));
    solid.world.dispose?.();
    // Its nose never gets past the near face of the post.
    const nose = Math.max(...blocked.points.map((p) => p.x)) + CHASSIS.length / 2;
    expect(nose).toBeLessThan(-LEG_AT - 0.05 + 0.02);
    expect(nose).toBeGreaterThan(-LEG_AT - 0.05 - 0.05);
    expect(blocked.arrivedAt).toBe(-1);

    const drawn = play(under('yes'), crosser(-INNER_LEG));
    const free = drive(drawn, 'b', seconds(20));
    drawn.world.dispose?.();
    expect(free.arrivedAt).toBeGreaterThan(0);
  });

  it('between two legs the lane under the deck is open: the robot crosses under the whole deck tick for tick as without legs', { timeout: 60_000 }, () => {
    const runs = ['solid', 'yes', 'no'].map((legs) => {
      const r = play(under(legs), crosser(0));
      const path = drive(r, 'b', seconds(20));
      r.world.dispose?.();
      return path;
    });
    const [solid, drawn, none] = runs as [Path, Path, Path];
    expect(solid.arrivedAt).toBeGreaterThan(0);
    expect(Math.abs(solid.points.at(-1)!.x - 6)).toBeLessThan(0.1);
    expect(worstGap(solid, none)).toBe(0);
    expect(worstGap(solid, drawn)).toBe(0);
    expect(solid.arrivedAt).toBe(none.arrivedAt);
  });

  it('under the plain rules too ("Vật lý thật" off) a solid leg stops the robot and the lane between legs stays open', { timeout: 60_000 }, () => {
    const plain = (legs: string, z: number): Path => {
      const all = join(under(legs), crosser(z));
      const r = rig([FLOOR, ...all.nodes], all.wires, '3d');
      const path = drive(r, 'b', seconds(20));
      return path;
    };
    const blocked = plain('solid', -INNER_LEG);
    expect(Math.max(...blocked.points.map((p) => p.x)) + CHASSIS.length / 2).toBeLessThan(-LEG_AT - 0.05 + 0.02);
    expect(plain('yes', -INNER_LEG).arrivedAt).toBeGreaterThan(0);
    const open = plain('solid', 0);
    expect(open.arrivedAt).toBeGreaterThan(0);
    expect(worstGap(open, plain('no', 0))).toBe(0);
  });
});

describe('raised deck: the level below', () => {
  // The ground robot drives under the deck along the line the deck robot drives above it, the other way.
  const below = (): Parts => bot({ id: 'b', x: 3, z: 1, floor: 0, heading: 180, goal: { x: -3, z: 1 } });
  const above = (): Parts => bot({ id: 'a', x: -3, z: 1, floor: TOP, heading: 0, goal: { x: 3, z: 1 } });
  const theDeck: Parts = { nodes: [deck({ holeCols: 3, holeRows: 3 })], wires: [] };

  it('a robot on the ground under the deck drives the same path with and without a robot above it, and with no deck at all', () => {
    const both = play(theDeck, above(), below());
    const withAbove = drive(both, 'b', seconds(12));
    both.world.dispose?.();
    const alone = play(theDeck, below());
    const withoutAbove = drive(alone, 'b', seconds(12));
    alone.world.dispose?.();
    const open = play(below());
    const noDeck = drive(open, 'b', seconds(12));
    open.world.dispose?.();
    expect(withAbove.arrivedAt).toBeGreaterThan(0);
    expect(worstGap(withAbove, withoutAbove)).toBe(0);
    expect(worstGap(withAbove, noDeck)).toBe(0);
    expect(withAbove.arrivedAt).toBe(withoutAbove.arrivedAt);
  });

  it('the robot above is not disturbed by the one below either, and the two pass over each other', () => {
    const both = play(theDeck, above(), below());
    const paths = { a: [] as { x: number; z: number }[], b: [] as { x: number; z: number }[] };
    const upper: Path = { points: [], arrivedAt: -1 };
    for (let k = 0; k < seconds(12); k++) {
      both.tick();
      const a = both.entity('a')!;
      const b = both.entity('b')!;
      upper.points.push({ x: a.position.x, y: a.position.y, z: a.position.z, heading: a.robot?.heading ?? 0 });
      paths.a.push({ x: a.position.x, z: a.position.z });
      paths.b.push({ x: b.position.x, z: b.position.z });
    }
    both.world.dispose?.();
    const alone = play(theDeck, above());
    const single = drive(alone, 'a', seconds(12));
    alone.world.dispose?.();
    expect(worstGap(upper, single)).toBe(0);
    const closest = Math.min(...paths.a.map((p, i) => Math.hypot(p.x - paths.b[i]!.x, p.z - paths.b[i]!.z)));
    expect(closest).toBeLessThan(0.1);
  });
});

describe('raised deck: a robot that drives onto a hole', () => {
  // One 0.7 m hole in the middle of the deck; the robot drives along +x on the line z = `offset` from x = -3 towards x = 3.
  const across = (offset: number, floor: number): Parts => bot({ id: 'a', x: -3, z: offset, floor, heading: 0, goal: { x: 3, z: offset }, drive: { tolerance: 0.02 } });
  const oneHole: Parts = { nodes: [deck({ hole: 0.7, margin: 4 })], wires: [] };

  it('0.9 x 0.7 m chassis straight onto the 0.7 m hole: its wheels lose the floor and it ends stuck astride the hole, still level with the deck', { timeout: 60_000 }, () => {
    const r = play(oneHole, across(0, TOP));
    const path = drive(r, 'a', seconds(14));
    r.world.dispose?.();
    const last = path.points[path.points.length - 1]!;
    const before = path.points[path.points.length - 1 - seconds(2)]!;
    expect(path.arrivedAt).toBe(-1);
    // Its middle is over the hole (the hole reaches 0.35 m each way), it has not dropped, and it is at rest.
    expect(Math.abs(last.x)).toBeLessThan(0.35);
    expect(last.y).toBeCloseTo(TOP + CHASSIS.height / 2, 6);
    expect(Math.abs(last.x - before.x)).toBeLessThan(1e-6);
    expect(Math.abs(last.z - before.z)).toBeLessThan(1e-6);
    // The same drive on the ground, where there is no hole, arrives: it is the hole that stopped it.
    const ground = play(across(0, 0));
    expect(drive(ground, 'a', seconds(14)).arrivedAt).toBeGreaterThan(0);
    ground.world.dispose?.();
  });

  it('in the lane beside the hole (0.75 m from its middle, every wheel on the deck) it drives tick for tick as on the ground', { timeout: 60_000 }, () => {
    const up = play(oneHole, across(0.75, TOP));
    const onDeck = drive(up, 'a', seconds(14));
    up.world.dispose?.();
    const down = play(across(0.75, 0));
    const onGround = drive(down, 'a', seconds(14));
    down.world.dispose?.();
    expect(onDeck.arrivedAt).toBeGreaterThan(0);
    expect(onDeck.arrivedAt).toBe(onGround.arrivedAt);
    expect(worstGap(onDeck, onGround, TOP)).toBeLessThan(1e-9);
  });
});

describe('raised deck: floor markers on two levels', () => {
  it('a robot on the deck reads the tile on the deck, a robot under it reads the tile on the ground', () => {
    // Lane z = 1 of a 3 x 3 deck. Each level has two tiles on that lane; one tile of each level is shifted, so that the
    // nearest middle alone would give the low robot the deck tile and the high robot the ground tile.
    const tiles: NodeSpec[] = [
      ['g1', 'floor-marker', { number: 1, position: { x: -1, y: 0, z: 1 }, size: 2 }],
      ['g2', 'floor-marker', { number: 2, position: { x: 1.2, y: 0, z: 1 }, size: 2 }],
      ['d1', 'floor-marker', { number: 101, position: { x: -1.2, y: TOP, z: 1 }, size: 2 }],
      ['d2', 'floor-marker', { number: 102, position: { x: 1, y: TOP, z: 1 }, size: 2 }],
      ['readLow', 'floor-marker-sensor', {}],
      ['readHigh', 'floor-marker-sensor', {}],
    ];
    const r = play(
      { nodes: [deck({ holeCols: 3, holeRows: 3 }), ...tiles], wires: [['low', 'self', 'readLow', 'who'], ['high', 'self', 'readHigh', 'who']] },
      bot({ id: 'low', x: -1.15, z: 1, floor: 0 }),
      bot({ id: 'high', x: 1.15, z: 1, floor: TOP }),
    );
    r.tick(30);
    expect(r.entity('high')!.position.y).toBeCloseTo(TOP + CHASSIS.height / 2, 6);
    expect(r.entity('low')!.position.y).toBeCloseTo(CHASSIS.height / 2, 6);
    expect(r.out('readLow', 'number')).toBe(1);
    expect(r.out('readHigh', 'number')).toBe(102);
    expect(r.out('readLow', 'marker')).toBe(r.entity('g1')!.id);
    expect(r.out('readHigh', 'marker')).toBe(r.entity('d2')!.id);
    r.world.dispose?.();
  });
});

describe('raised deck: a carton with a parcel code tipped into a hole', () => {
  it('lands on the ground below with its code, and "Đọc mã" wired to a zone on the ground under the deck reads it', { timeout: 60_000 }, () => {
    // The robot stands 0.7 m beside the hole and tips its tray towards it. The carton slides off with some speed and falls 2.6 m, so it
    // comes to rest on the ground up to 1.5 m past the hole: the zone that feeds the reader covers 4 x 4 m of ground under the deck.
    const below: Parts = {
      nodes: [
        ['under', 'zone', { center: { x: 0, y: 0.2, z: 0 }, size: { x: 4, y: 0.4, z: 4 }, filter: 'item', rule: 'center' }],
        ['reader', 'code-reader', {}],
      ],
      wires: [['under', 'first', 'reader', 'thing']],
    };
    const r = play({ nodes: [deck({ hole: 0.7, margin: 4 })], wires: [] }, below, bot({ id: 'r', x: 0, z: -0.7, floor: TOP, heading: 0, tray: { side: 1, kg: 2, code: 37 } }));
    expect(r.entity('r-crate')!.look).toBe('parcel-carton#37');
    // While it is still up on the tray the reader below has nothing to read.
    r.tick(5);
    expect(r.out('reader', 'has')).toBe(false);
    r.tick(seconds(7));
    const landed = r.entity('r-crate')!;
    expect(Math.abs(crateBottom(landed))).toBeLessThan(0.02);
    expect(landed.look).toBe('parcel-carton#37');
    expect(r.world.tagOf(landed.id)).toBe('37');
    expect(r.out('under', 'first')).toBe(landed.id);
    expect(r.out('reader', 'code')).toBe(37);
    expect(r.out('reader', 'has')).toBe(true);
    r.world.dispose?.();
  });
});
