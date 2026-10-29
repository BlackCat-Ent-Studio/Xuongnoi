import type { EntityId, ShotSpec, Vec3, ViewMode } from '../engine/types';
import { colliderBox } from './collider';
import type { Entity } from './entity';

/** Shots fly straight (or in an arc when gravity is on) and stop at the first solid or character they meet. */

/** Downward pull on a shot with gravity on (lighter than a falling body, so arcs stay readable). */
export const BULLET_GRAVITY = -12;
/** At most this many shots exist at once. */
export const MAX_BULLETS = 150;
/** Longest stretch a shot moves between collision checks. */
const MAX_STEP = 0.25;
const MIN_SPEED = 0.5;
const MAX_SPEED = 80;
const MAX_LIFETIME = 30;
const MIN_SIZE = 0.1;
const MAX_SIZE = 2;

export interface BulletState {
  owner: EntityId;
  damage: number;
  /** Seconds left. */
  ttl: number;
  gravity: boolean;
}

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function clampShot(spec: ShotSpec): { speed: number; lifetime: number; damage: number; size: number } {
  return {
    speed: clamp(finiteOr(spec.speed, 12), MIN_SPEED, MAX_SPEED),
    lifetime: clamp(finiteOr(spec.lifetime, 1.5), 0.05, MAX_LIFETIME),
    damage: Math.max(0, finiteOr(spec.damage, 1)),
    size: clamp(finiteOr(spec.size, 0.25), MIN_SIZE, MAX_SIZE),
  };
}

/** Unit direction a shooter fires in: toward `aimAt` when given, else along its facing. Never has a component the view lacks. */
export function aimDirection(shooter: Entity, aimAt: Entity | undefined, mode: ViewMode): Vec3 {
  let d: Vec3 = aimAt
    ? { x: aimAt.pos.x - shooter.pos.x, y: aimAt.pos.y - shooter.pos.y, z: aimAt.pos.z - shooter.pos.z }
    : { x: shooter.facing.x, y: 0, z: shooter.facing.z };
  if (mode === '2d-side') d = { ...d, z: 0 };
  if (mode === '2d-top') d = { ...d, y: 0 };
  let len = Math.hypot(d.x, d.y, d.z);
  if (len < 1e-6) {
    d = { x: 1, y: 0, z: 0 };
    len = 1;
  }
  return { x: d.x / len, y: d.y / len, z: d.z / len };
}

/** Where a shot starts: just outside the shooter along `dir`, at chest height. */
export function muzzlePosition(shooter: Entity, dir: Vec3, size: number, mode: ViewMode): Vec3 {
  const reach = Math.max(shooter.size.x, shooter.size.z) / 2 + size / 2 + 0.05;
  return {
    x: shooter.pos.x + dir.x * reach,
    y: mode === '2d-top' ? shooter.pos.y : shooter.pos.y + shooter.size.y * 0.1 + dir.y * reach,
    z: mode === '2d-side' ? 0 : shooter.pos.z + dir.z * reach,
  };
}

function overlaps(a: Entity, b: Entity): boolean {
  const ba = colliderBox(a);
  const bb = colliderBox(b);
  return (
    Math.abs(ba.pos.x - bb.pos.x) < (ba.size.x + bb.size.x) / 2 &&
    Math.abs(ba.pos.y - bb.pos.y) < (ba.size.y + bb.size.y) / 2 &&
    Math.abs(ba.pos.z - bb.pos.z) < (ba.size.z + bb.size.z) / 2
  );
}

export function countBullets(list: readonly Entity[]): number {
  let n = 0;
  for (const e of list) if (e.bullet && e.visible) n++;
  return n;
}

export interface BulletDeps {
  /** Hurts a character (no-op without health). */
  strike(victim: Entity, damage: number, dirX: number, dirZ: number): boolean;
  hide(id: EntityId): void;
}

/** Advances every shot by dt. Returns the characters hit, grouped by the shooter's id. */
export function stepBullets(list: readonly Entity[], dt: number, mode: ViewMode, deps: BulletDeps): Map<EntityId, EntityId[]> {
  const hits = new Map<EntityId, EntityId[]>();
  let solids: Entity[] | null = null;
  for (const b of list) {
    const s = b.bullet;
    if (!s || !b.visible) continue;
    s.ttl -= dt;
    if (s.ttl <= 0) {
      deps.hide(b.id);
      continue;
    }
    solids ??= list.filter((e) => e.visible && e.solid && (e.kind === 'block' || e.kind === 'vehicle'));
    const n = Math.max(1, Math.ceil((Math.hypot(b.vel.x, b.vel.y, b.vel.z) * dt) / MAX_STEP));
    const sub = dt / n;
    for (let i = 0; i < n; i++) {
      if (s.gravity && mode !== '2d-top') b.vel.y += BULLET_GRAVITY * sub;
      b.pos.x += b.vel.x * sub;
      b.pos.y += b.vel.y * sub;
      b.pos.z += b.vel.z * sub;
      if (mode === '2d-side') b.pos.z = 0;
      if (solids.some((o) => o.vehicle?.driver !== s.owner && overlaps(b, o))) {
        deps.hide(b.id);
        break;
      }
      const victim = list.find(
        (v) => v.kind === 'character' && v.visible && v.id !== s.owner && v.seatedIn === null && !v.combat?.dead && overlaps(b, v),
      );
      if (victim) {
        deps.strike(victim, s.damage, b.vel.x, b.vel.z);
        const prior = hits.get(s.owner);
        if (prior) prior.push(victim.id);
        else hits.set(s.owner, [victim.id]);
        deps.hide(b.id);
        break;
      }
    }
  }
  return hits;
}
