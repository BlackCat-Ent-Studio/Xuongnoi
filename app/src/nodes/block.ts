import type { EntityId, NodeDef } from '../engine/types';
import { asBool, risingEdge, strParam, vec3Param, type EdgeState } from './util';

interface BlockState {
  id: EntityId;
  hide: EdgeState;
  hidden: boolean;
}

export const blockNode: NodeDef<BlockState> = {
  kind: 'block',
  label: 'Khối',
  category: 'object',
  description:
    'Một khối đặt trong thế giới: có thể là mặt đất/tường để đứng lên, hoặc vật nhặt được. Bật "Ẩn đi" để làm khối biến mất.',
  inputs: [{ id: 'hide', type: 'bool', label: 'Ẩn đi' }],
  outputs: [{ id: 'self', type: 'object', label: 'Khối' }],
  params: [
    { id: 'position', label: 'Vị trí', kind: 'vec3', default: { x: 0, y: 0, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 1, y: 1, z: 1 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#a3a3a3' },
    {
      id: 'type',
      label: 'Loại khối',
      kind: 'select',
      default: 'solid',
      options: [
        { value: 'solid', label: 'Rắn (đứng lên được)' },
        { value: 'pickup', label: 'Vật nhặt (đi xuyên qua)' },
      ],
    },
  ],
  create(ctx, params) {
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 0, z: 0 }),
      size: vec3Param(params, 'size', { x: 1, y: 1, z: 1 }),
      color: strParam(params, 'color', '#a3a3a3'),
      solid: strParam(params, 'type', 'solid') !== 'pickup',
    });
    return { id, hide: { prev: false }, hidden: false };
  },
  evaluate(ctx, i, _params, s) {
    if (risingEdge(s.hide, asBool(i.hide)) && !s.hidden) {
      s.hidden = true;
      ctx.world.hide(s.id);
    }
    return { self: s.id };
  },
};
