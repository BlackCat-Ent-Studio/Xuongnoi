import type { Collider, ColliderDesc, RigidBody, RigidBodyDesc, World } from '@dimforge/rapier3d-deterministic-compat';
import type { ExactBody, Vec3, ViewMode } from '../engine/types';
import { boundsBox, boxOverlap, chassisOutline, colliderBox, overOutline, type Box } from './collider';
import { yawQuat } from './oriented-box';
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
 *    A chassis is shown as its real outline (length by width) turned to its heading, so a crate meets the corner that is drawn.
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
  /** A chassis shown by its real outline: its turn at the start of this tick and the one the game wants at its end. Null = shown upright. */
  fromTurn: Quat | null;
  turn: Quat | null;
  /** Where / how fast the engine last left the entity; a different value means game code moved it. */
  lastPos: Vec3;
  lastVel: Vec3;
  /** Crate that game code is moving: out of the simulation this tick. */
  parked: boolean;
  /** Top-down view: the height the crate lives at. */
  plane: number;
}

/** A turned kinematic box an arm piece or hand shows to the engine (see `WorldApi.setExactBodies`). */
interface ExactRec {
  body: RigidBody;
  collider: Collider;
  size: Vec3;
  /** Where the box stood at the start of this tick, and where / how turned the game wants it at the end. */
  from: Vec3;
  fromRot: Quat;
  to: Vec3;
  toRot: Quat;
}

type Quat = { x: number; y: number; z: number; w: number };

/** The angle (rad) of a turn about the vertical. */
const yawOf = (q: Quat): number => 2 * Math.atan2(q.y, q.w);

/** An angle brought into -pi .. pi. */
function wrapPi(a: number): number {
  const two = Math.PI * 2;
  const d = a % two;
  return d > Math.PI ? d - two : d <= -Math.PI ? d + two : d;
}

/** Normalised linear mix of two turns (the hand turns a degree or two per tick, so this is as good as a slerp). */
function mixTurn(a: Quat, b: Quat, t: number): Quat {
  const sign = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
  const x = a.x + (sign * b.x - a.x) * t;
  const y = a.y + (sign * b.y - a.y) * t;
  const z = a.z + (sign * b.z - a.z) * t;
  const w = a.w + (sign * b.w - a.w) * t;
  const n = Math.hypot(x, y, z, w) || 1;
  return { x: x / n, y: y / n, z: z / n, w: w / n };
}

export interface CrateEngine {
  /** One tick: shows the world to the engine, steps it, and writes the crates' place, speed and turn back. */
  step(entities: readonly Entity[], dt: number): void;
  /** Declares the exact boxes of an arm piece or hand for this tick (see `WorldApi.setExactBodies`); null drops them. */
  setExact(owner: string, bodies: readonly ExactBody[] | null): void;
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
const sameTurn = (a: Quat, b: Quat): boolean => a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;

export function createCrateEngine(rapier: RapierModule, options: CrateEngineOptions): CrateEngine {
  const { mode } = options;
  const gravity = Math.max(0, options.gravity);
  const world: World = new rapier.World({ x: 0, y: mode === '2d-top' ? 0 : -gravity, z: 0 });
  world.numSolverIterations = SOLVER_ITERATIONS;
  const recs = new Map<Entity, Rec>();
  const MAX = rapier.CoefficientCombineRule.Max;
  /** Exact boxes declared by arm pieces: the tick they were declared in and the boxes. The owner's upright cover cubes then stay out of the engine. */
  const declared = new Map<string, { tick: number; bodies: readonly ExactBody[] }>();
  const exactRecs = new Map<string, ExactRec[]>();
  /** Engine ticks run so far: a declaration is fresh during the step of the tick it was made in. */
  let ticks = 0;
  let freshOwners = new Set<string>();

  /** What this entity is to the engine this tick, or null when it takes no part. */
  function roleOf(e: Entity): Role | null {
    if (!e.visible || !finite3(e.pos) || !finite3(e.size)) return null;
    if (e.kind === 'item') {
      if (!e.rigid || e.bullet || e.heldBy !== null || e.inHand || !finite3(e.vel)) return null;
      return 'crate';
    }
    if (e.kind === 'block') {
      if (!e.solid || freshOwners.has(e.ownerNodeId)) return null;
      if (e.belt && e.belt.speed !== 0 && mode !== '2d-top') return 'belt';
      return e.mover ? 'kin' : 'fixed';
    }
    if (e.kind === 'robot' || e.kind === 'vehicle') return e.solid ? 'kin' : null;
    if (e.kind === 'character') return options.solidBodies && isSolidBody(e) ? 'kin' : null;
    return null;
  }

  /** The box the engine is shown for an entity: its collision box, or for a chassis its real outline (turned by `turnOf`). */
  function shownBox(e: Entity, role: Role): Box {
    const outline = role === 'kin' ? chassisOutline(e) : null;
    return outline ? { pos: e.pos, size: { x: outline.half.x * 2, y: outline.half.y * 2, z: outline.half.z * 2 } } : colliderBox(e);
  }

  /** The turn of a chassis shown by its real outline; null for every other body (shown upright). */
  const turnOf = (e: Entity, role: Role): Quat | null => (role === 'kin' && chassisOutline(e) ? yawQuat(e.facing) : null);

  function colliderDesc(e: Entity, role: Role): ColliderDesc {
    const box = shownBox(e, role);
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
    if (role === 'kin') {
      const desc = rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(e.pos.x, e.pos.y, e.pos.z);
      const turn = turnOf(e, role);
      return turn ? desc.setRotation(turn) : desc;
    }
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
    const box = shownBox(e, role);
    const turn = turnOf(e, role);
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
      fromTurn: turn,
      turn,
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
    const box = shownBox(e, rec.role);
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
      rec.fromTurn = rec.turn;
      rec.turn = turnOf(e, rec.role);
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
    if (e.grippedBy !== undefined || !same3(e.pos, rec.lastPos)) {
      // Game code put it somewhere (a gripper, a piston, a portal): out of the simulation while it is being moved. A crate the
      // gripper holds stays out for as long as it holds it, even on a tick the hand has not moved it.
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
      // The fingers and palm that hold the crate do not carry it.
      if (e.grippedBy !== undefined && o.ownerNodeId === e.grippedBy) continue;
      if (!(o.kind === 'block' ? o.solid : o.kind === 'item' ? o.rigid === true : o.kind === 'robot' || o.kind === 'vehicle' ? o.solid : false)) continue;
      const b = boundsBox(o);
      if (Math.abs(bottom - (b.pos.y + b.size.y / 2)) > REST_GAP) continue;
      const outline = chassisOutline(o);
      if (outline ? overOutline(me, outline, 1e-6) : boxOverlap(e, o, 'x') > 1e-6 && boxOverlap(e, o, 'z') > 1e-6) return true;
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

  /**
   * Makes the engine work out afresh where a turning chassis touches what stands on it.
   *
   * Why: for two bodies that do not move against each other the engine keeps the contact it worked out before, and with it
   * where the touching points lay in the world at that time. A crate riding on a chassis that turns is such a pair, and it
   * swings those points round the chassis's middle. Friction then aims the crate at the speed the deck had where the crate
   * *was*, so the crate leaves along a line that points outwards. Measured in a bare scene (one turning plate, one cube on
   * it): the cube moves outwards by 0.096 x its distance from the plate's middle per radian turned, the same for any step
   * size, solver passes, friction, mass and turn speed; with the contact worked out afresh every step it keeps its place
   * (what is left is the step error, 0.0006 x that distance per radian at 1 rad/s).
   * Setting the box's place on its body again, to the same value, is what marks the contact as changed.
   */
  function refreshContacts(rec: Rec): void {
    rec.collider.setTranslationWrtParent(rec.offset);
  }

  /**
   * A chassis that turns in this tick, as the engine is shown it: it goes from where it stood to where the game put it along
   * the arc of one steady turn (about `pivot`, by `angle`), cut into the engine's steps.
   *
   * Why an arc: cut into straight pieces, the deck would keep one speed for a whole tick and change it at once at the next, and
   * a crate on a chassis that drives round a bend would need all the friction of that bend in one engine step. It then slips
   * a little every tick (measured in a bare scene, 1 m/s round a 1.3 m bend: 1.2 mm outwards per radian). Along the arc the
   * change is spread over the steps and it does not slip (0.02 mm per radian).
   */
  interface Arc {
    e: Entity;
    /** The turn of the whole tick about the vertical (rad). */
    angle: number;
    /** From the point it turns about to where it stood at the start of the tick (ground plane). */
    arm: { x: number; z: number };
    /** Where its middle stood before the engine step just made, and the ground speed (m/s) it had in that step. */
    at: { x: number; z: number };
    vel: { x: number; z: number };
  }
  const turning = new Map<Rec, Arc>();
  /** The crates in the simulation by the handle of their box (filled only in a tick in which a chassis turns). */
  const crateByHandle = new Map<number, { e: Entity; rec: Rec }>();

  function arcOf(e: Entity, rec: Rec): Arc {
    const angle = wrapPi(yawOf(rec.turn!) - yawOf(rec.fromTurn!));
    const dx = e.pos.x - rec.from.x;
    const dz = e.pos.z - rec.from.z;
    // Turning (x, z) by `angle` about the vertical gives (x cos + z sin, z cos - x sin). The arm that this turn takes from the
    // start to the end of the tick's move (dx, dz):
    const k = Math.abs(angle) > 1e-9 ? 1 / Math.tan(angle / 2) : 0;
    const arm = k !== 0 ? { x: -(dx + k * dz) / 2, z: -(dz - k * dx) / 2 } : { x: 0, z: 0 };
    return { e, angle, arm, at: { x: rec.from.x, z: rec.from.z }, vel: { x: 0, z: 0 } };
  }

  /** Where the middle of a turning chassis stands after share `t` of its tick (the end of the tick is exactly where the game put it). */
  function arcPoint(rec: Rec, arc: Arc, t: number): Vec3 {
    const e = arc.e;
    const y = rec.from.y + (e.pos.y - rec.from.y) * t;
    const finiteArm = Number.isFinite(arc.arm.x) && Number.isFinite(arc.arm.z) && (arc.arm.x !== 0 || arc.arm.z !== 0);
    if (t >= 1 || !finiteArm) return { x: rec.from.x + (e.pos.x - rec.from.x) * t, y, z: rec.from.z + (e.pos.z - rec.from.z) * t };
    const c = Math.cos(arc.angle * t) - 1;
    const s = Math.sin(arc.angle * t);
    return { x: rec.from.x + c * arc.arm.x + s * arc.arm.z, y, z: rec.from.z + c * arc.arm.z - s * arc.arm.x };
  }

  /**
   * After an engine step in which a chassis turned: the crates that static friction holds on its deck follow the arc the deck
   * made under them, not the straight line the engine moved them along.
   *
   * Why: the engine gives such a crate the speed of the deck under it and moves it straight on for the whole step, while the
   * deck itself goes round. Each step ends the crate a little further from the middle of the chassis than the deck under it:
   * by (1 - cos of the angle turned) x its distance from that middle, 0.6 mm per radian for a crate 0.3 m out at 1 rad/s.
   * That bit is taken back here, and nothing else is touched (speed, height, turn and every contact stay the engine's).
   * Only for a crate that stands on the deck and does not slide on it: the speed it has against the deck under it is no more
   * than its friction can take away in one step (mu x g x step). A crate that slides, because the turn is too hard for its
   * friction or because a wall or a hand holds it back, is left alone.
   */
  function followArc(chassis: Rec, arc: Arc, dt: number): void {
    const step = dt / SUBSTEPS;
    const angle = arc.angle / SUBSTEPS;
    const back = 1 - Math.cos(angle);
    const spin = angle / step;
    const middle = chassis.body.translation();
    world.contactPairsWith(chassis.collider, (other) => {
      const crate = crateByHandle.get(other.handle);
      if (!crate) return;
      let stands = false;
      world.contactPair(crate.rec.collider, chassis.collider, (m, flipped) => {
        if (m.numContacts() > 0 && m.normal().y * (flipped ? -1 : 1) < -GROUND_NORMAL_Y) stands = true;
      });
      if (!stands) return;
      const body = crate.rec.body;
      const p = body.translation();
      const v = body.linvel();
      const rx = p.x - middle.x;
      const rz = p.z - middle.z;
      // The deck under the crate moves with the chassis's own speed plus its turn rate across the arm to the crate.
      const slide = Math.hypot(v.x - (arc.vel.x + spin * rz), v.z - (arc.vel.z - spin * rx));
      if (!(slide <= materialOf(crate.e).mu * gravity * (crate.e.gravityScale ?? 1) * step)) return;
      body.setTranslation({ x: p.x - back * rx, y: p.y, z: p.z - back * rz }, false);
    });
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

  function exactCollider(size: Vec3): ColliderDesc {
    return rapier.ColliderDesc.cuboid(Math.max(size.x / 2, 1e-4), Math.max(size.y / 2, 1e-4), Math.max(size.z / 2, 1e-4))
      .setFriction(0)
      .setRestitution(0)
      .setFrictionCombineRule(MAX)
      .setRestitutionCombineRule(MAX);
  }

  /** Brings the engine's turned boxes in line with what the arm pieces declared this tick (new, moved, resized, gone). */
  function syncExact(): void {
    for (const owner of [...exactRecs.keys()]) {
      if (freshOwners.has(owner)) continue;
      for (const r of exactRecs.get(owner)!) world.removeRigidBody(r.body);
      exactRecs.delete(owner);
    }
    for (const owner of freshOwners) {
      const list = declared.get(owner)!.bodies;
      let recs = exactRecs.get(owner);
      if (!recs) exactRecs.set(owner, (recs = []));
      while (recs.length > list.length) world.removeRigidBody(recs.pop()!.body);
      list.forEach((b, i) => {
        const ok = finite3(b.centre) && finite3(b.size) && [b.rot.x, b.rot.y, b.rot.z, b.rot.w].every(Number.isFinite);
        if (!ok) return;
        const rot = b.rot;
        let rec = recs![i];
        if (!rec) {
          const body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(b.centre.x, b.centre.y, b.centre.z).setRotation(rot));
          const collider = world.createCollider(exactCollider(b.size), body);
          rec = { body, collider, size: { ...b.size }, from: { ...b.centre }, fromRot: rot, to: { ...b.centre }, toRot: rot };
          recs![i] = rec;
          return;
        }
        if (!same3(b.size, rec.size)) {
          world.removeCollider(rec.collider, true);
          rec.collider = world.createCollider(exactCollider(b.size), rec.body);
          rec.size = { ...b.size };
        }
        rec.from = rec.to;
        rec.fromRot = rec.toRot;
        rec.to = { ...b.centre };
        rec.toRot = rot;
      });
    }
  }

  return {
    setExact(owner, bodies) {
      if (bodies === null) declared.delete(owner);
      else declared.set(owner, { tick: ticks, bodies });
    },
    step(entities, dt) {
      world.timestep = dt / SUBSTEPS;
      freshOwners = new Set([...declared].filter(([, d]) => d.tick === ticks).map(([k]) => k));
      for (const [k, d] of declared) if (d.tick < ticks) declared.delete(k);
      syncExact();
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
      turning.clear();
      for (const [e, rec] of recs) if (rec.role === 'kin' && rec.turn && rec.fromTurn && !sameTurn(rec.fromTurn, rec.turn)) turning.set(rec, arcOf(e, rec));
      if (turning.size > 0) {
        crateByHandle.clear();
        for (const [e, rec] of recs) if (rec.role === 'crate' && !rec.parked) crateByHandle.set(rec.collider.handle, { e, rec });
      }
      for (let k = 1; k <= SUBSTEPS; k++) {
        const t = k / SUBSTEPS;
        for (const [e, rec] of recs) {
          if (rec.role === 'kin') {
            const arc = turning.get(rec);
            if (arc) {
              const to = arcPoint(rec, arc, t);
              arc.vel = { x: ((to.x - arc.at.x) * SUBSTEPS) / dt, z: ((to.z - arc.at.z) * SUBSTEPS) / dt };
              arc.at = { x: to.x, z: to.z };
              rec.body.setNextKinematicTranslation(to);
              rec.body.setNextKinematicRotation(mixTurn(rec.fromTurn!, rec.turn!, t));
              refreshContacts(rec);
              continue;
            }
            rec.body.setNextKinematicTranslation({
              x: rec.from.x + (e.pos.x - rec.from.x) * t,
              y: rec.from.y + (e.pos.y - rec.from.y) * t,
              z: rec.from.z + (e.pos.z - rec.from.z) * t,
            });
            if (rec.turn) rec.body.setNextKinematicRotation(rec.fromTurn ? mixTurn(rec.fromTurn, rec.turn, t) : rec.turn);
          } else if (rec.role === 'belt' && k > 1) {
            rec.body.setTranslation(e.pos, false);
          }
        }
        for (const owner of freshOwners) {
          for (const r of exactRecs.get(owner) ?? []) {
            r.body.setNextKinematicTranslation({ x: r.from.x + (r.to.x - r.from.x) * t, y: r.from.y + (r.to.y - r.from.y) * t, z: r.from.z + (r.to.z - r.from.z) * t });
            r.body.setNextKinematicRotation(mixTurn(r.fromRot, r.toRot, t));
          }
        }
        world.step();
        for (const [rec, arc] of turning) followArc(rec, arc, dt);
        if (mode !== '3d') for (const rec of recs.values()) if (rec.role === 'crate' && !rec.parked) flatten(rec);
      }
      for (const [e, rec] of recs) if (rec.role === 'crate') writeBack(e, rec, entities);
      ticks++;
    },
    dispose() {
      exactRecs.clear();
      declared.clear();
      recs.clear();
      world.free();
    },
  };
}
