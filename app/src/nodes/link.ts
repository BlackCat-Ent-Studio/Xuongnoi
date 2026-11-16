import type { EntityId, NodeDef } from '../engine/types';
import { advance, localToWorld } from '../world/arm-kinematics';
import { armRegistry, baseFrame, placeBox } from './arm-parts';
import { asObject, numParam, strParam } from './util';

interface LinkState {
  id: EntityId;
}

export const linkNode: NodeDef<LinkState> = {
  kind: 'link',
  label: 'Thanh nối',
  labelEn: 'Link / Arm Segment',
  category: 'object',
  description:
    'Một đoạn cánh tay cứng, vẽ thành thanh bo tròn. Gắn đầu thanh vào "Đầu khớp" của một khớp (hoặc vào đầu một thanh khác); đầu kia là "Đầu thanh", để gắn khớp tiếp theo hoặc tay kẹp. Thanh chỉ chuyển động theo khớp, không tự quay. Khối lượng của thanh (đặt ở giữa thanh) là tải mà các khớp phía trước phải giữ: mô-men = m × 9,81 × khoảng cách ngang tới khớp.',
  inputs: [{ id: 'base', type: 'object', label: 'Gắn vào', required: true }],
  outputs: [{ id: 'tip', type: 'object', label: 'Đầu thanh' }],
  params: [
    { id: 'length', label: 'Chiều dài (m)', kind: 'number', default: 1, min: 0.1, max: 20, step: 0.1 },
    { id: 'mass', label: 'Khối lượng (kg)', kind: 'number', default: 1, min: 0, max: 100000, step: 0.5 },
    { id: 'thickness', label: 'Độ dày (m)', kind: 'number', default: 0.2, min: 0.05, max: 2, step: 0.05 },
    { id: 'color', label: 'Màu', kind: 'color', default: '#a3a3a3' },
  ],
  createOnly: ['length', 'thickness', 'color'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const length = Math.max(0.1, numParam(params, 'length', 1));
    const t = Math.max(0.05, numParam(params, 'thickness', 0.2));
    // Parked far below the world until the first tick puts it on its joint.
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: { x: 0, y: -1000, z: 0 },
      size: { x: length, y: t, z: t },
      color: strParam(params, 'color', '#a3a3a3'),
      solid: false,
    });
    return { id };
  },
  evaluate(ctx, i, params, s) {
    const reg = armRegistry(ctx.world);
    const baseId = asObject(i.base);
    const start = baseFrame(ctx, baseId, { x: 0, y: 0, z: 0 });
    if (!start) {
      reg.parts.delete(ctx.nodeId);
      reg.frames.delete(s.id);
      return { tip: null };
    }
    const length = Math.max(0.1, numParam(params, 'length', 1));
    const end = advance(start, length);
    const mid = localToWorld(start, { x: length / 2, y: 0, z: 0 });
    reg.frames.set(s.id, end);
    reg.parts.set(ctx.nodeId, {
      tick: ctx.tick,
      baseId,
      tipId: s.id,
      masses: [{ kg: Math.max(0, numParam(params, 'mass', 1)), point: mid }],
    });
    placeBox(ctx.world, ctx.mode, s.id, mid, start);
    return { tip: s.id };
  },
};
