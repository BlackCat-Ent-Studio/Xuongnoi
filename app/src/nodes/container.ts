import type { EntityId, EntityView, NodeDef, Params, Vec3, ViewMode, WorldApi } from '../engine/types';
import { CLASSIC_LOOK, type LookOption } from '../engine/factory-looks';
import { clamp, numParam, strParam, vec3Param } from './util';

/** `look` of every block a cage is made of: the renderer draws the cage from them. */
export const CONTAINER_LOOK = 'container';
/** The draw-only look a new cage has: mesh walls on four small wheels, so what lies inside stays in view. */
export const ROLL_CAGE_LOOK = 'roll-cage';
export const CONTAINER_LOOKS: readonly LookOption[] = [
  { value: ROLL_CAGE_LOOK, label: 'Lồng lưới có bánh (nhìn thấy vật bên trong)' },
  { value: CLASSIC_LOOK, label: 'Thùng hộp kín (thành phẳng)' },
];

/** Thickness of the floor plate and of every wall (m). */
export const CONTAINER_THICK = 0.05;
/**
 * Text a wall carries (the floor plate carries the shape of the whole cage): a wall of the mesh cage draws nothing of its
 * own, a wall of the closed box is drawn as the flat board it is.
 */
export const CONTAINER_WALL_LABEL = 'wall';
export const CONTAINER_BOARD_LABEL = 'board';
export const CONTAINER_MAX_CAPACITY = 24;
/** Thickness of the cage where it is only paint on the floor (the top-down view). */
const PAINT = 0.02;

const DEFAULT_POSITION = { x: 0, y: 0.5, z: 0 };
const DEFAULT_COLOR = '#aab2bd';
const DEFAULT_INSIDE = 1;
const DEFAULT_WALL = 1;
const DEFAULT_CLEARANCE = 0.35;
const DEFAULT_CAPACITY = 6;
const DEFAULT_MASS = 20;

/** The shape of a cage; every length in metres. */
export interface ContainerShape {
  /** Clear width between the walls, the same along x and z. */
  inside: number;
  /** Height of the walls above the top of the floor plate. */
  wall: number;
  /** Free height under the floor plate: the room a carrier needs to drive under. */
  clearance: number;
  /** True = drawn as the closed box, false = as the mesh roll cage. */
  classic: boolean;
}

/** The shape the settings ask for, with every number brought into its allowed range. */
export function containerShape(params: Params): ContainerShape {
  return {
    inside: clamp(numParam(params, 'inside', DEFAULT_INSIDE), 0.3, 3),
    wall: clamp(numParam(params, 'wall', DEFAULT_WALL), 0.2, 3),
    clearance: clamp(numParam(params, 'clearance', DEFAULT_CLEARANCE), CONTAINER_THICK, 2),
    classic: strParam(params, 'look', ROLL_CAGE_LOOK) === CLASSIC_LOOK,
  };
}

/** One solid block of a cage: its middle against the ground point under the middle of the cage, and its size. */
export interface ContainerPart {
  at: Vec3;
  size: Vec3;
}

/**
 * The blocks of a cage, the floor plate first, then the walls at -x, +x, -z, +z. The side view shows a cut through the
 * middle (everything sits on one plane there, so the two walls across z would close the cage): the plate and two walls.
 */
export function containerParts(s: ContainerShape, mode: ViewMode): ContainerPart[] {
  const t = CONTAINER_THICK;
  const outer = s.inside + 2 * t;
  const wy = s.clearance + t + s.wall / 2;
  const reach = s.inside / 2 + t / 2;
  const parts: ContainerPart[] = [
    { at: { x: 0, y: s.clearance + t / 2, z: 0 }, size: { x: outer, y: t, z: outer } },
    { at: { x: -reach, y: wy, z: 0 }, size: { x: t, y: s.wall, z: outer } },
    { at: { x: reach, y: wy, z: 0 }, size: { x: t, y: s.wall, z: outer } },
  ];
  if (mode === '2d-side') return parts;
  parts.push({ at: { x: 0, y: wy, z: -reach }, size: { x: s.inside, y: s.wall, z: t } }, { at: { x: 0, y: wy, z: reach }, size: { x: s.inside, y: s.wall, z: t } });
  return parts;
}

/** The shape of a cage written as the text its floor plate carries. */
export function containerLabel(s: ContainerShape): string {
  return [s.inside, s.wall, s.clearance, s.classic ? 1 : 0].join('|');
}

/** Reads `containerLabel` back; null for anything else (a wall, or a block of another piece). */
export function containerOfLabel(label: string | undefined): ContainerShape | null {
  const n = (label ?? '').split('|').map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const [inside, wall, clearance, classic] = n as [number, number, number, number];
  if (inside <= 0 || wall <= 0) return null;
  return { inside, wall, clearance, classic: classic === 1 };
}

/**
 * Every block of the cage that `id` is a block of, the floor plate first; empty when `id` is no block of a cage.
 *
 * This is all a piece needs to move a cage: it gets the cage's "Đối tượng" (the floor plate) on a wire and sends
 * `world.moveBlocks(containerBlocks(world, id), to)` every tick the cage moves, where `to` is the new middle of the floor
 * plate. Floor and walls then go as one body and whatever lies inside rides along. The cage itself never moves: how fast
 * it starts and stops is the mover's to decide.
 */
export function containerBlocks(world: Pick<WorldApi, 'getEntity' | 'listEntities'>, id: EntityId): EntityId[] {
  const v = world.getEntity(id);
  if (!v || v.kind !== 'block' || v.look !== CONTAINER_LOOK) return [];
  return world
    .listEntities()
    .filter((e) => e.kind === 'block' && e.look === CONTAINER_LOOK && e.ownerNodeId === v.ownerNodeId)
    .map((e) => e.id);
}

/** True when the middle of `e` is inside the cage whose floor plate is `floor`: between the walls, above the plate, below the rim. */
export function insideContainer(e: Pick<EntityView, 'position'>, floor: Pick<EntityView, 'position'>, s: ContainerShape, mode: ViewMode): boolean {
  const half = s.inside / 2;
  if (Math.abs(e.position.x - floor.position.x) >= half) return false;
  if (mode !== '2d-side' && Math.abs(e.position.z - floor.position.z) >= half) return false;
  // Seen from straight above there is no height: whatever lies on the painted square is in.
  if (mode === '2d-top') return true;
  const under = floor.position.y - CONTAINER_THICK / 2;
  return e.position.y > under && e.position.y < under + CONTAINER_THICK + s.wall;
}

interface ContainerState {
  /** The floor plate first, then the walls. */
  ids: EntityId[];
  shape: ContainerShape;
  /** What was inside on the last tick. */
  inside: Set<EntityId>;
  /** Things that came in and have not had their "Khi nhận vật" tick yet. */
  owed: number;
  /** True when "Khi nhận vật" was on last tick (two ticks in a row would read as one). */
  pulsed: boolean;
}

/**
 * An open-top cage on wheels: a floor plate and four walls, each a plain solid block (the same solid a "Vật thể" is), so
 * things fall in and stay as bodies. The piece only counts what lies inside; it never holds, deletes or moves anything,
 * and it never moves itself. The five blocks are made to be moved together (`containerBlocks`).
 */
export const containerNode: NodeDef<ContainerState> = {
  kind: 'container',
  label: 'Lồng chứa',
  category: 'object',
  description:
    'Một chiếc lồng hở miệng có bánh xe: đáy và bốn thành đều rắn giống "Vật thể". Vật rơi vào thì nằm lại bên trong như vật thật; lồng chỉ đếm, không giữ và không xoá vật nào. "Số vật bên trong" đếm các đồ vật có tâm nằm trong lòng lồng, đếm lại mỗi nhịp: vật nảy ra ngoài thì không còn được tính. "Đã đầy" bật khi số vật bằng hoặc hơn "Sức chứa"; sức chứa chỉ để báo đầy, không cản vật rơi thêm vào (vật thứ 7 vẫn được đếm). "Khi nhận vật" bật một nhịp cho mỗi vật mới vào. "Vật bên trong" đưa ra một vật đang nằm trong lồng (vật được tạo ra sớm nhất trong số đó), để nối vào "Vật cần thu hồi" của Tạo đối tượng hoặc "Vật cần đọc" của Đọc mã. Lồng không có cổng vào và không tự chạy: muốn lấy vật ra thì thu hồi từng vật qua "Vật bên trong". Bật công tắc "Vật lý thật" thì các thùng chồng lên nhau trong lồng như thật; tắt thì thùng vẫn rơi vào và vẫn được đếm, nhưng nằm lồng vào nhau. Ở góc nhìn ngang, lồng hiện thành một lát cắt (đáy và hai thành); ở góc nhìn từ trên xuống, lồng chỉ là một ô vẽ trên nền, vật nằm trên ô đó được đếm.',
  inputs: [],
  outputs: [
    { id: 'self', type: 'object', label: 'Đối tượng' },
    { id: 'count', type: 'number', label: 'Số vật bên trong' },
    { id: 'full', type: 'bool', label: 'Đã đầy' },
    { id: 'took', type: 'bool', label: 'Khi nhận vật' },
    { id: 'first', type: 'object', label: 'Vật bên trong' },
  ],
  params: [
    { id: 'position', label: 'Vị trí (y = mặt đất dưới bánh xe)', kind: 'vec3', default: DEFAULT_POSITION, place: 'point' },
    { id: 'inside', label: 'Lòng lồng (m, cạnh trong)', kind: 'number', default: DEFAULT_INSIDE, min: 0.3, max: 3, step: 0.05 },
    { id: 'wall', label: 'Cao thành (m)', kind: 'number', default: DEFAULT_WALL, min: 0.2, max: 3, step: 0.05 },
    { id: 'capacity', label: 'Sức chứa (số vật để báo đầy)', kind: 'number', default: DEFAULT_CAPACITY, min: 1, max: CONTAINER_MAX_CAPACITY, step: 1 },
    { id: 'clearance', label: 'Khoảng hở gầm (m)', kind: 'number', default: DEFAULT_CLEARANCE, min: CONTAINER_THICK, max: 2, step: 0.05 },
    { id: 'mass', label: 'Khối lượng lồng rỗng (kg)', kind: 'number', default: DEFAULT_MASS, min: 0, max: 1000, step: 1 },
    // Draw only: the floor plate and the walls are the same solid blocks whatever the look.
    { id: 'look', label: 'Kiểu dáng (chỉ đổi hình vẽ)', kind: 'select', default: ROLL_CAGE_LOOK, options: [...CONTAINER_LOOKS] },
    { id: 'color', label: 'Màu', kind: 'color', default: DEFAULT_COLOR },
  ],
  // The blocks are made once when the run starts; the capacity and the colour can change while it runs.
  createOnly: ['position', 'inside', 'wall', 'clearance', 'mass', 'look'],
  liveApply: {
    color: (ctx, p, s) => {
      for (const id of s.ids) ctx.world.setEntityStyle(id, { color: String(p.color) });
    },
  },
  create(ctx, params) {
    const mode = ctx.world.mode;
    const shape = containerShape(params);
    const at = vec3Param(params, 'position', DEFAULT_POSITION);
    const color = strParam(params, 'color', DEFAULT_COLOR);
    const state = (ids: EntityId[]): ContainerState => ({ ids, shape, inside: new Set(), owed: 0, pulsed: false });
    if (mode === '2d-top') {
      // Seen from straight above there is no height: a painted square that blocks nothing; what lies on it is counted.
      const side = shape.inside + 2 * CONTAINER_THICK;
      return state([ctx.world.spawn({ kind: 'block', ownerNodeId: ctx.nodeId, position: at, size: { x: side, y: PAINT, z: side }, color, solid: false, zone: true })]);
    }
    const mass = clamp(numParam(params, 'mass', DEFAULT_MASS), 0, 1000);
    const ids = containerParts(shape, mode).map((p, k) =>
      ctx.world.spawn({
        kind: 'block',
        ownerNodeId: ctx.nodeId,
        position: { x: at.x + p.at.x, y: at.y + p.at.y, z: at.z + p.at.z },
        size: p.size,
        color,
        look: CONTAINER_LOOK,
        solid: true,
        // The floor plate carries the shape, so the whole cage is drawn once, and the weight of the empty cage.
        label: k === 0 ? containerLabel(shape) : shape.classic ? CONTAINER_BOARD_LABEL : CONTAINER_WALL_LABEL,
        mass: k === 0 ? mass : 0,
      }),
    );
    return state(ids);
  },
  evaluate(ctx, _i, params, s) {
    const self = s.ids[0] ?? null;
    const floor = self !== null ? ctx.world.getEntity(self) : undefined;
    if (!floor || !floor.visible) {
      s.inside = new Set();
      s.owed = 0;
      s.pulsed = false;
      return { self, count: 0, full: false, took: false, first: null };
    }
    // Read against where the floor plate is now, so the count follows a cage that something moved.
    const now = new Set<EntityId>();
    let first: EntityId | null = null;
    for (const e of ctx.world.listEntities()) {
      if (e.kind !== 'item' || !e.visible || e.inHand || e.carried || !insideContainer(e, floor, s.shape, ctx.mode)) continue;
      if (first === null) first = e.id;
      if (!s.inside.has(e.id)) s.owed++;
      now.add(e.id);
    }
    s.inside = now;
    // One tick per thing that came in. Two that come in on the same tick get their ticks one after the other, with a
    // tick off in between, so a counter wired here counts both.
    const took = s.owed > 0 && !s.pulsed;
    if (took) s.owed--;
    s.pulsed = took;
    const capacity = Math.round(clamp(numParam(params, 'capacity', DEFAULT_CAPACITY), 1, CONTAINER_MAX_CAPACITY));
    return { self, count: now.size, full: now.size >= capacity, took, first };
  },
};
