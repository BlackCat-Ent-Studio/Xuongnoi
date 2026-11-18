import type { EntityId, NodeDef } from '../engine/types';
import { DEG, localToWorld, rotateFrame, sagDirection, stepJoint, horizontalArm, type Frame } from '../world/arm-kinematics';
import { hubCube, resolveTurn } from '../world/arm-solid';
import type { Box } from '../world/linear-actuator';
import { jointCanLift } from '../world/mechanics';
import { pushBodiesOf } from './linear-actuator';
import { armRegistry, baseFrame, massesBeyond, placeBox, placeSolidCubes, solidsBeyond } from './arm-parts';
import { setArmHint } from '../engine/render-hints';
import { asBool, asObject, clamp, numParam, strParam, vec3Param } from './util';

interface JointState {
  /** The small hub box drawn at the pivot; also the handle the `tip` output carries. */
  id: EntityId;
  /** Current joint angle in degrees, relative to what it is mounted on. */
  angle: number;
  /** The invisible solid cube of the housing, once "Chắn vật" is on and the joint has been placed. */
  bodies: EntityId[];
}

/** Size (m) of the hub box. */
const HUB = 0.3;

export const jointNode: NodeDef<JointState> = {
  kind: 'joint',
  label: 'Khớp xoay (Servo)',
  labelEn: 'Revolute Joint / Servo',
  category: 'action',
  description:
    'Khớp của tay máy, như một động cơ servo. Gắn nó lên một vật (hộp, thân robot hoặc đầu của khớp / thanh khác), đặt "Góc đặt" (độ) và nó quay tới góc đó với tốc độ tối đa cho trước. Mỗi tick nó tính mô-men cần để giữ mọi thứ treo phía sau (khối lượng thanh nối, tay kẹp và món đang kẹp, nhân với khoảng cách ngang tới khớp): M = Σ m × 9,81 × L. Nếu M lớn hơn "Mô-men tối đa" khớp không giữ nổi và trễ dần xuống với tốc độ tỉ lệ với phần vượt, "Quá tải" bật. Chưa nối "Bật" thì servo không giữ gì (buông). Chưa nối "Góc đặt" thì khớp giữ ở góc bắt đầu. Trục đứng chỉ có tác dụng khi nhìn từ trên và 3D; nhìn ngang chỉ thấy khớp gập (trục ngang); nhìn từ trên chỉ thấy khớp xoay (trục đứng).',
  inputs: [
    { id: 'base', type: 'object', label: 'Gắn vào', required: true },
    { id: 'angle', type: 'number', label: 'Góc đặt', default: Number.NaN },
    { id: 'power', type: 'bool', label: 'Bật' },
  ],
  outputs: [
    { id: 'tip', type: 'object', label: 'Đầu khớp' },
    { id: 'angleNow', type: 'number', label: 'Góc hiện tại' },
    { id: 'load', type: 'number', label: 'Mô-men đang chịu' },
    { id: 'overloaded', type: 'bool', label: 'Quá tải' },
    { id: 'reached', type: 'bool', label: 'Đã tới góc' },
  ],
  params: [
    {
      id: 'axis',
      label: 'Trục quay',
      kind: 'select',
      default: 'pitch',
      options: [
        { value: 'pitch', label: 'Ngang (gập lên xuống)' },
        { value: 'yaw', label: 'Đứng (xoay quanh trục đứng)' },
      ],
    },
    { id: 'start', label: 'Góc bắt đầu (độ)', kind: 'number', default: 0, min: -180, max: 180, step: 5 },
    { id: 'min', label: 'Góc nhỏ nhất (độ)', kind: 'number', default: -90, min: -180, max: 180, step: 5 },
    { id: 'max', label: 'Góc lớn nhất (độ)', kind: 'number', default: 90, min: -180, max: 180, step: 5 },
    { id: 'maxTorque', label: 'Mô-men tối đa (N·m)', kind: 'number', default: 50, min: 0, max: 100000, step: 1 },
    { id: 'maxSpeed', label: 'Tốc độ tối đa (độ/giây)', kind: 'number', default: 90, min: 1, max: 720, step: 5 },
    {
      id: 'solid',
      label: 'Chắn vật (hộp khớp là vật cản; khớp quay đẩy hoặc bị chặn bởi vật)',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không (chỉ để vẽ, vật đi xuyên qua)' },
        { value: 'yes', label: 'Có (nhân vật, robot, xe, đồ vật không đi xuyên qua)' },
      ],
    },
    { id: 'tolerance', label: 'Sai số cho phép (độ)', kind: 'number', default: 1, min: 0, max: 90, step: 0.5, advanced: true },
    { id: 'mount', label: 'Lệch so với vật gắn (dọc / lên / ngang, m)', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, advanced: true },
    { id: 'color', label: 'Màu', kind: 'color', default: '#8b5cf6', advanced: true },
  ],
  createOnly: ['color', 'solid'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const lo = Math.min(numParam(params, 'min', -90), numParam(params, 'max', 90));
    const hi = Math.max(numParam(params, 'min', -90), numParam(params, 'max', 90));
    // Parked far below the world until the first tick puts it on its pivot, so an unmounted joint is never seen.
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: { x: 0, y: -1000, z: 0 },
      size: { x: HUB, y: HUB, z: HUB },
      color: strParam(params, 'color', '#8b5cf6'),
      solid: false,
    });
    setArmHint(ctx.nodeId, id, { part: 'joint', axis: strParam(params, 'axis', 'pitch') === 'yaw' ? 'yaw' : 'pitch' });
    return { id, angle: clamp(numParam(params, 'start', 0), lo, hi), bodies: [] };
  },
  evaluate(ctx, i, params, s) {
    const reg = armRegistry(ctx.world);
    const base = baseFrame(ctx, asObject(i.base), vec3Param(params, 'mount', { x: 0, y: 0, z: 0 }));
    if (!base) {
      reg.parts.delete(ctx.nodeId);
      reg.frames.delete(s.id);
      return { tip: null, angleNow: s.angle, load: 0, overloaded: false, reached: false };
    }
    const axis = strParam(params, 'axis', 'pitch') === 'yaw' ? 'yaw' : 'pitch';
    const lo = Math.min(numParam(params, 'min', -90), numParam(params, 'max', 90));
    const hi = Math.max(numParam(params, 'min', -90), numParam(params, 'max', 90));
    const maxTorque = Math.max(0, numParam(params, 'maxTorque', 50));
    const powered = asBool(i.power);
    // An unwired "Góc đặt" arrives as NaN: the joint keeps its start angle.
    const wired = typeof i.angle === 'number' && Number.isFinite(i.angle);
    const target = clamp(wired ? (i.angle as number) : numParam(params, 'start', 0), lo, hi);

    // Holding torque about this joint: weights beyond it times their horizontal distance (yaw: gravity has no lever).
    let required = 0;
    if (axis === 'pitch') {
      const loads = massesBeyond(reg, s.id, ctx.tick).map((m) => ({ massKg: m.kg, armM: horizontalArm(base, m.point) }));
      required = jointCanLift({ torqueMaxNm: maxTorque, loads, angle: 0 }).requiredNm;
    }
    const absolutePitchDeg = (base.pitch + s.angle * DEG * (axis === 'pitch' ? 1 : 0)) / DEG;
    const step = stepJoint({
      angle: s.angle,
      target,
      min: lo,
      max: hi,
      maxSpeedDegPerS: numParam(params, 'maxSpeed', 90),
      maxTorqueNm: maxTorque,
      requiredNm: required,
      powered,
      sag: sagDirection(absolutePitchDeg),
      dt: ctx.dt,
    });
    const angle0 = s.angle;
    s.angle = step.angle;

    // Turning is a push. Solid cubes beyond the joint (links with "Chắn vật", a piston head) must not enter a solid, and
    // what they shove needs torque on top of the one that holds the arm up; short of that the joint stays where it is.
    const beyondAt = (deg: number): Box[] => solidsBeyond(reg, s.id, rotateFrame(base, axis, deg * DEG, ctx.mode), ctx.tick, ctx.mode);
    let blocked = false;
    /** Torque (N·m) spent pushing rigid crates, on top of the one that holds the arm up. */
    let pushNm = 0;
    const cubesNow = Math.abs(step.angle - angle0) > 1e-9 ? beyondAt(angle0) : [];
    if (cubesNow.length > 0) {
      const bodies = pushBodiesOf(ctx.world);
      const lever = (b: Box): number => (axis === 'pitch' ? Math.hypot(horizontalArm(base, b.pos), b.pos.y - base.pos.y) : Math.hypot(b.pos.x - base.pos.x, b.pos.z - base.pos.z));
      const resolved = resolveTurn(angle0, step.angle, beyondAt, {
        levers: cubesNow.map(lever),
        bodies,
        solids: ctx.world.solidBoxes().map((b) => ({ pos: b.position, size: b.size })),
        flat: ctx.mode === '2d-top' ? 'y' : ctx.mode === '2d-side' ? 'z' : null,
        availableNm: powered ? Math.max(0, maxTorque - required) : 0,
      });
      blocked = resolved.blocked;
      pushNm = resolved.rigidNm;
      s.angle = resolved.angle;
      for (const [id, d] of resolved.moves) {
        const e = ctx.world.getEntity(id);
        // A rigid crate (real physics on) is pushed by the engine when the cubes move; the sweep only checked torque and room.
        if (e && !ctx.world.isRigidCrate(id)) ctx.world.teleport(id, { x: e.position.x + d.x, y: e.position.y + d.y, z: e.position.z + d.z }, false);
      }
    }
    const overloaded = step.overloaded || blocked;
    // Drawing only: the renderer shows the servo's axis and a warning while it is overloaded.
    setArmHint(ctx.nodeId, s.id, { part: 'joint', axis, overloaded });

    const out: Frame = rotateFrame(base, axis, s.angle * DEG, ctx.mode);
    reg.frames.set(s.id, out);
    const solidHub = strParam(params, 'solid', 'no') === 'yes';
    reg.parts.set(ctx.nodeId, {
      tick: ctx.tick,
      baseId: asObject(i.base),
      tipId: s.id,
      masses: [],
      shape: (from, mode) => {
        const mounted: Frame = { pos: localToWorld(from, vec3Param(params, 'mount', { x: 0, y: 0, z: 0 })), yaw: from.yaw, pitch: from.pitch };
        const turned = rotateFrame(mounted, axis, s.angle * DEG, mode);
        return { out: turned, solids: solidHub ? [hubCube(turned.pos, HUB)] : [] };
      },
    });
    placeBox(ctx.world, ctx.mode, s.id, out.pos, out);
    if (solidHub) placeSolidCubes(ctx.world, ctx.nodeId, s.bodies, [hubCube(out.pos, HUB)]);
    const reached = !overloaded && Math.abs(s.angle - target) <= Math.max(0, numParam(params, 'tolerance', 1)) + 1e-9;
    return { tip: s.id, angleNow: s.angle, load: required + pushNm, overloaded, reached };
  },
};
