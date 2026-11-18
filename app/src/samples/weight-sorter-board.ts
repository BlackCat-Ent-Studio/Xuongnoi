import type { Board, Params } from '../engine/types';
import { makeBoard, type CardSpec, type Link } from './cell-board-kit';

/**
 * Sample "Băng chuyền phân loại theo cân nặng": a spawner drops a crate on the conveyor every few seconds with a random
 * mass (a random-number piece wired to the spawner's mass), so it runs forever. The crate rides over a scale; a compare
 * piece decides "heavy", a timer waits until the crate is in front of the piston, and the piston pushes it into the side
 * bin. Light crates ride on to the end bin. Built only from palette pieces; nothing is typed by a person while it runs.
 */

/** Numbers the notes and the test quote. */
export const WEIGHT_SORTER = {
  /** The compare piece sends a crate to the side bin from this mass up (kg). */
  thresholdKg: 5,
  beltSpeed: 1.5,
  /** Wait between "heavy crate on the scale" and the push (s). */
  pushDelayS: 2.3,
  pistonForceN: 80,
  /** The random piece throws whole kilograms from `minKg` to `maxKg`: below the threshold is light, from it up heavy. */
  minKg: 1,
  maxKg: 8,
  /** A fixed seed makes every run throw the same masses (1, 7, 3, 7, 7...); 0 would make every run different. */
  seed: 1,
  /** A new crate every this many seconds (about 6 m apart on the belt). */
  spawnEveryS: 4,
  crateX: -14,
  /** Crates vanish this long after they were made, so the machine never fills up. */
  crateLifeS: 30,
};

const BELT_Y = 0.3;
const BELT = { y: 0.6, z: 1 };

const belt = (x0: number, x1: number, extra: Params = {}): Params => ({
  position: { x: (x0 + x1) / 2, y: BELT_Y, z: 0 },
  size: { x: x1 - x0, y: BELT.y, z: BELT.z },
  style: 'conveyor',
  beltSpeed: WEIGHT_SORTER.beltSpeed,
  beltWalls: 'no',
  color: '#475569',
  ...extra,
});

const specs: CardSpec[] = [
  // --- the world ---
  { id: 'floor', kind: 'block', col: 0, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 90, y: 1, z: 16 }, color: '#65a30d' } },
  { id: 'go', kind: 'on-start', col: 0 },
  { id: 'feed', kind: 'block', col: 1, params: belt(-56, -1.5) },
  { id: 'scale', kind: 'block', col: 1, params: belt(-1.5, 0.3, { color: '#f59e0b' }) },
  { id: 'belt-end', kind: 'block', col: 1, params: belt(0.3, 8) },
  { id: 'pad-end', kind: 'block', col: 1, params: { position: { x: 10.2, y: 0.05, z: 0 }, size: { x: 3.2, y: 0.1, z: 3.2 }, color: '#3b82f6' } },
  { id: 'side-belt', kind: 'block', col: 1, params: belt(0, 0, { position: { x: 1.6, y: 0.25, z: 3.25 }, size: { x: 2.4, y: 0.5, z: 5.5 }, beltDir: 'z' }) },
  { id: 'pad-side', kind: 'block', col: 1, params: { position: { x: 1.6, y: 0.05, z: 7.6 }, size: { x: 3.2, y: 0.1, z: 3 }, color: '#ef4444' } },

  // --- make crates of random mass ---
  { id: 'make-timer', kind: 'timer', col: 2, params: { seconds: WEIGHT_SORTER.spawnEveryS, repeat: 'yes' } },
  { id: 'dice', kind: 'random', col: 2, params: { min: WEIGHT_SORTER.minKg, max: WEIGHT_SORTER.maxKg, whole: 'yes', mode: 'tick', seed: WEIGHT_SORTER.seed } },
  {
    id: 'maker',
    kind: 'spawner',
    col: 2,
    params: {
      template: 'item',
      shape: 'box',
      position: { x: WEIGHT_SORTER.crateX, y: BELT.y + 0.5, z: 0 },
      size: { x: 0.8, y: 0.8, z: 0.8 },
      color: '#d4a373',
      maxAlive: 12,
      lifetime: WEIGHT_SORTER.crateLifeS,
      wireMaterial: 'yes',
    },
  },

  // --- weigh, decide, wait, push ---
  { id: 'weigh', kind: 'force-sensor', col: 3, params: { mode: 'scale' } },
  { id: 'limit', kind: 'const', col: 3, params: { value: WEIGHT_SORTER.thresholdKg } },
  { id: 'is-heavy', kind: 'compare', col: 3, params: { op: 'ge' } },
  { id: 'heavy-seen', kind: 'latch', col: 3 },
  // The wait starts the moment a crate comes onto the scale (the same moment whatever the physics), not when the scale has read it
  // fully: a crate that is only partly on the scale reads only its share. A crate that leaves without being heavy cancels it.
  { id: 'here', kind: 'latch', col: 3 },
  { id: 'busy', kind: 'or', col: 3 },
  { id: 'idle', kind: 'not', col: 3 },
  { id: 'forget', kind: 'or', col: 4 },
  { id: 'wait', kind: 'timer', col: 4, params: { seconds: WEIGHT_SORTER.pushDelayS } },
  { id: 'now-push', kind: 'and', col: 4 },
  {
    id: 'piston',
    kind: 'linear-actuator',
    col: 4,
    params: { position: { x: 1.6, y: BELT.y + 0.75, z: -4.4 }, direction: 90, stroke: 2, maxForce: WEIGHT_SORTER.pistonForceN, speed: 4, headSize: 1.4 },
  },

  // --- readouts ---
  { id: 'show-mass', kind: 'show-number', col: 5, params: { label: 'Cân đọc (kg)', corner: 'top-left' } },
  { id: 'side-bin', kind: 'zone', col: 5, params: { center: { x: 1.6, y: 0.7, z: 7.6 }, size: { x: 3, y: 1.4, z: 2.6 }, filter: 'item', color: '#ef4444' } },
  { id: 'end-bin', kind: 'zone', col: 5, params: { center: { x: 10.2, y: 0.7, z: 0 }, size: { x: 3, y: 1.4, z: 3 }, filter: 'item', color: '#3b82f6' } },
  { id: 'show-side', kind: 'show-number', col: 6, params: { label: 'Trong thùng bên (nặng)', corner: 'top-left' } },
  { id: 'show-end', kind: 'show-number', col: 6, params: { label: 'Trong thùng cuối (nhẹ)', corner: 'top-left' } },
  { id: 'show-force', kind: 'show-number', col: 6, params: { label: 'Lực đẩy (N)', corner: 'top-left' } },
  { id: 'text-over', kind: 'show-text', col: 6, params: { text: 'Xi lanh quá tải: không đẩy nổi thùng nặng!', corner: 'top-right', color: '#f59e0b' } },
  { id: 'text-heavy', kind: 'show-text', col: 6, params: { text: 'Thùng nặng: đẩy sang thùng bên', corner: 'top-right', color: '#ef4444' } },
  { id: 'cam', kind: 'camera', col: 6, params: { mode: 'fixed', point: { x: 2, y: 0.5, z: 1 }, zoom: 0.5, view: 'tilted' } },
];

/** Every wire of the board. */
export const WEIGHT_SORTER_WIRES: readonly Link[] = [
  // The belts run by themselves
  ['go', 'started', 'feed', 'run'],
  ['go', 'started', 'scale', 'run'],
  ['go', 'started', 'belt-end', 'run'],
  ['go', 'started', 'side-belt', 'run'],
  // A new crate every few seconds, its mass thrown by the random piece
  ['go', 'started', 'make-timer', 'run'],
  ['make-timer', 'done', 'maker', 'spawn'],
  ['dice', 'value', 'maker', 'mass'],
  // Scale -> mass -> compare -> remembered "heavy"
  ['scale', 'self', 'weigh', 'who'],
  ['weigh', 'mass', 'is-heavy', 'a'],
  ['limit', 'value', 'is-heavy', 'b'],
  ['is-heavy', 'out', 'heavy-seen', 'set'],
  // A crate on the scale starts the wait; when it is in front of the piston and was heavy, push
  ['weigh', 'loaded', 'here', 'set'],
  ['here', 'on', 'wait', 'run'],
  ['wait', 'done', 'now-push', 'a'],
  ['heavy-seen', 'on', 'now-push', 'b'],
  ['now-push', 'out', 'piston', 'extend'],
  // When the rod is all the way out, forget and retract
  ['piston', 'extended', 'heavy-seen', 'reset'],
  // A crate that left the scale without being heavy: forget it too, so the next one starts the wait afresh
  ['weigh', 'loaded', 'busy', 'a'],
  ['heavy-seen', 'on', 'busy', 'b'],
  ['busy', 'out', 'idle', 'in'],
  ['piston', 'extended', 'forget', 'a'],
  ['idle', 'out', 'forget', 'b'],
  ['forget', 'out', 'here', 'reset'],
  ['forget', 'out', 'wait', 'reset'],
  // Readouts
  ['weigh', 'mass', 'show-mass', 'value'],
  ['side-bin', 'count', 'show-side', 'value'],
  ['end-bin', 'count', 'show-end', 'value'],
  ['piston', 'force', 'show-force', 'value'],
  ['piston', 'overloaded', 'text-over', 'show'],
  ['heavy-seen', 'on', 'text-heavy', 'show'],
  // Camera
  ['go', 'started', 'cam', 'on'],
];

/** The sample board. Fresh objects on every call. */
export function createWeightSorterBoard(): Board {
  return makeBoard('Băng chuyền phân loại theo cân nặng', '3d', specs, WEIGHT_SORTER_WIRES, [
    {
      color: 'yellow',
      h: 400,
      text: 'Băng chuyền tự phân loại và chạy mãi, không cần bấm gì. Bấm Chạy: cứ 4 giây "Tạo đối tượng" thả một thùng lên băng, khối lượng do "Số ngẫu nhiên" tung (1 đến 8 kg). Thùng chạy qua đoạn băng vàng là cái cân: "Cảm biến lực / Cân" đọc khối lượng, "So sánh" hỏi "từ 5 kg trở lên?". Hẹn giờ bắt đầu đếm từ lúc thùng vừa lên cân (cân chỉ đủ số kg khi thùng nằm trọn trên cân, còn đang gác nửa trên băng kia thì chỉ đọc phần của nó). Nếu thùng nặng thì Công tắc nhớ bật, hết giờ thì thùng đã tới trước Xi lanh và xi lanh đẩy thùng sang thùng bên (đỏ). Thùng nhẹ chạy tiếp tới thùng cuối (xanh). Bảng này đã bật "Vật lý thật" (công tắc ở bảng Thuộc tính, khi chưa chọn mảnh nào): thùng là vật rắn thật, bám băng chuyền bằng ma sát, va và lăn vào thùng chứa.',
    },
    {
      color: 'green',
      h: 380,
      text: 'Con số cần nhớ: thùng cao 0,8 m, μ = 0,5, đầu xi lanh đẩy ở độ cao 0,75 m trên đáy thùng. Xi lanh chỉ cần lực nhỏ hơn trong hai lực: lực làm trượt μ × m × 9,81 và lực làm đổ m × 9,81 × 0,4 / 0,75. Thùng 8 kg: trượt 0,5 × 8 × 9,81 = 39 N, làm đổ 42 N, nên thùng trượt và ô "Lực đẩy" đọc 39 N; thùng 2 kg chỉ 10 N. Lực tối đa đặt 80 N, dư gần gấp đôi nên đẩy nhanh. Đẩy xong thì xi lanh tự thu về rồi chờ thùng nặng kế tiếp. Mỗi thùng chỉ tồn tại 30 giây rồi biến mất, nên hai số "Trong thùng" là số thùng đang nằm trong mỗi thùng chứa lúc này.',
    },
    {
      color: 'pink',
      h: 420,
      text: 'Thử đổi thông số: 1) Chọn Xi lanh đẩy, hạ "Lực đẩy tối đa" xuống 30 N: thùng nặng không đẩy nổi, hiện "Quá tải" và nó chạy lẫn vào thùng cuối. 2) Đặt "Lực đẩy tối đa" 41 N (chỉ dư 1,8 N): không quá tải nhưng thanh đẩy chậm đến mức thùng nặng cũng trôi sang thùng cuối. 3) Chọn "Tạo đối tượng", mở mục nâng cao, đổi "Hệ số ma sát" từ 0,5 lên 0,8: lực làm trượt thành 63 N, lớn hơn lực làm đổ 42 N, nên ô "Lực đẩy" đọc 42 N. 4) Chọn "Số cố định" ngưỡng, đổi 5 thành 1: thùng nhẹ cũng bị đẩy sang bên. 5) Chọn "Số ngẫu nhiên", đổi "Lớn nhất" từ 8 thành 4: không còn thùng nặng nào. 6) Chọn Hẹn giờ 2,3 giây, đổi thành 1: xi lanh đẩy hụt vì thùng chưa tới. 7) Chọn "Số ngẫu nhiên", đổi "Hạt giống" từ 1 về 0: mỗi lần chạy ra một dãy khối lượng khác (hạt giống 1 thì lần nào cũng cùng một dãy).',
    },
  ], { realPhysics: true });
}
