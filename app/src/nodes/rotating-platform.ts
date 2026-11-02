import type { EntityId, NodeDef } from '../engine/types';
import { asBool, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface RotatingState {
  id: EntityId;
  turn: EdgeState;
  /** Quarter turns the block should have reached (0..3); retried while someone blocks the way. */
  quarter: number;
  applied: number;
  /** Seconds until the next automatic step. */
  timer: number;
  /** Radians of the free spin. */
  spin: number;
}

export const rotatingPlatformNode: NodeDef<RotatingState> = {
  kind: 'rotating-platform',
  label: 'Bệ xoay',
  category: 'object',
  description:
    'Hộp xoay quanh tâm. Kiểu "Xoay từng nấc 90°": hộp rắn, mỗi lần "Xoay" bật (hoặc mỗi "Tự xoay sau" giây) nó quay một góc vuông, rộng và dài đổi chỗ cho nhau; ai đang đứng chỗ nó xoay tới sẽ bị đẩy sang chỗ trống, nếu không có chỗ thì nó chờ. Kiểu "Quay liên tục": hộp không rắn (không chặn đường), quay tròn như cánh quạt hay bẫy; nối Chạm nhau để biết ai bị quét trúng (chạm tính theo đúng hình đang quay). Hộp trong game 2D ngang quay trong mặt phẳng nhìn, còn nhìn từ trên và 3D thì quay quanh trục đứng. Bot tìm đường coi hộp này như chỗ trống.',
  inputs: [
    { id: 'turn', type: 'bool', label: 'Xoay' },
    { id: 'run', type: 'bool', label: 'Chạy', default: true },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Hộp xoay' },
    { id: 'angle', type: 'number', label: 'Góc (độ)' },
    { id: 'turned', type: 'bool', label: 'Vừa xoay xong' },
  ],
  params: [
    { id: 'position', label: 'Vị trí (tâm)', kind: 'vec3', default: { x: 0, y: 2, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 3, y: 0.5, z: 1 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#8b5cf6' },
    {
      id: 'mode',
      label: 'Kiểu xoay',
      kind: 'select',
      default: 'step',
      options: [
        { value: 'step', label: 'Xoay từng nấc 90° (rắn)' },
        { value: 'spin', label: 'Quay liên tục (không rắn, để chạm)' },
      ],
    },
    { id: 'every', label: 'Tự xoay sau (giây, 0 = chỉ khi bật "Xoay")', kind: 'number', default: 0, min: 0, max: 60, step: 0.5 },
    { id: 'speed', label: 'Tốc độ quay (độ/giây)', kind: 'number', default: 90, min: -720, max: 720, step: 10 },
  ],
  createOnly: ['position', 'size', 'color', 'mode'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 2, z: 0 }),
      size: vec3Param(params, 'size', { x: 3, y: 0.5, z: 1 }),
      color: strParam(params, 'color', '#8b5cf6'),
      solid: strParam(params, 'mode', 'step') !== 'spin',
    });
    return { id, turn: { prev: false }, quarter: 0, applied: 0, timer: Math.max(0, numParam(params, 'every', 0)), spin: 0 };
  },
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const view = world.getEntity(s.id);
    const run = i.run === undefined ? true : asBool(i.run);
    const edge = risingEdge(s.turn, asBool(i.turn));
    if (!view || !view.visible) return { self: s.id, angle: 0, turned: false };

    if (strParam(params, 'mode', 'step') === 'spin') {
      if (run) {
        const next = s.spin + (numParam(params, 'speed', 90) * Math.PI * ctx.dt) / 180;
        s.spin = next % (Math.PI * 2);
      }
      world.setBlockAngle(s.id, s.spin);
      const deg = (s.spin * 180) / Math.PI;
      return { self: s.id, angle: deg < 0 ? deg + 360 : deg, turned: false };
    }

    const every = Math.max(0, numParam(params, 'every', 0));
    if (edge) s.quarter = (s.quarter + 1) % 4;
    if (run && every > 0) {
      s.timer -= ctx.dt;
      if (s.timer <= 1e-9) {
        s.quarter = (s.quarter + 1) % 4;
        s.timer = every;
      }
    }
    let turned = false;
    if (s.quarter !== s.applied && world.setBlockAngle(s.id, (s.quarter * Math.PI) / 2)) {
      s.applied = s.quarter;
      turned = true;
    }
    return { self: s.id, angle: s.applied * 90, turned };
  },
};
