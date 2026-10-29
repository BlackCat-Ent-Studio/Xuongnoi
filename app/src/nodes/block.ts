import { BLOCK_STYLES, BLOCK_STYLE_LABELS, TRAFFIC_COLORS, blockStyleOf } from '../engine/block-styles';
import type { EntityId, NodeDef, Params, Vec3, ViewMode } from '../engine/types';
import { BODY_PARAMS, BODY_PARAM_IDS, bodySpec } from './body-params';
import { asBool, asNum, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

/** Surface speed of a belt-styled block whose speed param is left at 0. */
const DEFAULT_BELT_SPEED = 2;
const MAX_BELT_SPEED = 30;

type BeltDirection = 'x' | '-x' | 'z' | '-z';

/**
 * The conveyor settings of a block, or null when it is no belt. A speed of 0 means "off" for any style except
 * "Băng chuyền", which then runs at 2 along the block's longer horizontal side (the direction option only picks the sign).
 */
export function beltOf(params: Params, size: Vec3, mode: ViewMode): { axis: 'x' | 'z'; speed: number; walls: boolean } | null {
  const isBelt = blockStyleOf(strParam(params, 'style', 'box')) === 'conveyor';
  const set = numParam(params, 'beltSpeed', 0);
  if (set === 0 && !isBelt) return null;
  const dir = strParam(params, 'beltDir', 'x') as BeltDirection;
  const sign = dir.startsWith('-') ? -1 : 1;
  let axis: 'x' | 'z' = dir.endsWith('z') ? 'z' : 'x';
  if (set === 0) axis = size.z > size.x ? 'z' : 'x';
  if (mode === '2d-side') axis = 'x';
  const speed = Math.max(-MAX_BELT_SPEED, Math.min(MAX_BELT_SPEED, set === 0 ? DEFAULT_BELT_SPEED : set));
  return { axis, speed: speed * sign, walls: isBelt && strParam(params, 'beltWalls', 'yes') !== 'no' };
}

interface BlockState {
  id: EntityId;
  /** Last "Đổi màu" value seen (0 = none), so a colour is applied only when the number changes. */
  pick?: number;
  hide: EdgeState;
  show: EdgeState;
  hidden: boolean;
  /** Signed belt speed from the params, or null when the block is no conveyor. */
  belt?: number | null;
}

export const blockNode: NodeDef<BlockState> = {
  kind: 'block',
  label: 'Hộp',
  category: 'object',
  description:
    'Một hộp đặt trong thế giới: có thể là mặt đất/tường để đứng lên, hoặc vật nhặt được. Bật "Ẩn đi" để làm hộp biến mất, bật "Hiện lại" để hộp hiện ra lại (đứng chỗ cũ). "Vừa bị dùng lên" báo một nhịp khi nhân vật vung dụng cụ trúng hộp. Mục Nâng cao có "Tốc độ băng chuyền": khác 0 thì hộp thành băng chuyền, đưa mọi thứ nằm trên mặt hộp đi theo hướng đã chọn ("Chạy băng" tắt thì dừng, "Đảo chiều" bật thì chạy ngược). Chọn kiểu dáng "Băng chuyền" mà để tốc độ 0 thì băng tự chạy tốc độ 2 dọc theo cạnh dài hơn của hộp (có thành chắn hai bên). Kiểu "Đường ray" chỉ để trang trí.',
  inputs: [
    { id: 'hide', type: 'bool', label: 'Ẩn đi' },
    { id: 'show', type: 'bool', label: 'Hiện lại' },
    { id: 'pick', type: 'number', label: 'Đổi màu (1, 2 hoặc 3)' },
    { id: 'run', type: 'bool', label: 'Chạy băng', default: true },
    { id: 'reverse', type: 'bool', label: 'Đảo chiều' },
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
    {
      id: 'style',
      label: 'Kiểu dáng',
      kind: 'select',
      default: 'box',
      options: BLOCK_STYLES.map((value) => ({ value, label: BLOCK_STYLE_LABELS[value] })),
    },
    { id: 'signText', label: 'Chữ trên biển (kiểu Biển tên)', kind: 'text', default: '' },
    { id: 'color1', label: 'Màu 1', kind: 'color', default: TRAFFIC_COLORS[0] },
    { id: 'color2', label: 'Màu 2', kind: 'color', default: TRAFFIC_COLORS[1] },
    { id: 'color3', label: 'Màu 3', kind: 'color', default: TRAFFIC_COLORS[2] },
    {
      id: 'beltSpeed',
      label: 'Tốc độ băng chuyền (0 = tắt)',
      kind: 'number',
      default: 0,
      min: -MAX_BELT_SPEED,
      max: MAX_BELT_SPEED,
      step: 0.5,
      advanced: true,
    },
    {
      id: 'beltDir',
      label: 'Hướng băng chuyền',
      kind: 'select',
      default: 'x',
      options: [
        { value: 'x', label: 'Theo trục X' },
        { value: '-x', label: 'Ngược trục X' },
        { value: 'z', label: 'Theo trục Z' },
        { value: '-z', label: 'Ngược trục Z' },
      ],
      advanced: true,
    },
    {
      id: 'beltWalls',
      label: 'Thành chắn hai bên (kiểu Băng chuyền)',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có' },
        { value: 'no', label: 'Không' },
      ],
      advanced: true,
    },
    ...BODY_PARAMS,
  ],
  createOnly: ['position', 'size', 'color', 'type', 'style', 'signText', 'beltSpeed', 'beltDir', 'beltWalls', ...BODY_PARAM_IDS],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const size = vec3Param(params, 'size', { x: 1, y: 1, z: 1 });
    const solid = strParam(params, 'type', 'solid') !== 'pickup';
    const belt = solid || ctx.world.mode === '2d-top' ? beltOf(params, size, ctx.world.mode) : null;
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 0, z: 0 }),
      size,
      color: strParam(params, 'color', '#a3a3a3'),
      solid,
      blockStyle: blockStyleOf(strParam(params, 'style', 'box')),
      label: strParam(params, 'signText', '').trim(),
      ...(belt ? { belt: { axis: belt.axis, walls: belt.walls } } : {}),
      ...bodySpec(params),
    });
    return { id, pick: 0, hide: { prev: false }, show: { prev: false }, hidden: false, belt: belt ? belt.speed : null };
  },
  evaluate(ctx, i, params, s) {
    const pick = Math.round(asNum(i.pick));
    if (pick !== (s.pick ?? 0)) {
      s.pick = pick;
      if (pick >= 1 && pick <= 3) {
        ctx.world.setEntityStyle(s.id, { color: strParam(params, `color${pick}`, TRAFFIC_COLORS[pick - 1] ?? '#ffffff') });
      }
    }
    if (risingEdge(s.hide, asBool(i.hide)) && !s.hidden) {
      s.hidden = true;
      ctx.world.hide(s.id);
    }
    // Evaluated after "Ẩn đi", so when both rise on the same tick the entity ends up visible.
    if (risingEdge(s.show, asBool(i.show)) && s.hidden) {
      s.hidden = false;
      ctx.world.show(s.id);
    }
    if (s.belt != null) {
      ctx.world.setBeltSpeed(s.id, asBool(i.run) ? (asBool(i.reverse) ? -s.belt : s.belt) : 0);
    }
    return { self: s.id, usedOn: ctx.world.wasUsedOn(s.id) };
  },
};
