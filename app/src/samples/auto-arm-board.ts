import type { Board, Params } from '../engine/types';
import { makeBoard, type CardSpec, type Link } from './cell-board-kit';

/**
 * Sample "Tay máy tự gắp và đặt": crates ride a belt to a pick point; a gripper that has a crate in reach starts a
 * 5-step cycle (wait, lower, close, lift and swing, open and return) whose joint angles are "taught" in map-range cards.
 * Built only from palette pieces; nothing is typed by a person while it runs.
 */

/** Numbers the notes and the test quote. */
export const AUTO_ARM = {
  /** Grip force of each finger (N). A 2 kg crate with mu 0.5 needs 19.6 N; the fragile crate breaks above 30 N. */
  gripForceN: 25,
  holdThresholdN: 19.62,
  fragileLimitN: 60,
  crateKg: 2,
  /** Taught pitch angles (deg) of [shoulder, elbow] at the hover and the lowered pose, and the swing (deg) to the place point. */
  /** Folded pose the arm starts in (it moves to the hover pose by itself). */
  rest: [70, -140] as const,
  hover: [36, -111.8] as const,
  down: [21.2, -95.8] as const,
  swing: 180,
  /** Which crates of the queue are fragile (front of the queue first). */
  fragile: [false, false, true, false, true, false] as readonly boolean[],
  firstCrateX: 4.5,
  crateSpacingM: 3,
  beltSpeed: 1,
};

const [H1, H2] = AUTO_ARM.hover;
const [D1, D2] = AUTO_ARM.down;

const beltY = 0.3;
const beltTop = 0.6;

function crates(): CardSpec[] {
  return AUTO_ARM.fragile.map((fragile, i) => ({
    id: `crate-${i + 1}`,
    kind: 'item',
    col: 0,
    params: {
      shape: 'box',
      position: { x: AUTO_ARM.firstCrateX + i * AUTO_ARM.crateSpacingM, y: beltTop + 0.35, z: 0 },
      size: { x: 0.6, y: 0.6, z: 0.6 },
      color: fragile ? '#facc15' : '#a16207',
      mass: AUTO_ARM.crateKg,
      ...(fragile ? { crushLimit: AUTO_ARM.fragileLimitN } : {}),
    },
  }));
}

const ramp = (inMin: number, outMin: number, outMax: number): Params => ({ inMin, inMax: inMin + 1, outMin, outMax, clamp: 'yes' });

const specs: CardSpec[] = [
  // --- the world ---
  { id: 'floor', kind: 'block', col: 0, params: { position: { x: 5, y: -0.5, z: 0 }, size: { x: 50, y: 1, z: 14 }, color: '#65a30d' } },
  { id: 'pillar', kind: 'block', col: 0, params: { position: { x: 0, y: 0.8, z: 0 }, size: { x: 0.6, y: 1.6, z: 0.6 }, color: '#a3a3a3' } },
  { id: 'feed', kind: 'block', col: 0, params: { position: { x: 11.5, y: beltY, z: 0 }, size: { x: 21, y: 0.6, z: 1.2 }, style: 'conveyor', beltSpeed: AUTO_ARM.beltSpeed, beltDir: '-x', color: '#475569' } },
  { id: 'stopper', kind: 'block', col: 0, params: { position: { x: 1.6, y: 0.775, z: 0 }, size: { x: 0.3, y: 0.35, z: 1.2 }, color: '#f59e0b' } },
  { id: 'out-belt', kind: 'block', col: 0, params: { position: { x: -4, y: beltY, z: 0 }, size: { x: 6, y: 0.6, z: 1.2 }, style: 'conveyor', beltSpeed: AUTO_ARM.beltSpeed, beltDir: '-x', color: '#475569' } },
  { id: 'pad-out', kind: 'block', col: 0, params: { position: { x: -8.5, y: 0.05, z: 0 }, size: { x: 3, y: 0.1, z: 3 }, color: '#3b82f6' } },
  { id: 'go', kind: 'on-start', col: 1 },
  ...crates(),

  // --- the arm: pillar -> swing -> shoulder -> upper -> elbow -> fore -> gripper ---
  { id: 'swing', kind: 'joint', col: 2, params: { axis: 'yaw', start: 0, min: -180, max: 180, maxTorque: 50, maxSpeed: 90, mount: { x: 0, y: 0.8, z: 0 }, color: '#8b5cf6' } },
  { id: 'shoulder', kind: 'joint', col: 2, params: { axis: 'pitch', start: AUTO_ARM.rest[0], min: -30, max: 90, maxTorque: 140, maxSpeed: 60 } },
  { id: 'upper', kind: 'link', col: 2, params: { length: 1.8, mass: 1.5, thickness: 0.22 } },
  { id: 'elbow', kind: 'joint', col: 3, params: { axis: 'pitch', start: AUTO_ARM.rest[1], min: -150, max: 30, maxTorque: 80, maxSpeed: 60 } },
  { id: 'fore', kind: 'link', col: 3, params: { length: 1.1, mass: 1, thickness: 0.18 } },
  { id: 'gripper', kind: 'gripper', col: 3, params: { defaultForce: 0, maxForce: 120, fingerMu: 0.8, width: 1, reach: 0.5, mass: 0.5 } },
  { id: 'grip-force', kind: 'const', col: 3, params: { value: AUTO_ARM.gripForceN } },

  // --- the cycle: Chuỗi bước. "Sang bước kế" fires when the finished condition of the current step holds ---
  { id: 'a-cycle', kind: 'sequence', col: 4, params: { stepCount: 5, loop: 'yes' } },
  { id: 'stage', kind: 'select-number', col: 4, params: { choices: 5 } },
  { id: 'arm-set', kind: 'and', col: 4 },
  { id: 'arm-in-place', kind: 'and', col: 4 },
  { id: 'moving-24', kind: 'or', col: 5 },
  { id: 'moving-245', kind: 'or', col: 5 },
  { id: 'done-moving', kind: 'and', col: 5 },
  { id: 'done-wait', kind: 'and', col: 5 },
  { id: 'done-grip', kind: 'and', col: 5 },
  { id: 'done-a', kind: 'or', col: 5 },
  { id: 'done-any', kind: 'or', col: 5 },
  { id: 'steady', kind: 'not', col: 5 },
  { id: 'go-next', kind: 'and', col: 5 },
  { id: 'close-3-4', kind: 'or', col: 5 },
  { id: 'belt-run', kind: 'not', col: 5 },

  // --- taught angles: idx (1..5) -> degrees. Each joint = a ramp at one step + a ramp at another ---
  { id: 'yaw-out', kind: 'map-range', col: 6, params: ramp(3, 0, AUTO_ARM.swing) },
  { id: 'yaw-back', kind: 'map-range', col: 6, params: ramp(4, 0, -AUTO_ARM.swing) },
  { id: 'yaw-sum', kind: 'math', col: 6, params: { op: 'add' } },
  { id: 'sh-down', kind: 'map-range', col: 6, params: ramp(1, H1, D1) },
  { id: 'sh-up', kind: 'map-range', col: 7, params: ramp(3, 0, H1 - D1) },
  { id: 'sh-sum', kind: 'math', col: 7, params: { op: 'add' } },
  { id: 'el-down', kind: 'map-range', col: 7, params: ramp(1, H2, D2) },
  { id: 'el-up', kind: 'map-range', col: 7, params: ramp(3, 0, H2 - D2) },
  { id: 'el-sum', kind: 'math', col: 7, params: { op: 'add' } },

  // --- readouts ---
  { id: 'placed', kind: 'counter', col: 8 },
  { id: 'slips', kind: 'counter', col: 8 },
  { id: 'crushes', kind: 'counter', col: 8 },
  { id: 'drop-zone', kind: 'zone', col: 8, params: { center: { x: -1.9, y: 0.9, z: 0 }, size: { x: 2.4, y: 0.5, z: 1.4 }, filter: 'item', rule: 'center', color: '#22c55e' } },
  { id: 'show-placed', kind: 'show-number', col: 9, params: { label: 'Đã đặt (thùng)', corner: 'top-left' } },
  { id: 'show-slips', kind: 'show-number', col: 9, params: { label: 'Bị tuột (lần)', corner: 'top-left' } },
  { id: 'show-crushes', kind: 'show-number', col: 9, params: { label: 'Bị hỏng (thùng)', corner: 'top-left' } },
  { id: 'show-grip', kind: 'show-number', col: 9, params: { label: 'Lực kẹp mỗi ngón (N)', corner: 'top-left' } },
  { id: 'show-step', kind: 'show-number', col: 9, params: { label: 'Bước đang làm (1-5)', corner: 'top-left' } },
  { id: 'cam', kind: 'camera', col: 9, params: { mode: 'fixed', point: { x: 0, y: 1, z: 0 }, zoom: 0.7, view: 'tilted' } },
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
  // Power and belts
  ['go', 'started', 'swing', 'power'],
  ['go', 'started', 'shoulder', 'power'],
  ['go', 'started', 'elbow', 'power'],
  ['go', 'started', 'out-belt', 'run'],
  ['gripper', 'inReach', 'belt-run', 'in'],
  ['belt-run', 'out', 'feed', 'run'],
  // The cycle: which step is on -> the taught angle of every joint
  ['a-cycle', 'index', 'yaw-out', 'value'],
  ['a-cycle', 'index', 'yaw-back', 'value'],
  ['yaw-out', 'value', 'yaw-sum', 'a'],
  ['yaw-back', 'value', 'yaw-sum', 'b'],
  ['yaw-sum', 'out', 'swing', 'angle'],
  ['a-cycle', 'index', 'sh-down', 'value'],
  ['a-cycle', 'index', 'sh-up', 'value'],
  ['sh-down', 'value', 'sh-sum', 'a'],
  ['sh-up', 'value', 'sh-sum', 'b'],
  ['sh-sum', 'out', 'shoulder', 'angle'],
  ['a-cycle', 'index', 'el-down', 'value'],
  ['a-cycle', 'index', 'el-up', 'value'],
  ['el-down', 'value', 'el-sum', 'a'],
  ['el-up', 'value', 'el-sum', 'b'],
  ['el-sum', 'out', 'elbow', 'angle'],
  // Gripper: closed in steps 3 and 4, with the chosen force
  ['a-cycle', 'step3', 'close-3-4', 'a'],
  ['a-cycle', 'step4', 'close-3-4', 'b'],
  ['close-3-4', 'out', 'gripper', 'close'],
  ['grip-force', 'value', 'gripper', 'force'],
  // When is the step finished?
  ['shoulder', 'reached', 'arm-set', 'a'],
  ['elbow', 'reached', 'arm-set', 'b'],
  ['arm-set', 'out', 'arm-in-place', 'a'],
  ['swing', 'reached', 'arm-in-place', 'b'],
  ['a-cycle', 'step2', 'moving-24', 'a'],
  ['a-cycle', 'step4', 'moving-24', 'b'],
  ['moving-24', 'out', 'moving-245', 'a'],
  ['a-cycle', 'step5', 'moving-245', 'b'],
  ['arm-in-place', 'out', 'done-moving', 'a'],
  ['moving-245', 'out', 'done-moving', 'b'],
  ['a-cycle', 'step1', 'done-wait', 'a'],
  ['gripper', 'inReach', 'done-wait', 'b'],
  ['a-cycle', 'step3', 'done-grip', 'a'],
  ['gripper', 'holding', 'done-grip', 'b'],
  ['done-moving', 'out', 'done-a', 'a'],
  ['done-wait', 'out', 'done-a', 'b'],
  ['done-a', 'out', 'done-any', 'a'],
  ['done-grip', 'out', 'done-any', 'b'],
  ['a-cycle', 'index', 'stage', 'value'],
  ['stage', 'changed', 'steady', 'in'],
  ['done-any', 'out', 'go-next', 'a'],
  ['steady', 'out', 'go-next', 'b'],
  ['go-next', 'out', 'a-cycle', 'next'],
  // Counters
  ['drop-zone', 'entered', 'placed', 'up'],
  ['gripper', 'slipped', 'slips', 'up'],
  ['gripper', 'crushedOut', 'crushes', 'up'],
  ['placed', 'value', 'show-placed', 'value'],
  ['slips', 'value', 'show-slips', 'value'],
  ['crushes', 'value', 'show-crushes', 'value'],
  ['gripper', 'gripForce', 'show-grip', 'value'],
  ['a-cycle', 'index', 'show-step', 'value'],
  ['go', 'started', 'cam', 'on'],
];

/** The sample board. Fresh objects on every call. */
export function createAutoArmBoard(): Board {
  return makeBoard('Tay máy tự gắp và đặt', '3d', specs, AUTO_ARM_WIRES, [
    {
      color: 'yellow',
      text: 'Tay máy chạy tự động theo 5 bước (Chuỗi bước): 1 chờ thùng tới tầm tay kẹp, 2 hạ xuống, 3 kẹp, 4 nâng lên và quay sang chỗ đặt, 5 nhả rồi quay về. Mỗi bước xong khi các khớp "Đã tới góc" (hoặc tay kẹp "Có vật trong tầm" / "Đang giữ"). Các góc được dạy sẵn trong các thẻ Quy đổi khoảng: số bước → góc của từng khớp.',
    },
    {
      color: 'green',
      text: 'Lực kẹp chọn 25 N mỗi ngón. Thùng nâu và thùng vàng đều nặng 2 kg, ma sát 0,5: giữ được khi 2 ngón × 0,5 × lực ≥ 2 × 9,81, tức lực ≥ 19,6 N. Thùng vàng dễ vỡ, chịu ép tối đa 60 N cả hai ngón, nên lực phải ≤ 30 N. Khoảng đúng là 19,6 đến 30 N; 25 N nằm giữa.',
    },
    {
      color: 'pink',
      text: 'Thử đổi thông số: 1) Chọn Số cố định "lực kẹp", đổi 25 thành 15: thùng nâng lên là TUỘT, đếm "Bị tuột". 2) Đổi thành 40: thùng vàng bị ép hỏng, đếm "Bị hỏng". 3) Chọn Khớp xoay "vai", hạ "Tốc độ tối đa" xuống 20: tay chậm hẳn, đặt được ít thùng hơn.',
    },
  ]);
}
