import { colliderBox, isTurnedBody } from './collider';
import type { Entity } from './entity';
import { CONTACT_EPS, touching } from './physics';
import { isSpinner } from './platforms';

/**
 * Which entities touch, without asking every pair. The answer is exactly the one the plain double loop gives (every pair of the
 * list in list order, block with block left out, kept when `touching` says so); only the pairs that cannot touch are not asked.
 *
 * Each entity gets an upright box that holds everything `touching` may measure of it, whatever it is paired with, grown by the
 * touch tolerance. Two entities whose boxes are apart cannot touch, so `touching` is only asked for pairs whose boxes meet. To
 * find those, the boxes are dropped into a grid of square cells on the ground plane and only entities that share a cell are
 * compared. An entity too wide for the grid (a floor) is compared with all the others, box first.
 *
 * Why the box holds enough, by what `touching` does:
 *  - two plain bodies: it compares their collision boxes per world axis with tolerance CONTACT_EPS, so the collision box is enough;
 *  - a spinning block: it compares the block's turned rectangle with the other one's plain box (position and size, not its
 *    collision box), per world axis among others. The rectangle lies within half the sum of the block's three sizes of its
 *    position on every axis, and the box of every entity holds its plain box;
 *  - a turned crate with a plain body: the largest gap along 15 axes, the world axes (the plain body's own) among them, must
 *    be at most CONTACT_EPS; along a world axis the crate reaches exactly as far as the upright bounds of its turned box;
 *  - two turned crates A and B: the gap along each of A's own three axes is at most CONTACT_EPS. B lies within R_B (half its
 *    diagonal) of its centre along any axis, so some point of A grown by CONTACT_EPS is within R_B of B's centre along each of
 *    A's axes, that is within √3·R_B of it; and that point is within R_A + √3·CONTACT_EPS of A's centre. So the centres are
 *    at most √3·(R_A + R_B + CONTACT_EPS) apart, and a cube of half side √3·(R + CONTACT_EPS) about each centre is enough.
 *    (That cube also holds the upright bounds the case before needs.)
 * Sizes are taken without their sign, which can only make a box larger. All of the above is about ordinary numbers: with a place
 * or a size that is not a number, endless, or so large that products of it overflow, `touching` can answer anything, so such an
 * entity is asked against every other one, whatever their boxes say.
 */

/** Side of a grid cell (world units, about metres): a few bodies wide, so a body sits in one to four cells. */
const CELL = 4;
/** An entity whose box covers more cells than this is not put in the grid. */
const MAX_CELLS = 64;
/** Cell numbers run from -HALF_SPAN to HALF_SPAN; an entity further out is not put in the grid. */
const HALF_SPAN = 1 << 19;
const SPAN = HALF_SPAN * 2;
const ROOT3 = Math.sqrt(3);
/** Beyond this a coordinate is not trusted to behave like a number (its square still fits a double). */
const SANE = 1e150;

interface Bound {
  e: Entity;
  /** Place in the list: `touching` is always asked with the earlier entity first, as the double loop does. */
  at: number;
  block: boolean;
  /** False when a number of the box is not an ordinary one: the box then rules nothing out. */
  sure: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  /** First cell of the box on each ground axis. */
  cellX: number;
  cellZ: number;
}

function boundOf(e: Entity, at: number): Bound {
  let cx = e.pos.x;
  let cy = e.pos.y;
  let cz = e.pos.z;
  let hx = Math.abs(e.size.x) / 2;
  let hy = Math.abs(e.size.y) / 2;
  let hz = Math.abs(e.size.z) / 2;
  let minX = cx - hx;
  let maxX = cx + hx;
  let minY = cy - hy;
  let maxY = cy + hy;
  let minZ = cz - hz;
  let maxZ = cz + hz;
  /** Grows the box to hold everything within (rx, ry, rz) of the point (px, py, pz). */
  const hold = (px: number, py: number, pz: number, rx: number, ry: number, rz: number): void => {
    // Math.min and Math.max give NaN when either number is NaN, so a number that is not one stays in the box.
    minX = Math.min(minX, px - rx);
    maxX = Math.max(maxX, px + rx);
    minY = Math.min(minY, py - ry);
    maxY = Math.max(maxY, py + ry);
    minZ = Math.min(minZ, pz - rz);
    maxZ = Math.max(maxZ, pz + rz);
  };
  let reach = 0;
  if (e.collider) {
    const b = colliderBox(e);
    cx = b.pos.x;
    cy = b.pos.y;
    cz = b.pos.z;
    hx = Math.abs(b.size.x) / 2;
    hy = Math.abs(b.size.y) / 2;
    hz = Math.abs(b.size.z) / 2;
    hold(cx, cy, cz, hx, hy, hz);
    // A turned crate swings its collision box round its position: the centre stays this far from it.
    reach = Math.hypot(cx - e.pos.x, cy - e.pos.y, cz - e.pos.z);
  }
  if (isSpinner(e)) {
    const r = (Math.abs(e.size.x) + Math.abs(e.size.y) + Math.abs(e.size.z)) / 2;
    hold(e.pos.x, e.pos.y, e.pos.z, r, r, r);
  }
  if (isTurnedBody(e)) {
    const r = reach + ROOT3 * (Math.hypot(hx, hy, hz) + CONTACT_EPS);
    hold(e.pos.x, e.pos.y, e.pos.z, r, r, r);
  }
  // NaN fails every comparison, so it is not `sure` either.
  const sure = minX > -SANE && maxX < SANE && minY > -SANE && maxY < SANE && minZ > -SANE && maxZ < SANE;
  return {
    e,
    at,
    block: e.kind === 'block',
    sure,
    minX: minX - CONTACT_EPS,
    maxX: maxX + CONTACT_EPS,
    minY: minY - CONTACT_EPS,
    maxY: maxY + CONTACT_EPS,
    minZ: minZ - CONTACT_EPS,
    maxZ: maxZ + CONTACT_EPS,
    cellX: 0,
    cellZ: 0,
  };
}

/** Calls `found` for every pair of `live` that touches (earlier entity first), block with block left out. The order of the calls is not the list's. */
export function touchingPairs(live: readonly Entity[], found: (a: Entity, b: Entity) => void): void {
  const ask = (p: Bound, q: Bound): void => {
    // Block-block pairs never matter; characters and items report contacts.
    if (p.block && q.block) return;
    // Apart on some axis: cannot touch.
    if (p.sure && q.sure && (p.minX > q.maxX || q.minX > p.maxX || p.minY > q.maxY || q.minY > p.maxY || p.minZ > q.maxZ || q.minZ > p.maxZ)) return;
    const a = p.at < q.at ? p : q;
    const b = p.at < q.at ? q : p;
    if (touching(a.e, b.e)) found(a.e, b.e);
  };

  const all: Bound[] = [];
  const wide: Bound[] = [];
  /** Per cell: the blocks in it and the other entities in it (blocks are never compared with each other). */
  const cells = new Map<number, { x: number; z: number; blocks: Bound[]; others: Bound[] }>();
  for (let at = 0; at < live.length; at++) {
    const b = boundOf(live[at]!, at);
    all.push(b);
    const x0 = Math.floor(b.minX / CELL);
    const x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL);
    const z1 = Math.floor(b.maxZ / CELL);
    const inGrid = b.sure && x0 >= -HALF_SPAN && x1 < HALF_SPAN && z0 >= -HALF_SPAN && z1 < HALF_SPAN && (x1 - x0 + 1) * (z1 - z0 + 1) <= MAX_CELLS;
    if (!inGrid) {
      wide.push(b);
      continue;
    }
    b.cellX = x0;
    b.cellZ = z0;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const key = (x + HALF_SPAN) * SPAN + (z + HALF_SPAN);
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = { x, z, blocks: [], others: [] }));
        (b.block ? cell.blocks : cell.others).push(b);
      }
    }
  }

  for (const cell of cells.values()) {
    const { others, blocks } = cell;
    for (let i = 0; i < others.length; i++) {
      const p = others[i]!;
      // Two boxes that meet share the cell where the later of their first cells is, on both axes: the pair is asked there and only there.
      for (let j = i + 1; j < others.length; j++) {
        const q = others[j]!;
        if (Math.max(p.cellX, q.cellX) === cell.x && Math.max(p.cellZ, q.cellZ) === cell.z) ask(p, q);
      }
      for (const q of blocks) {
        if (Math.max(p.cellX, q.cellX) === cell.x && Math.max(p.cellZ, q.cellZ) === cell.z) ask(p, q);
      }
    }
  }
  // Wide entities: with every entity in the grid, and with each other once.
  const isWide = new Set(wide);
  for (const w of wide) {
    for (const o of all) {
      if (o === w || (isWide.has(o) && o.at < w.at)) continue;
      ask(w, o);
    }
  }
}
