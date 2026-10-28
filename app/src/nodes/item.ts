import { ITEM_SHAPES, type EntityId, type ItemShape, type NodeDef } from '../engine/types';
import { strParam, vec3Param } from './util';

export const ITEM_SHAPE_LABELS: Record<ItemShape, string> = {
  box: 'Hộp',
  key: 'Chìa khoá',
  ball: 'Quả bóng',
  crate: 'Thùng',
};

function shapeParam(raw: string): ItemShape {
  return (ITEM_SHAPES as readonly string[]).includes(raw) ? (raw as ItemShape) : 'box';
}

export const itemNode: NodeDef<{ id: EntityId }> = {
  kind: 'item',
  label: 'Đồ vật',
  category: 'object',
  description:
    'Một món đồ trong thế giới: chìa khoá, quả bóng, thùng... Nhân vật có thể cầm, thả, ném nó, và bấm "Tương tác" khi đứng gần. Đồ vật rơi xuống đất và không chặn đường.',
  inputs: [],
  outputs: [
    { id: 'self', type: 'object', label: 'Đồ vật' },
    { id: 'held', type: 'bool', label: 'Đang được cầm' },
    { id: 'interacted', type: 'bool', label: 'Vừa được tương tác' },
  ],
  params: [
    { id: 'position', label: 'Vị trí', kind: 'vec3', default: { x: 0, y: 1, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 0.6, y: 0.6, z: 0.6 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#facc15' },
    {
      id: 'shape',
      label: 'Hình dạng',
      kind: 'select',
      default: 'box',
      options: ITEM_SHAPES.map((value) => ({ value, label: ITEM_SHAPE_LABELS[value] })),
    },
    {
      id: 'carryable',
      label: 'Cầm được không',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Cầm được' },
        { value: 'no', label: 'Cố định (chỉ để tương tác)' },
      ],
    },
  ],
  create(ctx, params) {
    const id = ctx.world.spawn({
      kind: 'item',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 1, z: 0 }),
      size: vec3Param(params, 'size', { x: 0.6, y: 0.6, z: 0.6 }),
      color: strParam(params, 'color', '#facc15'),
      solid: false,
      shape: shapeParam(strParam(params, 'shape', 'box')),
      carryable: strParam(params, 'carryable', 'yes') !== 'no',
    });
    return { id };
  },
  evaluate(ctx, _i, _params, s) {
    return {
      self: s.id,
      held: ctx.world.isHeld(s.id),
      interacted: ctx.world.wasInteracted(s.id),
    };
  },
};
