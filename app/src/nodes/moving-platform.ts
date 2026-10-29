import type { EntityId, NodeDef, Vec3, ViewMode } from '../engine/types';
import { numParam, strParam, vec3Param } from './util';

interface PlatformState {
  id: EntityId;
  a: Vec3;
  b: Vec3;
  /** +1 heading for B, -1 heading for A. */
  dir: 1 | -1;
  /** Seconds left to rest at an end. */
  rest: number;
  /** One-way platforms that reached B. */
  parked: boolean;
}

/** Position with the axes the view mode does not have pinned to the platform's own. */
function inPlane(mode: ViewMode, p: Vec3, ref: Vec3): Vec3 {
  if (mode === '2d-side') return { x: p.x, y: p.y, z: ref.z };
  if (mode === '2d-top') return { x: p.x, y: ref.y, z: p.z };
  return p;
}

export const movingPlatformNode: NodeDef<PlatformState> = {
  kind: 'moving-platform',
  label: 'Bệ di chuyển',
  category: 'object',
  description:
    'Một bệ rắn tự chạy từ điểm A (vị trí đặt) tới điểm B rồi quay lại. Nhân vật, đồ vật, xe đứng trên bệ sẽ đi theo; ai đứng cạnh thì bị đẩy đi. Bệ không bao giờ ép ai vào tường: bị kẹt thì nó dừng chờ. Tắt "Chạy" để bệ đứng yên. Bot tìm đường coi bệ này như chỗ trống (không tính là đất cố định).',
  inputs: [{ id: 'run', type: 'bool', label: 'Chạy', default: true }],
  outputs: [
    { id: 'self', type: 'object', label: 'Bệ' },
    { id: 'moving', type: 'bool', label: 'Đang chạy' },
    { id: 'arrived', type: 'bool', label: 'Vừa tới đầu mút' },
  ],
  params: [
    { id: 'position', label: 'Điểm A (xuất phát)', kind: 'vec3', default: { x: 0, y: 0, z: 0 } },
    { id: 'to', label: 'Điểm B', kind: 'vec3', default: { x: 4, y: 0, z: 0 } },
    { id: 'size', label: 'Kích thước', kind: 'vec3', default: { x: 3, y: 0.5, z: 1 } },
    { id: 'color', label: 'Màu', kind: 'color', default: '#f59e0b' },
    { id: 'speed', label: 'Tốc độ (khối/giây)', kind: 'number', default: 2, min: 0.1, max: 20, step: 0.1 },
    { id: 'wait', label: 'Nghỉ ở mỗi đầu (giây)', kind: 'number', default: 1, min: 0, max: 30, step: 0.5 },
    {
      id: 'loop',
      label: 'Cách chạy',
      kind: 'select',
      default: 'pingpong',
      options: [
        { value: 'pingpong', label: 'Qua lại mãi' },
        { value: 'once', label: 'Một chiều (dừng ở B)' },
      ],
    },
  ],
  createOnly: ['position', 'size', 'color', 'to'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const a = vec3Param(params, 'position', { x: 0, y: 0, z: 0 });
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: a,
      size: vec3Param(params, 'size', { x: 3, y: 0.5, z: 1 }),
      color: strParam(params, 'color', '#f59e0b'),
      solid: true,
    });
    return { id, a, b: inPlane(ctx.mode, vec3Param(params, 'to', { x: 4, y: 0, z: 0 }), a), dir: 1, rest: 0, parked: false };
  },
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const view = world.getEntity(s.id);
    const idle = { self: s.id, moving: false, arrived: false };
    if (!view || !view.visible) return idle;

    if (s.rest > 0) {
      s.rest = Math.max(0, s.rest - ctx.dt);
      return idle;
    }
    // The engine resolves an unwired run port to its default (true); treat a missing key the same way.
    const run = i.run === undefined ? true : i.run === true;
    if (!run || s.parked) return idle;

    const target = s.dir > 0 ? s.b : s.a;
    const cur = view.position;
    const dx = target.x - cur.x;
    const dy = target.y - cur.y;
    const dz = target.z - cur.z;
    const dist = Math.hypot(dx, dy, dz);
    const step = Math.max(0.1, numParam(params, 'speed', 2)) * ctx.dt;

    if (dist <= step + 1e-9) {
      // Close enough: land exactly on the end, then rest. A blocked landing is retried next tick.
      if (!world.moveBlock(s.id, target)) return idle;
      s.rest = Math.max(0, numParam(params, 'wait', 1));
      if (strParam(params, 'loop', 'pingpong') === 'once' && s.dir > 0) s.parked = true;
      else s.dir = s.dir > 0 ? -1 : 1;
      return { self: s.id, moving: false, arrived: true };
    }
    const k = step / dist;
    const moved = world.moveBlock(s.id, { x: cur.x + dx * k, y: cur.y + dy * k, z: cur.z + dz * k });
    return { self: s.id, moving: moved, arrived: false };
  },
};
