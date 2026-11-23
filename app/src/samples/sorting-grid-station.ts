import type { Circuit } from '../engine/types';
import { cards, open, pin, wires, type CardSpec, type Link } from './sorting-grid-kit';
import { CARTON, GRID, GRID_IDS, ROBOT, STATION, TRAY_TOP } from './sorting-grid-plan';

/**
 * "Trạm nạp" of the grid floor: a table beside a lane cell. The station makes a carton with a random route code on the
 * table, shows the code, and when a robot stands still on the cell with an empty tray, a pusher slides the carton onto
 * the tray. It knows about the robot only what its own zones see; no wire leads from a robot to a station.
 */

/** Wires of "Trạm nạp" (exported so the tests can cut them one at a time). */
export const GRID_STATION_WIRES: readonly Link[] = [
  // A new carton only while the table is empty and the pusher is back; the code is drawn on the same beat
  ['tren-ban.inside', 'ban-trong.in'],
  ['ban-trong.out', 'duoc-nap.a'],
  ['xi-lanh.retracted', 'duoc-nap.b'],
  ['duoc-nap.out', 'nhip-nap.run'],
  ['nhip-nap.done', 'xuc-xac.roll'],
  ['xuc-xac.value', 'tao-kien.code'],
  ['nhip-nap.done', 'tao-kien.spawn'],
  // The code of the carton on the table
  ['tren-ban.first', 'doc-ma.thing'],
  // A robot stands still on the hand-over cell and its tray is empty
  ['xe-do.first', 'xe-dung-yen.who'],
  ['xe-do.inside', 'xe-san-sang.a'],
  ['xe-dung-yen.still', 'xe-san-sang.b'],
  ['khay-xe.inside', 'khay-xe-trong.in'],
  ['tren-ban.inside', 'co-the-day.a'],
  ['khay-xe-trong.out', 'co-the-day.b'],
  ['xe-san-sang.out', 'lenh-day.a'],
  ['co-the-day.out', 'lenh-day.b'],
  // The pusher goes all the way out, then back
  ['lenh-day.out', 'dang-day.set'],
  ['xi-lanh.extended', 'dang-day.reset'],
  ['dang-day.on', 'xi-lanh.extend'],
  ['xi-lanh.extended', 'dem-nap.up'],
];

export function gridStationCircuit(): Circuit {
  const { table, push, base, cartonX } = STATION;
  const cartonY = table.topY + CARTON.size.y / 2;
  const stroke = push.endX - push.restX;
  // The barrel is as long as the stroke plus 0.2 m and the head sits at its end.
  const pushOriginX = push.restX - push.head - 0.2 - stroke;
  const classes = Object.fromEntries([...CARTON.classColors.map((c, k) => [`class${k + 1}Color`, c]), ...CARTON.classMasses.map((m, k) => [`class${k + 1}Mass`, m])]);
  const specs: CardSpec[] = [
    // --- what stands there
    ['be-tram', 'block', 0, { position: { x: (base.x0 + base.x1) / 2, y: -GRID.top / 2, z: 0 }, size: { x: base.x1 - base.x0, y: GRID.top, z: base.width }, color: '#7c8797' }],
    ['ban-nap', 'block', 0, { position: { x: (table.x0 + table.x1) / 2, y: table.topY / 2, z: 0 }, size: { x: table.x1 - table.x0, y: table.topY, z: table.width }, color: '#475569' }],
    ['cot-man-hinh', 'block', 0, { position: { x: cartonX, y: 0.45, z: -table.width / 2 - 0.1 }, size: { x: 0.06, y: 0.9, z: 0.06 }, color: '#334155' }],
    // --- making cartons
    ['tren-ban', 'zone', 1, { center: { x: cartonX, y: cartonY, z: 0 }, size: { x: 0.5, y: 0.3, z: table.width }, filter: 'item', rule: 'center', color: '#38bdf8' }],
    ['ban-trong', 'not', 1],
    ['duoc-nap', 'and', 1],
    ['nhip-nap', 'timer', 1, { seconds: STATION.feedGapS, repeat: 'yes' }],
    ['xuc-xac', 'random', 2, { min: 1, max: GRID.routes, whole: 'yes', mode: 'press', seed: GRID.seed }],
    [
      'tao-kien',
      'spawner',
      2,
      {
        template: 'item',
        shape: 'crate',
        look: 'parcel-carton',
        position: { x: cartonX, y: cartonY + 0.02, z: 0 },
        size: { ...CARTON.size },
        maxAlive: CARTON.maxAlive,
        lifetime: 0,
        randomClass: 'yes',
        classCount: CARTON.classColors.length,
        classSeed: 7,
        wireCode: 'yes',
        recallPorts: 'yes',
        ...classes,
      },
    ],
    ['doc-ma', 'code-reader', 2, { display: 'yes', displayAt: { x: cartonX, y: 1.01, z: -table.width / 2 - 0.1 } }],
    // --- is a robot there, is its tray empty
    ['xe-do', 'zone', 3, { center: { x: 0, y: ROBOT.height / 2, z: 0 }, size: { x: 0.2, y: 0.3, z: 0.2 }, filter: 'robot', rule: 'center', color: '#22c55e' }],
    ['xe-dung-yen', 'speed-sensor', 3],
    ['xe-san-sang', 'and', 3],
    ['khay-xe', 'zone', 3, { center: { x: 0, y: TRAY_TOP + CARTON.size.y / 2, z: 0 }, size: { x: 0.9, y: 0.3, z: 0.9 }, filter: 'item', rule: 'center', color: '#f59e0b' }],
    ['khay-xe-trong', 'not', 3],
    // --- pushing
    ['co-the-day', 'and', 4],
    ['lenh-day', 'and', 4],
    ['dang-day', 'latch', 4],
    ['xi-lanh', 'linear-actuator', 4, { position: { x: pushOriginX, y: cartonY, z: 0 }, direction: 0, orient: 'ground', stroke, maxForce: 100, speed: push.speed, headSize: push.head }],
    ['dem-nap', 'counter', 4],
  ];
  return {
    id: GRID_IDS.station,
    name: 'Trạm nạp',
    color: '#5aa9ff',
    graph: { nodes: cards(specs), wires: wires(GRID_STATION_WIRES) },
    pins: [
      pin('vat-thu-hoi', 'Vật cần thu hồi', 'in', 'object', 'tao-kien.recallThing'),
      pin('thu-hoi', 'Thu hồi', 'in', 'bool', 'tao-kien.recall'),
      pin('ma-cho', 'Mã kiện đang chờ', 'out', 'number', 'doc-ma.code'),
      pin('da-nap', 'Số kiện đã nạp lên xe', 'out', 'number', 'dem-nap.value'),
      pin('dang-co', 'Số kiện đang có', 'out', 'number', 'tao-kien.count'),
    ],
    exposed: [open('hat-giong', 'Hạt giống mã tuyến (0 = mỗi lần chạy khác nhau)', 'xuc-xac.seed'), open('nghi', 'Nghỉ trước khi tạo kiện mới (giây)', 'nhip-nap.seconds')],
    benchIds: [],
  };
}
