import type { EntityId, EntityView, NodeDef, ViewMode, WorldApi } from '../engine/types';
import { setTileHeld } from '../engine/render-hints';
import { clamp, numParam, strParam, vec3Param } from './util';

/** `look` of the block a floor marker is: the renderer draws it as a flat numbered tile, and marker readers find it by this. */
export const FLOOR_MARKER_LOOK = 'floor-marker';
export const MARKER_MAX_NUMBER = 999;
const MIN_SIZE = 0.2;
const MAX_SIZE = 10;
const THICKNESS = 0.02;

/**
 * A marker with arrows carries them as its block style: this prefix, then the letters of the directions a robot may leave
 * the tile in (E = +x, W = -x, S = +z, N = -z). A marker without arrows has no block style at all.
 */
export const MARKER_EXITS_PREFIX = 'marker-exits:';
export type ExitDir = 'E' | 'W' | 'S' | 'N';
/** Fixed order of the letters, and the step each one takes on the floor. */
export const EXIT_DIRS: readonly ExitDir[] = ['E', 'W', 'S', 'N'];
export const EXIT_STEP: Record<ExitDir, { x: number; z: number }> = { E: { x: 1, z: 0 }, W: { x: -1, z: 0 }, S: { x: 0, z: 1 }, N: { x: 0, z: -1 } };

/** The arrow letters in `raw`, each once, in the fixed order; '' for none (also for 'none' and anything unknown). */
export function exitLetters(raw: unknown): string {
  if (typeof raw !== 'string' || raw === 'none') return '';
  return EXIT_DIRS.filter((d) => raw.includes(d)).join('');
}

/** A marker as the pieces that read markers see it: its number, where its middle is and how wide the tile is. */
export interface MarkerSpot {
  id: EntityId;
  number: number;
  x: number;
  z: number;
  /** Side of the square tile, metres. */
  size: number;
  /** Height the tile is painted at, metres. */
  y: number;
  /** Letters of the directions its arrows point in ('' = no arrows). */
  exits: string;
}

/** Number written on a marker tile (1..999); 0 for anything that is not a marker. */
export function markerNumber(view: EntityView): number {
  if (view.kind !== 'block' || view.look !== FLOOR_MARKER_LOOK) return 0;
  const n = Number(view.label);
  return Number.isInteger(n) && n >= 1 && n <= MARKER_MAX_NUMBER ? n : 0;
}

/** Letters of the arrows painted on a marker tile; '' for a marker without arrows and for anything that is not a marker. */
export function markerExits(view: EntityView): string {
  if (view.kind !== 'block' || view.look !== FLOOR_MARKER_LOOK || !view.blockStyle?.startsWith(MARKER_EXITS_PREFIX)) return '';
  return exitLetters(view.blockStyle.slice(MARKER_EXITS_PREFIX.length));
}

/** Every visible marker on the board, in the order the cards made them. */
export function listMarkers(world: WorldApi): MarkerSpot[] {
  const out: MarkerSpot[] = [];
  for (const e of world.listEntities()) {
    if (!e.visible) continue;
    const number = markerNumber(e);
    if (number > 0) out.push({ id: e.id, number, x: e.position.x, z: e.position.z, size: e.size.x, y: e.position.y, exits: markerExits(e) });
  }
  return out;
}

/** The first visible marker carrying `number`, or null. Two markers with one number: the card made first wins. */
export function markerByNumber(world: WorldApi, number: number): MarkerSpot | null {
  if (!Number.isInteger(number) || number < 1) return null;
  return listMarkers(world).find((m) => m.number === number) ?? null;
}

/** Two heights closer than this are one floor: tiles painted on it are told apart by their middles only. */
const SAME_HEIGHT = 1e-6;

/**
 * The marker among `markers` whose tile the point stands on, or null. When tiles overlap: with a height `y` (the feet of
 * whoever reads) the tile nearest in height wins, so a robot on a raised deck reads the deck's tiles and one below reads
 * the ground's; among tiles at one height (and always without `y`) the nearest middle wins. The side view shows the floor
 * edge-on, so only x counts there.
 */
export function markerAt(markers: readonly MarkerSpot[], mode: ViewMode, at: { x: number; z: number; y?: number }): MarkerSpot | null {
  let best: MarkerSpot | null = null;
  let bestD = Infinity;
  let bestH = Infinity;
  for (const m of markers) {
    const dx = Math.abs(at.x - m.x);
    const dz = mode === '2d-side' ? 0 : Math.abs(at.z - m.z);
    if (dx > m.size / 2 || dz > m.size / 2) continue;
    const d = Math.hypot(dx, dz);
    const h = at.y === undefined ? 0 : Math.abs(at.y - m.y);
    if (h < bestH - SAME_HEIGHT || (h <= bestH + SAME_HEIGHT && d < bestD)) {
      best = m;
      bestD = d;
      bestH = h;
    }
  }
  return best;
}

/** `markerAt` over every visible marker of the board. */
export function markerUnder(world: WorldApi, mode: ViewMode, at: { x: number; z: number; y?: number }): MarkerSpot | null {
  return markerAt(listMarkers(world), mode, at);
}

/** Where the underside of an object is: the point a marker reader looks down from. */
export function feetOf(e: EntityView): { x: number; y: number; z: number } {
  return { x: e.position.x, y: e.position.y - e.size.y / 2, z: e.position.z };
}

function numberOf(raw: number): number {
  return Math.round(clamp(raw, 1, MARKER_MAX_NUMBER));
}

/**
 * A numbered tile painted on the floor: a place with a name. Nothing collides with it and nothing weighs on it; it only
 * tells where it is, so a robot can be sent to it ("Đi tới điểm") and can read which tile it stands on ("Đọc mốc sàn").
 * Arrows painted on it say which way a robot may leave it: that is all a one-way lane is.
 */
export const floorMarkerNode: NodeDef<{ id: EntityId }> = {
  kind: 'floor-marker',
  label: 'Mốc sàn',
  category: 'object',
  description:
    'Một ô đánh số sơn trên sàn để đánh dấu một chỗ: trạm nhận hàng, cửa số 3, chỗ đỗ... Ô không cản đường, đi đè lên được. Cho ra vị trí X, Z của nó để mảnh "Đi tới điểm" lái robot tới; mảnh "Đọc mốc sàn" cho robot biết mình đang đứng trên mốc số mấy; mảnh "Tìm mốc sàn" đổi một con số thành mốc mang số đó. Có thể vẽ thêm mũi tên chiều đi lên ô để làm làn một chiều: mảnh "Tìm đường trên lưới" chỉ đi theo mũi tên.',
  inputs: [],
  outputs: [
    { id: 'self', type: 'object', label: 'Đối tượng' },
    { id: 'x', type: 'number', label: 'X' },
    { id: 'z', type: 'number', label: 'Z' },
    { id: 'number', type: 'number', label: 'Số mốc' },
  ],
  params: [
    { id: 'number', label: `Số mốc (1-${MARKER_MAX_NUMBER})`, kind: 'number', default: 1, min: 1, max: MARKER_MAX_NUMBER, step: 1 },
    { id: 'position', label: 'Vị trí (x, z; y = độ cao mặt sàn, m)', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 }, place: 'point' },
    { id: 'size', label: 'Cỡ ô (m)', kind: 'number', default: 1, min: MIN_SIZE, max: MAX_SIZE, step: 0.1 },
    { id: 'color', label: 'Màu', kind: 'color', default: '#f59e0b' },
    {
      id: 'exits',
      label: 'Mũi tên chiều đi (vẽ trên ô)',
      kind: 'select',
      default: 'none',
      options: [
        { value: 'none', label: 'Không có mũi tên' },
        { value: 'E', label: '→ sang phải (+x)' },
        { value: 'W', label: '← sang trái (-x)' },
        { value: 'S', label: '↓ xuống dưới (+z)' },
        { value: 'N', label: '↑ lên trên (-z)' },
        { value: 'ES', label: '→ ↓ ngã rẽ: sang phải hoặc xuống dưới' },
        { value: 'EN', label: '→ ↑ ngã rẽ: sang phải hoặc lên trên' },
        { value: 'WS', label: '← ↓ ngã rẽ: sang trái hoặc xuống dưới' },
        { value: 'WN', label: '← ↑ ngã rẽ: sang trái hoặc lên trên' },
        { value: 'EWSN', label: '✥ đi hướng nào cũng được' },
      ],
    },
  ],
  // The tile is painted once when the run starts; only its colour can change while it runs.
  createOnly: ['number', 'position', 'size', 'exits'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const side = ctx.world.mode === '2d-side';
    const at = vec3Param(params, 'position', { x: 0, y: 0.5, z: 0 });
    const size = clamp(numParam(params, 'size', 1), MIN_SIZE, MAX_SIZE);
    const exits = exitLetters(strParam(params, 'exits', 'none'));
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: { x: at.x, y: at.y, z: side ? 0 : at.z },
      size: { x: size, y: THICKNESS, z: side ? 0.1 : size },
      color: strParam(params, 'color', '#f59e0b'),
      look: FLOOR_MARKER_LOOK,
      // The number travels as the tile's text: it is what is written on it.
      label: String(numberOf(numParam(params, 'number', 1))),
      // The arrows travel as the tile's style, and only when there are some: a marker without arrows is the tile it always was.
      ...(exits ? { blockStyle: `${MARKER_EXITS_PREFIX}${exits}` } : {}),
      solid: false,
      zone: true,
    });
    // A fresh tile is free: whatever "Bảng giữ ô" marked in the run before is gone.
    setTileHeld(ctx.nodeId, id, false);
    return { id };
  },
  evaluate(ctx, _i, params, s) {
    const e = ctx.world.getEntity(s.id);
    return { self: s.id, x: e?.position.x ?? 0, z: e?.position.z ?? 0, number: numberOf(numParam(params, 'number', 1)) };
  },
};
