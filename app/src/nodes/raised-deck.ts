import type { EntityId, NodeDef, Params, ViewMode } from '../engine/types';
import { clamp, numParam, strParam, vec3Param } from './util';

/** `look` of the plates a raised deck is made of: the renderer draws them as a steel mezzanine floor. */
export const RAISED_DECK_LOOK = 'raised-deck';

export const DECK_MAX_HOLES = 5;
const MIN_HOLE = 0.3;
const MAX_HOLE = 3;
/** Narrowest strip of floor left between two holes (m). */
const MIN_LAND = 0.1;
const MAX_PITCH = 10;
const MIN_MARGIN = 0.1;
const MAX_MARGIN = 10;
const MIN_THICKNESS = 0.05;
const MAX_THICKNESS = 1;
const MAX_TOP = 20;
/** Thickness of the deck where it is only paint on the floor (the top-down view). */
const PAINT = 0.02;

const DEFAULT_POSITION = { x: 0, y: 0.5, z: 0 };
const DEFAULT_COLOR = '#93a1b3';

/** The shape of a deck seen from above; every length in metres. */
export interface DeckShape {
  /** Holes along x and along z. */
  cols: number;
  rows: number;
  /** Side of a square hole. */
  hole: number;
  /** Distance between the middles of two neighbouring holes. */
  pitch: number;
  /** Floor left between an outer hole and the edge of the deck. */
  margin: number;
}

/** A rectangle of floor, measured from the middle of the deck. */
export interface DeckPlate {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** What the renderer needs to draw the trim of a whole deck: its shape, how thick the floor is and how far the legs reach down (0 = no legs). */
export interface DeckFrame extends DeckShape {
  thickness: number;
  legs: number;
}

/** The shape the settings ask for, with every number brought into its allowed range. */
export function deckShape(params: Params): DeckShape {
  const hole = clamp(numParam(params, 'hole', 0.7), MIN_HOLE, MAX_HOLE);
  return {
    cols: Math.round(clamp(numParam(params, 'holeCols', 1), 1, DECK_MAX_HOLES)),
    rows: Math.round(clamp(numParam(params, 'holeRows', 1), 1, DECK_MAX_HOLES)),
    hole,
    pitch: clamp(numParam(params, 'pitch', 2), hole + MIN_LAND, MAX_PITCH),
    margin: clamp(numParam(params, 'margin', 1.3), MIN_MARGIN, MAX_MARGIN),
  };
}

/** Full size of the deck along x and z. */
export function deckSize(s: DeckShape): { x: number; z: number } {
  return { x: (s.cols - 1) * s.pitch + s.hole + 2 * s.margin, z: (s.rows - 1) * s.pitch + s.hole + 2 * s.margin };
}

/** Middles of the holes along one axis, for `count` holes. */
export function holeCentres(count: number, pitch: number): number[] {
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * pitch);
}

/** The stretches of floor left along one axis once the holes are cut out of -half..half. */
function lands(half: number, centres: readonly number[], hole: number): [number, number][] {
  const out: [number, number][] = [];
  let from = -half;
  for (const c of centres) {
    out.push([from, c - hole / 2]);
    from = c + hole / 2;
  }
  out.push([from, half]);
  return out;
}

/**
 * The fewest rectangles that cover the deck and leave the holes open: a full-length strip between the rows of holes (and
 * one before the first row and after the last), then, row by row, the short pieces between the holes of that row.
 * rows + 1 strips and rows x (cols + 1) pieces: 4 for one hole, 16 for 3 x 3.
 */
export function deckPlates(s: DeckShape): DeckPlate[] {
  const size = deckSize(s);
  const xs = holeCentres(s.cols, s.pitch);
  const zs = holeCentres(s.rows, s.pitch);
  const out: DeckPlate[] = [];
  for (const [z0, z1] of lands(size.z / 2, zs, s.hole)) out.push({ x0: -size.x / 2, x1: size.x / 2, z0, z1 });
  for (const zc of zs) for (const [x0, x1] of lands(size.x / 2, xs, s.hole)) out.push({ x0, x1, z0: zc - s.hole / 2, z1: zc + s.hole / 2 });
  return out;
}

/**
 * The plates the world gets in a view. The 3D view and the top-down view lay the whole deck; the side view shows a cut
 * through the middle row of holes (everything sits on one plane there, so the full strips would close the holes).
 */
export function platesFor(s: DeckShape, mode: ViewMode): DeckPlate[] {
  const plates = deckPlates(s);
  if (mode !== '2d-side') return plates;
  const middleRow = Math.floor((s.rows - 1) / 2);
  const from = s.rows + 1 + middleRow * (s.cols + 1);
  return plates.slice(from, from + s.cols + 1);
}

const FRAME_FIELDS = 7;

/** The trim of a deck written as the text its first plate carries. */
export function frameLabel(f: DeckFrame): string {
  return [f.cols, f.rows, f.hole, f.pitch, f.margin, f.thickness, f.legs].join('|');
}

/** Reads `frameLabel` back; null for anything else. */
export function frameOfLabel(label: string | undefined): DeckFrame | null {
  const n = (label ?? '').split('|').map(Number);
  if (n.length !== FRAME_FIELDS || n.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const [cols, rows, hole, pitch, margin, thickness, legs] = n as [number, number, number, number, number, number, number];
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > DECK_MAX_HOLES || rows > DECK_MAX_HOLES || hole <= 0 || pitch <= hole) return null;
  return { cols, rows, hole, pitch, margin, thickness, legs };
}

interface DeckState {
  /** Every plate, the first full strip first. */
  ids: EntityId[];
}

/**
 * A steel floor on legs with a grid of square holes: an upper level robots drive on while parcels dropped into a hole
 * land on the level below. It is nothing but plain solid plates (the same solid a "Vật thể" is), so everything that
 * works on a block works on it. The trim and the legs are drawn only.
 */
export const raisedDeckNode: NodeDef<DeckState> = {
  kind: 'raised-deck',
  label: 'Sàn nâng có lỗ',
  category: 'object',
  description:
    'Một tầng sàn thép đặt trên cao, có các lỗ vuông xếp thành hàng và cột. Robot chạy trên mặt sàn như chạy trên mặt đất; kiện hàng thả vào lỗ thì rơi xuống tầng dưới; robot ở tầng dưới chạy bên dưới sàn không bị ảnh hưởng. Sàn được ghép từ các tấm rắn giống "Vật thể" (1 lỗ = 4 tấm, 3 x 3 lỗ = 16 tấm). Viền vàng quanh lỗ, viền xanh quanh mép sàn và các chân trụ chỉ là hình vẽ, không cản thứ gì. Dùng ở góc nhìn 3D. Ở góc nhìn ngang, sàn hiện thành một lát cắt qua hàng lỗ giữa; ở góc nhìn từ trên xuống, sàn chỉ là hình vẽ trên nền, không cản đường.',
  inputs: [],
  outputs: [{ id: 'self', type: 'object', label: 'Đối tượng' }],
  params: [
    { id: 'position', label: 'Vị trí (y = mặt đất bên dưới)', kind: 'vec3', default: DEFAULT_POSITION, place: 'point' },
    { id: 'top', label: 'Cao mặt sàn (m)', kind: 'number', default: 2.6, min: 0.3, max: MAX_TOP, step: 0.1 },
    { id: 'holeCols', label: 'Số lỗ theo trục X', kind: 'number', default: 1, min: 1, max: DECK_MAX_HOLES, step: 1 },
    { id: 'holeRows', label: 'Số lỗ theo trục Z', kind: 'number', default: 1, min: 1, max: DECK_MAX_HOLES, step: 1 },
    { id: 'hole', label: 'Cạnh lỗ (m)', kind: 'number', default: 0.7, min: MIN_HOLE, max: MAX_HOLE, step: 0.05 },
    { id: 'pitch', label: 'Khoảng cách giữa hai lỗ (m)', kind: 'number', default: 2, min: MIN_HOLE + MIN_LAND, max: MAX_PITCH, step: 0.1 },
    { id: 'margin', label: 'Lề quanh lỗ ngoài cùng (m)', kind: 'number', default: 1.3, min: MIN_MARGIN, max: MAX_MARGIN, step: 0.1 },
    { id: 'thickness', label: 'Bề dày sàn (m)', kind: 'number', default: 0.2, min: MIN_THICKNESS, max: MAX_THICKNESS, step: 0.05 },
    { id: 'color', label: 'Màu mặt sàn', kind: 'color', default: DEFAULT_COLOR },
    {
      id: 'legs',
      label: 'Vẽ chân trụ',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (chỉ là hình vẽ, không cản đường)' },
        { value: 'no', label: 'Không' },
      ],
    },
  ],
  // The plates are laid once when the run starts; only the colour can change while it runs.
  createOnly: ['position', 'top', 'holeCols', 'holeRows', 'hole', 'pitch', 'margin', 'thickness', 'legs'],
  liveApply: {
    color: (ctx, p, s) => {
      for (const id of s.ids) ctx.world.setEntityStyle(id, { color: String(p.color) });
    },
  },
  create(ctx, params) {
    const mode = ctx.world.mode;
    const shape = deckShape(params);
    const at = vec3Param(params, 'position', DEFAULT_POSITION);
    // Seen from straight above there is no height: the deck is paint on the floor, blocks nothing and hides nothing that stands on it.
    const flat = mode === '2d-top';
    const thickness = flat ? PAINT : clamp(numParam(params, 'thickness', 0.2), MIN_THICKNESS, MAX_THICKNESS);
    // The floor never dips below the ground it stands on.
    const top = flat ? PAINT : clamp(numParam(params, 'top', 2.6), thickness, MAX_TOP);
    const legs = !flat && strParam(params, 'legs', 'yes') !== 'no' ? top - thickness : 0;
    const color = strParam(params, 'color', DEFAULT_COLOR);
    const ids = platesFor(shape, mode).map((p, i) =>
      ctx.world.spawn({
        kind: 'block',
        ownerNodeId: ctx.nodeId,
        position: { x: at.x + (p.x0 + p.x1) / 2, y: at.y + top - thickness / 2, z: at.z + (p.z0 + p.z1) / 2 },
        size: { x: p.x1 - p.x0, y: thickness, z: p.z1 - p.z0 },
        color,
        look: RAISED_DECK_LOOK,
        solid: !flat,
        ...(flat ? { zone: true } : {}),
        // The first plate carries the shape of the whole deck, so the trim and the legs are drawn once.
        ...(i === 0 && mode !== '2d-side' ? { label: frameLabel({ ...shape, thickness, legs }) } : {}),
      }),
    );
    return { ids };
  },
  evaluate(_ctx, _i, _params, s) {
    return { self: s.ids[0] ?? null };
  },
};
