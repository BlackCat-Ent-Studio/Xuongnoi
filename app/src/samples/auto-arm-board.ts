import type { Board } from '../engine/types';
import { makeBoard, type CardSpec, type Link } from './cell-board-kit';

/**
 * Sample "Tay máy tự gắp và đặt": a spawner makes a crate on the feed belt every few seconds (for ever); the belt stops when one reaches the pick point; a 6-step cycle (wait,
 * lower, close, lift, swing, open and return) runs the arm. The step number picks a row of three "Bảng giá trị"
 * (one per joint) = the taught angles, and every step ends by itself through its own "Xong bước" port (a crate waiting,
 * a crate between the fingers with the arm down at its taught angles, the gripper holding for a moment, the arm up, the swing joint's own "Đã tới góc" at the place or at home). The gripper takes only a crate lying between its
 * fingers, so the arm really has to lower onto it. Built only from palette pieces; nothing is typed by a person while it runs.
 */

/** Numbers the notes and the test quote. */
export const AUTO_ARM = {
  /** Grip force of each finger (N). A 2 kg crate with mu 0.5 needs 19.6 N; the fragile crate breaks above 30 N. */
  gripForceN: 25,
  holdThresholdN: 19.62,
  fragileLimitN: 60,
  crateKg: 2,
  /**
   * Taught pitch angles (deg) of [shoulder, elbow]: the raised pose (waiting, carrying) and the lowered pose around the crate. In the
   * lowered pose the grasp point is 1.145 m up, 0.055 m below the crate's top (0.6 m crate on the 0.6 m belt, picked at x 2.05): the
   * palm (0.15 m deep) then rests just above the crate and the 0.3 m fingers stand along its upper half, one on each side.
   */
  hover: [60, -130] as const,
  down: [28.7, -99] as const,
  /** Swing (deg) of the base joint to the place point. */
  swing: 180,
  /** A new crate is made on the feed belt every this many seconds, for as long as the machine runs. */
  spawnEveryS: 8,
  /** Each crate vanishes this long after it was made (the pad never fills); long enough to ride in, be placed and ride out. */
  crateLifeS: 40,
  /** The dice throw 1 to 3: a 3 makes a fragile crate (about one in three). */
  fragileThrow: 3,
  /** Where the crates are made (x on the feed belt) and the belt's far end. */
  crateX: 12,
  feedEndX: 13,
  beltSpeed: 1,
  /** Where a crate stops on the belt (x of its centre): the gripper lowers onto this spot. */
  pickX: 2.05,
  /** The fingers stay closed this long (s) before the lift, so the grip is seen. */
  gripWaitS: 0.6,
};

const [H1, H2] = AUTO_ARM.hover;
const [D1, D2] = AUTO_ARM.down;

const beltY = 0.3;
const beltTop = 0.6;

/** One "Bảng giá trị": row k = the angle of this joint in step k of the cycle. */
const table = (v: readonly number[]) => ({ rows: v.length, ...Object.fromEntries(v.map((x, k) => [`v${k + 1}`, x])) });

const specs: CardSpec[] = [
  // --- the world ---
  { id: 'floor', kind: 'block', col: 0, params: { position: { x: 5, y: -0.5, z: 0 }, size: { x: 50, y: 1, z: 14 }, color: '#65a30d' } },
  { id: 'pillar', kind: 'block', col: 0, params: { position: { x: 0, y: 0.8, z: 0 }, size: { x: 0.6, y: 1.6, z: 0.6 }, color: '#a3a3a3' } },
  { id: 'feed', kind: 'block', col: 0, params: { position: { x: (1 + AUTO_ARM.feedEndX) / 2, y: beltY, z: 0 }, size: { x: AUTO_ARM.feedEndX - 1, y: 0.6, z: 1.2 }, style: 'conveyor', beltSpeed: AUTO_ARM.beltSpeed, beltDir: '-x', color: '#475569' } },
  { id: 'out-belt', kind: 'block', col: 0, params: { position: { x: -4, y: beltY, z: 0 }, size: { x: 6, y: 0.6, z: 1.2 }, style: 'conveyor', beltSpeed: AUTO_ARM.beltSpeed, beltDir: '-x', color: '#475569' } },
  { id: 'pad-out', kind: 'block', col: 0, params: { position: { x: -8.5, y: 0.05, z: 0 }, size: { x: 3, y: 0.1, z: 3 }, color: '#3b82f6' } },
  { id: 'go', kind: 'on-start', col: 1 },

  // --- crates are made on the feed belt, one every few seconds; the dice decide which ones are fragile ---
  { id: 'make-timer', kind: 'timer', col: 1, params: { seconds: AUTO_ARM.spawnEveryS, repeat: 'yes' } },
  { id: 'dice', kind: 'random', col: 1, params: { min: 1, max: AUTO_ARM.fragileThrow, whole: 'yes', mode: 'tick', seed: 1 } },
  { id: 'crate-mass', kind: 'const', col: 1, params: { value: AUTO_ARM.crateKg } },
  { id: 'tbl-fragile', kind: 'value-table', col: 1, params: table([0, 0, AUTO_ARM.fragileLimitN]) },
  {
    id: 'maker',
    kind: 'spawner',
    col: 1,
    params: {
      template: 'item',
      shape: 'box',
      position: { x: AUTO_ARM.crateX, y: beltTop + 0.35, z: 0 },
      size: { x: 0.6, y: 0.6, z: 0.6 },
      color: '#a16207',
      maxAlive: 8,
      lifetime: AUTO_ARM.crateLifeS,
      wireMaterial: 'yes',
    },
  },

  // --- the arm: pillar -> swing -> shoulder -> upper -> elbow -> fore -> gripper ---
  { id: 'swing', kind: 'joint', col: 2, params: { axis: 'yaw', start: 0, min: -180, max: 180, maxTorque: 50, maxSpeed: 90, mount: { x: 0, y: 0.8, z: 0 }, color: '#8b5cf6' } },
  { id: 'shoulder', kind: 'joint', col: 2, params: { axis: 'pitch', start: H1, min: -30, max: 90, maxTorque: 140, maxSpeed: 60 } },
  { id: 'upper', kind: 'link', col: 2, params: { length: 1.8, mass: 1.5, thickness: 0.22 } },
  { id: 'elbow', kind: 'joint', col: 3, params: { axis: 'pitch', start: H2, min: -150, max: 30, maxTorque: 80, maxSpeed: 60 } },
  { id: 'fore', kind: 'link', col: 3, params: { length: 1.1, mass: 1, thickness: 0.18 } },
  { id: 'gripper', kind: 'gripper', col: 3, params: { defaultForce: 0, maxForce: 120, fingerMu: 0.8, width: 1, grip: 'between', mass: 0.5 } },
  { id: 'grip-force', kind: 'const', col: 3, params: { value: AUTO_ARM.gripForceN } },

  // --- the pick point: the belt stops while a crate is there ---
  {
    id: 'pick',
    kind: 'zone',
    col: 4,
    params: { center: { x: AUTO_ARM.pickX, y: beltTop + 0.35, z: 0 }, size: { x: 0.3, y: 0.5, z: 0.8 }, filter: 'item', rule: 'center', color: '#f59e0b' },
  },
  { id: 'belt-run', kind: 'not', col: 4 },

  // --- the cycle: Chuỗi bước with a "Xong bước" port per step ---
  { id: 'a-cycle', kind: 'sequence', col: 4, rows: 15, params: { stepCount: 6, loop: 'yes', showDone: 'yes' } },
  { id: 'close-3-4', kind: 'or', col: 5 },
  { id: 'close-3-5', kind: 'or', col: 5 },
  { id: 'grip-wait', kind: 'timer', col: 5, params: { seconds: AUTO_ARM.gripWaitS, repeat: 'yes' } },
  { id: 'grip-ok', kind: 'and', col: 5 },
  { id: 'arrived', kind: 'and', col: 5 },
  { id: 'hand-ready', kind: 'and', col: 5 },

  // --- taught angles: step number -> row of the table, one table per joint ---
  { id: 'tbl-swing', kind: 'value-table', col: 6, params: table([0, 0, 0, 0, AUTO_ARM.swing, 0]) },
  { id: 'tbl-shoulder', kind: 'value-table', col: 6, params: table([H1, D1, D1, H1, H1, H1]) },
  { id: 'tbl-elbow', kind: 'value-table', col: 6, params: table([H2, D2, D2, H2, H2, H2]) },

  // --- readouts ---
  { id: 'placed', kind: 'counter', col: 7 },
  { id: 'slips', kind: 'counter', col: 7 },
  { id: 'crushes', kind: 'counter', col: 7 },
  { id: 'drop-zone', kind: 'zone', col: 7, params: { center: { x: -1.9, y: 0.9, z: 0 }, size: { x: 2.4, y: 0.5, z: 1.4 }, filter: 'item', rule: 'center', color: '#22c55e' } },
  { id: 'show-placed', kind: 'show-number', col: 8, params: { label: 'Đã đặt (thùng)', corner: 'top-left' } },
  { id: 'show-slips', kind: 'show-number', col: 8, params: { label: 'Bị tuột (lần)', corner: 'top-left' } },
  { id: 'show-crushes', kind: 'show-number', col: 8, params: { label: 'Bị hỏng (thùng)', corner: 'top-left' } },
  { id: 'show-grip', kind: 'show-number', col: 8, params: { label: 'Lực kẹp mỗi ngón (N)', corner: 'top-left' } },
  {
    id: 'step-text',
    kind: 'show-text',
    col: 8,
    rows: 3,
    params: {
      text: 'Bước',
      lines: '1. Chờ thùng tới\n2. Hạ tay xuống thùng\n3. Kẹp\n4. Nâng thùng lên khỏi băng\n5. Quay sang chỗ đặt\n6. Nhả rồi quay về',
      corner: 'top-right',
      color: '#0f766e',
    },
  },
  { id: 'cam', kind: 'camera', col: 8, params: { mode: 'fixed', point: { x: 0, y: 1.2, z: 0 }, zoom: 1.3, view: 'tilted' } },
];

/** Every wire of the board. */
export const AUTO_ARM_WIRES: readonly Link[] = [
  // The arm is linked piece by piece
  ['pillar', 'self', 'swing', 'base'],
  ['swing', 'tip', 'shoulder', 'base'],
  ['shoulder', 'tip', 'upper', 'base'],
  ['upper', 'tip', 'elbow', 'base'],
  ['elbow', 'tip', 'fore', 'base'],
  ['fore', 'tip', 'gripper', 'base'],
  // A new crate every few seconds; the dice throw (1 to 3) picks a row of the table: 0 N (sturdy) or the crush limit (fragile)
  ['go', 'started', 'make-timer', 'run'],
  ['make-timer', 'done', 'maker', 'spawn'],
  ['crate-mass', 'value', 'maker', 'mass'],
  ['dice', 'value', 'tbl-fragile', 'index'],
  ['tbl-fragile', 'value', 'maker', 'crushLimit'],
  // Power and belts: the feed belt stops while a crate waits at the pick point
  ['go', 'started', 'swing', 'power'],
  ['go', 'started', 'shoulder', 'power'],
  ['go', 'started', 'elbow', 'power'],
  ['go', 'started', 'out-belt', 'run'],
  ['pick', 'inside', 'belt-run', 'in'],
  ['belt-run', 'out', 'feed', 'run'],
  // The cycle: which step is on -> the taught angle of every joint
  ['a-cycle', 'index', 'tbl-swing', 'index'],
  ['a-cycle', 'index', 'tbl-shoulder', 'index'],
  ['a-cycle', 'index', 'tbl-elbow', 'index'],
  ['tbl-swing', 'value', 'swing', 'angle'],
  ['tbl-shoulder', 'value', 'shoulder', 'angle'],
  ['tbl-elbow', 'value', 'elbow', 'angle'],
  // Gripper: closed in steps 3, 4 and 5 (grip, lift, swing), with the chosen force
  ['a-cycle', 'step3', 'close-3-4', 'a'],
  ['a-cycle', 'step4', 'close-3-4', 'b'],
  ['a-cycle', 'step5', 'close-3-5', 'b'],
  ['close-3-4', 'out', 'close-3-5', 'a'],
  ['close-3-5', 'out', 'gripper', 'close'],
  ['grip-force', 'value', 'gripper', 'force'],
  // When is each step finished? Every step has its own "Xong bước" port
  ['pick', 'inside', 'a-cycle', 'done1'],
  ['shoulder', 'reached', 'arrived', 'a'],
  ['elbow', 'reached', 'arrived', 'b'],
  ['arrived', 'out', 'hand-ready', 'a'],
  ['gripper', 'inReach', 'hand-ready', 'b'],
  ['hand-ready', 'out', 'a-cycle', 'done2'],
  ['a-cycle', 'step3', 'grip-wait', 'run'],
  ['grip-wait', 'done', 'grip-ok', 'a'],
  ['gripper', 'holding', 'grip-ok', 'b'],
  ['grip-ok', 'out', 'a-cycle', 'done3'],
  ['arrived', 'out', 'a-cycle', 'done4'],
  ['swing', 'reached', 'a-cycle', 'done5'],
  ['swing', 'reached', 'a-cycle', 'done6'],
  // Counters and readouts
  ['drop-zone', 'entered', 'placed', 'up'],
  ['gripper', 'slipped', 'slips', 'up'],
  ['gripper', 'crushedOut', 'crushes', 'up'],
  ['placed', 'value', 'show-placed', 'value'],
  ['slips', 'value', 'show-slips', 'value'],
  ['crushes', 'value', 'show-crushes', 'value'],
  ['gripper', 'gripForce', 'show-grip', 'value'],
  ['a-cycle', 'index', 'step-text', 'line'],
  ['go', 'started', 'step-text', 'show'],
  ['go', 'started', 'cam', 'on'],
];

/** The sample board. Fresh objects on every call. */
export function createAutoArmBoard(): Board {
  return makeBoard('Tay máy tự gắp và đặt', '3d', specs, AUTO_ARM_WIRES, [
    {
      color: 'yellow',
      h: 430,
      text: 'Tay máy chạy mãi, không cần bấm gì: cứ 8 giây "Tạo đối tượng" thả một thùng 2 kg lên băng chuyền, thùng nào cũng bị gắp, đặt sang băng ra rồi biến mất sau 40 giây nên tấm xanh không bao giờ đầy. Tay máy chạy tự động theo 5 bước (Chuỗi bước): 1 chờ thùng tới điểm gắp (băng chuyền tự dừng), 2 hạ tay xuống quanh thùng, 3 kẹp, 4 nâng thùng lên khỏi băng, 5 quay sang chỗ đặt, 6 nhả rồi quay về. Số bước chọn một hàng của ba "Bảng giá trị" (góc dạy sẵn của vai, khuỷu, xoay). Mỗi bước tự báo "Xong bước" qua cổng riêng: thùng đã tới, tay đã hạ tới góc dạy (vai và khuỷu báo "Đã tới góc") và thùng nằm giữa hai ngón, tay kẹp đã giữ chắc 0,6 giây, vai và khuỷu đã nâng tới góc (bước 4), khớp xoay báo "Đã tới góc" khi tới chỗ đặt (bước 5) hoặc khi về chỗ cũ (bước 6). Nâng lên hẳn rồi mới quay, vì thùng đang nằm thấp giữa hai thành băng chuyền sẽ quệt vào thành băng nếu vừa nâng vừa quay.',
    },
    {
      color: 'green',
      h: 440,
      text: 'Tay kẹp ở kiểu "Vật nằm giữa hai ngón": nó chỉ kẹp được thùng khi điểm kẹp nằm trong thùng và lòng bàn tay không lún vào thùng, nên tay phải hạ xuống thật: bàn tay tựa ngay trên nắp thùng, hai ngón ôm hai bên thân thùng, và khi kẹp thùng được ép về chính giữa hai ngón. Lực kẹp chọn 25 N mỗi ngón. Mọi thùng đều nặng 2 kg (Số cố định "khối lượng"), ma sát 0,5: giữ được khi 2 ngón × 0,5 × lực ≥ 2 × 9,81, tức lực ≥ 19,6 N. Xúc xắc ném 1 đến 3 chọn một hàng của "Bảng giá trị" lực chịu nén: ném 3 (khoảng một thùng trong ba) ra 60 N, thùng dễ vỡ, chịu ép tối đa 60 N cả hai ngón, nên lực phải ≤ 30 N; các thùng khác là 0 (không bao giờ hỏng). Khoảng đúng là 19,6 đến 30 N; 25 N nằm giữa. Bảng này đã bật "Vật lý thật" (công tắc ở bảng Thuộc tính, khi chưa chọn mảnh nào): thùng là vật rắn thật, nằm yên trên băng, được tay nhấc, thả xuống băng ra rồi trôi tới tấm xanh và có thể lăn ngã ở đó.',
    },
    {
      color: 'pink',
      text: 'Thử đổi thông số: 1) Chọn Số cố định "lực kẹp", đổi 25 thành 15: thùng nâng lên là TUỘT, đếm "Bị tuột". 2) Đổi thành 40: thùng dễ vỡ bị ép hỏng, đếm "Bị hỏng". 3) Chọn "Bảng giá trị" của vai, đổi hàng 2 từ 28,7 thành 50: tay không hạ đủ sâu, thùng không nằm giữa hai ngón, tay đứng chờ mãi ở bước 2. 4) Chọn Khớp xoay "xoay", hạ "Tốc độ tối đa" xuống 30: tay quay chậm hẳn, đặt được ít thùng hơn.',
    },
  ], { realPhysics: true });
}
