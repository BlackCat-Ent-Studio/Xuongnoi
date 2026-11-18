import type { EntityId, EntityView, NodeDef, Vec3, ViewMode, WorldApi } from '../engine/types';
import { dirOf, localToWorld, type Frame } from '../world/arm-kinematics';
import { actuatorFrame, approach, exceeds, loadLimitedAdvance, planPush, RIGID_CONTACT_SKIN, RIGID_CROSS_TOL, targetLength, type PushBody, type PushMove, type PushOrient } from '../world/linear-actuator';
import { isTurnedView, obbBounds, obbOfView } from '../world/oriented-box';
import { armRegistry, baseFrame, placeBox } from './arm-parts';
import { setArmHint } from '../engine/render-hints';
import { asBool, asObject, clamp, numParam, strParam, vec3Param } from './util';

interface PistonState {
  /** The solid pusher head: what pushes, and the handle the `tip` output carries. */
  head: EntityId;
  /** Drawn only: the fixed barrel and the sliding rod. */
  housing: EntityId;
  rod: EntityId;
  /** How far the rod is out of the barrel, in metres. */
  len: number;
  /** False until the head has been set onto its mount once (that first jump is a placement, not a push). */
  placed: boolean;
  /** Speed (m/s) at which the head pushed a rigid crate last tick; 0 when it was not pushing one. */
  loadSpeed: number;
}

/** Length of the barrel (m): long enough to hold the whole rod when it is retracted. */
const barrelLen = (stroke: number): number => stroke + 0.2;
/** Share of the barrel length the rod itself is long. */
const ROD_SHARE = 0.9;
const housingThick = (head: number): number => clamp(head * 0.7, 0.15, 0.6);
/** The head never moves more than this in one go, so a fast rod cannot skip over a thin body. */
const MAX_SUB_STEP = 0.1;
/** Within this of an end the rod counts as fully in or out (m). */
const END_TOL = 1e-4;

const orientOf = (v: string): PushOrient => (v === 'up' || v === 'down' ? v : 'ground');
const flatOf = (mode: ViewMode): 'y' | 'z' | null => (mode === '2d-top' ? 'y' : mode === '2d-side' ? 'z' : null);

function vecDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Where the head's centre is when the rod is out by `len`. */
function headCentre(frame: Frame, len: number, head: number, stroke: number): Vec3 {
  return localToWorld(frame, { x: barrelLen(stroke) + len + head / 2, y: 0, z: 0 });
}

function boxOf(e: EntityView): { pos: Vec3; size: Vec3 } {
  return e.collider ? { pos: e.collider.position, size: e.collider.size } : { pos: e.position, size: e.size };
}

/**
 * Every loose body in the world that a head can shove (anything with a material that is not a block, carried or seated).
 * `except` is the body the pusher is mounted on: a pusher never pushes what it stands on.
 * A rigid crate (real physics on) comes with its real, possibly turned, outline: it can tip, and its box is the bounds of that outline.
 */
export function pushBodiesOf(world: WorldApi, except: EntityId | null = null): PushBody[] {
  const bodies: PushBody[] = [];
  for (const e of world.listEntities()) {
    if (e.id === except || e.kind === 'block' || !e.visible || e.carried || e.inHand || e.seatedIn !== undefined) continue;
    const mat = world.materialOf(e.id);
    if (!mat) continue;
    const base = { id: e.id, massKg: mat.massKg, mu: mat.mu };
    if (!world.isRigidCrate(e.id)) {
      bodies.push({ ...base, box: boxOf(e) });
      continue;
    }
    const real = obbOfView(e);
    bodies.push({ ...base, box: isTurnedView(e) ? obbBounds(real) : boxOf(e), crossTol: RIGID_CROSS_TOL, skin: RIGID_CONTACT_SKIN, ...(e.shape === 'ball' ? {} : { real }) });
  }
  return bodies;
}

/**
 * Puts the bodies a push plan moved where it says. A rigid crate (real physics on) is not displaced: the plan only decided
 * whether the pusher has the force and room to go on, and the head's own motion pushes the crate through the engine.
 */
export function shoveBodies(world: WorldApi, moves: readonly PushMove[]): void {
  for (const m of moves) {
    const e = world.getEntity(m.id);
    if (!e || world.isRigidCrate(m.id)) continue;
    world.teleport(m.id, { x: e.position.x + m.delta.x, y: e.position.y + m.delta.y, z: e.position.z + m.delta.z }, false);
  }
}

interface FollowResult {
  /** Part of the base's motion the head could not follow (a vector from the wanted place back to where the head is). */
  short: Vec3;
  /** Force (N) the chassis pushed with, the most it could give when it stalled or was blocked. */
  forceN: number;
  /** True when a load needed more than the chassis can push with. */
  stalled: boolean;
}

/**
 * The head follows a robot chassis it is bolted to. The chassis motion is a push like any other: loads in the way need
 * the drive force of the wheels (the same rule as a chassis shoving items), and the head never enters a solid. What the
 * head cannot follow is returned, so the caller can hold the chassis back (the rod is rigid).
 */
function followChassis(world: WorldApi, headId: EntityId, baseId: EntityId, want: Vec3, mode: ViewMode): FollowResult | null {
  const head = world.getEntity(headId);
  if (!head) return null;
  const have = boxOf(head).pos;
  const d = { x: want.x - have.x, y: want.y - have.y, z: want.z - have.z };
  const dist = Math.hypot(d.x, d.y, d.z);
  if (dist < 1e-9) return null;
  const dir = { x: d.x / dist, y: d.y / dist, z: d.z / dist };
  const heading = world.getEntity(baseId)?.robot?.heading ?? 0;
  const travel = mode === '2d-side' ? d.x : d.x * Math.cos(heading) + d.z * Math.sin(heading);
  const availableN = world.robotPushN(baseId, travel);
  const subs = Math.max(1, Math.ceil(dist / MAX_SUB_STEP));
  let moved = 0;
  let forceN = 0;
  let stalled = false;
  for (let k = 0; k < subs; k++) {
    const now = world.getEntity(headId);
    if (!now) break;
    const plan = planPush({
      head: boxOf(now),
      dir,
      step: dist / subs,
      bodies: pushBodiesOf(world, baseId),
      solids: world.solidBoxes().map((b) => ({ pos: b.position, size: b.size })),
      flat: flatOf(mode),
      lifting: dir.y > 0.5,
    });
    if (exceeds(plan.requiredN, availableN)) {
      stalled = true;
      forceN = availableN;
      break;
    }
    shoveBodies(world, plan.moves);
    forceN = Math.max(forceN, plan.requiredN);
    const at = boxOf(now).pos;
    world.moveBlock(headId, { x: at.x + dir.x * plan.advance, y: at.y + dir.y * plan.advance, z: at.z + dir.z * plan.advance });
    moved += plan.advance;
    if (plan.blocked) {
      forceN = availableN;
      break;
    }
  }
  const left = Math.max(0, dist - moved);
  return { short: { x: dir.x * left, y: dir.y * left, z: dir.z * left }, forceN, stalled };
}

export const linearActuatorNode: NodeDef<PistonState> = {
  kind: 'linear-actuator',
  label: 'Xi lanh đẩy',
  labelEn: 'Linear Actuator / Piston',
  category: 'action',
  description:
    'Xi lanh đẩy: thanh ra vào theo "Hành trình", đầu thanh là khối rắn đẩy mọi vật nằm trước nó. Cần lực F = Σ μ × m × 9,81; lớn hơn "Lực đẩy tối đa" thì thanh đứng lại và "Quá tải" bật; gặp tường thì dừng sát, rút về không kéo vật theo. Phải nối "Đẩy ra" (hoặc "Vị trí đặt" từ 0 tới 1) thì mới chạy; chưa nối "Gắn vào" thì xi lanh đứng cố định ở "Vị trí" trong thế giới.',
  inputs: [
    { id: 'base', type: 'object', label: 'Gắn vào' },
    { id: 'extend', type: 'bool', label: 'Đẩy ra' },
    { id: 'position', type: 'number', label: 'Vị trí đặt', default: Number.NaN },
  ],
  outputs: [
    { id: 'tip', type: 'object', label: 'Đầu đẩy' },
    { id: 'positionNow', type: 'number', label: 'Vị trí' },
    { id: 'extended', type: 'bool', label: 'Đã ra hết' },
    { id: 'retracted', type: 'bool', label: 'Đã thu về' },
    { id: 'force', type: 'number', label: 'Lực đang đẩy' },
    { id: 'overloaded', type: 'bool', label: 'Quá tải' },
  ],
  params: [
    { id: 'position', label: 'Vị trí (khi chưa gắn vào vật nào)', kind: 'vec3', default: { x: 0, y: 0.3, z: 0 } },
    { id: 'direction', label: 'Hướng đẩy (độ, trên mặt phẳng nằm)', kind: 'number', default: 0, min: -360, max: 360, step: 15 },
    {
      id: 'orient',
      label: 'Hướng thẳng đứng',
      kind: 'select',
      default: 'ground',
      options: [
        { value: 'ground', label: 'Nằm ngang (theo hướng đẩy)' },
        { value: 'up', label: 'Đẩy lên' },
        { value: 'down', label: 'Đẩy xuống' },
      ],
    },
    { id: 'stroke', label: 'Hành trình (m)', kind: 'number', default: 2, min: 0.1, max: 50, step: 0.1 },
    { id: 'maxForce', label: 'Lực đẩy tối đa (N)', kind: 'number', default: 100, min: 0, max: 1000000, step: 10 },
    { id: 'speed', label: 'Tốc độ (m/s)', kind: 'number', default: 1, min: 0.05, max: 50, step: 0.05 },
    { id: 'headSize', label: 'Cỡ đầu đẩy (m)', kind: 'number', default: 0.6, min: 0.1, max: 5, step: 0.1 },
    { id: 'mount', label: 'Lệch so với vật gắn (dọc / lên / ngang, m)', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, advanced: true },
    { id: 'color', label: 'Màu', kind: 'color', default: '#0ea5e9', advanced: true },
  ],
  createOnly: ['headSize', 'stroke'],
  liveApply: {
    color: (ctx, p, s) => {
      for (const id of [s.head, s.housing, s.rod]) ctx.world.setEntityStyle(id, { color: String(p.color) });
    },
  },
  create(ctx, params) {
    const size = Math.max(0.1, numParam(params, 'headSize', 0.6));
    const color = strParam(params, 'color', '#0ea5e9');
    const stroke = Math.max(0.1, numParam(params, 'stroke', 2));
    const frame = actuatorFrame(
      { pos: vec3Param(params, 'position', { x: 0, y: 0.3, z: 0 }), yaw: 0, pitch: 0 },
      numParam(params, 'direction', 0),
      orientOf(strParam(params, 'orient', 'ground')),
      ctx.mode,
    );
    // The head starts where it will sit when retracted, so an unmounted piston does not sweep across the world on its first tick.
    const head = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: headCentre(frame, 0, size, stroke),
      size: { x: size, y: size, z: size },
      color,
      solid: true,
    });
    const part = (length: number, thick: number): EntityId =>
      ctx.world.spawn({ kind: 'block', ownerNodeId: ctx.nodeId, position: { x: 0, y: -1000, z: 0 }, size: { x: length, y: thick, z: thick }, color, solid: false });
    const barrel = barrelLen(stroke);
    const thick = housingThick(size);
    const housing = part(barrel, thick);
    const rod = part(barrel * ROD_SHARE, thick * 0.4);
    setArmHint(ctx.nodeId, head, { part: 'head' });
    setArmHint(ctx.nodeId, housing, { part: 'housing' });
    setArmHint(ctx.nodeId, rod, { part: 'rod' });
    return { head, housing, rod, len: 0, placed: false, loadSpeed: 0 };
  },
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const reg = armRegistry(world);
    const baseId = asObject(i.base);
    const idle = { tip: null, positionNow: s.len, extended: false, retracted: s.len <= END_TOL, force: 0, overloaded: false };
    let origin: Frame | null;
    if (baseId === null) origin = { pos: vec3Param(params, 'position', { x: 0, y: 0.3, z: 0 }), yaw: 0, pitch: 0 };
    else origin = baseFrame(ctx, baseId, vec3Param(params, 'mount', { x: 0, y: 0, z: 0 }));
    if (!origin) {
      reg.parts.delete(ctx.nodeId);
      reg.frames.delete(s.head);
      return idle;
    }
    const orient = orientOf(strParam(params, 'orient', 'ground'));
    let frame = actuatorFrame(origin, numParam(params, 'direction', 0), orient, ctx.mode);
    const dir = dirOf(frame);
    const headSize = Math.max(0.1, numParam(params, 'headSize', 0.6));
    const stroke = Math.max(0.1, numParam(params, 'stroke', 2));
    const maxForce = Math.max(0, numParam(params, 'maxForce', 100));
    const speed = Math.max(0, numParam(params, 'speed', 1));

    /** Rod length read back from where the head really is (a blocked or squeezed move leaves it short). */
    const lenOfHead = (): number => {
      const h = world.getEntity(s.head);
      if (!h) return s.len;
      const along = vecDot({ x: h.position.x - frame.pos.x, y: h.position.y - frame.pos.y, z: h.position.z - frame.pos.z }, dir);
      return clamp(along - barrelLen(stroke) - headSize / 2, 0, stroke);
    };

    // Follow whatever the piston is mounted on (and settle the head onto its place on the first tick).
    s.len = clamp(s.len, 0, stroke);
    let forceN = 0;
    let overloaded = false;
    const want = headCentre(frame, s.len, headSize, stroke);
    const chassisId = baseId !== null && world.getEntity(baseId)?.robot !== undefined ? baseId : null;
    const follow = s.placed && chassisId !== null ? followChassis(world, s.head, chassisId, want, ctx.mode) : null;
    if (follow) {
      // The chassis cannot carry the head any further than the loads and walls allow: it is held back with it.
      forceN = follow.forceN;
      overloaded = follow.stalled;
      const left = Math.hypot(follow.short.x, follow.short.y, follow.short.z);
      if (left > 1e-9) {
        const base = world.getEntity(chassisId!)!;
        world.teleport(chassisId!, { x: base.position.x - follow.short.x, y: base.position.y - follow.short.y, z: base.position.z - follow.short.z }, true);
        frame = { ...frame, pos: { x: frame.pos.x - follow.short.x, y: frame.pos.y - follow.short.y, z: frame.pos.z - follow.short.z } };
      }
    } else if (chassisId === null || !s.placed) {
      world.moveBlock(s.head, want);
    }
    s.placed = true;
    s.len = lenOfHead();

    const posIn = typeof i.position === 'number' && Number.isFinite(i.position) ? i.position : null;
    const goal = targetLength(stroke, asBool(i.extend), posIn);
    let wanted = approach(s.len, goal, stroke, speed, ctx.dt) - s.len;
    const lenBefore = s.len;
    let rigidContactAt: number | null = null;

    if (Math.abs(wanted) > 1e-9) {
      const sign = Math.sign(wanted);
      const moveDir = { x: dir.x * sign, y: dir.y * sign, z: dir.z * sign };
      // A rigid crate in the way is accelerated by the force the rod has left after moving it, so a fast rod cannot hit it
      // harder than that force allows: the head stops at the crate's face and then follows the crate as it speeds up.
      const head0 = world.getEntity(s.head);
      if (head0) {
        const probe = planPush({
          head: boxOf(head0),
          dir: moveDir,
          step: Math.abs(wanted),
          bodies: pushBodiesOf(world, baseId),
          solids: world.solidBoxes().map((b) => ({ pos: b.position, size: b.size })),
          flat: flatOf(ctx.mode),
          lifting: moveDir.y > 0.5,
          probeContact: true,
        });
        if (probe.loadIds.some((id) => world.isRigidCrate(id)) && !exceeds(probe.requiredN, maxForce)) {
          rigidContactAt = probe.contactAt;
          wanted = sign * loadLimitedAdvance({ step: Math.abs(wanted), dt: ctx.dt, contactAt: probe.contactAt, loadKg: probe.loadKg, requiredN: probe.requiredN, maxN: maxForce, loadSpeed: s.loadSpeed });
        }
      }
      const subs = Math.max(1, Math.ceil(Math.abs(wanted) / MAX_SUB_STEP));
      for (let k = 0; k < subs; k++) {
        const head = world.getEntity(s.head);
        if (!head) break;
        const bodies = pushBodiesOf(world, baseId);
        const plan = planPush({
          head: boxOf(head),
          dir: moveDir,
          step: Math.abs(wanted) / subs,
          bodies,
          solids: world.solidBoxes().map((b) => ({ pos: b.position, size: b.size })),
          flat: flatOf(ctx.mode),
          lifting: moveDir.y > 0.5,
        });
        if (exceeds(plan.requiredN, maxForce)) {
          overloaded = true;
          forceN = maxForce;
          break;
        }
        shoveBodies(world, plan.moves);
        forceN = Math.max(forceN, plan.requiredN);
        world.moveBlock(s.head, headCentre(frame, s.len + sign * plan.advance, headSize, stroke));
        s.len = lenOfHead();
        if (plan.blocked) {
          // Pressing against a solid: the rod pushes with all it has but cannot go on.
          forceN = maxForce;
          break;
        }
      }
    }
    // Speed the head (and so the crate it is pushing) really had this tick; 0 when it only ran up to the crate or touched nothing.
    const travelled = Math.abs(s.len - lenBefore);
    s.loadSpeed = rigidContactAt !== null && travelled > rigidContactAt + 1e-6 ? travelled / ctx.dt : 0;

    const barrel = barrelLen(stroke);
    placeBox(world, ctx.mode, s.housing, localToWorld(frame, { x: barrel / 2, y: 0, z: 0 }), frame);
    placeBox(world, ctx.mode, s.rod, localToWorld(frame, { x: barrel + s.len - (barrel * ROD_SHARE) / 2, y: 0, z: 0 }), frame);

    const tip: Frame = { pos: localToWorld(frame, { x: barrel + s.len + headSize, y: 0, z: 0 }), yaw: frame.yaw, pitch: frame.pitch };
    reg.frames.set(s.head, tip);
    // A joint carrying this piston asks where the head would be for any angle it might turn to.
    const direction = numParam(params, 'direction', 0);
    const mount = vec3Param(params, 'mount', { x: 0, y: 0, z: 0 });
    reg.parts.set(ctx.nodeId, {
      tick: ctx.tick,
      baseId,
      tipId: s.head,
      masses: [],
      shape: (from, mode) => {
        const at = actuatorFrame({ pos: localToWorld(from, mount), yaw: from.yaw, pitch: from.pitch }, direction, orient, mode);
        return {
          out: { pos: localToWorld(at, { x: barrelLen(stroke) + s.len + headSize, y: 0, z: 0 }), yaw: at.yaw, pitch: at.pitch },
          solids: [{ pos: headCentre(at, s.len, headSize, stroke), size: { x: headSize, y: headSize, z: headSize } }],
        };
      },
    });
    return {
      tip: s.head,
      positionNow: s.len,
      extended: s.len >= stroke - END_TOL,
      retracted: s.len <= END_TOL,
      force: forceN,
      overloaded,
    };
  },
};
