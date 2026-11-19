import type { Board } from '../engine/types';
import { build, type NodeSpec, type WireSpec } from './boards-robot-arm';

/** "Thử ngay" boards for "Nhớ số", "Bộ điều phối" and the random classes of "Tạo đối tượng". */

/** Cards of machine 1 sit above this canvas height, those of machine 2 below it. */
export const SECOND_MACHINE_Y = 400;
export const NEW_DOOR_LABEL = 'Số cửa của việc mới';
export const MACHINE_DOOR_LABEL = 'Máy 1 chở tới cửa';

const lamp = (alias: string, y: number, x: number): NodeSpec => ({
  alias,
  kind: 'block',
  x: 1160,
  y,
  params: { position: { x, y: 1, z: 0 }, size: { x: 1.2, y: 1.2, z: 1 }, color: '#22c55e' },
});

/**
 * A job arrives every 2 seconds with a random door number. Two machines are ready-made: each is a "Công tắc nhớ" that is on
 * while the machine works, a 3-second "Hẹn giờ" that ends the work, and a green lamp that shows only while the machine is free.
 * Nothing hands the jobs out yet.
 */
export function shareJobsScene(): NodeSpec[] {
  return [
    { alias: 'start', kind: 'on-start', x: 20, y: 20 },
    { alias: 'clock', kind: 'timer', x: 20, y: 180, params: { seconds: 2, repeat: 'yes' } },
    { alias: 'door', kind: 'random', x: 20, y: 410, params: { min: 1, max: 6, whole: 'yes', mode: 'press', seed: 7 } },
    { alias: 'newDoor', kind: 'show-number', x: 20, y: 600, params: { label: NEW_DOOR_LABEL, corner: 'top-left' } },
    { alias: 'machineDoor', kind: 'show-number', x: 300, y: 660, params: { label: MACHINE_DOOR_LABEL, corner: 'top-right' } },
    { alias: 'busy1', kind: 'latch', x: 640, y: 20 },
    { alias: 'work1', kind: 'timer', x: 900, y: 20, params: { seconds: 3 } },
    lamp('lamp1', 20, -2),
    { alias: 'busy2', kind: 'latch', x: 640, y: SECOND_MACHINE_Y },
    { alias: 'work2', kind: 'timer', x: 900, y: SECOND_MACHINE_Y, params: { seconds: 3 } },
    lamp('lamp2', SECOND_MACHINE_Y, 2),
  ];
}

const machineWires = (k: 1 | 2): WireSpec[] => [
  [`busy${k}`, 'on', `work${k}`, 'run'],
  [`busy${k}`, 'on', `work${k}`, 'reset'],
  [`work${k}`, 'done', `busy${k}`, 'reset'],
  [`busy${k}`, 'on', `lamp${k}`, 'hide'],
  [`work${k}`, 'done', `lamp${k}`, 'show'],
];

export const SHARE_JOBS_SCENE_WIRES: WireSpec[] = [
  ['start', 'started', 'clock', 'run'],
  ['clock', 'done', 'door', 'roll'],
  ['door', 'value', 'newDoor', 'value'],
  ...machineWires(1),
  ...machineWires(2),
];

/** What the learner adds: the dispatcher between the job source and the machines, and a memory for machine 1. */
export const SHARE_JOBS_SOLUTION_WIRES: WireSpec[] = [
  ['clock', 'done', 'dispatcher', 'job'],
  ['dispatcher', 'give1', 'busy1', 'set'],
  ['busy1', 'on', 'dispatcher', 'busy1'],
  ['dispatcher', 'give2', 'busy2', 'set'],
  ['busy2', 'on', 'dispatcher', 'busy2'],
  ['door', 'value', 'memory', 'value'],
  ['dispatcher', 'give1', 'memory', 'store'],
  ['memory', 'held', 'machineDoor', 'value'],
];

export const tryDispatcher = (): Board =>
  build(
    'Bộ điều phối',
    'Bấm Chạy: cứ 2 giây có một việc mới. Bộ điều phối giao lần lượt cho máy 1 rồi máy 2; máy đang làm (3 giây) thì đèn xanh của nó tắt. "Nhớ số" giữ số cửa của việc mà máy 1 vừa nhận, dù số cửa của việc mới đã đổi. Thử đặt "Số giây" của hai Hẹn giờ máy thành 6: máy nào cũng bận nên việc phải chờ, "Đang chờ" bật, nhưng không việc nào bị mất.',
    [
      ...shareJobsScene(),
      { alias: 'dispatcher', kind: 'dispatcher', x: 300, y: 20 },
      { alias: 'memory', kind: 'sample-hold', x: 300, y: SECOND_MACHINE_Y },
      { alias: 'given', kind: 'show-number', x: 20, y: 720, params: { label: 'Đã giao', corner: 'bottom-left' } },
    ],
    [...SHARE_JOBS_SCENE_WIRES, ...SHARE_JOBS_SOLUTION_WIRES, ['dispatcher', 'given', 'given', 'value']],
  );

export const trySampleHold = (): Board =>
  build(
    'Nhớ số',
    'Bấm Chạy: đồng hồ đếm ngược từ 10 về 0 rồi lặp lại. Bấm phím E để "Lưu": "Số nhớ" chép số giây lúc đó và giữ nguyên, trong khi đồng hồ vẫn chạy. Bấm phím Q để "Xoá": "Số nhớ" về "Số ban đầu".',
    [
      { alias: 'start', kind: 'on-start', x: 20, y: 20 },
      { alias: 'clock', kind: 'timer', x: 20, y: 180, params: { seconds: 10, repeat: 'yes' } },
      { alias: 'save', kind: 'key', x: 20, y: 410, params: { key: 'KeyE' } },
      { alias: 'wipe', kind: 'key', x: 20, y: 570, params: { key: 'KeyQ' } },
      { alias: 'memory', kind: 'sample-hold', x: 300, y: 180 },
      { alias: 'now', kind: 'show-number', x: 600, y: 20, params: { label: 'Giây còn lại', corner: 'top-left' } },
      { alias: 'kept', kind: 'show-number', x: 600, y: 180, params: { label: 'Số nhớ', corner: 'top-right' } },
    ],
    [
      ['start', 'started', 'clock', 'run'],
      ['clock', 'left', 'memory', 'value'],
      ['save', 'pressed', 'memory', 'store'],
      ['wipe', 'pressed', 'memory', 'clear'],
      ['clock', 'left', 'now', 'value'],
      ['memory', 'held', 'kept', 'value'],
    ],
  );

export const spawnerClassBoard = (): Board =>
  build(
    'sinh ngẫu nhiên theo loại',
    'Bấm Chạy: cứ 2 giây một thùng rơi xuống bàn cân. Vì "Sinh ngẫu nhiên theo loại" đang bật với 3 loại, mỗi thùng bốc thăm một loại: đỏ 1 kg, vàng 3 kg hoặc xanh 6 kg. "Loại vừa sinh" và số trên cân cho biết thùng nào vừa rơi. "Hạt giống" là 5 nên lần chạy nào thứ tự cũng y hệt; đặt 0 thì mỗi lần một khác.',
    [
      { alias: 'start', kind: 'on-start', x: 20, y: 20 },
      { alias: 'clock', kind: 'timer', x: 20, y: 180, params: { seconds: 2, repeat: 'yes' } },
      {
        alias: 'maker',
        kind: 'spawner',
        x: 300,
        y: 20,
        params: {
          template: 'item',
          shape: 'crate',
          position: { x: 0, y: 4, z: 0 },
          size: { x: 0.8, y: 0.8, z: 0.8 },
          maxAlive: 1,
          lifetime: 1.8,
          randomClass: 'yes',
          classCount: 3,
          class1Mass: 1,
          class2Mass: 3,
          class3Mass: 6,
          classSeed: 5,
        },
      },
      { alias: 'floor', kind: 'block', x: 20, y: 420, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 12, y: 1, z: 1 }, color: '#78716c' } },
      { alias: 'scale', kind: 'block', x: 300, y: 420, params: { position: { x: 0, y: 0.2, z: 0 }, size: { x: 3, y: 0.4, z: 1 }, color: '#0ea5e9' } },
      { alias: 'sensor', kind: 'force-sensor', x: 600, y: 420 },
      { alias: 'kg', kind: 'show-number', x: 880, y: 420, params: { label: 'Cân (kg)', corner: 'top-left' } },
      { alias: 'class', kind: 'show-number', x: 600, y: 20, params: { label: 'Loại vừa sinh', corner: 'top-right' } },
    ],
    [
      ['start', 'started', 'clock', 'run'],
      ['clock', 'done', 'maker', 'spawn'],
      ['maker', 'lastClass', 'class', 'value'],
      ['scale', 'self', 'sensor', 'who'],
      ['sensor', 'mass', 'kg', 'value'],
    ],
  );
