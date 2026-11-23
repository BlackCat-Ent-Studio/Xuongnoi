import type { Board } from '../engine/types';
import { build, type NodeSpec, type WireSpec } from './boards-robot-arm';

/** "Thử ngay" board for "Lồng chứa": a belt drops cartons into a cage, a lamp shows how full it is, a button empties it. */

export const CAGE_IN_LABEL = 'Số thùng trong lồng';
export const CAGE_TOTAL_LABEL = 'Tổng số thùng đã nhận';
export const CAGE_SWAP_TEXT = 'Giữ để đổi lồng';

/** Numbers the note and the tests quote (m, s). The belt runs toward +x and drops its cartons into the cage. */
export const CAGE_LINE = {
  parcel: { x: 0.32, y: 0.26, z: 0.28 },
  /** The belt stands on legs from `from` to `legsTo`; its last stretch, up to `to`, is a slim slab that reaches over the wall of the cage. */
  belt: { topY: 1.7, from: -2.4, legsTo: -0.75, to: -0.38, slab: 0.14, width: 0.6, speed: 1 },
  cage: { x: 0, inside: 1, wall: 1, clearance: 0.35, capacity: 6 },
  /** The lamp turns amber from this many cartons on. */
  almost: 5,
  feedEveryS: 2.5,
  recallEveryS: 0.3,
  maxAlive: 12,
} as const;

/**
 * Where the board's "Máy quay" looks: a point between the end of the belt and the cage, and how far in. Close enough that
 * the cartons in the cage can be counted at the size the app opens at.
 */
export const CAGE_CAMERA = { point: { x: -0.5, y: 0.9, z: 0 }, zoom: 2.4 } as const;

/** "Đặt màu" of the lamp: the numbers the block piece takes. */
export const LAMP_PICK = { red: 1, amber: 2, green: 3 } as const;

const { parcel, belt, cage } = CAGE_LINE;

const NODES: NodeSpec[] = [
  { alias: 'start', kind: 'on-start', x: 20, y: 20 },
  { alias: 'beat', kind: 'timer', x: 20, y: 200, params: { seconds: CAGE_LINE.feedEveryS, repeat: 'yes' } },
  { alias: 'not-full', kind: 'not', x: 20, y: 480 },
  { alias: 'feed', kind: 'and', x: 400, y: 200 },
  {
    alias: 'maker',
    kind: 'spawner',
    x: 780,
    y: 20,
    params: {
      template: 'item',
      shape: 'crate',
      look: 'parcel-carton',
      position: { x: belt.from + 0.3, y: belt.topY + parcel.y / 2 + 0.02, z: 0 },
      size: { ...parcel },
      color: '#f59e0b',
      maxAlive: CAGE_LINE.maxAlive,
      lifetime: 0,
      recallPorts: 'yes',
    },
  },
  { alias: 'floor', kind: 'block', x: 20, y: 1100, params: { position: { x: -1, y: -0.5, z: 0 }, size: { x: 8, y: 1, z: 5 }, color: '#94a3b8' } },
  { alias: 'belt', kind: 'block', x: 400, y: 1100, params: { position: { x: (belt.from + belt.legsTo) / 2, y: belt.topY / 2, z: 0 }, size: { x: belt.legsTo - belt.from, y: belt.topY, z: belt.width }, style: 'belt-frame', beltSpeed: belt.speed, beltDir: 'x', beltWalls: 'no' } },
  { alias: 'belt-end', kind: 'block', x: 780, y: 1100, params: { position: { x: (belt.legsTo + belt.to) / 2, y: belt.topY - belt.slab / 2, z: 0 }, size: { x: belt.to - belt.legsTo, y: belt.slab, z: belt.width }, style: 'belt-frame', beltSpeed: belt.speed, beltDir: 'x', beltWalls: 'no' } },
  { alias: 'cage', kind: 'container', x: 1160, y: 20, params: { position: { x: cage.x, y: 0, z: 0 }, inside: cage.inside, wall: cage.wall, clearance: cage.clearance, capacity: cage.capacity } },
  { alias: 'in-cage', kind: 'show-number', x: 1540, y: 20, params: { label: CAGE_IN_LABEL, corner: 'top-left' } },
  { alias: 'total', kind: 'counter', x: 1540, y: 200, params: { target: 9999 } },
  { alias: 'total-shown', kind: 'show-number', x: 1920, y: 200, params: { label: CAGE_TOTAL_LABEL, corner: 'top-left' } },
  { alias: 'limit', kind: 'const', x: 1160, y: 560, params: { value: CAGE_LINE.almost } },
  { alias: 'almost', kind: 'compare', x: 1540, y: 590, params: { op: 'ge' } },
  // Green while there is room, amber once it is nearly full; a full cage takes one more off, down to red.
  { alias: 'room-colour', kind: 'bool-to-number', x: 1920, y: 480, params: { whenOn: LAMP_PICK.amber, whenOff: LAMP_PICK.green } },
  { alias: 'full-step', kind: 'bool-to-number', x: 1920, y: 700, params: { whenOn: LAMP_PICK.amber - LAMP_PICK.red, whenOff: 0 } },
  { alias: 'colour', kind: 'math', x: 2300, y: 480, params: { op: 'sub' } },
  { alias: 'lamp', kind: 'block', x: 2680, y: 480, params: { position: { x: cage.x + 0.75, y: 0.4325, z: 0.75 }, size: { x: 0.14, y: 0.865, z: 0.14 }, type: 'pickup', style: 'signal-tower' } },
  { alias: 'swap', kind: 'ui-button', x: 20, y: 700, params: { text: CAGE_SWAP_TEXT, corner: 'bottom-right' } },
  { alias: 'take', kind: 'timer', x: 400, y: 700, params: { seconds: CAGE_LINE.recallEveryS, repeat: 'yes' } },
  // The angle stays the learner's ("Tự do"); the camera only comes close, at once.
  { alias: 'cam', kind: 'camera', x: 1160, y: 1100, params: { mode: 'fixed', point: { ...CAGE_CAMERA.point }, zoom: CAGE_CAMERA.zoom, smoothness: 0, view: 'free' } },
];

/** The names the wires below use for the cards, in the order the cards stand in the board's graph. */
export const CAGE_LINE_CARDS: readonly string[] = NODES.map((n) => n.alias);

/** Every wire of the board; cutting any one of them changes what the learner sees (see the tests). */
export const CAGE_LINE_WIRES: WireSpec[] = [
  ['start', 'started', 'beat', 'run'],
  ['start', 'started', 'belt', 'run'],
  ['start', 'started', 'belt-end', 'run'],
  ['start', 'started', 'cam', 'on'],
  ['beat', 'done', 'feed', 'a'],
  ['cage', 'full', 'not-full', 'in'],
  ['not-full', 'out', 'feed', 'b'],
  ['feed', 'out', 'maker', 'spawn'],
  ['cage', 'count', 'in-cage', 'value'],
  ['cage', 'took', 'total', 'up'],
  ['total', 'value', 'total-shown', 'value'],
  ['cage', 'count', 'almost', 'a'],
  ['limit', 'value', 'almost', 'b'],
  ['almost', 'out', 'room-colour', 'on'],
  ['cage', 'full', 'full-step', 'on'],
  ['room-colour', 'value', 'colour', 'a'],
  ['full-step', 'value', 'colour', 'b'],
  ['colour', 'out', 'lamp', 'pick'],
  ['start', 'started', 'swap', 'show'],
  ['swap', 'held', 'take', 'run'],
  ['take', 'done', 'maker', 'recall'],
  ['cage', 'first', 'maker', 'recallThing'],
];

export function tryContainer(): Board {
  const board = build(
    'Lồng chứa',
    'Góc nhìn 3D. Bấm Chạy: cứ 2,5 giây băng chuyền đưa một thùng tới và thả vào lồng. "Số vật bên trong" hiện ở góc trên; "Khi nhận vật" cộng dồn thành tổng số thùng đã nhận. Đèn tháp xanh khi lồng còn chỗ, vàng khi có 5 thùng, đỏ khi "Đã đầy" (6 thùng); lồng đầy thì máy ngừng tạo thùng. Giữ nút "Giữ để đổi lồng": cứ 0,3 giây một thùng trong lồng được thu hồi qua "Vật bên trong", đèn xanh lại và băng chạy tiếp. Lồng không tự chạy và chưa có mảnh nào kéo được lồng đi: nút này đứng thay cho việc đổi lồng. Bảng này mở sẵn công tắc "Vật lý thật" để các thùng chồng lên nhau như thật; tắt đi rồi chạy lại thì thùng vẫn được đếm nhưng nằm lồng vào nhau. Thẻ "Máy quay" đưa góc nhìn lại gần lồng; gỡ dây "Bật" của nó thì thấy cả mặt sàn.',
    NODES,
    CAGE_LINE_WIRES,
    '3d',
  );
  // Cartons that pile up in a cage are real bodies: with the plain rules every carton would lie in the same spot.
  return { ...board, graph: { ...board.graph, settings: { ...board.graph.settings, realPhysics: true } } };
}
