import type { EntityId, ItemShape, ViewMode } from '../engine/types';
import type { Entity } from './entity';

/** Seconds a character cannot be hurt again after a hit (the red flash lasts as long). */
export const IFRAME_SECONDS = 0.5;
/** Seconds from running out of health until the body is hidden. */
export const DEATH_SECONDS = 0.8;
/** Seconds the knockback push lasts (it fades out linearly). */
export const KNOCK_SECONDS = 0.25;
/** Horizontal speed of a knockback push at its start. */
export const KNOCK_SPEED = 7;
/** Upward hop given by a knockback outside the top-down view. */
export const KNOCK_LIFT = 5;
/** A thrown item only hurts while it is at least this fast. */
export const THROWN_MIN_SPEED = 1.5;
/** Largest health a node may ask for (keeps the bar readable and the numbers sane). */
const MAX_HP_LIMIT = 1000;

/** Per-character health and hit reaction. Present only once a health node registered the character. */
export interface CombatState {
  maxHp: number;
  hp: number;
  showBar: boolean;
  /** Seconds of invulnerability left. */
  invuln: number;
  /** Seconds of knockback left, and its starting velocity. */
  knockT: number;
  knockVx: number;
  knockVz: number;
  dead: boolean;
  /** Seconds since death. */
  deathT: number;
}

/** Damage of a tool / thrown item when its own param is unset. */
export function defaultDamage(shape: ItemShape | undefined): number {
  switch (shape) {
    case 'sword':
      return 3;
    case 'hammer':
    case 'pickaxe':
      return 2;
    default:
      return 1;
  }
}

export function itemDamage(item: Entity): number {
  return item.damage !== undefined && item.damage > 0 ? item.damage : defaultDamage(item.shape);
}

/** Bare-handed swing. */
export const PUNCH_DAMAGE = 1;

/**
 * Physics hook: while a character is dying or being knocked back, its horizontal velocity comes from here
 * instead of its input. Returns true when it took over.
 */
export function lockMotion(c: Entity): boolean {
  const k = c.combat;
  if (!k) return false;
  if (k.dead) {
    c.vel.x = 0;
    c.vel.z = 0;
    return true;
  }
  if (k.knockT > 0) {
    const f = k.knockT / KNOCK_SECONDS;
    c.vel.x = k.knockVx * f;
    c.vel.z = k.knockVz * f;
    return true;
  }
  return false;
}

/** The combat parts of an entity's public snapshot. */
export function combatView(e: Entity): {
  health?: { hp: number; max: number; bar: boolean };
  hurt?: number;
  fallen?: number;
} {
  const k = e.combat;
  if (!k) return {};
  return {
    health: { hp: k.hp, max: k.maxHp, bar: k.showBar },
    ...(k.invuln > 0 ? { hurt: Math.min(1, k.invuln / Math.max(0.01, e.hit?.invulnSeconds ?? IFRAME_SECONDS)) } : {}),
    ...(k.dead ? { fallen: Math.min(1, k.deathT / DEATH_SECONDS) } : {}),
  };
}

export interface CombatDeps {
  mode: ViewMode;
  /** Contact test between two entities (same rule the world uses for contacts). */
  touches(a: Entity, b: Entity): boolean;
  /** Removes an entity from the run. */
  hide(id: EntityId): void;
  /** Makes a character let go of everything it carries. */
  letGo(c: Entity): void;
}

export interface Combat {
  register(c: Entity, maxHp: number, showBar: boolean): void;
  heal(c: Entity, amount: number): void;
  /** Deals `damage` pushing along (dirX, dirZ). False when ignored (no health, dead, or still invulnerable). */
  strike(victim: Entity, damage: number, dirX: number, dirZ: number): boolean;
  /** Advances timers, resolves thrown items and finished deaths; call after physics. */
  update(list: readonly Entity[], dt: number): void;
  wasHurt(id: EntityId): boolean;
}

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function createCombat(deps: CombatDeps): Combat {
  /** Hits taken this tick become visible (as a one-tick pulse) after the next step. */
  let pending = new Set<EntityId>();
  let hurt = new Set<EntityId>();

  function strike(victim: Entity, damage: number, dirX: number, dirZ: number): boolean {
    const k = victim.combat;
    if (victim.kind !== 'character' || victim.seatedIn !== null) return false; // vehicles are never targets; a seated driver is shielded
    if (!k || k.dead || k.invuln > 0 || !victim.visible) return false;
    const dmg = Math.max(0, finiteOr(damage, 0));
    k.hp = Math.max(0, k.hp - dmg);
    k.invuln = Math.max(0, finiteOr(victim.hit?.invulnSeconds ?? IFRAME_SECONDS, IFRAME_SECONDS));
    pending.add(victim.id);

    // Push away along the attack direction (the side view has no depth).
    let dx = finiteOr(dirX, 0);
    let dz = deps.mode === '2d-side' ? 0 : finiteOr(dirZ, 0);
    let len = Math.hypot(dx, dz);
    if (len < 1e-6) {
      dx = victim.facing.x ? -victim.facing.x : 1;
      dz = deps.mode === '2d-side' ? 0 : -victim.facing.z;
      len = Math.hypot(dx, dz);
    }
    k.knockT = KNOCK_SECONDS;
    const knockSpeed = Math.max(0, finiteOr(victim.hit?.knockSpeed ?? KNOCK_SPEED, KNOCK_SPEED));
    k.knockVx = (dx / len) * knockSpeed;
    k.knockVz = (dz / len) * knockSpeed;
    if (deps.mode !== '2d-top') {
      victim.vel.y = Math.max(0, finiteOr(victim.hit?.knockLift ?? KNOCK_LIFT, KNOCK_LIFT));
      victim.onGround = false;
    }

    if (k.hp <= 0) {
      k.dead = true;
      k.deathT = 0;
      k.knockT = 0;
      deps.letGo(victim);
    }
    return true;
  }

  function thrownHits(list: readonly Entity[]): void {
    for (const item of list) {
      if (item.kind !== 'item' || item.thrownBy === undefined || item.thrownBy === null) continue;
      const speed = Math.hypot(item.vel.x, item.vel.y, item.vel.z);
      if (!item.visible || item.heldBy !== null || speed < THROWN_MIN_SPEED) {
        item.thrownBy = null;
        continue;
      }
      for (const victim of list) {
        if (victim.kind !== 'character' || victim.id === item.thrownBy || !victim.combat) continue;
        if (!victim.visible || victim.seatedIn !== null || victim.combat.dead || !deps.touches(item, victim)) continue;
        if (strike(victim, itemDamage(item), item.vel.x, item.vel.z)) {
          item.vel.x *= -0.2;
          item.vel.z *= -0.2;
          item.thrownBy = null;
          break;
        }
      }
    }
  }

  return {
    register(c, maxHp, showBar) {
      if (c.kind !== 'character') return;
      const max = Math.min(MAX_HP_LIMIT, Math.max(1, finiteOr(maxHp, 5)));
      if (c.combat) {
        c.combat.maxHp = max;
        c.combat.hp = Math.min(c.combat.hp, max);
        c.combat.showBar = showBar;
        return;
      }
      c.combat = { maxHp: max, hp: max, showBar, invuln: 0, knockT: 0, knockVx: 0, knockVz: 0, dead: false, deathT: 0 };
    },
    heal(c, amount) {
      const k = c.combat;
      if (!k || k.dead) return;
      k.hp = Math.min(k.maxHp, k.hp + Math.max(0, finiteOr(amount, 0)));
    },
    strike,
    update(list, dt) {
      thrownHits(list);
      for (const e of list) {
        const k = e.combat;
        if (!k) continue;
        k.invuln = Math.max(0, k.invuln - dt);
        k.knockT = Math.max(0, k.knockT - dt);
        if (k.dead) {
          k.deathT += dt;
          if (k.deathT >= DEATH_SECONDS && e.visible) deps.hide(e.id);
        }
      }
      hurt = pending;
      pending = new Set();
    },
    wasHurt: (id) => hurt.has(id),
  };
}
