import { HOLD_STYLES, ITEM_SHAPES, type EntityId, type HoldStyle, type ItemShape, type NodeDef } from '../engine/types';
import { asBool, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

export const ITEM_SHAPE_LABELS: Record<ItemShape, string> = {
  box: 'Hộp',
  key: 'Chìa khoá',
  ball: 'Quả bóng',
  crate: 'Thùng',
  sword: 'Kiếm',
  pickaxe: 'Cuốc',
  hammer: 'Búa',
  torch: 'Đuốc',
  wand: 'Gậy phép',
  bucket: 'Xô nước',
  lock: 'Ổ khoá',
};

function shapeParam(raw: string): ItemShape {
  return (ITEM_SHAPES as readonly string[]).includes(raw) ? (raw as ItemShape) : 'box';
}

function holdStyleParam(raw: string): HoldStyle {
  return (HOLD_STYLES as readonly string[]).includes(raw) ? (raw as HoldStyle) : 'head';
}

interface ItemState {
  id: EntityId;
  hide: EdgeState;
  hidden: boolean;
}

export const itemNode: NodeDef<ItemState> = {
  kind: 'item',
  label: 'Đồ vật',
  category: 'object',
  description:
    'Một món đồ trong thế giới: chìa khoá, quả bóng, thùng... Nhân vật có thể cầm, thả, ném nó, và bấm "Tương tác" khi đứng gần. Đồ vật rơi xuống đất và không chặn đường. Chọn "Cầm trên tay" để món này là dụng cụ (kiếm, cuốc...) dùng với node Cầm tay.',
  inputs: [{ id: 'hide', type: 'bool', label: 'Ẩn đi' }],
  outputs: [
    { id: 'self', type: 'object', label: 'Đồ vật' },
    { id: 'held', type: 'bool', label: 'Đang được cầm' },
    { id: 'interacted', type: 'bool', label: 'Vừa được tương tác' },
    { id: 'inHand', type: 'bool', label: 'Đang ở trên tay' },
    { id: 'usedOn', type: 'bool', label: 'Vừa bị dùng lên' },
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
    {
      id: 'holdStyle',
      label: 'Cách cầm',
      kind: 'select',
      default: 'head',
      options: [
        { value: 'head', label: 'Khiêng trên đầu' },
        { value: 'hand', label: 'Cầm trên tay' },
      ],
    },
    { id: 'damage', label: 'Sát thương (0 = tuỳ loại)', kind: 'number', default: 0, min: 0, max: 100, step: 1 },
  ],
  createOnly: ['position', 'size', 'color', 'shape', 'carryable', 'holdStyle', 'damage'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
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
      holdStyle: holdStyleParam(strParam(params, 'holdStyle', 'head')),
      damage: numParam(params, 'damage', 0),
    });
    return { id, hide: { prev: false }, hidden: false };
  },
  evaluate(ctx, i, _params, s) {
    if (risingEdge(s.hide, asBool(i.hide)) && !s.hidden) {
      s.hidden = true;
      ctx.world.hide(s.id);
    }
    return {
      self: s.id,
      held: ctx.world.isHeld(s.id),
      interacted: ctx.world.wasInteracted(s.id),
      inHand: ctx.world.isInHand(s.id),
      usedOn: ctx.world.wasUsedOn(s.id),
    };
  },
};
