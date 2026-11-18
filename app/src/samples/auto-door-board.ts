import type { Board } from '../engine/types';
import { makeBoard, type CardSpec, type Link } from './cell-board-kit';

/**
 * Sample "Cửa tự động" (barrier): a bot walks up and down a path by itself. A zone sensor sees it coming, a servo lifts a
 * barrier bar, and when the zone has been empty for a few seconds a timer lets the barrier fall again. The bar is solid
 * ("Chắn vật"): while it is down it really stops the walker.
 * Built only from palette pieces; nothing is typed by a person while it runs.
 */

/** Numbers the notes and the test quote. */
export const AUTO_DOOR = {
  /** Barrier angle (deg): 0 = bar across the path, 90 = bar standing up. */
  openAngle: 90,
  closeDelayS: 2,
  /** The walker patrols between z = -patrolZ and z = +patrolZ. */
  patrolZ: 5.5,
  barMassKg: 4,
  barLengthM: 3.6,
  servoTorque: 120,
};

const Z = AUTO_DOOR.patrolZ;

const specs: CardSpec[] = [
  // --- the world ---
  { id: 'floor', kind: 'block', col: 0, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 }, color: '#65a30d' } },
  { id: 'path', kind: 'block', col: 0, params: { position: { x: 0, y: 0.02, z: 0 }, size: { x: 3.2, y: 0.04, z: 2 * Z }, color: '#d6c7a1' } },
  { id: 'pad-a', kind: 'block', col: 0, params: { position: { x: 0, y: 0.02, z: -Z - 0.8 }, size: { x: 3.2, y: 0.04, z: 1.6 }, color: '#3b82f6' } },
  { id: 'pad-b', kind: 'block', col: 0, params: { position: { x: 0, y: 0.02, z: Z + 0.8 }, size: { x: 3.2, y: 0.04, z: 1.6 }, color: '#ef4444' } },
  { id: 'post', kind: 'block', col: 0, params: { position: { x: -1.8, y: 0.35, z: 0 }, size: { x: 0.4, y: 0.7, z: 0.4 }, color: '#a3a3a3' } },
  { id: 'post-far', kind: 'block', col: 0, params: { position: { x: 1.8, y: 0.35, z: 0 }, size: { x: 0.4, y: 0.7, z: 0.4 }, color: '#a3a3a3' } },
  { id: 'walker', kind: 'character', col: 0, params: { position: { x: 0, y: 1, z: -Z }, speed: 3, role: 'bot', color: '#3b82f6' } },
  { id: 'go', kind: 'on-start', col: 0 },

  // --- the walker patrols between two ends ---
  { id: 'patrol', kind: 'patrol', col: 1, params: { pointA: { x: 0, y: 1, z: -Z }, pointB: { x: 0, y: 1, z: Z }, wait: 4 } },

  // --- the sensor and the timer ---
  { id: 'sensor', kind: 'zone', col: 1, params: { center: { x: 0, y: 1.5, z: 0 }, size: { x: 5, y: 3, z: 9 }, filter: 'character', color: '#22c55e' } },
  { id: 'not-inside', kind: 'not', col: 1 },
  { id: 'close-timer', kind: 'timer', col: 1, params: { seconds: AUTO_DOOR.closeDelayS } },
  { id: 'door-open', kind: 'latch', col: 2 },

  // --- the servo and the barrier bar: the on-off memory becomes the angle (90 when on, 0 when off) ---
  { id: 'to-angle', kind: 'bool-to-number', col: 3, params: { whenOn: AUTO_DOOR.openAngle, whenOff: 0 } },
  {
    id: 'servo',
    kind: 'joint',
    col: 3,
    params: { solid: 'no', axis: 'pitch', start: 0, min: 0, max: 90, maxTorque: AUTO_DOOR.servoTorque, maxSpeed: 120, mount: { x: 0, y: 0.45, z: 0 }, tolerance: 2 },
  },
  { id: 'bar', kind: 'link', col: 3, params: { length: AUTO_DOOR.barLengthM, mass: AUTO_DOOR.barMassKg, thickness: 0.2, color: '#ef4444', solid: 'yes' } },

  // --- readouts ---
  { id: 'distance', kind: 'distance', col: 4, params: { threshold: 5 } },
  { id: 'show-angle', kind: 'show-number', col: 4, params: { label: 'Góc cửa (độ)', corner: 'top-left' } },
  { id: 'show-gap', kind: 'show-number', col: 4, params: { label: 'Người cách cửa (m)', corner: 'top-left' } },
  { id: 'passes', kind: 'counter', col: 4 },
  { id: 'show-passes', kind: 'show-number', col: 4, params: { label: 'Số lần cửa mở', corner: 'top-left' } },
  { id: 'to-state', kind: 'bool-to-number', col: 6, params: { whenOn: 2, whenOff: 1 } },
  {
    id: 'status',
    kind: 'show-text',
    col: 6,
    params: { text: 'CỬA', lines: 'CỬA ĐANG ĐÓNG\nCỬA ĐANG MỞ', corner: 'top-right', color: '#0f766e' },
  },
  { id: 'show-load', kind: 'show-number', col: 5, params: { label: 'Mô-men khớp (N·m)', corner: 'top-left' } },
  { id: 'text-overload', kind: 'show-text', col: 5, params: { text: 'Khớp quá tải: không nâng nổi thanh!', corner: 'top-right', color: '#f59e0b' } },
  { id: 'cam', kind: 'camera', col: 5, params: { mode: 'fixed', point: { x: 0, y: 0.5, z: 0 }, zoom: 0.55, view: 'tilted' } },
];

/** Every wire of the board: the machine is linked only by these. */
export const AUTO_DOOR_WIRES: readonly Link[] = [
  // The walker goes by itself
  ['go', 'started', 'patrol', 'on'],
  ['walker', 'self', 'patrol', 'self'],
  ['patrol', 'moveX', 'walker', 'moveX'],
  ['patrol', 'moveY', 'walker', 'moveY'],
  // Sensor: someone comes into the zone -> remember "open"; the timer starts counting when the zone is empty
  ['sensor', 'entered', 'door-open', 'set'],
  ['sensor', 'entered', 'close-timer', 'reset'],
  ['sensor', 'inside', 'not-inside', 'in'],
  ['not-inside', 'out', 'close-timer', 'run'],
  ['close-timer', 'done', 'door-open', 'reset'],
  // On-off memory -> angle -> servo -> solid bar
  ['door-open', 'on', 'to-angle', 'on'],
  ['to-angle', 'value', 'servo', 'angle'],
  ['go', 'started', 'servo', 'power'],
  ['post', 'self', 'servo', 'base'],
  ['servo', 'tip', 'bar', 'base'],
  // Readouts
  ['walker', 'self', 'distance', 'a'],
  ['post', 'self', 'distance', 'b'],
  ['distance', 'distance', 'show-gap', 'value'],
  ['servo', 'angleNow', 'show-angle', 'value'],
  ['sensor', 'entered', 'passes', 'up'],
  ['passes', 'value', 'show-passes', 'value'],
  ['door-open', 'on', 'to-state', 'on'],
  ['to-state', 'value', 'status', 'line'],
  ['go', 'started', 'status', 'show'],
  ['servo', 'load', 'show-load', 'value'],
  ['servo', 'overloaded', 'text-overload', 'show'],
  // Camera
  ['go', 'started', 'cam', 'on'],
];

/** The sample board. Fresh objects on every call. */
export function createAutoDoorBoard(): Board {
  return makeBoard('Cửa tự động', '3d', specs, AUTO_DOOR_WIRES, [
    {
      color: 'yellow',
      h: 360,
      text: 'Cửa tự động chạy một mình, không cần bấm phím. Bấm Chạy rồi xem: một người máy đi tuần qua lại. Khi người vào vùng xanh (Vùng kích hoạt), "Công tắc nhớ" bật, Khớp xoay (servo) nhấc thanh chắn đỏ lên 90 độ. Người đi khỏi vùng 2 giây (Hẹn giờ) thì công tắc tắt và thanh hạ xuống. Bảng này đã bật "Vật lý thật" (công tắc ở bảng Thuộc tính, khi chưa chọn mảnh nào): thanh nặng thật, nên ô "Mô-men khớp" đọc 4 × 9,81 × 1,8 = 70,6 N·m lúc khớp giữ thanh nằm ngang (khớp có 120 N·m).',
    },
    {
      color: 'green',
      text: 'Cách nối: Vùng kích hoạt "vào" → Công tắc nhớ → Đổi thành số (bật = 90, tắt = 0) → "Góc đặt" của Khớp xoay. Khớp xoay phải có tín hiệu "Bật" (từ Khi bắt đầu) thì mới giữ được thanh. Thanh nối bật "Chắn vật" nên là vật thật: khi thanh hạ xuống người bị chặn lại, thanh nhấc lên mới đi qua được.',
    },
    {
      color: 'pink',
      text: 'Thử đổi thông số: 1) Chọn Hẹn giờ, đổi "Số giây" từ 2 thành 8: cửa mở lâu hơn sau khi người đi khỏi. 2) Chọn Khớp xoay, hạ "Mô-men tối đa" từ 120 xuống 50: thanh nặng 4 kg dài 3,6 m cần ~70 N·m nên không nhấc nổi, hiện "quá tải", người bị chặn mãi. 3) Chọn Vùng kích hoạt, thu nhỏ "Kích thước vùng": cửa mở trễ, người đâm vào thanh rồi mới được qua. 4) Chọn Thanh nối, đổi "Chắn vật" thành Không: thanh chỉ còn là hình vẽ, người đi xuyên qua.',
    },
  ], { realPhysics: true });
}
