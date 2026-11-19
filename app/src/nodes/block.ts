import { BLOCK_STYLES, BLOCK_STYLE_LABELS, TRAFFIC_COLORS, blockStyleOf, type BlockStyle } from '../engine/block-styles';
import type { EntityId, NodeDef, Params, PortDef, Vec3, ViewMode } from '../engine/types';
import { MATERIAL_OUT_PARAMS, materialPortValues, materialPortsActive, DAMAGED_PORT, WEIGHT_PORT } from './material-ports';
import { BODY_PARAMS, BODY_PARAM_IDS, MATERIAL_PARAM_IDS, bodySpec, materialParams, materialSpec } from './body-params';
import { asBool, asNum, numParam, risingEdge, strParam, vec3Param, type EdgeState } from './util';

/** Surface speed of a belt-styled block whose speed param is left at 0. */
const DEFAULT_BELT_SPEED = 2;
const MAX_BELT_SPEED = 30;

type BeltDirection = 'x' | '-x' | 'z' | '-z';

/** The styles that are a conveyor by their look alone: they run without a speed being set, and have side walls. */
const BELT_STYLES: readonly BlockStyle[] = ['conveyor', 'belt-frame'];

/**
 * The conveyor settings of a block, or null when it is no belt. A speed of 0 means "off" for any style except the belt
 * styles ("Băng chuyền", "Băng chuyền khung xanh"), which then run at 2 along the block's longer horizontal side (the
 * direction option only picks the sign).
 */
export function beltOf(params: Params, size: Vec3, mode: ViewMode): { axis: 'x' | 'z'; speed: number; walls: boolean } | null {
  const isBelt = BELT_STYLES.includes(blockStyleOf(strParam(params, 'style', 'box')));
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
  /** Last "Đặt màu" value seen (0 = none), so a colour is applied only when the number changes. */
  pick?: number;
  hide: EdgeState;
  show: EdgeState;
  /** Last "Ẩn khi bật" value seen; the block only reacts when it changes. */
  whilePrev?: boolean;
  hidden: boolean;
  /** Signed belt speed from the params, or null when the block is no conveyor. */
  belt?: number | null;
}

/** Only while "Báo đang ẩn" is on: a signal that is on for as long as the block is hidden. The default card does not change. */
const HIDDEN_PORTS: PortDef[] = [{ id: 'hidden', type: 'bool', label: 'Đang ẩn' }];

export const blockNode: NodeDef<BlockState> = {
  kind: 'block',
  label: 'Vật thể',
  category: 'object',
  description:
    'Một vật thể đặt trong thế giới: có thể là mặt đất/tường để đứng lên, hoặc vật nhặt được. Bật "Ẩn" để làm hộp biến mất, bật "Hiện" để hộp hiện ra lại (đứng chỗ cũ). "Khi bị dùng lên" báo một nhịp khi nhân vật vung dụng cụ trúng hộp. Mục Nâng cao có "Tốc độ băng chuyền": khác 0 thì hộp thành băng chuyền, đưa mọi thứ nằm trên mặt hộp đi theo hướng đã chọn ("Bật băng chuyền" tắt thì dừng, "Đảo chiều" bật thì chạy ngược). Chọn kiểu dáng "Băng chuyền" hoặc "Băng chuyền khung xanh" mà để tốc độ 0 thì băng tự chạy tốc độ 2 dọc theo cạnh dài hơn của hộp (có thành chắn hai bên). Kiểu "Đường ray" chỉ để trang trí. "Ẩn khi bật" là cổng cũ (một cổng làm cả hai việc: ẩn khi bật, hiện lại khi tắt), chỉ để game cũ vẫn chạy; game mới dùng "Ẩn" để mở và "Hiện" để đóng. Lần đổi nào đến sau cùng thì thắng: "Ẩn"/"Hiện" vẫn dùng được, nhưng khi "Ẩn khi bật" đổi giá trị thì nó quyết định.',
  inputs: [
    { id: 'hide', type: 'bool', label: 'Ẩn' },
    { id: 'show', type: 'bool', label: 'Hiện' },
    { id: 'pick', type: 'number', label: 'Đặt màu' },
    { id: 'run', type: 'bool', label: 'Bật băng chuyền' },
    { id: 'reverse', type: 'bool', label: 'Đảo chiều' },
    { id: 'hiddenWhile', type: 'bool', label: 'Ẩn khi bật', legacy: true },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Đối tượng' },
    { id: 'usedOn', type: 'bool', label: 'Khi bị dùng lên' },
  ],
  optionalOutputs: {
    all: [...HIDDEN_PORTS, DAMAGED_PORT, WEIGHT_PORT],
    active: (params) => [...(strParam(params, 'showHiddenOut', 'no') === 'yes' ? HIDDEN_PORTS : []), ...materialPortsActive(params)],
  },
  params: [
    { id: 'position', label: 'Vị trí', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, place: 'point' },
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
      id: 'showHiddenOut',
      label: 'Báo đang ẩn',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (hiện ô ra "Đang ẩn": bật suốt lúc hộp đang ẩn)' },
      ],
      advanced: true,
    },
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
    ...materialParams('block'),
    ...MATERIAL_OUT_PARAMS,
  ],
  createOnly: ['position', 'size', 'color', 'type', 'style', 'signText', 'beltSpeed', 'beltDir', 'beltWalls', ...BODY_PARAM_IDS, ...MATERIAL_PARAM_IDS],
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
      ...materialSpec(params, 'block'),
    });
    return { id, pick: 0, hide: { prev: false }, show: { prev: false }, whilePrev: false, hidden: false, belt: belt ? belt.speed : null };
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
    // Evaluated after "Ẩn", so when both rise on the same tick the entity ends up visible.
    if (risingEdge(s.show, asBool(i.show)) && s.hidden) {
      s.hidden = false;
      ctx.world.show(s.id);
    }
    // Follows the signal: on hides, off shows again. Acts only when the value changes, so an unwired input does nothing;
    // evaluated last, so when it changes on the same tick as a pulse, the signal wins.
    const hiddenWhile = asBool(i.hiddenWhile);
    if (hiddenWhile !== (s.whilePrev ?? false)) {
      s.whilePrev = hiddenWhile;
      if (hiddenWhile && !s.hidden) {
        s.hidden = true;
        ctx.world.hide(s.id);
      } else if (!hiddenWhile && s.hidden) {
        s.hidden = false;
        ctx.world.show(s.id);
      }
    }
    if (s.belt != null) {
      ctx.world.setBeltSpeed(s.id, asBool(i.run) ? (asBool(i.reverse) ? -s.belt : s.belt) : 0);
    }
    return { self: s.id, usedOn: ctx.world.wasUsedOn(s.id), ...(strParam(params, 'showHiddenOut', 'no') === 'yes' ? { hidden: s.hidden } : {}), ...materialPortValues(ctx, s.id, params) };
  },
};
