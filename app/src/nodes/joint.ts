import type { EntityId, NodeDef } from '../engine/types';
import { DEG, rotateFrame, sagDirection, stepJoint, horizontalArm, type Frame } from '../world/arm-kinematics';
import { jointCanLift } from '../world/mechanics';
import { armRegistry, baseFrame, massesBeyond, placeBox } from './arm-parts';
import { asBool, asObject, clamp, numParam, strParam, vec3Param } from './util';

interface JointState {
  /** The small hub box drawn at the pivot; also the handle the `tip` output carries. */
  id: EntityId;
  /** Current joint angle in degrees, relative to what it is mounted on. */
  angle: number;
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
    { id: 'mount', label: 'Lệch so với vật gắn (dọc / lên / ngang, m)', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, advanced: true },
    { id: 'color', label: 'Màu', kind: 'color', default: '#8b5cf6', advanced: true },
  ],
  createOnly: ['color'],
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
    return { id, angle: clamp(numParam(params, 'start', 0), lo, hi) };
  },
  evaluate(ctx, i, params, s) {
    const reg = armRegistry(ctx.world);
    const base = baseFrame(ctx, asObject(i.base), vec3Param(params, 'mount', { x: 0, y: 0, z: 0 }));
    if (!base) {
      reg.parts.delete(ctx.nodeId);
      reg.frames.delete(s.id);
      return { tip: null, angleNow: s.angle, load: 0, overloaded: false };
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
    s.angle = step.angle;

    const out: Frame = rotateFrame(base, axis, s.angle * DEG, ctx.mode);
    reg.frames.set(s.id, out);
    reg.parts.set(ctx.nodeId, { tick: ctx.tick, baseId: asObject(i.base), tipId: s.id, masses: [] });
    placeBox(ctx.world, ctx.mode, s.id, out.pos, out);
    return { tip: s.id, angleNow: s.angle, load: required, overloaded: step.overloaded };
  },
};
