import type { BodySnapshot } from '../engine/types';

/**
 * Hidden physics invariants. Pure functions over world snapshots: the headless test-suite runs them over every
 * puzzle level tick by tick, and the dev-only watcher runs them in the browser. Nothing here is shown to players.
 */

export type ViolationCode =
  | 'character-in-block'
  | 'character-in-item'
  | 'character-in-character'
  | 'item-in-item'
  | 'item-in-block'
  | 'carried-in-block'
  | 'carried-in-body'
  | 'below-floor'
  | 'sensor-without-contact'
  | 'collider-mismatch';

export interface Violation {
  code: ViolationCode;
  /** Level objects involved (owner node ids). */
  who: string[];
  /** How deep the overlap is, or how far off the value is. */
  amount: number;
}

export interface CheckOptions {
  /** True when characters and items are solid bodies (puzzle 3D); otherwise only blocks block anything. */
  solidBodies: boolean;
  /** Overlap deeper than this is a violation. */
  tolerance?: number;
  /** A character or item whose centre is lower than this fell off the world and was not handled. */
  fallLimit?: number;
}

export const OVERLAP_TOLERANCE = 0.05;
export const FALL_LIMIT = -8;
const AXES = ['x', 'y', 'z'] as const;

/** Depth of the overlap of two boxes (smallest axis overlap); 0 or less = apart. */
export function penetration(a: BodySnapshot, b: BodySnapshot): number {
  let depth = Infinity;
  for (const k of AXES) {
    const o = Math.min(a.box.pos[k] + a.box.size[k] / 2, b.box.pos[k] + b.box.size[k] / 2) - Math.max(a.box.pos[k] - a.box.size[k] / 2, b.box.pos[k] - b.box.size[k] / 2);
    if (o < depth) depth = o;
  }
  return depth;
}

/** Largest gap between two boxes along any axis (negative = overlapping on every axis). */
export function gap(a: BodySnapshot, b: BodySnapshot): number {
  let g = -Infinity;
  for (const k of AXES) {
    const d = Math.abs(a.box.pos[k] - b.box.pos[k]) - (a.box.size[k] + b.box.size[k]) / 2;
    if (d > g) g = d;
  }
  return g;
}

const isBody = (b: BodySnapshot): boolean => b.visible && !b.seated && (b.kind === 'character' || b.kind === 'item');

/** Every rule that must hold for one snapshot of the world. */
export function checkBodies(bodies: readonly BodySnapshot[], options: CheckOptions): Violation[] {
  const tol = options.tolerance ?? OVERLAP_TOLERANCE;
  const fall = options.fallLimit ?? FALL_LIMIT;
  const out: Violation[] = [];
  const add = (code: ViolationCode, a: BodySnapshot, b: BodySnapshot | null, amount: number): void => {
    out.push({ code, who: b ? [a.owner, b.owner] : [a.owner], amount });
  };
  const walls = bodies.filter((b) => b.visible && b.kind === 'block' && b.solid && !b.zone);
  const movers = bodies.filter(isBody);
  const free = (b: BodySnapshot): boolean => !b.carried;

  for (const m of movers) {
    if (m.box.pos.y < fall) add('below-floor', m, null, fall - m.box.pos.y);
    for (const w of walls) {
      const d = penetration(m, w);
      if (d <= tol) continue;
      if (m.kind === 'character') add('character-in-block', m, w, d);
      else if (m.carried) add('carried-in-block', m, w, d);
      else add('item-in-block', m, w, d);
    }
  }
  if (!options.solidBodies) return out;

  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i]!;
      const b = movers[j]!;
      if (a.kind === 'item' && b.kind === 'item' && (a.carried || b.carried)) {
        // A carried item may only overlap the one who carries it (and a hand-held tool).
        const d = penetration(a, b);
        if (d > tol && a.holder !== b.holder) add('carried-in-body', a, b, d);
        continue;
      }
      const item = a.kind === 'item' ? a : b.kind === 'item' ? b : null;
      const other = item === a ? b : a;
      if (item && item.carried) {
        // A carried item must not push into another body, except its own carrier.
        if (item.holder === other.id) continue;
        const d = penetration(a, b);
        if (d > tol) add('carried-in-body', item, other, d);
        continue;
      }
      if (!free(a) || !free(b)) continue;
      const d = penetration(a, b);
      if (d <= tol) continue;
      if (a.kind === 'character' && b.kind === 'character') add('character-in-character', a, b, d);
      else if (a.kind === 'item' && b.kind === 'item') add('item-in-item', a, b, d);
      else add('character-in-item', a, b, d);
    }
  }
  return out;
}

/** Sensors say "touching" only when the collision boxes really are in contact (within `slack`). */
export function checkContactClaims(a: BodySnapshot, b: BodySnapshot, claimedTouching: boolean, slack = 0.02): Violation[] {
  const g = gap(a, b);
  if (claimedTouching && g > slack) return [{ code: 'sensor-without-contact', who: [a.owner, b.owner], amount: g }];
  if (!claimedTouching && g < -slack) return [{ code: 'sensor-without-contact', who: [a.owner, b.owner], amount: -g }];
  return [];
}

/**
 * A character's collision box must cover the figure that is drawn: `scale` times the base size, standing on the
 * same floor. `maxWidthGap` lets the box be a little slimmer than the bounding box of the drawn arms and ears.
 */
export function checkColliderMatchesDrawing(c: BodySnapshot, scale: number, maxWidthGap = 0.4): Violation[] {
  const drawnH = c.size.y * scale;
  const feet = c.pos.y - c.size.y / 2;
  const boxFeet = c.box.pos.y - c.box.size.y / 2;
  const drawnW = Math.max(c.size.x, c.size.z) * scale;
  const boxW = Math.min(c.box.size.x, c.box.size.z);
  const out: Violation[] = [];
  if (Math.abs(c.box.size.y - drawnH) > 0.05) out.push({ code: 'collider-mismatch', who: [c.owner, 'height'], amount: Math.abs(c.box.size.y - drawnH) });
  if (Math.abs(boxFeet - feet) > 0.05) out.push({ code: 'collider-mismatch', who: [c.owner, 'feet'], amount: Math.abs(boxFeet - feet) });
  if (drawnW - boxW > maxWidthGap) out.push({ code: 'collider-mismatch', who: [c.owner, 'width'], amount: drawnW - boxW });
  return out;
}

export function describeViolation(v: Violation): string {
  return `${v.code} [${v.who.join(' / ')}] by ${v.amount.toFixed(2)}`;
}
