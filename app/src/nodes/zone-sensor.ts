import type { EntityId, EntityView, NodeDef } from '../engine/types';
import { asObject, clamp, numParam, strParam, vec3Param } from './util';

interface ZoneState {
  /** Marker box that shows the zone while editing; hidden as soon as the game runs. */
  marker: EntityId;
  markerHidden: boolean;
  wasInside: boolean;
}

export function matchesFilter(e: EntityView, filter: string): boolean {
  switch (filter) {
    case 'player':
      return e.kind === 'character' && (e.role ?? 'player') === 'player';
    case 'bot':
      return e.kind === 'character' && e.role === 'bot';
    case 'item':
      return e.kind === 'item';
    case 'vehicle':
      return e.kind === 'vehicle';
    case 'robot':
      return e.kind === 'robot';
    default:
      return e.kind === 'character';
  }
}

/** Yaw (radians, 0 = +X, toward +Z positive) a followed entity points at; 0 when it has no direction. */
function yawOf(e: EntityView): number {
  if (e.vehicle) return e.vehicle.heading;
  if (e.robot) return e.robot.heading;
  if (e.facing) return Math.atan2(e.facing.z, e.facing.x);
  return 0;
}

/** Whether distance `d` (entity centre to zone centre) with extents `ee` (entity) and `zz` (zone) counts under `rule`. */
function axisHit(rule: string, d: number, ee: number, zz: number): boolean {
  const ad = Math.abs(d);
  if (rule === 'center') return ad <= zz / 2;
  if (rule === 'inside') return ad + ee / 2 <= zz / 2;
  return ad < (ee + zz) / 2;
}

const DEFAULT_CENTER = { x: 0, y: 1, z: 0 };
const DEFAULT_SIZE = { x: 4, y: 3, z: 4 };

export const zoneSensorNode: NodeDef<ZoneState> = {
  kind: 'zone',
  label: 'Vùng kích hoạt',
  category: 'logic',
  description:
    'Một vùng hình hộp vô hình: biết có ai đang đứng trong đó không. Khi chỉnh sửa bạn thấy vùng là hộp mờ, lúc chạy thì nó vô hình. Chọn loại nào được tính (nhân vật, người chơi, bot, đồ vật, xe). "Khi đối tượng vào" / "Khi đối tượng ra" bật một nhịp; "Số đối tượng" đếm số vật trong vùng. Nối "Bám theo đối tượng" để vùng đi theo vật đó (ví dụ chiếc xe): lúc này "Tâm vùng" chỉ là độ lệch so với vật; không nối thì vùng đứng yên ở "Tâm vùng". Bật "Xoay theo vật" để vùng quay theo hướng vật (chỉ ở 3D và nhìn từ trên). "Chỉ tính loại hàng" lọc đồ vật theo loại hàng; "Tính khi nào" chọn chạm mép, tâm vật vào trong hay nằm trọn bên trong; "Ít nhất bao nhiêu vật" là số vật tối thiểu để "Đang có đối tượng" bật.',
  inputs: [{ id: 'follow', type: 'object', label: 'Bám theo đối tượng' }],
  outputs: [
    { id: 'inside', type: 'bool', label: 'Đang có đối tượng' },
    { id: 'entered', type: 'bool', label: 'Khi đối tượng vào' },
    { id: 'exited', type: 'bool', label: 'Khi đối tượng ra' },
    { id: 'count', type: 'number', label: 'Số đối tượng' },
    { id: 'first', type: 'object', label: 'Đối tượng đầu tiên' },
  ],
  params: [
    { id: 'center', label: 'Tâm vùng', kind: 'vec3', default: DEFAULT_CENTER },
    { id: 'size', label: 'Kích thước vùng', kind: 'vec3', default: DEFAULT_SIZE },
    {
      id: 'filter',
      label: 'Tính những gì',
      kind: 'select',
      default: 'character',
      options: [
        { value: 'character', label: 'Mọi nhân vật' },
        { value: 'player', label: 'Người chơi' },
        { value: 'bot', label: 'Bot' },
        { value: 'item', label: 'Đồ vật' },
        { value: 'vehicle', label: 'Phương tiện' },
        { value: 'robot', label: 'Robot' },
      ],
    },
    {
      id: 'rotate',
      label: 'Xoay theo vật',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có' },
      ],
    },
    { id: 'goods', label: 'Chỉ tính loại hàng', kind: 'text', default: '' },
    {
      id: 'rule',
      label: 'Tính khi nào',
      kind: 'select',
      default: 'touch',
      options: [
        { value: 'touch', label: 'Chạm mép' },
        { value: 'center', label: 'Tâm vật vào trong' },
        { value: 'inside', label: 'Nằm trọn bên trong' },
      ],
    },
    { id: 'minCount', label: 'Ít nhất bao nhiêu vật', kind: 'number', default: 1, min: 1, max: 50, step: 1 },
    { id: 'color', label: 'Màu vùng (khi chỉnh sửa)', kind: 'color', default: '#22c55e' },
  ],
  createOnly: ['center', 'size', 'color'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.marker, { color: String(p.color) }),
  },
  create(ctx, params) {
    const marker = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'center', DEFAULT_CENTER),
      size: vec3Param(params, 'size', DEFAULT_SIZE),
      color: strParam(params, 'color', '#22c55e'),
      solid: false,
      zone: true,
    });
    return { marker, markerHidden: false, wasInside: false };
  },
  evaluate(ctx, i, params, s) {
    if (!s.markerHidden) {
      s.markerHidden = true;
      ctx.world.hide(s.marker);
    }
    const offset = vec3Param(params, 'center', DEFAULT_CENTER);
    const followId = asObject(i.follow);
    const anchorView = followId !== null ? ctx.world.getEntity(followId) : undefined;
    const anchor = anchorView?.position;
    // The side view has no yaw to turn with, so rotation only applies in 3D and from above.
    const yaw = anchorView && strParam(params, 'rotate', 'no') === 'yes' && ctx.mode !== '2d-side' ? yawOf(anchorView) : 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const ox = offset.x * cos - offset.z * sin;
    const oz = offset.x * sin + offset.z * cos;
    const c = anchor ? { x: anchor.x + ox, y: anchor.y + offset.y, z: anchor.z + oz } : offset;
    const z = vec3Param(params, 'size', DEFAULT_SIZE);
    const filter = strParam(params, 'filter', 'character');
    const goods = strParam(params, 'goods', '');
    const rule = strParam(params, 'rule', 'touch');
    const minCount = Math.round(clamp(numParam(params, 'minCount', 1), 1, 50));
    // Flat views ignore the unused axis so a thin zone still catches everyone on the plane.
    const useY = ctx.mode !== '2d-top';
    const useZ = ctx.mode !== '2d-side';
    let count = 0;
    let first: EntityId | null = null;
    for (const e of ctx.world.listEntities()) {
      if (!e.visible || e.seatedIn !== undefined || e.inHand || e.carried || !matchesFilter(e, filter)) continue;
      if (goods !== '' && ctx.world.tagOf(e.id) !== goods) continue;
      // Entity centre in the zone's own frame, and its box extent along the zone's axes.
      const dx = e.position.x - c.x;
      const dz = e.position.z - c.z;
      const lx = dx * cos + dz * sin;
      const lz = -dx * sin + dz * cos;
      const ex = Math.abs(cos) * e.size.x + Math.abs(sin) * e.size.z;
      const ez = Math.abs(sin) * e.size.x + Math.abs(cos) * e.size.z;
      if (!axisHit(rule, lx, ex, Math.abs(z.x))) continue;
      if (useY && !axisHit(rule, e.position.y - c.y, e.size.y, Math.abs(z.y))) continue;
      if (useZ && !axisHit(rule, lz, ez, Math.abs(z.z))) continue;
      count++;
      if (first === null) first = e.id;
    }
    const inside = count >= minCount;
    const entered = inside && !s.wasInside;
    const exited = !inside && s.wasInside;
    s.wasInside = inside;
    return { inside, entered, exited, count, first };
  },
};
