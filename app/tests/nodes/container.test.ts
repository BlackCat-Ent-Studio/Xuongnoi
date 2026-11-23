import { beforeAll, describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT, type EntityView, type ParamValue, type ViewMode } from '../../src/engine/types';
import { CLASSIC_LOOK } from '../../src/engine/factory-looks';
import {
  CONTAINER_BOARD_LABEL,
  CONTAINER_LOOK,
  CONTAINER_THICK,
  CONTAINER_WALL_LABEL,
  ROLL_CAGE_LOOK,
  containerBlocks,
  containerLabel,
  containerOfLabel,
  containerShape,
  insideContainer,
} from '../../src/nodes/container';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig } from '../helpers/arm-rig';
import { CARTON, GROUND, cageRig, type Drop } from './container-rig';

/**
 * The "Lồng chứa" card: what it builds, what it counts and what its outputs say, with "Vật lý thật" on (cartons are rigid
 * bodies that pile up) and off (the plain item rules).
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;
const built = (params: Record<string, ParamValue> = {}, mode: ViewMode = '3d') => rig([['cage', 'container', { position: { x: 2, y: 0, z: -1 }, ...params }]], [], mode).world;
const blocksOf = (params: Record<string, ParamValue> = {}, mode: ViewMode = '3d'): EntityView[] => built(params, mode).entities().filter((e) => e.ownerNodeId === 'cage');
/** Whether each body the card made stops other bodies. */
const solidOf = (params: Record<string, ParamValue> = {}, mode: ViewMode = '3d'): boolean[] => built(params, mode).debugBodies!().filter((b) => b.owner === 'cage').map((b) => b.solid);

/** Two makers that let a carton go on the same beat, side by side, and a third beat for the odd one. */
const pairs = (left: number, right: number): Drop[] => [
  { x: -0.2, z: -0.15, count: left },
  { x: 0.2, z: 0.15, count: right },
];

describe('the card', () => {
  const def = getNodeDef('container')!;

  it('is an object piece with no input, five outputs and the settings of the cage', () => {
    expect([def.kind, def.label, def.labelEn, def.category]).toEqual(['container', 'Lồng chứa', 'Container Cage', 'object']);
    expect(def.inputs).toEqual([]);
    expect(def.outputs.map((p) => [p.id, p.type, p.label])).toEqual([
      ['self', 'object', 'Đối tượng'],
      ['count', 'number', 'Số vật bên trong'],
      ['full', 'bool', 'Đã đầy'],
      ['took', 'bool', 'Khi nhận vật'],
      ['first', 'object', 'Vật bên trong'],
    ]);
    expect(def.params.map((p) => [p.id, p.default])).toEqual([
      ['position', { x: 0, y: 0.5, z: 0 }],
      ['inside', 1],
      ['wall', 1],
      ['capacity', 6],
      ['clearance', 0.35],
      ['mass', 20],
      ['look', ROLL_CAGE_LOOK],
      ['color', '#aab2bd'],
    ]);
    expect(def.params.find((p) => p.id === 'capacity')).toMatchObject({ min: 1, max: 24 });
    expect(def.params.find((p) => p.id === 'look')!.options!.map((o) => o.value)).toEqual([ROLL_CAGE_LOOK, CLASSIC_LOOK]);
    expect(def.params.find((p) => p.id === 'position')!.place).toBe('point');
  });

  it('brings every size into its range', () => {
    expect(containerShape({ inside: 99, wall: 0, clearance: -1, look: 'nonsense' })).toEqual({ inside: 3, wall: 0.2, clearance: CONTAINER_THICK, classic: false });
    expect(containerShape({})).toEqual({ inside: 1, wall: 1, clearance: 0.35, classic: false });
    expect(containerShape({ look: CLASSIC_LOOK }).classic).toBe(true);
  });

  it('writes its shape on the floor plate and reads it back; a wall or any other text is no cage', () => {
    const shape = containerShape({ inside: 0.8, wall: 1.2, clearance: 0.2, look: CLASSIC_LOOK });
    expect(containerOfLabel(containerLabel(shape))).toEqual(shape);
    for (const text of [undefined, '', CONTAINER_WALL_LABEL, CONTAINER_BOARD_LABEL, '1|1', '1|1|0.35|0|9', '0|1|0.35|0', 'a|b|c|d']) expect(containerOfLabel(text), String(text)).toBeNull();
  });
});

describe('what the card builds', () => {
  it('3D: a floor plate and four walls, all solid, that close the cage without a gap', () => {
    const parts = blocksOf();
    expect(parts).toHaveLength(5);
    for (const p of parts) expect([p.kind, p.look, p.visible]).toEqual(['block', CONTAINER_LOOK, true]);
    expect(solidOf()).toEqual([true, true, true, true, true]);
    const [floor, west, east, north, south] = parts as [EntityView, EntityView, EntityView, EntityView, EntityView];
    // Floor plate: 0.35 m free under it, 1.1 m square (1 m inside + two walls of 5 cm).
    expect(floor.size).toEqual({ x: 1.1, y: 0.05, z: 1.1 });
    expect(floor.position.x).toBeCloseTo(2, 9);
    expect(floor.position.z).toBeCloseTo(-1, 9);
    expect(floor.position.y - floor.size.y / 2).toBeCloseTo(GROUND + 0.35, 9);
    const floorTop = floor.position.y + floor.size.y / 2;
    for (const w of [west, east, north, south]) {
      expect(w.size.y).toBe(1);
      expect(w.position.y - w.size.y / 2).toBeCloseTo(floorTop, 9);
    }
    // Inner faces 1 m apart both ways; the walls across x cover the corners, the walls across z fit between them.
    expect(east.position.x - east.size.x / 2 - (west.position.x + west.size.x / 2)).toBeCloseTo(1, 9);
    expect(south.position.z - south.size.z / 2 - (north.position.z + north.size.z / 2)).toBeCloseTo(1, 9);
    expect([west.size.z, east.size.z]).toEqual([1.1, 1.1]);
    expect([north.size.x, south.size.x]).toEqual([1, 1]);
    expect(floor.label).toBe('1|1|0.35|0');
    expect([west, east, north, south].map((w) => w.label)).toEqual(Array(4).fill(CONTAINER_WALL_LABEL));
  });

  it('follows the settings: inside, wall height, clearance, colour; the closed box marks its walls as boards', () => {
    const parts = blocksOf({ inside: 0.8, wall: 0.6, clearance: 0.1, color: '#112233', look: CLASSIC_LOOK });
    const [floor, west] = parts as [EntityView, EntityView];
    expect(floor.size).toEqual({ x: 0.9, y: 0.05, z: 0.9 });
    expect(floor.position.y).toBeCloseTo(0.125, 9);
    expect(west.size).toEqual({ x: 0.05, y: 0.6, z: 0.9 });
    expect(new Set(parts.map((p) => p.color))).toEqual(new Set(['#112233']));
    expect(floor.label).toBe('0.8|0.6|0.1|1');
    expect(parts.slice(1).map((p) => p.label)).toEqual(Array(4).fill(CONTAINER_BOARD_LABEL));
    // The look is draw-only: the same five boxes either way.
    const mesh = blocksOf({ inside: 0.8, wall: 0.6, clearance: 0.1 });
    expect(mesh.map((p) => [p.position, p.size])).toEqual(parts.map((p) => [p.position, p.size]));
  });

  it('the floor plate carries the weight of the empty cage, the walls weigh nothing', () => {
    const r = rig([['cage', 'container', { mass: 35 }]], [], '3d');
    const ids = r.world.entities().filter((e) => e.ownerNodeId === 'cage').map((e) => e.id);
    expect(ids.map((id) => r.world.materialOf(id)!.massKg)).toEqual([35, 0, 0, 0, 0]);
  });

  it('side view: a cut through the middle (floor and two walls); top-down view: a painted square that blocks nothing', () => {
    const side = blocksOf({}, '2d-side');
    expect(side).toHaveLength(3);
    expect(side.map((p) => p.position.z)).toEqual([0, 0, 0]);
    const top = blocksOf({}, '2d-top');
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ zone: true, size: { x: 1.1, y: 0.02, z: 1.1 } });
    expect(solidOf({}, '2d-top')).toEqual([false]);
    expect(solidOf({}, '2d-side')).toEqual([true, true, true]);
  });

  it('a new colour repaints all five blocks while it runs', () => {
    const r = rig([['cage', 'container', {}]], [], '3d');
    r.tick();
    r.set('cage', { color: '#ff0000' });
    r.tick();
    expect(new Set(r.world.entities().filter((e) => e.ownerNodeId === 'cage').map((e) => e.color))).toEqual(new Set(['#ff0000']));
  });

  it('names the blocks that move as one body from any one of them, floor plate first; nothing for a block of another piece', () => {
    const r = rig(
      [
        ['a', 'container', { position: { x: 0, y: 0, z: 0 } }],
        ['b', 'container', { position: { x: 5, y: 0, z: 0 } }],
        ['other', 'block', { position: { x: 9, y: 0, z: 0 } }],
      ],
      [],
      '3d',
    );
    const of = (owner: string): string[] => r.world.entities().filter((e) => e.ownerNodeId === owner).map((e) => e.id);
    r.tick();
    expect(r.out('a', 'self')).toBe(of('a')[0]);
    for (const id of of('a')) expect(containerBlocks(r.world, id)).toEqual(of('a'));
    expect(containerBlocks(r.world, r.out('b', 'self') as string)).toEqual(of('b'));
    expect(containerBlocks(r.world, of('other')[0]!)).toEqual([]);
    expect(containerBlocks(r.world, 'no-such-thing')).toEqual([]);
  });
});

describe.each([
  ['with "Vật lý thật" on', true],
  ['with the switch off (plain item rules)', false],
] as const)('counting %s', (_name, real) => {
  const start = (drops: Drop[], cage: Record<string, ParamValue> = {}) => cageRig({ ...(real ? { rapier } : {}), drops, cage });

  it('an empty cage says 0, not full, nothing inside', () => {
    const r = start([]);
    const seen = r.watch(0.5);
    expect(seen.at(-1)).toEqual({ count: 0, took: false, full: false, first: null });
    expect(seen.some((s) => s.took || s.full || s.count !== 0)).toBe(false);
  });

  it('four cartons let go one by one: the count climbs 1, 2, 3, 4 and "Khi nhận vật" is on for one tick each time', () => {
    const r = start([{ x: 0.05, z: -0.05, count: 4 }]);
    const seen = r.watch(8);
    const climbs = seen.map((s) => s.count).filter((c, t, all) => t === 0 || c !== all[t - 1]);
    expect(climbs).toEqual([0, 1, 2, 3, 4]);
    expect(seen.filter((s) => s.took)).toHaveLength(4);
    // Never two ticks in a row: each one is a separate beat.
    expect(seen.some((s, t) => s.took && seen[t + 1]?.took)).toBe(false);
    // The beat comes on the tick the count rises.
    for (let t = 1; t < seen.length; t++) if (seen[t]!.count > seen[t - 1]!.count) expect(seen[t]!.took, `tick ${t}`).toBe(true);
    expect(seen.at(-1)!.full).toBe(false);
    expect(r.cartons()).toHaveLength(4);
    // "Vật bên trong" is a carton that lies in the cage: the first one made.
    expect(seen.at(-1)!.first).toBe(r.cartons()[0]!.id);
  });

  it('two cartons that come in on the same tick count as two and give two beats, one right after the other', () => {
    const r = start(pairs(1, 1));
    const seen = r.watch(4);
    const rise = seen.findIndex((s) => s.count > 0);
    expect(rise).toBeGreaterThan(0);
    expect(seen[rise - 1]!.count).toBe(0);
    expect(seen[rise]!.count).toBe(2);
    expect(seen.map((s, t) => (s.took ? t : -1)).filter((t) => t >= 0)).toEqual([rise, rise + 2]);
  });

  it('full at the capacity; a seventh carton is not kept out, is counted, and "Đã đầy" stays on', () => {
    const r = start(pairs(4, 3));
    const seen = r.watch(10);
    expect(seen.at(-1)).toMatchObject({ count: 7, full: true });
    expect(seen.filter((s) => s.took)).toHaveLength(7);
    const full = seen.findIndex((s) => s.full);
    expect(seen[full]!.count).toBe(6);
    expect(seen[full - 1]!.count).toBeLessThan(6);
    expect(seen.slice(full).every((s) => s.full)).toBe(true);
    // All seven lie between the walls, above the floor plate.
    for (const c of r.cartons()) {
      expect(Math.abs(c.position.x)).toBeLessThan(0.5);
      expect(Math.abs(c.position.z)).toBeLessThan(0.5);
      expect(c.position.y).toBeGreaterThan(0.4);
    }
  });

  it('the capacity only moves "Đã đầy": changed while it runs, the count stays and the signal follows', () => {
    const r = start(pairs(2, 1));
    expect(r.watch(5).at(-1)).toMatchObject({ count: 3, full: false });
    r.set('cage', { capacity: 3 });
    expect(r.watch(0.1).at(-1)).toMatchObject({ count: 3, full: true });
    r.set('cage', { capacity: 4 });
    expect(r.watch(0.1).at(-1)).toMatchObject({ count: 3, full: false });
  });

  it('a carton that comes down beside the mouth is not counted', () => {
    // 0.9 m from the middle: on the ground outside the cage.
    const r = start([{ x: 0.9, z: 0, count: 1 }]);
    const seen = r.watch(4);
    expect(seen.some((s) => s.count > 0 || s.took || s.first !== null)).toBe(false);
    expect(r.cartons()).toHaveLength(1);
    expect(r.cartons()[0]!.position.y).toBeLessThan(0.2);
  });

  it('a carton that leaves the cage is taken off the count on that tick; coming back in is one more beat', () => {
    const r = start(pairs(2, 1));
    expect(r.watch(5).at(-1)).toMatchObject({ count: 3 });
    const [first, second] = r.cartons() as [EntityView, EntityView];
    // Lifted out over the rim and set down on the ground beside the cage.
    expect(r.world.teleport(first.id, { x: 2, y: GROUND + CARTON.y / 2 + 0.01, z: 0 }, false)).not.toBeNull();
    const gone = r.watch(TICK_DT);
    expect(gone[0]).toMatchObject({ count: 2, took: false, first: second.id });
    expect(r.watch(1).every((s) => s.count === 2 && !s.took)).toBe(true);
    // Held above the rim it is between the walls but not in the cage.
    r.world.teleport(first.id, { x: 0, y: 1.9, z: 0 }, false);
    expect(r.watch(TICK_DT)[0]).toMatchObject({ count: 2, took: false });
    const back = r.watch(2);
    expect(back.at(-1)).toMatchObject({ count: 3, first: first.id });
    expect(back.filter((s) => s.took)).toHaveLength(1);
  });
});

describe('what counts as inside', () => {
  const shape = containerShape({});
  const floor = { position: { x: 4, y: 0.375, z: -2 } };
  const at = (x: number, y: number, z: number, mode: ViewMode = '3d'): boolean => insideContainer({ position: { x: 4 + x, y, z: -2 + z } }, floor, shape, mode);

  it('the middle of the thing between the inner faces of the walls, above the underside of the floor plate, below the rim', () => {
    expect(at(0, 0.9, 0)).toBe(true);
    expect([at(0.5 - MM, 0.9, 0), at(0.5 + MM, 0.9, 0)]).toEqual([true, false]);
    expect([at(-0.5 + MM, 0.9, 0), at(-0.5 - MM, 0.9, 0)]).toEqual([true, false]);
    expect([at(0, 0.9, 0.5 - MM), at(0, 0.9, 0.5 + MM)]).toEqual([true, false]);
    expect([at(0, 0.9, -0.5 + MM), at(0, 0.9, -0.5 - MM)]).toEqual([true, false]);
    // Underside of the plate at 0.35 m, rim at 0.35 + 0.05 + 1 = 1.4 m.
    expect([at(0, 0.35 + MM, 0), at(0, 0.35 - MM, 0)]).toEqual([true, false]);
    expect([at(0, 1.4 - MM, 0), at(0, 1.4 + MM, 0)]).toEqual([true, false]);
  });

  it('the side view does not look at z, the top-down view not at the height', () => {
    expect(at(0, 0.9, 7, '2d-side')).toBe(true);
    expect(at(0, 9, 0, '2d-side')).toBe(false);
    expect(at(0.2, 99, -0.2, '2d-top')).toBe(true);
    expect(at(0.6, 0, 0, '2d-top')).toBe(false);
  });

  it('plain rules: a carton that comes to rest on the top of a wall is not inside', () => {
    // Its middle comes down on the wall (inner face at 0.5 m).
    const r = cageRig({ drops: [{ x: 0, z: -0.52, count: 1 }] });
    const seen = r.watch(4);
    expect(seen.some((s) => s.count > 0 || s.took)).toBe(false);
    expect(r.cartons()[0]!.position.y).toBeCloseTo(1.4 + CARTON.y / 2, 2);
  });
});

describe('other views', () => {
  it('side view: cartons fall between the two walls and are counted, whatever their z', () => {
    const r = cageRig({ mode: '2d-side', drops: [{ x: 0.1, z: 0, count: 3 }] });
    const seen = r.watch(6);
    expect(seen.at(-1)).toMatchObject({ count: 3 });
    expect(seen.filter((s) => s.took)).toHaveLength(3);
  });

  it('top-down view: what lies on the painted square is counted, what lies beside it is not', () => {
    const r = cageRig({ mode: '2d-top', drops: [{ x: 0.1, z: 0.2, count: 2 }, { x: 0.9, z: 0, count: 1 }] });
    expect(r.watch(3).at(-1)).toMatchObject({ count: 2 });
  });
});
