import type { Board } from '../engine/types';
import { CODE_DISPLAY_SIZE } from '../nodes/code-reader';
import { build, type NodeSpec, type WireSpec } from './boards-robot-arm';

/** "Thử ngay" board for "Đọc mã": cartons with a code ride a belt through a scan gate, are read, and are taken back at the end. */

export const CODE_NOW_LABEL = 'Mã đang đọc';
export const CODE_READS_LABEL = 'Số thùng đã đọc';
export const CODE_ALIVE_LABEL = 'Số thùng đang có';

/** Numbers the note and the tests quote (m, s). The belt runs toward -x at the speed of the sorting sample. */
export const CODE_LINE = {
  parcel: { x: 0.32, y: 0.26, z: 0.28 },
  belt: { topY: 0.5, length: 5, width: 0.6, speed: 0.5 },
  feedEveryS: 1.5,
  maxAlive: 8,
  gateX: 0,
  endX: -2.2,
} as const;

/**
 * Where the board's "Máy quay" looks: a point at the gate between the belt top and the display, and how far in. Close
 * enough that the numbers on the cartons and on the display can be read at the size the app opens at.
 */
export const CODE_CAMERA = { point: { x: CODE_LINE.gateX, y: 0.8, z: 0 }, zoom: 2.6 } as const;

const { parcel, belt } = CODE_LINE;
const restY = belt.topY + parcel.y / 2;
const gate = { x: 0.14, y: belt.topY + 0.67, z: belt.width + 0.19 };

const NODES: NodeSpec[] = [
  { alias: 'start', kind: 'on-start', x: 20, y: 20 },
  { alias: 'beat', kind: 'timer', x: 20, y: 200, params: { seconds: CODE_LINE.feedEveryS, repeat: 'yes' } },
  { alias: 'dice', kind: 'random', x: 20, y: 480, params: { min: 1, max: 9, seed: 5 } },
  {
    alias: 'maker',
    kind: 'spawner',
    x: 400,
    y: 20,
    params: {
      template: 'item',
      shape: 'crate',
      look: 'parcel-carton',
      position: { x: belt.length / 2 - 0.3, y: restY + 0.02, z: 0 },
      size: { ...parcel },
      maxAlive: CODE_LINE.maxAlive,
      lifetime: 0,
      randomClass: 'yes',
      classCount: 3,
      classSeed: 3,
      // Mass 0 = by kind (1 kg): three tape colours, and no "N kg" tag on the cartons.
      class1Mass: 0,
      class2Mass: 0,
      class3Mass: 0,
      wireCode: 'yes',
      recallPorts: 'yes',
    },
  },
  { alias: 'floor', kind: 'block', x: 20, y: 1100, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 7, y: 1, z: 3 }, color: '#94a3b8' } },
  { alias: 'belt', kind: 'block', x: 400, y: 1100, params: { position: { x: 0, y: belt.topY / 2, z: 0 }, size: { x: belt.length, y: belt.topY, z: belt.width }, style: 'belt-frame', beltSpeed: belt.speed, beltDir: '-x', beltWalls: 'no' } },
  { alias: 'frame', kind: 'block', x: 780, y: 1100, params: { position: { x: CODE_LINE.gateX, y: gate.y / 2, z: 0 }, size: gate, type: 'pickup', style: 'scan-gate' } },
  { alias: 'at-gate', kind: 'zone', x: 780, y: 20, params: { center: { x: CODE_LINE.gateX, y: restY, z: 0 }, size: { x: 0.3, y: 0.3, z: belt.width }, filter: 'item', rule: 'center', color: '#facc15' } },
  {
    alias: 'reader',
    kind: 'code-reader',
    x: 1160,
    y: 20,
    // The screen sits on a corner of the gate's top beam.
    params: { display: 'yes', displayAt: { x: CODE_LINE.gateX, y: gate.y - 0.05 + CODE_DISPLAY_SIZE.y / 2, z: gate.z / 2 - CODE_DISPLAY_SIZE.z / 2 } },
  },
  { alias: 'now', kind: 'show-number', x: 1540, y: 20, params: { label: CODE_NOW_LABEL, corner: 'top-right' } },
  { alias: 'reads', kind: 'counter', x: 1540, y: 200, params: { target: 9999 } },
  { alias: 'read-count', kind: 'show-number', x: 1920, y: 200, params: { label: CODE_READS_LABEL, corner: 'top-right' } },
  { alias: 'at-end', kind: 'zone', x: 780, y: 400, params: { center: { x: CODE_LINE.endX, y: restY, z: 0 }, size: { x: 0.3, y: 0.3, z: belt.width }, filter: 'item', rule: 'center', color: '#ef4444' } },
  { alias: 'alive', kind: 'show-number', x: 1160, y: 400, params: { label: CODE_ALIVE_LABEL, corner: 'top-left' } },
  // Last in the list, so every other card keeps the id it had. The angle stays the learner's ("Tự do"); the camera only comes close, at once.
  { alias: 'cam', kind: 'camera', x: 1160, y: 1100, params: { mode: 'fixed', point: { ...CODE_CAMERA.point }, zoom: CODE_CAMERA.zoom, smoothness: 0, view: 'free' } },
];

/** Every wire of the board; cutting any one of them changes what the learner sees (see the tests). */
export const CODE_LINE_WIRES: WireSpec[] = [
  ['start', 'started', 'beat', 'run'],
  ['start', 'started', 'belt', 'run'],
  ['start', 'started', 'cam', 'on'],
  ['beat', 'done', 'dice', 'roll'],
  ['beat', 'done', 'maker', 'spawn'],
  ['dice', 'value', 'maker', 'code'],
  ['at-gate', 'first', 'reader', 'thing'],
  ['reader', 'code', 'now', 'value'],
  ['reader', 'has', 'reads', 'up'],
  ['reads', 'value', 'read-count', 'value'],
  ['at-end', 'first', 'maker', 'recallThing'],
  ['at-end', 'entered', 'maker', 'recall'],
  ['maker', 'count', 'alive', 'value'],
];

export const tryCodeReader = (): Board =>
  build(
    'Đọc mã',
    'Bấm Chạy: cứ 1,5 giây có một thùng mới, "Số ngẫu nhiên" cho nó một mã từ 1 đến 9 và mã được in trên thùng. Thùng đi qua cổng quét: "Đọc mã" đọc đúng số in trên thùng, màn hình nhỏ trên cổng giữ số đó tới khi thùng sau đi qua. Cuối băng chuyền, vùng đỏ báo cho "Tạo đối tượng" thu hồi thùng. Thử gỡ dây "Mã gắn lên vật": thùng không còn số, "Có mã" tắt. Thử gỡ dây "Thu hồi": thùng dồn lại ở cuối băng và máy ngừng tạo khi đủ 8 thùng. Thẻ "Máy quay" đưa góc nhìn lại gần cổng quét để đọc được số; gỡ dây "Bật" của nó thì thấy cả băng chuyền.',
    NODES,
    CODE_LINE_WIRES,
    '3d',
  );
