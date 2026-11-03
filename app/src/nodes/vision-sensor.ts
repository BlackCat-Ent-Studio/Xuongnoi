import type { EntityId, EntityView, NodeDef, ViewMode } from '../engine/types';
import { asObject, clamp, numParam, strParam } from './util';
import { noteVision, type VisionNote } from './sight-notes';
import { matchesFilter } from './zone-sensor';

interface VisionState {
  seen: boolean;
}

/** Slack on the cone edge so a target exactly on the border (after rounding) still counts. */
const ANGLE_SLACK = 1e-6;

/** Where the viewer looks as a unit vector on the plane the view shows (x/y from the side, x/z otherwise). */
export function lookDirection(e: EntityView, mode: ViewMode): { a: number; b: number } {
  let fx = 1;
  let fz = 0;
  if (e.vehicle) {
    fx = Math.cos(e.vehicle.heading);
    fz = Math.sin(e.vehicle.heading);
  } else if (e.facing && Math.hypot(e.facing.x, e.facing.z) > 1e-6) {
    fx = e.facing.x;
    fz = e.facing.z;
  }
  return directionOf(fx, fz, mode);
}

/** A facing (x, z) as the unit look direction on the plane the view shows. */
export function directionOf(fx: number, fz: number, mode: ViewMode): { a: number; b: number } {
  if (mode === '2d-side') return { a: fx >= 0 ? 1 : -1, b: 0 };
  const len = Math.hypot(fx, fz) || 1;
  return { a: fx / len, b: fz / len };
}

/** Distance as the sensor measures it: the axis a flat view hides never counts, like in the distance sensor. */
export function viewDistance(mode: ViewMode, dx: number, dy: number, dz: number): number {
  return Math.hypot(dx, mode === '2d-top' ? 0 : dy, mode === '2d-side' ? 0 : dz);
}

/** True when the offset (dx, dy, dz) from the viewer lies inside the cone of half angle `half` around `dir`. */
export function insideCone(mode: ViewMode, dx: number, dy: number, dz: number, dir: { a: number; b: number }, half: number): boolean {
  // The cone is measured on the ground plane, or on the picture plane from the side.
  const pa = dx;
  const pb = mode === '2d-side' ? dy : dz;
  const plane = Math.hypot(pa, pb);
  // Someone right on top of the viewer is in front of it, whatever way it faces.
  const off = plane < 1e-6 ? 0 : Math.acos(clamp((pa * dir.a + pb * dir.b) / plane, -1, 1));
  return off <= half + ANGLE_SLACK;
}

export const visionSensorNode: NodeDef<VisionState> = {
  kind: 'vision-sensor',
  label: 'Tầm nhìn',
  category: 'logic',
  description:
    'Cho một nhân vật hoặc xe "đôi mắt": nó thấy được vật nằm trong hình quạt phía trước mặt, trong "Tầm xa" và "Góc nhìn". Nối "Mục tiêu" thì chỉ canh đúng vật đó; không nối thì canh mọi vật thuộc loại đã chọn ở "Tính loại nào" (không tính chính nó). Bật "Tường che mắt" thì khối rắn nằm giữa sẽ chặn tầm nhìn. "Vừa thấy" và "Vừa mất dấu" bật một nhịp. Khi chẳng thấy gì, "Khoảng cách" bằng "Tầm xa".',
  inputs: [
    { id: 'viewer', type: 'object', label: 'Người nhìn', required: true },
    { id: 'target', type: 'object', label: 'Mục tiêu' },
  ],
  outputs: [
    { id: 'seen', type: 'bool', label: 'Đang thấy' },
    { id: 'gained', type: 'bool', label: 'Vừa thấy' },
    { id: 'lost', type: 'bool', label: 'Vừa mất dấu' },
    { id: 'nearest', type: 'object', label: 'Vật gần nhất' },
    { id: 'distance', type: 'number', label: 'Khoảng cách' },
  ],
  params: [
    { id: 'range', label: 'Tầm xa (ô)', kind: 'number', default: 6, min: 0, max: 60, step: 0.5 },
    { id: 'angle', label: 'Góc nhìn (độ)', kind: 'number', default: 90, min: 1, max: 360, step: 5 },
    {
      id: 'walls',
      label: 'Tường che mắt',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có' },
        { value: 'no', label: 'Không' },
      ],
    },
    {
      id: 'filter',
      label: 'Tính loại nào (khi chưa nối Mục tiêu)',
      kind: 'select',
      default: 'player',
      options: [
        { value: 'character', label: 'Mọi nhân vật' },
        { value: 'player', label: 'Người chơi' },
        { value: 'bot', label: 'Bot' },
        { value: 'item', label: 'Đồ vật' },
        { value: 'vehicle', label: 'Phương tiện' },
      ],
    },
  ],
  create: () => ({ seen: false }),
  evaluate(ctx, i, params, s) {
    const range = Math.max(0, numParam(params, 'range', 6));
    const half = (clamp(numParam(params, 'angle', 90), 1, 360) / 2) * (Math.PI / 180);
    const walls = strParam(params, 'walls', 'yes') !== 'no';
    const filter = strParam(params, 'filter', 'player');
    const viewerId = asObject(i.viewer);
    const viewer = viewerId !== null ? ctx.world.getEntity(viewerId) : undefined;
    const targetId = asObject(i.target);
    const angleDeg = clamp(numParam(params, 'angle', 90), 1, 360);

    let note: VisionNote | null = null;
    let nearest: EntityId | null = null;
    let best = Infinity;
    if (viewer && viewer.visible && viewer.seatedIn === undefined) {
      note = { range, angle: angleDeg, walls, seen: false, tick: ctx.tick };
      noteVision(ctx.world, viewer.id, note);
      const dir = lookDirection(viewer, ctx.mode);
      const candidates: readonly EntityView[] =
        targetId !== null
          ? [ctx.world.getEntity(targetId)].filter((e): e is EntityView => e !== undefined)
          : ctx.world.listEntities().filter((e) => e.seatedIn === undefined && !e.inHand && e.fallen === undefined && matchesFilter(e, filter));
      for (const e of candidates) {
        if (e.id === viewer.id || !e.visible) continue;
        const dx = e.position.x - viewer.position.x;
        const dy = e.position.y - viewer.position.y;
        const dz = e.position.z - viewer.position.z;
        const dist = viewDistance(ctx.mode, dx, dy, dz);
        if (dist > range || dist >= best) continue;
        if (!insideCone(ctx.mode, dx, dy, dz, dir, half)) continue;
        if (walls && !ctx.world.lineOfSight(viewer.id, e.id)) continue;
        best = dist;
        nearest = e.id;
      }
    }
    const seen = nearest !== null;
    if (note) note.seen = seen;
    const gained = seen && !s.seen;
    const lost = !seen && s.seen;
    s.seen = seen;
    return { seen, gained, lost, nearest, distance: seen ? best : range };
  },
};
