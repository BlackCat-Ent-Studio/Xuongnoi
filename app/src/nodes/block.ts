import type { EntityId, NodeDef } from '../engine/types';
import { asBool, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface BlockState {
  id: EntityId;
  hide: EdgeState;
  show: EdgeState;
  hidden: boolean;
}

export const blockNode: NodeDef<BlockState> = {
  kind: 'block',
  label: 'Hộp',
  category: 'object',
  description:
    'Một hộp đặt trong thế giới: có thể là mặt đất/tường để đứng lên, hoặc vật nhặt được. Bật "Ẩn đi" để làm hộp biến mất, bật "Hiện lại" để hộp hiện ra lại (đứng chỗ cũ). "Vừa bị dùng lên" báo một nhịp khi nhân vật vung dụng cụ trúng hộp.',
  inputs: [
    { id: 'hide', type: 'bool', label: 'Ẩn đi' },
    { id: 'show', type: 'bool', label: 'Hiện lại' },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Hộp' },
    { id: 'usedOn', type: 'bool', label: 'Vừa bị dùng lên' },
  ],
  params: [
    { id: 'position', label: 'Vị trí', kind: 'vec3', default: { x: 0, y: 0, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 1, y: 1, z: 1 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#a3a3a3' },
    {
      id: 'type',
      label: 'Loại hộp',
      kind: 'select',
      default: 'solid',
      options: [
        { value: 'solid', label: 'Rắn (đứng lên được)' },
        { value: 'pickup', label: 'Vật nhặt (đi xuyên qua)' },
      ],
    },
  ],
  createOnly: ['position', 'size', 'color', 'type'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 0, z: 0 }),
      size: vec3Param(params, 'size', { x: 1, y: 1, z: 1 }),
      color: strParam(params, 'color', '#a3a3a3'),
      solid: strParam(params, 'type', 'solid') !== 'pickup',
    });
    return { id, hide: { prev: false }, show: { prev: false }, hidden: false };
  },
  evaluate(ctx, i, _params, s) {
    if (risingEdge(s.hide, asBool(i.hide)) && !s.hidden) {
      s.hidden = true;
      ctx.world.hide(s.id);
    }
    // Evaluated after "Ẩn đi", so when both rise on the same tick the entity ends up visible.
    if (risingEdge(s.show, asBool(i.show)) && s.hidden) {
      s.hidden = false;
      ctx.world.show(s.id);
    }
    return { self: s.id, usedOn: ctx.world.wasUsedOn(s.id) };
  },
};
