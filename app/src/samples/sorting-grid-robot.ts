import type { Circuit } from '../engine/types';
import { cards, open, pin, table, wires, type CardSpec, type Link } from './sorting-grid-kit';
import { GRID_IDS, ROBOT, ROUTES, TRAY_TOP, cellNumber, mm } from './sorting-grid-plan';

/**
 * "Xe phân loại": a two-motor robot for a floor of one-way lanes, with a tray that tips to either side. Everything it
 * decides it decides from what it senses itself: the cell under it, the carton on its tray and that carton's code. An
 * empty robot drives to a station cell; with a carton on the tray it drives to the stop cell of the carton's route, tips,
 * and drives back. What it shares with the other robots goes through its pins to the one "Bảng giữ ô" on the main board.
 */

const MOTOR_SIDE = mm(ROBOT.width / 2 - 0.05);
/** Middle of the tray plate above the middle of the chassis. */
const TRAY_UP = mm(ROBOT.height / 2 + ROBOT.tray.gap + ROBOT.tray.thickness / 2);

/** Inner wires of "Xe phân loại" (exported so the tests can cut them one at a time). */
export const ROBOT_WIRES: readonly Link[] = [
  // Chassis, motors, driver
  ['than.self', 'trai.body'],
  ['than.self', 'phai.body'],
  ['than.self', 'lai.robot'],
  ['lai.left', 'trai.power'],
  ['lai.right', 'phai.power'],
  // Where am I, where to next: the cell under the robot, the route finder, the marker of the cell the hold card allows
  ['than.self', 'doc-moc.who'],
  ['doc-moc.number', 'tim-duong.at'],
  ['tim-moc.marker', 'lai.target'],
  // The tray: a turntable on the chassis, a tilt hinge on the turntable, a plate on the hinge
  ['than.self', 'ban-xoay.base'],
  ['ban-xoay.tip', 'khop-nghieng.base'],
  ['khop-nghieng.tip', 'khay.base'],
  ['bat-dau.started', 'ban-xoay.power'],
  ['bat-dau.started', 'khop-nghieng.power'],
  // What lies on the tray, and its code
  ['than.self', 'tren-khay.follow'],
  ['tren-khay.first', 'doc-ma.thing'],
  ['tren-khay.inside', 'khay-trong.in'],
  // A carton that has lain still for a moment is "taken": its code is remembered until the next carton
  ['tren-khay.inside', 'cho-yen.run'],
  ['khay-trong.out', 'cho-yen.reset'],
  ['doc-ma.code', 'nho-ma.value'],
  ['cho-yen.done', 'nho-ma.store'],
  // Goal: with a carton, the stop cell of its route; empty, the station the last route leads back to
  ['doc-ma.code', 'o-do.index'],
  ['nho-ma.held', 'tram-ve.index'],
  ['khay-trong.out', 've-tram.on'],
  ['tram-ve.value', 'o-tram.a'],
  ['ve-tram.value', 'o-tram.b'],
  ['o-do.value', 'o-dich.a'],
  ['o-tram.out', 'o-dich.b'],
  ['o-dich.out', 'tim-duong.goal'],
  // Standing on the middle of the goal cell with a taken carton, the tray first turns to the side this route's hole is on
  ['tim-duong.hasNext', 'da-toi.in'],
  ['da-toi.out', 'dung-o-dich.b'],
  ['dung-o-dich.out', 'toi-noi.a'],
  ['cho-yen.done', 'toi-noi.b'],
  ['doc-ma.code', 'ben-do.index'],
  ['ben-do.value', 'nho-ben.value'],
  ['toi-noi.out', 'nho-ben.store'],
  ['nho-ben.held', 'ban-xoay.angle'],
  // ... then tips, until the carton has left the tray
  ['toi-noi.out', 'lenh-do.a'],
  ['ban-xoay.reached', 'lenh-do.b'],
  ['lenh-do.out', 'goc-nghieng.on'],
  ['goc-nghieng.value', 'khop-nghieng.angle'],
  ['lenh-do.out', 'dem-do.up'],
  // Drive: only while the tray is where it was told to be (flat, or tipped at the goal, where there is nowhere to drive to), and either empty or with the carton taken
  ['khop-nghieng.reached', 'chay.a'],
  ['khay-trong.out', 'duoc-di.a'],
  ['cho-yen.done', 'duoc-di.b'],
  ['duoc-di.out', 'chay.b'],
  ['chay.out', 'lai.go'],
];

export function robotCircuit(): Circuit {
  const { tray } = ROBOT;
  const hinge = { look: 'hinge', solid: 'no' };
  const specs: CardSpec[] = [
    // --- chassis and drive
    ['bat-dau', 'on-start', 0],
    ['than', 'robot-body', 0, { position: { x: 0, y: ROBOT.height / 2, z: 0 }, heading: 0, length: ROBOT.length, width: ROBOT.width, height: ROBOT.height, mass: ROBOT.mass, friction: 0.8, look: 'agv', color: '#f59e0b' }],
    ['trai', 'motor', 0, { side: -MOTOR_SIDE, accel: ROBOT.motorAccel }],
    ['phai', 'motor', 0, { side: MOTOR_SIDE, accel: ROBOT.motorAccel }],
    ['doc-moc', 'floor-marker-sensor', 1],
    ['tim-duong', 'grid-route', 1],
    ['tim-moc', 'floor-marker-find', 1],
    ['lai', 'robot-goto', 1, { ...ROBOT.drive }],
    // --- the tray
    ['ban-xoay', 'joint', 2, { axis: 'yaw', start: 90, min: -90, max: 90, maxSpeed: 180, mount: { x: 0, y: TRAY_UP, z: 0 }, ...hinge }],
    ['khop-nghieng', 'joint', 2, { axis: 'pitch', start: 0, min: 0, max: 60, maxTorque: 150, maxSpeed: 60, mount: { x: -tray.across / 2, y: 0, z: 0 }, ...hinge }],
    ['khay', 'link', 2, { length: tray.across, width: tray.along, thickness: tray.thickness, solid: 'yes', mass: 1, look: 'factory' }],
    // --- the carton on the tray
    ['tren-khay', 'zone', 3, { center: { x: 0, y: mm(TRAY_TOP - ROBOT.height / 2 + 0.18), z: 0 }, size: { x: 0.8, y: 0.4, z: 0.72 }, filter: 'item', rotate: 'yes', rule: 'center', color: '#a855f7' }],
    ['doc-ma', 'code-reader', 3],
    ['khay-trong', 'not', 3],
    ['cho-yen', 'timer', 3, { seconds: ROBOT.settleS, repeat: 'no' }],
    ['nho-ma', 'sample-hold', 3, { start: 1 }],
    // --- where to go
    ['o-do', 'value-table', 4, table(ROUTES.map((r) => cellNumber(...r.stop)), 'zero')],
    ['tram-ve', 'value-table', 4, table(ROUTES.map((r) => r.home))],
    ['ve-tram', 'bool-to-number', 5, { whenOn: 1, whenOff: 0 }],
    ['o-tram', 'math', 5, { op: 'mul' }],
    ['o-dich', 'math', 5, { op: 'add' }],
    // --- when to turn the tray, when to tip, when to drive
    ['da-toi', 'not', 6],
    ['dung-o-dich', 'and', 6],
    ['toi-noi', 'and', 6],
    ['ben-do', 'value-table', 6, table(ROUTES.map((r) => r.turn))],
    ['nho-ben', 'sample-hold', 6, { start: 90 }],
    ['lenh-do', 'and', 7],
    ['goc-nghieng', 'bool-to-number', 7, { whenOn: ROBOT.tilt, whenOff: 0 }],
    ['dem-do', 'counter', 7],
    ['duoc-di', 'or', 8],
    ['chay', 'and', 8],
  ];
  return {
    id: GRID_IDS.robot,
    name: 'Xe phân loại',
    color: '#f59e0b',
    graph: { nodes: cards(specs), wires: wires(ROBOT_WIRES) },
    pins: [
      pin('o-duoc-di', 'Ô được đi', 'in', 'number', 'tim-moc.number'),
      pin('dung-giua-o', 'Đứng giữa ô', 'in', 'bool', 'dung-o-dich.a'),
      pin('robot', 'Robot', 'out', 'object', 'than.self'),
      pin('o-muon', 'Ô muốn tới', 'out', 'number', 'tim-duong.next'),
      pin('da-do', 'Số kiện đã đổ', 'out', 'number', 'dem-do.value'),
    ],
    exposed: [open('tuyen-dau', 'Tuyến nhớ lúc đầu (1-9; chọn trạm nạp đầu tiên của xe)', 'nho-ma.start')],
    benchIds: [],
  };
}
