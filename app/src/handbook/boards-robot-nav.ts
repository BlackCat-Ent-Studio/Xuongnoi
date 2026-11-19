import type { Board } from '../engine/types';
import { build, type NodeSpec, type WireSpec } from './boards-robot-arm';

/** "Thử ngay" boards for "Đi tới điểm", "Mốc sàn", "Đọc mốc sàn" and "Tìm mốc sàn", and the scene of the lesson about them. */

export const TARGET_NUMBER_LABEL = 'Số mốc muốn tới';
export const STANDING_ON_LABEL = 'Đang đứng trên mốc số';
export const DISTANCE_LABEL = 'Còn cách (m)';

const at = (x: number, z: number) => ({ x, y: 0.5, z });

const floorMarker = (alias: string, y: number, number: number, x: number, z: number): NodeSpec => ({ alias, kind: 'floor-marker', x: 20, y, params: { number, position: at(x, z) } });

/** A robot seen from above: chassis, a left and a right motor mounted on it. Nothing gives the motors power yet. */
const ROBOT: NodeSpec[] = [
  { alias: 'body', kind: 'robot-body', x: 320, y: 20, params: { position: at(-5, 0), heading: -90 } },
  { alias: 'left', kind: 'motor', x: 920, y: 20, params: { side: -0.4 } },
  { alias: 'right', kind: 'motor', x: 920, y: 240, params: { side: 0.4 } },
];
const ROBOT_WIRES: WireSpec[] = [
  ['body', 'self', 'left', 'body'],
  ['body', 'self', 'right', 'body'],
];

/**
 * Start of the lesson: the robot, markers 2 and 3 on the right, "Khi bắt đầu", a number card that says which marker to go
 * to, and a read-out waiting for the number of the marker under the robot.
 */
export function robotNavScene(): NodeSpec[] {
  return [
    { alias: 'start', kind: 'on-start', x: 20, y: 20 },
    { alias: 'wanted', kind: 'const', x: 20, y: 180, params: { value: 2 } },
    floorMarker('mark2', 300, 2, 5, -3),
    floorMarker('mark3', 520, 3, 5, 3),
    ...ROBOT,
    { alias: 'standing', kind: 'show-number', x: 1220, y: 20, params: { label: STANDING_ON_LABEL, corner: 'top-right' } },
  ];
}
export const ROBOT_NAV_SCENE_WIRES: WireSpec[] = [...ROBOT_WIRES];

/** What the learner adds: marker 1, the number-to-marker lookup, the driver and the reader. */
export const ROBOT_NAV_SOLUTION_NODES: NodeSpec[] = [
  { alias: 'mark1', kind: 'floor-marker', x: 320, y: 640 },
  { alias: 'find', kind: 'floor-marker-find', x: 320, y: 300 },
  { alias: 'drive', kind: 'robot-goto', x: 620, y: 20 },
  { alias: 'reader', kind: 'floor-marker-sensor', x: 920, y: 480 },
];
export const ROBOT_NAV_SOLUTION_WIRES: WireSpec[] = [
  ['wanted', 'value', 'find', 'number'],
  ['body', 'self', 'drive', 'robot'],
  ['find', 'marker', 'drive', 'target'],
  ['start', 'started', 'drive', 'go'],
  ['drive', 'left', 'left', 'power'],
  ['drive', 'right', 'right', 'power'],
  ['body', 'self', 'reader', 'who'],
  ['reader', 'number', 'standing', 'value'],
];

const DRIVE_WIRES: WireSpec[] = [
  ['body', 'self', 'drive', 'robot'],
  ['start', 'started', 'drive', 'go'],
  ['drive', 'left', 'left', 'power'],
  ['drive', 'right', 'right', 'power'],
];

export const tryRobotGoto = (): Board =>
  build(
    'Đi tới điểm',
    'Nhìn từ trên xuống. Bấm Chạy: robot đang quay mũi lên trên nên nó quay tại chỗ về phía Mốc số 1, chạy tới, chậm dần rồi dừng giữa ô. "Còn cách" giảm về gần 0. Thử gỡ sợi dây "Trái" hoặc "Phải": mảnh Đi tới điểm chỉ ra lệnh, bánh nào không có dây thì đứng yên. Thử đổi "Công suất chạy tối đa" hay "Coi như đã tới khi còn cách".',
    [
      { alias: 'start', kind: 'on-start', x: 20, y: 20 },
      floorMarker('mark1', 180, 1, 4, 3),
      ...ROBOT,
      { alias: 'drive', kind: 'robot-goto', x: 620, y: 20 },
      { alias: 'left-over', kind: 'show-number', x: 1220, y: 20, params: { label: DISTANCE_LABEL, corner: 'top-right' } },
    ],
    [...ROBOT_WIRES, ...DRIVE_WIRES, ['mark1', 'self', 'drive', 'target'], ['drive', 'distance', 'left-over', 'value']],
    '2d-top',
  );

export const tryFloorMarker = (): Board =>
  build(
    'Mốc sàn',
    'Nhìn từ trên xuống. Mốc số 5 là một ô sơn trên sàn: robot chạy đè lên được. Ở đây mảnh Đi tới điểm lấy đích từ hai con số "X" và "Z" của mốc (cách chọn "Hai con số..."), nên hai ô số trên màn hình chính là chỗ robot sẽ dừng. Đổi "Vị trí" của mốc rồi bấm Chạy lại.',
    [
      { alias: 'start', kind: 'on-start', x: 20, y: 20 },
      floorMarker('mark5', 180, 5, 3, -2),
      ...ROBOT,
      { alias: 'drive', kind: 'robot-goto', x: 620, y: 20, params: { targetFrom: 'ports' } },
      { alias: 'show-x', kind: 'show-number', x: 1220, y: 20, params: { label: 'X của mốc', corner: 'top-left' } },
      { alias: 'show-z', kind: 'show-number', x: 1220, y: 160, params: { label: 'Z của mốc', corner: 'top-right' } },
    ],
    [...ROBOT_WIRES, ...DRIVE_WIRES, ['mark5', 'x', 'drive', 'x'], ['mark5', 'z', 'drive', 'z'], ['mark5', 'x', 'show-x', 'value'], ['mark5', 'z', 'show-z', 'value']],
    '2d-top',
  );

export const tryFloorMarkerSensor = (): Board =>
  build(
    'Đọc mốc sàn',
    'Nhìn từ trên xuống. Lái robot bằng phím mũi tên (lên = tiến, trái / phải = rẽ) qua ba ô mốc. Ô số trên màn hình cho biết robot đang đứng trên mốc số mấy; ra khỏi ô thì về 0. Tâm robot phải nằm trong ô thì mới tính.',
    [
      { alias: 'stick', kind: 'stick', x: 20, y: 20 },
      floorMarker('mark1', 240, 1, -1, 0),
      floorMarker('mark2', 460, 2, 3, -3),
      floorMarker('mark3', 680, 3, 3, 3),
      ...ROBOT.map((n): NodeSpec => (n.alias === 'body' ? { ...n, x: 620, params: { position: at(-5, 0), heading: 0 } } : n)),
      { alias: 'left-mix', kind: 'math', x: 320, y: 20, params: { op: 'add' } },
      { alias: 'right-mix', kind: 'math', x: 320, y: 220, params: { op: 'sub' } },
      { alias: 'reader', kind: 'floor-marker-sensor', x: 620, y: 240 },
      { alias: 'standing', kind: 'show-number', x: 1220, y: 20, params: { label: STANDING_ON_LABEL, corner: 'top-right' } },
    ],
    [
      ...ROBOT_WIRES,
      ['stick', 'y', 'left-mix', 'a'],
      ['stick', 'x', 'left-mix', 'b'],
      ['stick', 'y', 'right-mix', 'a'],
      ['stick', 'x', 'right-mix', 'b'],
      ['left-mix', 'out', 'left', 'power'],
      ['right-mix', 'out', 'right', 'power'],
      ['body', 'self', 'reader', 'who'],
      ['reader', 'number', 'standing', 'value'],
    ],
    '2d-top',
  );

export const tryFloorMarkerFind = (): Board =>
  build(
    'Tìm mốc sàn',
    'Nhìn từ trên xuống. Số cố định bên trái là "số mốc muốn tới" (đang là 2). Tìm mốc sàn đổi con số đó thành đúng ô mốc, Đi tới điểm lái robot tới. Đang chạy, đổi "Giá trị" của Số cố định thành 1 hoặc 3: robot đổi hướng ngay. Đổi thành 0 hoặc 7 (không có mốc nào): "Có mốc" tắt, robot đứng chờ.',
    [...robotNavScene(), ...ROBOT_NAV_SOLUTION_NODES.map((n): NodeSpec => (n.alias === 'mark1' ? { ...n, params: { number: 1, position: at(0, 0) } } : n))],
    [...ROBOT_NAV_SCENE_WIRES, ...ROBOT_NAV_SOLUTION_WIRES.filter((w) => !(w[0] === 'start' && w[2] === 'drive')), ['find', 'found', 'drive', 'go']],
    '2d-top',
  );
