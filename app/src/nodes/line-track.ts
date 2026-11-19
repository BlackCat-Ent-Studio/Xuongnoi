import type { EntityId, LineTrackSpec, NodeDef, ParamDef, Params, Vec3, ViewMode } from '../engine/types';
import { LINE_TRACK_LOOK, dedupePath, presetPath, smoothPath, type PlanePoint, type TrackShape } from '../world/line-track';
import { clamp, numParam, strParam, vec3Param } from './util';

export const TRACK_MAX_POINTS = 16;
const TRACK_MIN_POINTS = 2;
/** Points 1..8 are shown; 9..16 are folded under "Nâng cao". */
const CLASSIC_POINTS = 8;
const MIN_WIDTH = 0.02;
const MAX_WIDTH = 3;
const MAX_RADIUS = 5;
const MAX_SPAN = 200;

const SHAPES: readonly TrackShape[] = ['custom', 'straight', 'oval', 's-curve', 'eight'];

const DEFAULT_POINTS: readonly Vec3[] = [
  { x: -4, y: 0, z: -3 },
  { x: 4, y: 0, z: -3 },
  { x: 4, y: 0, z: 3 },
  { x: -4, y: 0, z: 3 },
  ...Array.from({ length: TRACK_MAX_POINTS - 4 }, () => ({ x: 0, y: 0, z: 0 })),
];

const POINT_PARAMS: ParamDef[] = DEFAULT_POINTS.map((p, i) => ({
  id: `p${i + 1}`,
  label: `Điểm ${i + 1} (chỉ dùng x và z; dạng "Tự vẽ")`,
  kind: 'vec3',
  default: p,
  place: 'point',
  ...(i >= CLASSIC_POINTS ? { advanced: true } : {}),
}));

const yesNo = [
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
];

function shapeOf(params: Params): TrackShape {
  const s = strParam(params, 'shape', 'oval');
  return (SHAPES as readonly string[]).includes(s) ? (s as TrackShape) : 'oval';
}

/** Height of the floor the line is painted on (the "Tâm" y). */
export function trackLevel(params: Params): number {
  return vec3Param(params, 'center', { x: 0, y: 0.5, z: 0 }).y;
}

/**
 * The painted line a set of params describes, in the plane of the view: (x, z) in the top-down and 3D views, and (x, floor
 * height) in the side view, where the line is a strip along the floor and the z values do not matter.
 */
export function trackSpecOf(params: Params, mode: ViewMode): LineTrackSpec {
  const side = mode === '2d-side';
  const centre = vec3Param(params, 'center', { x: 0, y: 0.5, z: 0 });
  const plane = (p: Vec3): PlanePoint => ({ u: p.x, v: side ? centre.y : p.z });
  const shape = shapeOf(params);
  let path: PlanePoint[];
  let closed: boolean;
  if (shape === 'custom') {
    const n = Math.round(clamp(numParam(params, 'count', 4), TRACK_MIN_POINTS, TRACK_MAX_POINTS));
    const raw: PlanePoint[] = [];
    for (let k = 0; k < n; k++) raw.push(plane(vec3Param(params, `p${k + 1}`, DEFAULT_POINTS[k]!)));
    closed = strParam(params, 'closed', 'yes') === 'yes';
    const radius = strParam(params, 'smooth', 'yes') === 'yes' ? clamp(numParam(params, 'radius', 1), 0, MAX_RADIUS) : 0;
    path = smoothPath(raw, closed, radius);
  } else {
    const length = clamp(numParam(params, 'length', 12), 0, MAX_SPAN);
    const breadth = clamp(numParam(params, 'breadth', 6), 0, MAX_SPAN);
    const preset = presetPath(shape, centre.x, side ? centre.y : centre.z, length, breadth);
    path = side ? preset.path.map((p) => ({ u: p.u, v: centre.y })) : preset.path;
    closed = preset.closed;
  }
  return { path: dedupePath(path, closed), closed, width: clamp(numParam(params, 'width', 0.2), MIN_WIDTH, MAX_WIDTH) };
}

export const lineTrackNode: NodeDef<{ id: EntityId }> = {
  kind: 'line-track',
  label: 'Đường line',
  category: 'object',
  description:
    'Một vạch sơn kẻ trên sàn (không cản đường, đi đè lên được) để robot dò theo. Chọn dạng có sẵn (đường thẳng, hình bầu dục, chữ S, số 8) hoặc tự vẽ bằng các điểm. Chỉnh được bề rộng, màu và độ bo tròn góc. Mảnh "Cảm biến dò line" đọc xem vật đang đứng trên vạch hay lệch ra ngoài.',
  inputs: [],
  outputs: [{ id: 'self', type: 'object', label: 'Đối tượng' }],
  params: [
    {
      id: 'shape',
      label: 'Dạng đường',
      kind: 'select',
      default: 'oval',
      options: [
        { value: 'oval', label: 'Hình bầu dục (vòng kín)' },
        { value: 'straight', label: 'Đường thẳng' },
        { value: 's-curve', label: 'Chữ S' },
        { value: 'eight', label: 'Số 8' },
        { value: 'custom', label: 'Tự vẽ bằng các điểm' },
      ],
    },
    { id: 'center', label: 'Tâm (x, z; y = độ cao mặt sàn, m)', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 }, place: 'point' },
    { id: 'length', label: 'Dài (m, các dạng có sẵn)', kind: 'number', default: 12, min: 1, max: MAX_SPAN, step: 0.5 },
    { id: 'breadth', label: 'Rộng (m, các dạng có sẵn)', kind: 'number', default: 6, min: 0, max: MAX_SPAN, step: 0.5 },
    { id: 'width', label: 'Bề rộng vạch (m)', kind: 'number', default: 0.2, min: MIN_WIDTH, max: MAX_WIDTH, step: 0.02 },
    { id: 'color', label: 'Màu vạch', kind: 'color', default: '#111111' },
    { id: 'count', label: 'Số điểm (dạng "Tự vẽ")', kind: 'number', default: 4, min: TRACK_MIN_POINTS, max: TRACK_MAX_POINTS, step: 1 },
    { id: 'closed', label: 'Khép kín thành vòng (dạng "Tự vẽ")', kind: 'select', default: 'yes', options: yesNo },
    { id: 'smooth', label: 'Bo tròn góc (dạng "Tự vẽ")', kind: 'select', default: 'yes', options: yesNo },
    { id: 'radius', label: 'Bán kính bo góc (m)', kind: 'number', default: 1, min: 0, max: MAX_RADIUS, step: 0.1 },
    ...POINT_PARAMS,
  ],
  // The line is built once when the game starts; only the colour can change while it runs.
  createOnly: ['shape', 'center', 'length', 'breadth', 'width', 'count', 'closed', 'smooth', 'radius', ...POINT_PARAMS.map((p) => p.id)],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const track = trackSpecOf(params, ctx.world.mode);
    const level = trackLevel(params);
    const side = ctx.world.mode === '2d-side';
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of track.path) {
      minU = Math.min(minU, p.u);
      maxU = Math.max(maxU, p.u);
      minV = Math.min(minV, p.v);
      maxV = Math.max(maxV, p.v);
    }
    if (track.path.length === 0) minU = maxU = minV = maxV = 0;
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      // The box only marks where the line is (picking, framing); nothing collides with it.
      position: { x: (minU + maxU) / 2, y: level, z: side ? 0 : (minV + maxV) / 2 },
      size: { x: maxU - minU + track.width, y: 0.02, z: side ? 0.1 : maxV - minV + track.width },
      color: strParam(params, 'color', '#111111'),
      look: LINE_TRACK_LOOK,
      solid: false,
      zone: true,
      track,
    });
    return { id };
  },
  evaluate(_ctx, _i, _params, s) {
    return { self: s.id };
  },
};
