import type { EntityId, EntityView, NodeDef } from '../engine/types';
import { strParam, vec3Param } from './util';

interface ZoneState {
  /** Marker box that shows the zone while editing; hidden as soon as the game runs. */
  marker: EntityId;
  markerHidden: boolean;
  wasInside: boolean;
}

function matchesFilter(e: EntityView, filter: string): boolean {
  switch (filter) {
    case 'player':
      return e.kind === 'character' && (e.role ?? 'player') === 'player';
    case 'bot':
      return e.kind === 'character' && e.role === 'bot';
    case 'item':
      return e.kind === 'item';
    case 'vehicle':
      return e.kind === 'vehicle';
    default:
      return e.kind === 'character';
  }
}

const DEFAULT_CENTER = { x: 0, y: 1, z: 0 };
const DEFAULT_SIZE = { x: 4, y: 3, z: 4 };

export const zoneSensorNode: NodeDef<ZoneState> = {
  kind: 'zone',
  label: 'Cảm biến vùng',
  category: 'logic',
  description:
    'Một vùng hình hộp vô hình: biết có ai đang đứng trong đó không. Khi chỉnh sửa bạn thấy vùng là hộp mờ, lúc chơi thì nó vô hình. Chọn loại nào được tính (nhân vật, người chơi, bot, đồ vật, xe). "Vừa vào" / "Vừa ra" bật một nhịp; "Số lượng" đếm số vật trong vùng.',
  inputs: [],
  outputs: [
    { id: 'inside', type: 'bool', label: 'Có ai trong vùng' },
    { id: 'entered', type: 'bool', label: 'Vừa vào' },
    { id: 'exited', type: 'bool', label: 'Vừa ra' },
    { id: 'count', type: 'number', label: 'Số lượng' },
    { id: 'first', type: 'object', label: 'Vật đầu tiên' },
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
      ],
    },
    { id: 'color', label: 'Màu vùng (khi chỉnh sửa)', kind: 'color', default: '#22c55e' },
  ],
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
  evaluate(ctx, _i, params, s) {
    if (!s.markerHidden) {
      s.markerHidden = true;
      ctx.world.hide(s.marker);
    }
    const c = vec3Param(params, 'center', DEFAULT_CENTER);
    const z = vec3Param(params, 'size', DEFAULT_SIZE);
    const filter = strParam(params, 'filter', 'character');
    // Flat views ignore the unused axis so a thin zone still catches everyone on the plane.
    const useY = ctx.mode !== '2d-top';
    const useZ = ctx.mode !== '2d-side';
    let count = 0;
    let first: EntityId | null = null;
    for (const e of ctx.world.listEntities()) {
      if (!e.visible || e.seatedIn !== undefined || e.inHand || !matchesFilter(e, filter)) continue;
      if (Math.abs(e.position.x - c.x) >= (e.size.x + Math.abs(z.x)) / 2) continue;
      if (useY && Math.abs(e.position.y - c.y) >= (e.size.y + Math.abs(z.y)) / 2) continue;
      if (useZ && Math.abs(e.position.z - c.z) >= (e.size.z + Math.abs(z.z)) / 2) continue;
      count++;
      if (first === null) first = e.id;
    }
    const inside = count > 0;
    const entered = inside && !s.wasInside;
    const exited = !inside && s.wasInside;
    s.wasInside = inside;
    return { inside, entered, exited, count, first };
  },
};
