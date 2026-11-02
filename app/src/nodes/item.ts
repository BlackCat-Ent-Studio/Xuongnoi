import { HOLD_STYLES, ITEM_SHAPES, type EntityId, type HoldStyle, type ItemShape, type NodeDef } from '../engine/types';
import { BODY_PARAMS, BODY_PARAM_IDS, bodySpec } from './body-params';
import { DEFAULT_ITEM_FRICTION } from '../world/physics';
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
  veggie: 'Bó rau',
  ore: 'Cục quặng',
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
  show: EdgeState;
  hidden: boolean;
}

export const itemNode: NodeDef<ItemState> = {
  kind: 'item',
  label: 'Đồ vật',
  category: 'object',
  description:
    'Một món đồ trong thế giới: chìa khoá, quả bóng, thùng... Nhân vật có thể cầm, thả, ném nó, và bấm "Tương tác" khi đứng gần. "Ẩn đi (1 nhịp)" làm nó biến mất, "Hiện lại (1 nhịp)" cho nó hiện ra lại chỗ cũ. Đồ vật rơi xuống đất và không chặn đường. Chọn "Cầm trên tay" để món này là dụng cụ (kiếm, cuốc...) dùng với node Cầm dụng cụ.',
  inputs: [
    { id: 'hide', type: 'bool', label: 'Ẩn đi (1 nhịp)' },
    { id: 'show', type: 'bool', label: 'Hiện lại (1 nhịp)' },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Đồ vật' },
    { id: 'held', type: 'bool', label: 'Đang bị khiêng' },
    { id: 'interacted', type: 'bool', label: 'Vừa được dùng' },
    { id: 'inHand', type: 'bool', label: 'Đang cầm tay' },
    { id: 'usedOn', type: 'bool', label: 'Bị dùng lên' },
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
    { id: 'tag', label: 'Loại hàng (chữ, để trống nếu không cần)', kind: 'text', default: '' },
    ...BODY_PARAMS,
    { id: 'friction', label: 'Độ trượt (càng lớn càng mau dừng)', kind: 'number', default: DEFAULT_ITEM_FRICTION, min: 0, max: 40, step: 1, advanced: true },
    { id: 'bounce', label: 'Độ nảy (0 = không nảy, 1 = nảy lại hết)', kind: 'number', default: 0, min: 0, max: 1, step: 0.05, advanced: true },
  ],
  createOnly: ['position', 'size', 'color', 'shape', 'carryable', 'holdStyle', 'damage', 'tag', ...BODY_PARAM_IDS, 'friction', 'bounce'],
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
      tag: strParam(params, 'tag', '').trim(),
      ...bodySpec(params),
      friction: numParam(params, 'friction', DEFAULT_ITEM_FRICTION),
      bounce: numParam(params, 'bounce', 0),
    });
    return { id, hide: { prev: false }, show: { prev: false }, hidden: false };
  },
  evaluate(ctx, i, _params, s) {
    if (risingEdge(s.hide, asBool(i.hide)) && !s.hidden) {
      s.hidden = true;
      ctx.world.hide(s.id);
    }
    // Evaluated after "Ẩn đi (1 nhịp)", so when both rise on the same tick the entity ends up visible.
    if (risingEdge(s.show, asBool(i.show)) && s.hidden) {
      s.hidden = false;
      ctx.world.show(s.id);
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
