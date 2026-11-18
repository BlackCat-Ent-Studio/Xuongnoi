import type { EntityId, NodeDef } from '../engine/types';
import { advance, localToWorld } from '../world/arm-kinematics';
import { linkCubes, linkOutline, linkSliceCount, outlineSlices } from '../world/arm-solid';
import { armRegistry, baseFrame, isSolidPiece, placeBox, placeSolidCubes } from './arm-parts';
import { setArmHint } from '../engine/render-hints';
import { quatFromAxes } from '../world/oriented-box';
import { asObject, numParam, strParam } from './util';

interface LinkState {
  id: EntityId;
  /** Invisible solid cubes laid along the link, once "Chắn vật" is on and the link has been placed. */
  bodies: EntityId[];
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
    {
      id: 'solid',
      label: 'Chắn vật (thanh là vật cản: người, robot, xe, đồ vật không đi xuyên qua)',
      kind: 'select',
      // A new card follows the world switch: solid with "Vật lý thật" (a real arm is), drawn-only without it, so a board that plays with the
      // switch off is built and behaves as it always did. Boards saved before the setting existed keep passing through things.
      default: 'auto',
      legacyDefault: 'no',
      options: [
        { value: 'auto', label: 'Tự động (có khi bật "Vật lý thật", không khi tắt)' },
        { value: 'no', label: 'Không (chỉ để vẽ, vật đi xuyên qua)' },
        { value: 'yes', label: 'Có (thanh chắn đường; khớp phía trước đẩy hoặc bị chặn)' },
      ],
    },
    { id: 'color', label: 'Màu', kind: 'color', default: '#a3a3a3' },
  ],
  createOnly: ['length', 'thickness', 'color', 'solid'],
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
    setArmHint(ctx.nodeId, id, { part: 'link' });
    return { id, bodies: [] };
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
    const thickness = Math.max(0.05, numParam(params, 'thickness', 0.2));
    const solid = isSolidPiece(ctx.world, params);
    // Real physics: a rigid crate meets the link's exact box (the engine is given that box, a sweep tests slices of it); the upright cubes stay for everything else.
    const exact = solid && ctx.world.realPhysicsOn();
    reg.frames.set(s.id, end);
    reg.parts.set(ctx.nodeId, {
      tick: ctx.tick,
      baseId,
      tipId: s.id,
      masses: [{ kg: Math.max(0, numParam(params, 'mass', 1)), point: mid }],
      shape: (from) => ({
        out: advance(from, length),
        solids: !solid ? [] : exact ? [...linkCubes(from, length, thickness).map((c) => ({ ...c, fat: true })), ...outlineSlices(linkOutline(from, length, thickness), 'x', linkSliceCount(length, thickness))] : linkCubes(from, length, thickness),
      }),
    });
    placeBox(ctx.world, ctx.mode, s.id, mid, start);
    if (solid) placeSolidCubes(ctx.world, ctx.nodeId, s.bodies, linkCubes(start, length, thickness));
    if (exact) {
      const o = linkOutline(start, length, thickness);
      ctx.world.setExactBodies(ctx.nodeId, [{ centre: o.centre, size: { x: 2 * o.half.x, y: 2 * o.half.y, z: 2 * o.half.z }, rot: quatFromAxes(o.axes[0], o.axes[1], o.axes[2]) }]);
    }
    return { tip: s.id };
  },
};
