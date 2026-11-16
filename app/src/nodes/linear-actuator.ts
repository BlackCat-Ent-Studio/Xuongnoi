import type { EntityId, EntityView, NodeDef, Vec3, ViewMode } from '../engine/types';
import { dirOf, localToWorld, type Frame } from '../world/arm-kinematics';
import { actuatorFrame, approach, exceeds, planPush, targetLength, type PushBody, type PushOrient } from '../world/linear-actuator';
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
    return { head, housing, rod, len: 0 };
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
    const frame = actuatorFrame(origin, numParam(params, 'direction', 0), orient, ctx.mode);
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
    world.moveBlock(s.head, headCentre(frame, s.len, headSize, stroke));
    s.len = lenOfHead();

    const posIn = typeof i.position === 'number' && Number.isFinite(i.position) ? i.position : null;
    const goal = targetLength(stroke, asBool(i.extend), posIn);
    const wanted = approach(s.len, goal, stroke, speed, ctx.dt) - s.len;
    let forceN = 0;
    let overloaded = false;

    if (Math.abs(wanted) > 1e-9) {
      const sign = Math.sign(wanted);
      const moveDir = { x: dir.x * sign, y: dir.y * sign, z: dir.z * sign };
      const subs = Math.max(1, Math.ceil(Math.abs(wanted) / MAX_SUB_STEP));
      for (let k = 0; k < subs; k++) {
        const head = world.getEntity(s.head);
        if (!head) break;
        const bodies: PushBody[] = [];
        for (const e of world.listEntities()) {
          if (e.kind === 'block' || !e.visible || e.carried || e.inHand || e.seatedIn !== undefined) continue;
          const mat = world.materialOf(e.id);
          if (mat) bodies.push({ id: e.id, box: boxOf(e), massKg: mat.massKg, mu: mat.mu });
        }
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
        for (const m of plan.moves) {
          const e = world.getEntity(m.id);
          if (e) world.teleport(m.id, { x: e.position.x + m.delta.x, y: e.position.y + m.delta.y, z: e.position.z + m.delta.z }, false);
        }
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

    const barrel = barrelLen(stroke);
    placeBox(world, ctx.mode, s.housing, localToWorld(frame, { x: barrel / 2, y: 0, z: 0 }), frame);
    placeBox(world, ctx.mode, s.rod, localToWorld(frame, { x: barrel + s.len - (barrel * ROD_SHARE) / 2, y: 0, z: 0 }), frame);

    const tip: Frame = { pos: localToWorld(frame, { x: barrel + s.len + headSize, y: 0, z: 0 }), yaw: frame.yaw, pitch: frame.pitch };
    reg.frames.set(s.head, tip);
    reg.parts.set(ctx.nodeId, { tick: ctx.tick, baseId, tipId: s.head, masses: [] });
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
