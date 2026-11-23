import { TICK_DT, type EntityId, type EntityView, type Vec3, type World } from '../../src/engine/types';
import { block, crate } from '../world/crate-helpers';

const view = (w: World, id: EntityId): EntityView => {
  const v = w.getEntity(id);
  if (!v) throw new Error(`no entity ${id}`);
  return v;
};

/**
 * An open-top cage made of five plain solid blocks (a floor plate and four walls), cartons to drop into it, and the
 * measurements the cage tests read from the entity views alone: which cartons are inside, how high the pile stands, how deep
 * a carton corner sits inside a wall or the floor, and when everything lies still. Nothing here is a piece of the app.
 */

export interface CageSpec {
  /** Middle of the cage on the ground plane. */
  x: number;
  z: number;
  /** Clear width inside the walls, along x and z (m). */
  inside: number;
  /** Height of the walls above the cage floor (m). */
  wall: number;
  /** Height of the underside of the floor plate above the ground: the room a carrier needs to drive under (m). */
  clearance: number;
  /** Thickness of the walls and of the floor plate (m). */
  thick: number;
}

export const CAGE: CageSpec = { x: 0, z: 0, inside: 0.8, wall: 1, clearance: 0.35, thick: 0.05 };

export interface Cage {
  spec: CageSpec;
  /** Floor plate first, then the walls at -x, +x, -z, +z. */
  ids: EntityId[];
  /** Where each block's middle stands against the middle of the cage. */
  offsets: Vec3[];
  /** Top of the floor plate and top of the walls (world heights). */
  floorTop: number;
  rim: number;
}

export function buildCage(w: World, spec: CageSpec): Cage {
  const { x, z, inside, wall, clearance, thick } = spec;
  const floorTop = clearance + thick;
  const outer = inside + 2 * thick;
  const wy = floorTop + wall / 2;
  const reach = inside / 2 + thick / 2;
  const parts: { at: Vec3; size: Vec3 }[] = [
    { at: { x: 0, y: clearance + thick / 2, z: 0 }, size: { x: outer, y: thick, z: outer } },
    { at: { x: -reach, y: wy, z: 0 }, size: { x: thick, y: wall, z: outer } },
    { at: { x: reach, y: wy, z: 0 }, size: { x: thick, y: wall, z: outer } },
    { at: { x: 0, y: wy, z: -reach }, size: { x: inside, y: wall, z: thick } },
    { at: { x: 0, y: wy, z: reach }, size: { x: inside, y: wall, z: thick } },
  ];
  const ids = parts.map((p) => block(w, x + p.at.x, p.at.y, z + p.at.z, p.size.x, p.size.y, p.size.z, { ownerNodeId: 'cage' }));
  return { spec, ids, offsets: parts.map((p) => p.at), floorTop, rim: floorTop + wall };
}

/** Sends every block of the cage to its place round a new middle. Returns how many of the five blocks did not get there. */
export function moveCage(w: World, cage: Cage, x: number, z: number): number {
  let refused = 0;
  cage.ids.forEach((id, k) => {
    const o = cage.offsets[k]!;
    if (!w.moveBlock(id, { x: x + o.x, y: o.y, z: z + o.z })) refused++;
  });
  return refused;
}

/** Where the middle of the cage is now, read from its floor plate. */
export function cageMiddle(w: World, cage: Cage): { x: number; z: number } {
  const p = view(w, cage.ids[0]!).position;
  return { x: p.x, z: p.z };
}

/** Largest distance (m) any wall stands off its place against the floor plate. */
export function cageTear(w: World, cage: Cage): number {
  const f = view(w, cage.ids[0]!).position;
  let worst = 0;
  cage.ids.forEach((id, k) => {
    const p = view(w, id).position;
    const o = cage.offsets[k]!;
    const o0 = cage.offsets[0]!;
    worst = Math.max(worst, Math.abs(p.x - f.x - (o.x - o0.x)), Math.abs(p.y - f.y - (o.y - o0.y)), Math.abs(p.z - f.z - (o.z - o0.z)));
  });
  return worst;
}

export interface CartonSpec {
  size: Vec3;
  kg: number;
}

/** The carton of the brief: a 0.26 m cube. */
export const CUBE: Vec3 = { x: 0.26, y: 0.26, z: 0.26 };
/** The carton the factory stations make today. */
export const FACTORY_CARTON: Vec3 = { x: 0.32, y: 0.26, z: 0.28 };
export const MASSES = [1, 2, 5] as const;

export function carton(w: World, at: Vec3, c: CartonSpec): EntityId {
  return crate(w, at.x, at.y, at.z, c.size, { mass: c.kg, ownerNodeId: 'carton' });
}

/** A small repeatable random source (0..1), so every run of a test drops the cartons in the same places. */
export function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** The eight corners of a carton as the engine left it. */
export function cornersOf(v: EntityView): Vec3[] {
  const q = v.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  const turn = (p: Vec3): Vec3 => {
    // p' = q p q*
    const ix = q.w * p.x + q.y * p.z - q.z * p.y;
    const iy = q.w * p.y + q.z * p.x - q.x * p.z;
    const iz = q.w * p.z + q.x * p.y - q.y * p.x;
    const iw = -q.x * p.x - q.y * p.y - q.z * p.z;
    return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
  };
  const out: Vec3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = turn({ x: (sx * v.size.x) / 2, y: (sy * v.size.y) / 2, z: (sz * v.size.z) / 2 });
    out.push({ x: v.position.x + c.x, y: v.position.y + c.y, z: v.position.z + c.z });
  }
  return out;
}

export interface CageReading {
  /** Cartons whose middle is inside the cage volume (between the walls, above the floor plate, below the rim). */
  inside: number;
  /** Cartons whose middle is between the walls but above the rim (lying on top of the pile, not held by the walls). */
  aboveRim: number;
  /** Highest corner of a carton between the walls, against the rim (m): negative = the whole pile is below the rim. */
  topOverRim: number;
  /** Deepest a carton corner sits inside the material of the floor plate and of a wall (m, 0 = none), over every carton given. Corners only: a wall edge cutting into a carton face is not seen. */
  inFloor: number;
  inWall: number;
}

/** Reads the cartons against the cage where it stands now. */
export function readCage(w: World, cage: Cage, cartons: readonly EntityId[]): CageReading {
  const mid = cageMiddle(w, cage);
  const half = cage.spec.inside / 2;
  const outer = half + cage.spec.thick;
  const under = cage.floorTop - cage.spec.thick;
  const out: CageReading = { inside: 0, aboveRim: 0, topOverRim: -Infinity, inFloor: 0, inWall: 0 };
  for (const id of cartons) {
    const v = view(w, id);
    const between = Math.abs(v.position.x - mid.x) < half && Math.abs(v.position.z - mid.z) < half && v.position.y > under;
    if (between && v.position.y < cage.rim) out.inside++;
    else if (between) out.aboveRim++;
    for (const c of cornersOf(v)) {
      const ax = Math.abs(c.x - mid.x);
      const az = Math.abs(c.z - mid.z);
      if (between) out.topOverRim = Math.max(out.topOverRim, c.y - cage.rim);
      // Only a corner that is inside the material of the plate or of a wall counts, by how far it is from the nearest face.
      if (ax >= outer || az >= outer || c.y <= under || c.y >= cage.rim) continue;
      if (c.y < cage.floorTop) out.inFloor = Math.max(out.inFloor, Math.min(cage.floorTop - c.y, c.y - under));
      else for (const a of [ax, az]) if (a > half) out.inWall = Math.max(out.inWall, Math.min(a - half, outer - a, cage.rim - c.y));
    }
  }
  return out;
}

/** Tells when a set of bodies lies still: every middle slower than 0.05 m/s and every turn slower than 0.2 rad/s. */
export function stillWatch(w: World, ids: readonly EntityId[]): { tick(): boolean } {
  let last = new Map<EntityId, EntityView>();
  return {
    tick() {
      let still = true;
      const now = new Map<EntityId, EntityView>();
      for (const id of ids) {
        const v = view(w, id);
        now.set(id, v);
        const p = last.get(id);
        if (!p) {
          still = false;
          continue;
        }
        const speed = Math.hypot(v.position.x - p.position.x, v.position.y - p.position.y, v.position.z - p.position.z) / TICK_DT;
        const a = v.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
        const b = p.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
        const dot = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w));
        const spin = (2 * Math.acos(dot)) / TICK_DT;
        if (speed > 0.05 || spin > 0.2) still = false;
      }
      last = now;
      return still;
    },
  };
}

export const f3 = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : '-');
