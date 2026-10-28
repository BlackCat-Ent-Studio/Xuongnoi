import type { ViewMode } from '../engine/types';
import type { Entity } from './entity';

export const GRAVITY = -30;
export const TERMINAL_SPEED = 40;
/** Penetration below this is treated as resting contact (prevents snagging on tiled floors). */
export const SKIN = 1e-6;
/** Gap at or below this counts as a contact. */
export const CONTACT_EPS = 0.01;
/** Max displacement per substep, below half of a 1-unit block. */
const MAX_SUBSTEP_DISTANCE = 0.4;

type Axis = 'x' | 'y' | 'z';

function sanitize(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clamp1(n: number): number {
  return Math.max(-1, Math.min(1, sanitize(n)));
}

function overlapOn(a: Entity, b: Entity, axis: Axis): number {
  return (
    Math.min(a.pos[axis] + a.size[axis] / 2, b.pos[axis] + b.size[axis] / 2) -
    Math.max(a.pos[axis] - a.size[axis] / 2, b.pos[axis] - b.size[axis] / 2)
  );
}

function overlapsAll(a: Entity, b: Entity): boolean {
  return overlapOn(a, b, 'x') > SKIN && overlapOn(a, b, 'y') > SKIN && overlapOn(a, b, 'z') > SKIN;
}

/** Overlapping or within CONTACT_EPS on every axis. */
export function touching(a: Entity, b: Entity): boolean {
  return (
    Math.abs(a.pos.x - b.pos.x) <= (a.size.x + b.size.x) / 2 + CONTACT_EPS &&
    Math.abs(a.pos.y - b.pos.y) <= (a.size.y + b.size.y) / 2 + CONTACT_EPS &&
    Math.abs(a.pos.z - b.pos.z) <= (a.size.z + b.size.z) / 2 + CONTACT_EPS
  );
}

/** Move along one axis by `delta`, pushing out of solid blocks. Returns true if blocked. */
function moveAxis(c: Entity, axis: Axis, delta: number, solids: readonly Entity[]): boolean {
  if (delta === 0) return false;
  c.pos[axis] += delta;
  let blocked = false;
  for (const b of solids) {
    if (!overlapsAll(c, b)) continue;
    const half = (c.size[axis] + b.size[axis]) / 2;
    c.pos[axis] = delta > 0 ? b.pos[axis] - half : b.pos[axis] + half;
    blocked = true;
  }
  return blocked;
}

function applyIntent(c: Entity, mode: ViewMode, yaw: number): void {
  const it = c.intent;
  if (!it) {
    c.vel.x = 0;
    c.vel.z = 0;
    return;
  }
  const mx = clamp1(it.moveX);
  const my = clamp1(it.moveY);
  const speed = sanitize(it.speed);
  if (mode === '2d-side') {
    c.vel.x = mx * speed;
    c.vel.z = 0;
  } else if (mode === '2d-top') {
    c.vel.x = mx * speed;
    c.vel.z = -my * speed;
  } else {
    // yaw 0: forward = -Z, right = +X; rotate both around Y by yaw.
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    c.vel.x = (cos * mx - sin * my) * speed;
    c.vel.z = (-sin * mx - cos * my) * speed;
  }
  if (mode !== '2d-top' && it.jump && c.onGround) {
    c.vel.y = sanitize(it.jumpPower);
    c.onGround = false;
  }
}

/** Advance all visible characters by dt against solid visible blocks. */
export function stepPhysics(entities: readonly Entity[], dt: number, mode: ViewMode, yaw: number): void {
  const solids = entities.filter((e) => e.visible && e.solid && e.kind === 'block');

  for (const c of entities) {
    if (c.kind !== 'character' || !c.visible) continue;
    applyIntent(c, mode, yaw);

    if (mode === '2d-top') {
      c.vel.y = 0;
    } else {
      c.vel.y = Math.max(-TERMINAL_SPEED, c.vel.y + GRAVITY * dt);
    }
    if (mode === '2d-side') c.pos.z = 0;

    const maxDist = Math.max(Math.abs(c.vel.x), Math.abs(c.vel.y), Math.abs(c.vel.z)) * dt;
    const n = Math.max(1, Math.ceil(maxDist / MAX_SUBSTEP_DISTANCE));
    const sub = dt / n;
    let grounded = false;
    for (let i = 0; i < n; i++) {
      if (moveAxis(c, 'x', c.vel.x * sub, solids)) c.vel.x = 0;
      if (mode !== '2d-top') {
        const dy = c.vel.y * sub;
        if (moveAxis(c, 'y', dy, solids)) {
          if (dy < 0) grounded = true;
          c.vel.y = 0;
        }
      }
      if (mode !== '2d-side' && moveAxis(c, 'z', c.vel.z * sub, solids)) c.vel.z = 0;
    }
    c.onGround = grounded;
  }
}
