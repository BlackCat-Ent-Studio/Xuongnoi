import type { Collider, ColliderDesc, RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d-deterministic-compat';
import type { Vec3, ViewMode } from '../engine/types';
import { boundsBox, boxOverlap, colliderBox } from './collider';
import { beltVelocity } from './conveyor';
import type { Entity } from './entity';
import { materialOf } from './material';
import type { RapierModule } from './rapier-loader';
import { isSolidBody } from './solid-bodies';

/**
 * Rigid-body behaviour of loose items ("crates") while "Vật lý thật" is on. A rigid-body engine (Rapier, deterministic build)
 * moves only the crates: they tip over, stack, collide with each other and slide on friction. Everything else stays under
 * the game's own rules and is only *shown* to the engine as something solid:
 *  - blocks are fixed boxes (a belt is a box that moves at its surface speed; a block a node moves is a kinematic box);
 *  - robot chassis, vehicles (and, in solid-body worlds, characters) are kinematic boxes placed where the game put them.
 * The engine reads each crate's mass and friction from its material and gravity from the world setting.
 *
 * Crates that game code moves by itself (a gripper teleporting a held crate, a piston or an arm cube pushing one) leave
 * the simulation for that tick and re-enter where they were put, so those parts keep their force limits.
 * Not an engine job (the JS bindings cannot change a contact): a belt only carries a crate by friction, and in the
 * top-down view (no gravity, so no floor contact) the floor friction and belt carry are done here by hand.
 */

const MIN_MASS_KG = 0.001;
/**
 * Engine steps per game tick. A block or robot that moves 1.7 cm in one 1/60 s step reaches a crate already inside it, and the
 * engine's way of pushing it back out adds energy (a 1 m/s hit on the top of a tall crate then tips it although the hit alone
 * cannot). At four steps the result matches the energy a hand calculation gives; it also keeps stacks steadier.
 */
const SUBSTEPS = 4;
/** Solver passes per engine step (the default is 4): enough for a stack of a few crates to stand still. */
const SOLVER_ITERATIONS = 8;
/** A downward contact normal steeper than this counts as "standing on something". */
const GROUND_NORMAL_Y = 0.5;
/** Gap (m) under a crate's bottom that still counts as resting on a surface (for a crate the engine is not moving). */
const REST_GAP = 0.03;

type Role = 'crate' | 'fixed' | 'belt' | 'kin';

interface Rec {
  role: Role;
  body: RigidBody;
  collider: Collider;
  /** Collision box size and offset from the entity position that the collider was built for. */
  size: Vec3;
  offset: Vec3;
  /** Kinematic bodies: where the body stood at the start of this tick (it travels from here to the entity's position). */
  from: Vec3;
  /** Where / how fast the engine last left the entity; a different value means game code moved it. */
  lastPos: Vec3;
  lastVel: Vec3;
  /** Crate that game code is moving: out of the simulation this tick. */
  parked: boolean;
  /** Top-down view: the height the crate lives at. */
  plane: number;
}

export interface CrateEngine {
  /** One tick: shows the world to the engine, steps it, and writes the crates' place, speed and turn back. */
  step(entities: readonly Entity[], dt: number): void;
  /** Frees the engine's memory. The engine cannot be used afterwards. */
  dispose(): void;
}

export interface CrateEngineOptions {
  mode: ViewMode;
  /** Gravity in m/s² (a positive number pulling down). */
  gravity: number;
  /** Solid-body world: characters are bodies the crates bump into. */
  solidBodies: boolean;
}

const finite3 = (v: Vec3): boolean => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const same3 = (a: Vec3, b: Vec3): boolean => a.x === b.x && a.y === b.y && a.z === b.z;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

export function createCrateEngine(rapier: RapierModule, options: CrateEngineOptions): CrateEngine {
  const { mode } = options;
  const gravity = Math.max(0, options.gravity);
  const world: World = new rapier.World({ x: 0, y: mode === '2d-top' ? 0 : -gravity, z: 0 });
  world.numSolverIterations = SOLVER_ITERATIONS;
  const recs = new Map<Entity, Rec>();
  const MAX = rapier.CoefficientCombineRule.Max;

  /** What this entity is to the engine this tick, or null when it takes no part. */
  function roleOf(e: Entity): Role | null {
    if (!e.visible || !finite3(e.pos) || !finite3(e.size)) return null;
    if (e.kind === 'item') {
      if (!e.rigid || e.bullet || e.heldBy !== null || e.inHand || !finite3(e.vel)) return null;
      return 'crate';
    }
    if (e.kind === 'block') {
      if (!e.solid) return null;
      if (e.belt && e.belt.speed !== 0 && mode !== '2d-top') return 'belt';
      return e.mover ? 'kin' : 'fixed';
    }
    if (e.kind === 'robot' || e.kind === 'vehicle') return e.solid ? 'kin' : null;
    if (e.kind === 'character') return options.solidBodies && isSolidBody(e) ? 'kin' : null;
    return null;
  }

  function colliderDesc(e: Entity, role: Role): ColliderDesc {
    const box = colliderBox(e);
    const hx = Math.max(box.size.x / 2, 1e-4);
    const hy = Math.max(box.size.y / 2, 1e-4);
    const hz = Math.max(box.size.z / 2, 1e-4);
    const ball = role === 'crate' && e.shape === 'ball';
    const desc = ball ? rapier.ColliderDesc.ball(Math.min(hx, hy, hz)) : rapier.ColliderDesc.cuboid(hx, hy, hz);
    desc.setTranslation(box.pos.x - e.pos.x, box.pos.y - e.pos.y, box.pos.z - e.pos.z);
    // Both sides use the "largest" rule, and only crates carry a friction number, so a crate's own material decides.
    desc.setFrictionCombineRule(MAX).setRestitutionCombineRule(MAX);
    if (role === 'crate') {
      const m = materialOf(e);
      desc.setMass(Math.max(m.massKg, MIN_MASS_KG)).setFriction(m.mu).setRestitution(Math.min(1, Math.max(0, e.bounce ?? 0)));
    } else {
      desc.setFriction(0).setRestitution(0);
    }
    return desc;
  }

  function bodyDesc(e: Entity, role: Role): RigidBodyDesc {
    if (role === 'fixed') return rapier.RigidBodyDesc.fixed().setTranslation(e.pos.x, e.pos.y, e.pos.z);
    if (role === 'kin') return rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(e.pos.x, e.pos.y, e.pos.z);
    if (role === 'belt') return rapier.RigidBodyDesc.kinematicVelocityBased().setTranslation(e.pos.x, e.pos.y, e.pos.z);
    const z = mode === '2d-side' ? 0 : e.pos.z;
    const desc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(e.pos.x, e.pos.y, z)
      .setRotation(e.rot ?? IDENTITY)
      .setLinvel(e.vel.x, e.vel.y, mode === '2d-side' ? 0 : e.vel.z)
      .setGravityScale(e.gravityScale ?? 1)
      // A crate that fell asleep ignores a gentle hit by a moving block or robot (the contact wakes it one tick too late),
      // and a sleeping crate's contact forces read stale. Crates never sleep: about 1.2 ms a tick for 50 crates, 4.8 ms for 200 (measured, 4 steps per tick).
      .setCanSleep(false);
    // Flat views: a crate may only turn about the axis that points out of the picture. Its out-of-plane place is put back each
    // tick instead of locked (a locked translation makes the engine's friction too weak on the remaining axes).
    if (mode === '2d-side') desc.enabledRotations(false, false, true);
    if (mode === '2d-top') desc.enabledRotations(false, true, false);
    return desc;
  }

  function create(e: Entity, role: Role): Rec {
    const body = world.createRigidBody(bodyDesc(e, role));
    const collider = world.createCollider(colliderDesc(e, role), body);
    const box = colliderBox(e);
    if (role === 'crate') {
      if (mode === '2d-side') e.pos.z = 0;
      e.rot = { ...(e.rot ?? IDENTITY) };
    }
    return {
      role,
      body,
      collider,
      size: { ...box.size },
      offset: { x: box.pos.x - e.pos.x, y: box.pos.y - e.pos.y, z: box.pos.z - e.pos.z },
      from: { ...e.pos },
      lastPos: { ...e.pos },
      lastVel: { ...e.vel },
      parked: false,
      plane: e.pos.y,
    };
  }

  function remove(e: Entity, rec: Rec): void {
    world.removeRigidBody(rec.body);
    recs.delete(e);
    // A crate that is picked up or hidden stands upright again when it comes back, unless its holder carries it turned (`heldTurn`).
    if (rec.role === 'crate' && !(e.heldBy !== null && e.heldTurn)) delete e.rot;
  }

  /** The collision box of a fixed / kinematic entity changed (a block turned, a robot resized): build a new collider. */
  function refit(e: Entity, rec: Rec): void {
    const box = colliderBox(e);
    const offset = { x: box.pos.x - e.pos.x, y: box.pos.y - e.pos.y, z: box.pos.z - e.pos.z };
    if (same3(box.size, rec.size) && same3(offset, rec.offset)) return;
    world.removeCollider(rec.collider, true);
    rec.collider = world.createCollider(colliderDesc(e, rec.role), rec.body);
    rec.size = { ...box.size };
    rec.offset = offset;
  }

  function syncScenery(e: Entity, rec: Rec): void {
    refit(e, rec);
    if (rec.role === 'kin') {
      rec.from = { ...rec.lastPos };
    } else if (rec.role === 'belt') {
      // The belt does not travel: it is put back before every engine step and only lends its surface speed to what rests on it.
      const v = beltVelocity(e);
      rec.body.setTranslation(e.pos, false);
      rec.body.setLinvel({ x: v.x, y: 0, z: v.z }, true);
    } else if (!same3(e.pos, rec.lastPos)) {
      rec.body.setTranslation(e.pos, true);
    }
    rec.lastPos = { ...e.pos };
  }

  function syncCrate(e: Entity, rec: Rec): void {
    if (!same3(e.pos, rec.lastPos)) {
      // Game code put it somewhere (a gripper, a piston, a portal): out of the simulation while it is being moved.
      if (!rec.parked) {
        rec.body.setEnabled(false);
        rec.parked = true;
      }
      rec.lastPos = { ...e.pos };
      rec.lastVel = { ...e.vel };
      return;
    }
    if (rec.parked) {
      rec.body.setEnabled(true);
      rec.body.setTranslation(e.pos, true);
      // Game code may have turned it while it held it (a gripper keeps the turn relative to the hand): it comes back turned that way.
      rec.body.setRotation(e.rot ?? IDENTITY, true);
      rec.body.setLinvel({ x: e.vel.x, y: e.vel.y, z: mode === '2d-side' ? 0 : e.vel.z }, true);
      rec.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rec.parked = false;
    } else if (!same3(e.vel, rec.lastVel)) {
      rec.body.setLinvel({ x: e.vel.x, y: e.vel.y, z: mode === '2d-side' ? 0 : e.vel.z }, true);
    }
    rec.lastVel = { ...e.vel };
  }

  /** Top-down view only: floor friction (a = μ·g against the surface under the crate, which may be a belt) done by hand. */
  function floorFriction(e: Entity, rec: Rec, belts: readonly Entity[], dt: number): void {
    let sx = 0;
    let sz = 0;
    for (const b of belts) {
      if (boxOverlap(e, b, 'x') > 1e-6 && boxOverlap(e, b, 'z') > 1e-6) {
        const v = beltVelocity(b);
        sx = v.x;
        sz = v.z;
        break;
      }
    }
    const v = rec.body.linvel();
    const ux = v.x - sx;
    const uz = v.z - sz;
    const speed = Math.hypot(ux, uz);
    if (speed === 0) return;
    const slow = materialOf(e).mu * gravity * dt;
    const k = speed <= slow ? 0 : (speed - slow) / speed;
    rec.body.setLinvel({ x: sx + ux * k, y: 0, z: sz + uz * k }, true);
  }

  /** True when something solid lies right under the crate's bottom face (for a crate the engine is not moving). */
  function restsOnSomething(e: Entity, entities: readonly Entity[]): boolean {
    const me = boundsBox(e);
    const bottom = me.pos.y - me.size.y / 2;
    for (const o of entities) {
      if (o === e || !o.visible || o.heldBy !== null || o.bullet) continue;
      if (!(o.kind === 'block' ? o.solid : o.kind === 'item' ? o.rigid === true : o.kind === 'robot' || o.kind === 'vehicle' ? o.solid : false)) continue;
      const b = boundsBox(o);
      if (Math.abs(bottom - (b.pos.y + b.size.y / 2)) > REST_GAP) continue;
      if (boxOverlap(e, o, 'x') > 1e-6 && boxOverlap(e, o, 'z') > 1e-6) return true;
    }
    return false;
  }

  /** Flat views: puts a crate back into the picture's plane (and stops any drift out of it) after an engine step. */
  function flatten(rec: Rec): void {
    const p = rec.body.translation();
    const v = rec.body.linvel();
    if (mode === '2d-side') {
      if (p.z !== 0) rec.body.setTranslation({ x: p.x, y: p.y, z: 0 }, false);
      if (v.z !== 0) rec.body.setLinvel({ x: v.x, y: v.y, z: 0 }, false);
    } else if (p.y !== rec.plane || v.y !== 0) {
      rec.body.setTranslation({ x: p.x, y: rec.plane, z: p.z }, false);
      rec.body.setLinvel({ x: v.x, y: 0, z: v.z }, false);
    }
  }

  function standing(rec: Rec): boolean {
    let found = false;
    world.contactPairsWith(rec.collider, (other) => {
      if (found) return;
      world.contactPair(rec.collider, other, (m, flipped) => {
        if (m.numContacts() === 0) return;
        const ny = m.normal().y * (flipped ? -1 : 1);
        if (ny < -GROUND_NORMAL_Y) found = true;
      });
    });
    return found;
  }

  function writeBack(e: Entity, rec: Rec, entities: readonly Entity[]): void {
    if (rec.parked) {
      e.onGround = restsOnSomething(e, entities);
      return;
    }
    const p = rec.body.translation();
    const v = rec.body.linvel();
    const q = rec.body.rotation();
    e.pos.x = p.x;
    e.pos.y = p.y;
    e.pos.z = mode === '2d-side' ? 0 : p.z;
    e.vel.x = v.x;
    e.vel.y = v.y;
    e.vel.z = mode === '2d-side' ? 0 : v.z;
    e.rot = { x: q.x, y: q.y, z: q.z, w: q.w };
    e.onGround = mode === '2d-top' ? false : standing(rec);
    rec.lastPos = { ...e.pos };
    rec.lastVel = { ...e.vel };
  }

  return {
    step(entities, dt) {
      world.timestep = dt / SUBSTEPS;
      const live = new Set<Entity>();
      const belts: Entity[] = [];
      for (const e of entities) {
        const role = roleOf(e);
        if (role === null) continue;
        let rec = recs.get(e);
        if (rec && rec.role !== role) {
          remove(e, rec);
          rec = undefined;
        }
        if (!rec) {
          rec = create(e, role);
          recs.set(e, rec);
        } else if (role === 'crate') syncCrate(e, rec);
        else syncScenery(e, rec);
        live.add(e);
      }
      for (const [e, rec] of [...recs]) if (!live.has(e)) remove(e, rec);
      // Top view: belts are floor strips (not solid bodies), so the engine does not know them; they carry by hand here.
      if (mode === '2d-top') {
        for (const e of entities) {
          if (e.kind === 'block' && e.visible && e.belt && e.belt.speed !== 0) belts.push(e);
        }
        for (const [e, rec] of recs) if (rec.role === 'crate' && !rec.parked) floorFriction(e, rec, belts, dt);
      }
      for (let k = 1; k <= SUBSTEPS; k++) {
        const t = k / SUBSTEPS;
        for (const [e, rec] of recs) {
          if (rec.role === 'kin') {
            rec.body.setNextKinematicTranslation({
              x: rec.from.x + (e.pos.x - rec.from.x) * t,
              y: rec.from.y + (e.pos.y - rec.from.y) * t,
              z: rec.from.z + (e.pos.z - rec.from.z) * t,
            });
          } else if (rec.role === 'belt' && k > 1) {
            rec.body.setTranslation(e.pos, false);
          }
        }
        world.step();
        if (mode !== '3d') for (const rec of recs.values()) if (rec.role === 'crate' && !rec.parked) flatten(rec);
      }
      for (const [e, rec] of recs) if (rec.role === 'crate') writeBack(e, rec, entities);
    },
    dispose() {
      recs.clear();
      world.free();
    },
  };
}
