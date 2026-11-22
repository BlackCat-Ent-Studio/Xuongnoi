import type { EntityId, EntityView, NodeDef, ViewMode, WorldApi } from '../engine/types';
import { clamp, numParam, strParam, vec3Param } from './util';

/** `look` of the block a floor marker is: the renderer draws it as a flat numbered tile, and marker readers find it by this. */
export const FLOOR_MARKER_LOOK = 'floor-marker';
export const MARKER_MAX_NUMBER = 99;
const MIN_SIZE = 0.2;
const MAX_SIZE = 10;
const THICKNESS = 0.02;

/** A marker as the pieces that read markers see it: its number, where its middle is and how wide the tile is. */
export interface MarkerSpot {
  id: EntityId;
  number: number;
  x: number;
  z: number;
  /** Side of the square tile, metres. */
  size: number;
}

/** Number written on a marker tile (1..99); 0 for anything that is not a marker. */
export function markerNumber(view: EntityView): number {
  if (view.kind !== 'block' || view.look !== FLOOR_MARKER_LOOK) return 0;
  const n = Number(view.label);
  return Number.isInteger(n) && n >= 1 && n <= MARKER_MAX_NUMBER ? n : 0;
}

/** Every visible marker on the board, in the order the cards made them. */
export function listMarkers(world: WorldApi): MarkerSpot[] {
  const out: MarkerSpot[] = [];
  for (const e of world.listEntities()) {
    if (!e.visible) continue;
    const number = markerNumber(e);
    if (number > 0) out.push({ id: e.id, number, x: e.position.x, z: e.position.z, size: e.size.x });
  }
  return out;
}

/** The first visible marker carrying `number`, or null. Two markers with one number: the card made first wins. */
export function markerByNumber(world: WorldApi, number: number): MarkerSpot | null {
  if (!Number.isInteger(number) || number < 1) return null;
  return listMarkers(world).find((m) => m.number === number) ?? null;
}

/**
 * The marker whose tile the point stands on (the nearest middle when tiles overlap), or null. The side view shows the
 * floor edge-on, so only x counts there.
 */
export function markerUnder(world: WorldApi, mode: ViewMode, at: { x: number; z: number }, feetY?: number): MarkerSpot | null {
  let best: MarkerSpot | null = null;
  let bestD = Infinity;
  for (const m of listMarkers(world)) {
    // EXPERIMENTAL (spike/deck, not for merge): only a marker painted on the floor the object stands on is read.
    if (import.meta.env.VITE_SPIKE_MARKER_LEVEL && feetY !== undefined && Math.abs((world.getEntity(m.id)?.position.y ?? feetY) - feetY) > Number(import.meta.env.VITE_SPIKE_MARKER_LEVEL)) continue;
    const dx = Math.abs(at.x - m.x);
    const dz = mode === '2d-side' ? 0 : Math.abs(at.z - m.z);
    if (dx > m.size / 2 || dz > m.size / 2) continue;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function numberOf(raw: number): number {
  return Math.round(clamp(raw, 1, MARKER_MAX_NUMBER));
}

/**
 * A numbered tile painted on the floor: a place with a name. Nothing collides with it and nothing weighs on it; it only
 * tells where it is, so a robot can be sent to it ("Đi tới điểm") and can read which tile it stands on ("Đọc mốc sàn").
 */
export const floorMarkerNode: NodeDef<{ id: EntityId }> = {
  kind: 'floor-marker',
  label: 'Mốc sàn',
  category: 'object',
  description:
    'Một ô đánh số sơn trên sàn để đánh dấu một chỗ: trạm nhận hàng, cửa số 3, chỗ đỗ... Ô không cản đường, đi đè lên được. Cho ra vị trí X, Z của nó để mảnh "Đi tới điểm" lái robot tới; mảnh "Đọc mốc sàn" cho robot biết mình đang đứng trên mốc số mấy; mảnh "Tìm mốc sàn" đổi một con số thành mốc mang số đó.',
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
  ],
  // The tile is painted once when the run starts; only its colour can change while it runs.
  createOnly: ['number', 'position', 'size'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const side = ctx.world.mode === '2d-side';
    const at = vec3Param(params, 'position', { x: 0, y: 0.5, z: 0 });
    const size = clamp(numParam(params, 'size', 1), MIN_SIZE, MAX_SIZE);
    const id = ctx.world.spawn({
      kind: 'block',
      ownerNodeId: ctx.nodeId,
      position: { x: at.x, y: at.y, z: side ? 0 : at.z },
      size: { x: size, y: THICKNESS, z: side ? 0.1 : size },
      color: strParam(params, 'color', '#f59e0b'),
      look: FLOOR_MARKER_LOOK,
      // The number travels as the tile's text: it is what is written on it.
      label: String(numberOf(numParam(params, 'number', 1))),
      solid: false,
      zone: true,
    });
    return { id };
  },
  evaluate(ctx, _i, params, s) {
    const e = ctx.world.getEntity(s.id);
    return { self: s.id, x: e?.position.x ?? 0, z: e?.position.z ?? 0, number: numberOf(numParam(params, 'number', 1)) };
  },
};
