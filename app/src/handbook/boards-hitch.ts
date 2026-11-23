import type { Board } from '../engine/types';
import { build, type NodeSpec, type WireSpec } from './boards-robot-arm';

/** "Thử ngay" board for "Chốt gài": a robot drives under a cage, takes it, carries it to a marked spot, lets go and drives away. */

export const HITCH_PAYLOAD_LABEL = 'Xe đang chở (kg)';

/** Numbers the note and the tests quote (m, kg). The floor top is y = 0. */
export const HITCH_YARD = {
  robot: { x: -5, z: 0, length: 0.9, width: 0.7, height: 0.24, mass: 5 },
  /** Marker 1 is under the cage, marker 2 is where the cage is set down, marker 3 is where the robot parks. */
  marks: [
    { x: -2, z: 0 },
    { x: 2.5, z: 1.2 },
    { x: 2.5, z: -1.5 },
  ],
  cage: { mass: 20 },
  carton: { x: 0.32, y: 0.26, z: 0.28, mass: 1, count: 2 },
} as const;

/** Where the "Máy quay" of the board looks: the middle of the trip, near enough to see the cartons in the cage. */
export const HITCH_CAMERA = { point: { x: -0.8, y: 0.4, z: 0.2 }, zoom: 1.3 } as const;

/** The marker the robot drives to in each step of the "Chuỗi bước": under the cage, stay there to take it, the drop spot, the parking spot. */
export const HITCH_ROUTE = [1, 1, 2, 3] as const;

const { robot, marks, carton } = HITCH_YARD;
const mark = (alias: string, x: number, n: number): NodeSpec => ({ alias, kind: 'floor-marker', x, y: 1100, params: { number: n, position: { x: marks[n - 1]!.x, y: 0, z: marks[n - 1]!.z } } });
/** A carton lying on the floor plate of the cage (the plate top is 0.4 m above the floor). */
const cartonAt = (alias: string, x: number, dx: number): NodeSpec => ({
  alias,
  kind: 'item',
  x,
  y: 1100,
  params: { shape: 'crate', look: 'parcel-carton', position: { x: marks[0].x + dx, y: 0.4 + carton.y / 2 + 0.01, z: 0 }, size: { x: carton.x, y: carton.y, z: carton.z }, color: '#f59e0b', mass: carton.mass },
});

const NODES: NodeSpec[] = [
  { alias: 'steps', kind: 'sequence', x: 20, y: 20, params: { stepCount: HITCH_ROUTE.length, loop: 'no', showDone: 'yes' } },
  { alias: 'still-going', kind: 'not', x: 20, y: 620 },
  { alias: 'route', kind: 'value-table', x: 400, y: 20, params: { rows: HITCH_ROUTE.length, ...Object.fromEntries(HITCH_ROUTE.map((n, k) => [`v${k + 1}`, n])) } },
  { alias: 'find', kind: 'floor-marker-find', x: 400, y: 260 },
  { alias: 'hold', kind: 'or', x: 400, y: 560 },
  { alias: 'drive', kind: 'robot-goto', x: 780, y: 20 },
  { alias: 'hitch', kind: 'hitch', x: 780, y: 560 },
  { alias: 'body', kind: 'robot-body', x: 1160, y: 20, params: { position: { x: robot.x, y: robot.height / 2, z: robot.z }, heading: 0, length: robot.length, width: robot.width, height: robot.height, mass: robot.mass, showPayload: 'yes' } },
  { alias: 'left', kind: 'motor', x: 1540, y: 20, params: { side: -(robot.width / 2 - 0.05) } },
  { alias: 'right', kind: 'motor', x: 1540, y: 360, params: { side: robot.width / 2 - 0.05 } },
  { alias: 'carried', kind: 'show-number', x: 1920, y: 20, params: { label: HITCH_PAYLOAD_LABEL, corner: 'top-left' } },
  { alias: 'start', kind: 'on-start', x: 1920, y: 360 },
  // The angle stays free ("Tự do"); the camera only comes close, at once.
  { alias: 'cam', kind: 'camera', x: 2300, y: 20, params: { mode: 'fixed', point: { ...HITCH_CAMERA.point }, zoom: HITCH_CAMERA.zoom, smoothness: 0, view: 'free' } },
  { alias: 'floor', kind: 'block', x: 20, y: 1100, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 13, y: 1, z: 8 }, color: '#94a3b8' } },
  mark('mark1', 400, 1),
  mark('mark2', 780, 2),
  mark('mark3', 1160, 3),
  { alias: 'cage', kind: 'container', x: 1540, y: 1100, params: { position: { x: marks[0].x, y: 0, z: marks[0].z } } },
  cartonAt('carton1', 1920, -0.2),
  cartonAt('carton2', 2300, 0.2),
];

/** The names the wires below use for the cards, in the order the cards stand in the graph of the board. */
export const HITCH_YARD_CARDS: readonly string[] = NODES.map((n) => n.alias);

/** Every wire of the board; cutting any one of them changes what the learner sees (see the tests). */
export const HITCH_YARD_WIRES: WireSpec[] = [
  ['body', 'self', 'left', 'body'],
  ['body', 'self', 'right', 'body'],
  ['body', 'self', 'drive', 'robot'],
  ['drive', 'left', 'left', 'power'],
  ['drive', 'right', 'right', 'power'],
  // Which marker to drive to in this step.
  ['steps', 'index', 'route', 'index'],
  ['route', 'value', 'find', 'number'],
  ['find', 'marker', 'drive', 'target'],
  // Drive until the last step is done.
  ['steps', 'finished', 'still-going', 'in'],
  ['still-going', 'out', 'drive', 'go'],
  // The hitch holds during the steps "take" and "carry".
  ['body', 'self', 'hitch', 'carrier'],
  ['steps', 'step2', 'hold', 'a'],
  ['steps', 'step3', 'hold', 'b'],
  ['hold', 'out', 'hitch', 'on'],
  // A driving step ends when the robot gets there; the step "take" ends once the hitch holds the cage.
  ['drive', 'arrivedPulse', 'steps', 'next'],
  ['hitch', 'holding', 'steps', 'done2'],
  ['body', 'payload', 'carried', 'value'],
  ['start', 'started', 'cam', 'on'],
];

export function tryHitch(): Board {
  const board = build(
    'Chốt gài',
    'Góc nhìn 3D. Bấm Chạy và xem bốn bước của "Chuỗi bước". Bước 1: robot chạy tới Mốc 1, chui xuống gầm lồng. Bước 2: "Gài" bật, chốt giữ lấy lồng; "Đang gài" nối vào "Xong bước 2" nên chuỗi sang bước kế. Bước 3: robot chở lồng tới Mốc 2; lồng đi cùng xe nhưng không xoay theo xe, hai thùng bên trong đi theo lồng. Bước 4: "Gài" tắt, lồng nằm lại ở Mốc 2, robot chạy một mình về Mốc 3 rồi dừng. Ô số góc trên cho biết xe đang chở bao nhiêu kg: 22 lúc đang gài (lồng 20 kg và hai thùng 1 kg), 0 lúc đã nhả. Bảng này mở sẵn công tắc "Vật lý thật" để xe bị đè nặng như thật; tắt đi rồi chạy lại thì xe vẫn gài, chở và nhả như vậy, nhưng ô số luôn là 0. Thử gỡ dây "Gài": robot vẫn chạy tới gầm lồng nhưng lồng không bao giờ rời chỗ. Thẻ "Máy quay" đưa góc nhìn lại gần; gỡ dây "Bật" của nó thì thấy cả mặt sàn.',
    NODES,
    HITCH_YARD_WIRES,
    '3d',
  );
  // What is held weighs on the robot only with real physics: the number on screen is the lesson of the board.
  return { ...board, graph: { ...board.graph, settings: { ...board.graph.settings, realPhysics: true } } };
}
