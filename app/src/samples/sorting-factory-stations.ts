import { instanceParams } from '../circuits/instance';
import { activeInputs, activeOutputs, getNodeDef } from '../engine/registry';
import { CIRCUIT_KIND, type Board, type Circuit, type CircuitExposed, type CircuitPin, type Graph, type GraphNode, type Note, type NoteColor, type ParamValue, type Params, type PortType, type Vec3, type Wire } from '../engine/types';
import { registerAllNodes } from '../nodes';

/**
 * "Xưởng phân loại kiện hàng", the stations that stand still: the feeding station "Trạm nạp" (belt, scan gate, scale, arm,
 * hand-over table), the drop chute "Cửa thả" (used six times), the sorting rule "Luật chia cửa" and a small adder "Cộng sáu
 * số". Every one is a circuit board made of palette pieces and wires; the main board only holds copies of them, the floor
 * and the read-outs. The vehicles that carry a parcel from the hand-over table to a chute are not here.
 */

/** Numbers the notes and the tests quote. All positions are in the station's own frame: the arm stands at the origin. */
export const FACTORY = {
  /** Cartons: size (m), and the six classes the spawner draws from: tape colour and mass (kg). Class 6 is a heavy carton with the tape of class 1. */
  parcel: { x: 0.32, y: 0.26, z: 0.28 },
  classColors: ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'] as const,
  classMasses: [1, 2, 3, 2, 4, 8] as const,
  classCount: 6,
  seed: 7,
  /** Seconds the belt stays empty before the next carton is made. */
  feedGapS: 1,
  /** A carton vanishes this long after it was made (the only thing that removes one for good). */
  parcelLifeS: 150,
  belt: { topY: 0.5, fromX: 0.74, length: 2.6, width: 0.6, speed: 0.5 },
  gateX: 2.0,
  /** Where a carton stops (x of its centre): the arm lowers onto this spot. */
  pickX: 0.96,
  /** The arm: pedestal height (= shoulder height), link lengths, and the taught [shoulder, elbow] angles (deg). */
  arm: { baseH: 0.7, upper: 1.2, fore: 0.4, up: [55, -145] as const, pick: [36.87, -126.87] as const, place: [28.36, -118.36] as const, swing: 180 },
  gripForceN: 100,
  gripWaitS: 0.5,
  openWaitS: 0.5,
  /** The hand-over table: its centre (x, z) and the height of its top. */
  handOver: { x: -1.056, z: 0, topY: 0.34 },
  /** The chute: footprint and height (m), where its sorted cartons are put (in the chute's own frame), and how often one is moved out. */
  chute: {
    side: 0.94,
    height: 0.75,
    clearEveryS: 0.3,
    /** The way out behind the chute: a belt (top height, where it starts, length, width, speed) with a stop (height, thickness) at its end. */
    out: { topY: 0.5, fromZ: -0.8, length: 4.8, width: 0.6, speed: 1, stopH: 0.9, stopT: 0.08 },
    /** Where a carton taken out of the chute is put: on the start of that belt. */
    binAt: { x: 0, y: 0.68, z: -1.1 } as Vec3,
  },
  /** The rule: a carton heavier than this (kg) goes to the heavy chute whatever its colour. */
  heavyAboveKg: 5,
  heavyChute: 6,
  chuteCount: 6,
  /** The stand-in for the vehicles: a carton leaves the hand-over table this long (s) after it was set down, and appears this high above its chute. */
  carryAfterS: 2,
  dropFromY: 1.3,
} as const;

export const FACTORY_IDS = { station: 'tram-nap', chute: 'cua-tha', rule: 'luat-chia-cua', adder: 'cong-sau-so', carry: 'chuyen-tam' } as const;

// ---------- small builders ----------

type CardSpec = [id: string, kind: string, col: number, params?: Record<string, ParamValue>];
type WireSpec = [from: string, to: string];

const COL_W = 330;
const GAP_Y = 24;
const MARGIN = 30;

/** A card as the palette would make it (every setting at its default), with the given settings on top. */
function card(id: string, kind: string, given: Record<string, ParamValue> = {}): GraphNode {
  const def = getNodeDef(kind);
  if (!def) throw new Error(`sorting factory: unknown piece ${kind}`);
  const params: Params = {};
  for (const p of def.params) params[p.id] = typeof p.default === 'object' ? { ...p.default } : p.default;
  for (const [key, value] of Object.entries(given)) params[key] = typeof value === 'object' ? { ...value } : value;
  return { id, kind, params, pos: { x: 0, y: 0 } };
}

/** Height of a card on the canvas: a header band and one row per port it shows. */
function cardHeight(node: GraphNode, rowsOfCopy: number): number {
  const def = getNodeDef(node.kind);
  const rows = def ? activeInputs(def, node.params).length + activeOutputs(def, node.params).length : rowsOfCopy;
  return 48 + 26 * Math.max(1, rows);
}

/** Stacks the cards of each column downwards in the order given, so no two overlap. Returns the lowest edge. */
function layOut(nodes: GraphNode[], cols: readonly number[], rowsOfCopy: (node: GraphNode) => number = () => 4): number {
  const bottoms = new Map<number, number>();
  nodes.forEach((n, i) => {
    const col = cols[i] ?? 0;
    const y = bottoms.get(col) ?? MARGIN;
    n.pos = { x: MARGIN + col * COL_W, y };
    bottoms.set(col, y + cardHeight(n, rowsOfCopy(n)) + GAP_Y);
  });
  return Math.max(MARGIN, ...bottoms.values());
}

function cards(specs: readonly CardSpec[]): GraphNode[] {
  const nodes = specs.map(([id, kind, , params]) => card(id, kind, params));
  layOut(nodes, specs.map((s) => s[2]));
  return nodes;
}

const ref = (text: string): { node: string; port: string } => {
  const [node, port] = text.split('.') as [string, string];
  return { node, port };
};

const wires = (specs: readonly WireSpec[]): Wire[] => specs.map(([from, to], i) => ({ id: `w${i + 1}`, from: ref(from), to: ref(to) }));

const pin = (id: string, label: string, dir: 'in' | 'out', type: PortType, inner: string): CircuitPin => ({ id, label, dir, type, inner: ref(inner) });

const open = (id: string, label: string, inner: string): CircuitExposed => {
  const [node, param] = inner.split('.') as [string, string];
  return { id, label, inner: { node, param } };
};

/** One "Bảng giá trị": row k = the value in step k of the cycle. */
const table = (values: readonly number[]): Record<string, ParamValue> => ({ rows: values.length, ...Object.fromEntries(values.map((v, k) => [`v${k + 1}`, v])) });

/** The floor a circuit stands on when it is tried alone (a bench card: no copy has it). */
const benchFloor = (col: number): CardSpec => ['san-thu', 'block', col, { position: { x: 0, y: -0.5, z: 0 }, size: { x: 14, y: 1, z: 10 }, color: '#cfd2d7' }];

// ---------- Trạm nạp ----------

/** Wires of "Trạm nạp" (exported so the tests can cut them one at a time). */
export const STATION_WIRES: readonly WireSpec[] = [
  // The arm, piece by piece
  ['de-tay.self', 'xoay.base'],
  ['xoay.tip', 'vai.base'],
  ['vai.tip', 'thanh-tren.base'],
  ['thanh-tren.tip', 'khuyu.base'],
  ['khuyu.tip', 'thanh-duoi.base'],
  ['thanh-duoi.tip', 'tay-kep.base'],
  ['bat-dau.started', 'xoay.power'],
  ['bat-dau.started', 'vai.power'],
  ['bat-dau.started', 'khuyu.power'],
  // Feeding: a new carton only while the belt is empty; the belt stops while a carton is at the pick point
  ['tren-bang.inside', 'bang-trong.in'],
  ['bang-trong.out', 'nhip-nap.run'],
  ['nhip-nap.done', 'tao-kien.spawn'],
  ['diem-gap.inside', 'bang-chay.in'],
  ['bang-chay.out', 'bang.run'],
  // Scan gate: the colour of the carton under the gate is remembered
  ['cong-quet.first', 'doc-mau.thing'],
  ['doc-mau.index', 'nho-mau.value'],
  ['cong-quet.entered', 'nho-mau.store'],
  // Scale: the belt weighs the one carton on it
  ['bang.self', 'can.who'],
  // When the hand starts to grip, class and mass of this carton are kept for the hand-over
  ['nho-mau.held', 'loai-kien.value'],
  ['buoc.step3', 'loai-kien.store'],
  ['can.mass', 'khoi-luong.value'],
  ['buoc.step3', 'khoi-luong.store'],
  // The cycle: step number -> taught angle of each joint
  ['buoc.index', 'goc-xoay.index'],
  ['buoc.index', 'goc-vai.index'],
  ['buoc.index', 'goc-khuyu.index'],
  ['goc-xoay.value', 'xoay.angle'],
  ['goc-vai.value', 'vai.angle'],
  ['goc-khuyu.value', 'khuyu.angle'],
  // The hand is closed in steps 3 to 6 (grip, lift, swing, lower onto the table)
  ['buoc.step3', 'kep-3-4.a'],
  ['buoc.step4', 'kep-3-4.b'],
  ['buoc.step5', 'kep-5-6.a'],
  ['buoc.step6', 'kep-5-6.b'],
  ['kep-3-4.out', 'kep.a'],
  ['kep-5-6.out', 'kep.b'],
  ['kep.out', 'tay-kep.close'],
  ['luc-kep.value', 'tay-kep.force'],
  // Step 1 ends when a carton waits at the pick point, the table is empty and the outside says "go on"
  ['cho-giao.inside', 'ban-trong.in'],
  ['diem-gap.inside', 'co-the-gap.a'],
  ['ban-trong.out', 'co-the-gap.b'],
  ['co-the-gap.out', 'duoc-gap.a'],
  ['duoc-gap.out', 'buoc.done1'],
  // The other steps end by themselves
  ['vai.reached', 'da-toi-goc.a'],
  ['khuyu.reached', 'da-toi-goc.b'],
  ['da-toi-goc.out', 'tay-om-kien.a'],
  ['tay-kep.inReach', 'tay-om-kien.b'],
  ['tay-om-kien.out', 'buoc.done2'],
  ['buoc.step3', 'cho-kep.run'],
  ['cho-kep.done', 'kep-chac.a'],
  ['tay-kep.holding', 'kep-chac.b'],
  ['kep-chac.out', 'buoc.done3'],
  ['da-toi-goc.out', 'buoc.done4'],
  ['xoay.reached', 'buoc.done5'],
  ['da-toi-goc.out', 'buoc.done6'],
  ['buoc.step7', 'cho-mo.run'],
  ['cho-mo.done', 'buoc.done7'],
  ['da-toi-goc.out', 'buoc.done8'],
  ['xoay.reached', 'buoc.done9'],
  // "Có kiện chờ": a carton lies on the table and the hand is back on the belt side
  ['buoc.index', 'tay-da-ve.a'],
  ['buoc-ha-ban.value', 'tay-da-ve.b'],
  ['cho-giao.inside', 'co-kien-cho.a'],
  ['tay-da-ve.out', 'co-kien-cho.b'],
];

function stationCircuit(): Circuit {
  const { belt, arm, handOver, parcel } = FACTORY;
  const beltMidX = belt.fromX + belt.length / 2;
  const restY = belt.topY + parcel.y / 2;
  const [u1, u2] = arm.up;
  const [p1, p2] = arm.pick;
  const [l1, l2] = arm.place;
  const classes: Record<string, ParamValue> = {};
  FACTORY.classColors.forEach((c, k) => (classes[`class${k + 1}Color`] = c));
  FACTORY.classMasses.forEach((m, k) => (classes[`class${k + 1}Mass`] = m));
  const look = { look: 'factory' };
  const specs: CardSpec[] = [
    // --- belt, feeding
    ['bat-dau', 'on-start', 0],
    ['bang', 'block', 0, { position: { x: beltMidX, y: belt.topY / 2, z: 0 }, size: { x: belt.length, y: belt.topY, z: belt.width }, style: 'belt-frame', beltSpeed: belt.speed, beltDir: '-x', beltWalls: 'no' }],
    ['tren-bang', 'zone', 0, { center: { x: beltMidX, y: belt.topY + 0.16, z: 0 }, size: { x: belt.length + 0.1, y: 0.32, z: belt.width }, filter: 'item', rule: 'center', color: '#38bdf8' }],
    ['bang-trong', 'not', 0],
    ['nhip-nap', 'timer', 0, { seconds: FACTORY.feedGapS, repeat: 'yes' }],
    [
      'tao-kien',
      'spawner',
      1,
      {
        template: 'item',
        shape: 'crate',
        look: 'parcel-carton',
        position: { x: belt.fromX + belt.length - 0.25, y: restY + 0.02, z: 0 },
        size: { ...parcel },
        maxAlive: 30,
        lifetime: FACTORY.parcelLifeS,
        randomClass: 'yes',
        classCount: FACTORY.classCount,
        classSeed: FACTORY.seed,
        ...classes,
      },
    ],
    ['diem-gap', 'zone', 1, { center: { x: FACTORY.pickX - 0.023, y: restY, z: 0 }, size: { x: 0.1, y: 0.3, z: 0.5 }, filter: 'item', rule: 'center', color: '#f59e0b' }],
    ['bang-chay', 'not', 1],
    // --- scan gate and scale
    ['cong', 'block', 2, { position: { x: FACTORY.gateX, y: (belt.topY + 0.67) / 2, z: 0 }, size: { x: 0.14, y: belt.topY + 0.67, z: belt.width + 0.19 }, type: 'pickup', style: 'scan-gate' }],
    ['cong-quet', 'zone', 2, { center: { x: FACTORY.gateX, y: restY, z: 0 }, size: { x: 0.3, y: 0.3, z: belt.width }, filter: 'item', rule: 'center', color: '#facc15' }],
    ['doc-mau', 'color-sensor', 2, { color6: '#f97316' }],
    ['nho-mau', 'sample-hold', 2],
    ['can', 'force-sensor', 2],
    ['loai-kien', 'sample-hold', 3],
    ['khoi-luong', 'sample-hold', 3],
    // --- the arm
    ['de-tay', 'block', 3, { position: { x: 0, y: arm.baseH / 2, z: 0 }, size: { x: 0.5, y: arm.baseH, z: 0.5 }, style: 'arm-base' }],
    ['xoay', 'joint', 3, { axis: 'yaw', start: 0, min: -180, max: 180, maxTorque: 200, maxSpeed: 90, mount: { x: 0, y: arm.baseH / 2, z: 0 }, ...look }],
    ['vai', 'joint', 4, { axis: 'pitch', start: u1, min: 0, max: 90, maxTorque: 300, maxSpeed: 60, ...look }],
    ['thanh-tren', 'link', 4, { length: arm.upper, mass: 1, thickness: 0.15, ...look }],
    ['khuyu', 'joint', 4, { axis: 'pitch', start: u2, min: -170, max: 0, maxTorque: 150, maxSpeed: 60, ...look }],
    ['thanh-duoi', 'link', 4, { length: arm.fore, mass: 0.6, thickness: 0.13, ...look }],
    ['tay-kep', 'gripper', 5, { defaultForce: 0, maxForce: 150, width: 0.42, grip: 'between', mass: 0.4, ...look }],
    ['luc-kep', 'const', 5, { value: FACTORY.gripForceN }],
    // --- the cycle
    ['buoc', 'sequence', 6, { stepCount: 9, loop: 'yes', showDone: 'yes' }],
    ['goc-xoay', 'value-table', 7, table([0, 0, 0, 0, arm.swing, arm.swing, arm.swing, arm.swing, 0])],
    ['goc-vai', 'value-table', 7, table([u1, p1, p1, u1, u1, l1, l1, u1, u1])],
    ['goc-khuyu', 'value-table', 7, table([u2, p2, p2, u2, u2, l2, l2, u2, u2])],
    ['kep-3-4', 'or', 7],
    ['kep-5-6', 'or', 7],
    ['kep', 'or', 7],
    ['da-toi-goc', 'and', 8],
    ['tay-om-kien', 'and', 8],
    ['cho-kep', 'timer', 8, { seconds: FACTORY.gripWaitS, repeat: 'yes' }],
    ['kep-chac', 'and', 8],
    ['cho-mo', 'timer', 8, { seconds: FACTORY.openWaitS, repeat: 'yes' }],
    // --- hand-over
    ['ban-giao', 'block', 9, { position: { x: handOver.x, y: handOver.topY / 2, z: handOver.z }, size: { x: 0.6, y: handOver.topY, z: 0.6 }, color: '#475569' }],
    ['cho-giao', 'zone', 9, { center: { x: handOver.x, y: handOver.topY + 0.15, z: handOver.z }, size: { x: 0.5, y: 0.3, z: 0.5 }, filter: 'item', rule: 'center', color: '#22c55e' }],
    ['ban-trong', 'not', 9],
    ['co-the-gap', 'and', 9],
    ['duoc-gap', 'and', 9],
    ['buoc-ha-ban', 'const', 10, { value: 6 }],
    ['tay-da-ve', 'compare', 10, { op: 'lt' }],
    ['co-kien-cho', 'and', 10],
    benchFloor(10),
  ];
  return {
    id: FACTORY_IDS.station,
    name: 'Trạm nạp',
    color: '#5aa9ff',
    graph: { nodes: cards(specs), wires: wires(STATION_WIRES) },
    pins: [
      pin('cho-nap', 'Cho nạp tiếp', 'in', 'bool', 'duoc-gap.b'),
      pin('co-kien', 'Có kiện chờ', 'out', 'bool', 'co-kien-cho.out'),
      pin('loai', 'Loại kiện', 'out', 'number', 'loai-kien.held'),
      pin('kg', 'Khối lượng', 'out', 'number', 'khoi-luong.held'),
    ],
    exposed: [open('so-loai', 'Số loại kiện (2-6)', 'tao-kien.classCount'), open('nghi', 'Nghỉ giữa hai kiện (giây)', 'nhip-nap.seconds'), open('hat-giong', 'Hạt giống (0 = mỗi lần chạy khác nhau)', 'tao-kien.classSeed')],
    benchIds: ['san-thu'],
  };
}

// ---------- Cửa thả ----------

/** Wires of "Cửa thả" between its own cards (the bench spawner's wires are apart). */
export const CHUTE_WIRES: readonly WireSpec[] = [
  // What lies in the chute is read, then put on the belt that leads to the pen, one carton per beat
  ['bat-dau.started', 'bang-ra.run'],
  ['vung.first', 'doc-mau.thing'],
  ['vung.inside', 'nhip-gom.run'],
  ['vung.first', 'dua-di.who'],
  ['nhip-gom.done', 'dua-di.go'],
  ['dua-di.done', 'dem.up'],
  // A carton whose colour is not the one this chute takes counts as wrong (a chute that takes every colour has "Màu được nhận" 0)
  ['doc-mau.index', 'khac-mau.a'],
  ['mau-nhan.value', 'khac-mau.b'],
  ['mau-nhan.value', 'ken-mau.a'],
  ['khac-mau.out', 'sai-mau.a'],
  ['ken-mau.out', 'sai-mau.b'],
  ['sai-mau.out', 'sai-luc-gom.a'],
  ['dua-di.done', 'sai-luc-gom.b'],
  ['sai-luc-gom.out', 'dem-sai.up'],
];

const CHUTE_BENCH_WIRES: readonly WireSpec[] = [
  ['bat-dau.started', 'nhip-thu.run'],
  ['nhip-thu.done', 'tha-thu.spawn'],
];

function chuteCircuit(): Circuit {
  const { chute, parcel } = FACTORY;
  const { out } = chute;
  const endZ = out.fromZ - out.length;
  const specs: CardSpec[] = [
    ['cua', 'block', 0, { position: { x: 0, y: chute.height / 2, z: 0 }, size: { x: chute.side, y: chute.height, z: chute.side }, type: 'pickup', style: 'chute', signText: '1' }],
    ['bat-dau', 'on-start', 0],
    // The way out: a belt that carries each sorted carton away from the chute; the cartons line up against the stop at its
    // end. Cartons put down on one fixed spot would stack into a column that falls back into the chute and is counted again.
    ['bang-ra', 'block', 0, { position: { x: 0, y: out.topY / 2, z: out.fromZ - out.length / 2 }, size: { x: out.width, y: out.topY, z: out.length }, style: 'belt-frame', beltSpeed: out.speed, beltDir: '-z' }],
    ['chan-cuoi', 'block', 0, { position: { x: 0, y: out.stopH / 2, z: endZ - out.stopT / 2 }, size: { x: out.width + 0.2, y: out.stopH, z: out.stopT }, color: '#94a3b8' }],
    ['vung', 'zone', 1, { center: { x: 0, y: 0.3, z: 0 }, size: { x: chute.side, y: 0.6, z: chute.side }, filter: 'item', rule: 'center', color: '#38bdf8' }],
    ['doc-mau', 'color-sensor', 1, { color6: '#f97316' }],
    ['nhip-gom', 'timer', 1, { seconds: chute.clearEveryS, repeat: 'yes' }],
    ['dua-di', 'teleport', 2, { position: { ...chute.binAt } }],
    ['dem', 'counter', 2],
    ['mau-nhan', 'const', 3, { value: 1 }],
    ['khac-mau', 'compare', 3, { op: 'ne' }],
    ['ken-mau', 'compare', 3, { op: 'ne' }],
    ['sai-mau', 'and', 3],
    ['sai-luc-gom', 'and', 3],
    ['dem-sai', 'counter', 4],
    // --- bench only: a floor and a spawner that drops a carton of a random class into the chute every two seconds
    benchFloor(5),
    ['nhip-thu', 'timer', 5, { seconds: 2, repeat: 'yes' }],
    [
      'tha-thu',
      'spawner',
      5,
      { template: 'item', shape: 'crate', look: 'parcel-carton', position: { x: 0, y: 1.4, z: 0 }, size: { ...parcel }, maxAlive: 12, lifetime: 20, randomClass: 'yes', classCount: 3, classSeed: 3 },
    ],
  ];
  return {
    id: FACTORY_IDS.chute,
    name: 'Cửa thả',
    color: '#f7d046',
    graph: { nodes: cards(specs), wires: wires([...CHUTE_WIRES, ...CHUTE_BENCH_WIRES]) },
    pins: [pin('so-kien', 'Số kiện', 'out', 'number', 'dem.value'), pin('sai', 'Kiện sai loại', 'out', 'number', 'dem-sai.value')],
    exposed: [open('so-cua', 'Số cửa (ghi trên biển)', 'cua.signText'), open('mau-nhan', 'Màu được nhận (1-6, 0 = màu nào cũng nhận)', 'mau-nhan.value'), open('cho-gom', 'Chỗ gom kiện đã thả', 'dua-di.position')],
    benchIds: ['san-thu', 'nhip-thu', 'tha-thu'],
  };
}

// ---------- Luật chia cửa ----------

export const RULE_WIRES: readonly WireSpec[] = [
  ['nguong-nang.value', 'la-nang.b'],
  ['la-nang.out', 'he-so-mau.on'],
  ['la-nang.out', 'cua-nang.on'],
  ['he-so-mau.value', 'cua-theo-mau.b'],
  ['cua-theo-mau.out', 'cua-toi.a'],
  ['cua-nang.value', 'cua-toi.b'],
];

/** Chute of a carton = its colour number; a carton heavier than the threshold goes to the heavy chute instead. */
function ruleCircuit(): Circuit {
  const specs: CardSpec[] = [
    ['nguong-nang', 'const', 0, { value: FACTORY.heavyAboveKg }],
    ['la-nang', 'compare', 0, { op: 'gt' }],
    ['he-so-mau', 'bool-to-number', 1, { whenOn: 0, whenOff: 1 }],
    ['cua-nang', 'bool-to-number', 1, { whenOn: FACTORY.heavyChute, whenOff: 0 }],
    ['cua-theo-mau', 'math', 2, { op: 'mul' }],
    ['cua-toi', 'math', 3, { op: 'add' }],
  ];
  return {
    id: FACTORY_IDS.rule,
    name: 'Luật chia cửa',
    color: '#5ecf9a',
    graph: { nodes: cards(specs), wires: wires(RULE_WIRES) },
    pins: [
      pin('loai', 'Loại kiện', 'in', 'number', 'cua-theo-mau.a'),
      pin('kg', 'Khối lượng', 'in', 'number', 'la-nang.a'),
      pin('cua', 'Cửa phải tới', 'out', 'number', 'cua-toi.out'),
    ],
    exposed: [open('nguong', 'Nặng hơn bao nhiêu kg thì là kiện nặng', 'nguong-nang.value'), open('cua-nang', 'Cửa cho kiện nặng', 'cua-nang.whenOn')],
    benchIds: [],
  };
}

// ---------- Cộng sáu số ----------

function adderCircuit(): Circuit {
  const specs: CardSpec[] = [1, 2, 3, 4, 5].map((k): CardSpec => [`cong-${k}`, 'math', k - 1, { op: 'add' }]);
  return {
    id: FACTORY_IDS.adder,
    name: 'Cộng sáu số',
    graph: { nodes: cards(specs), wires: wires([2, 3, 4, 5].map((k): WireSpec => [`cong-${k - 1}.out`, `cong-${k}.a`])) },
    pins: [
      pin('so-1', 'Số 1', 'in', 'number', 'cong-1.a'),
      ...[2, 3, 4, 5, 6].map((k) => pin(`so-${k}`, `Số ${k}`, 'in', 'number', `cong-${k - 1}.b`)),
      pin('tong', 'Tổng', 'out', 'number', 'cong-5.out'),
    ],
    exposed: [],
    benchIds: [],
  };
}

// ---------- Chuyển tạm (stands where the vehicles will work) ----------

/** Where chute k (1..6) stands on the main board: a row behind the station. */
export const chutePlace = (k: number): Vec3 => ({ x: -3.75 + (k - 1) * 1.5, y: 0, z: -3.2 });

/** The colour chute k takes: its own number, and 0 (every colour) for the heavy chute. */
export const chuteAccepts = (k: number): number => (k === FACTORY.heavyChute ? 0 : k);

const CHUTES = Array.from({ length: FACTORY.chuteCount }, (_, n) => n + 1);

export const CARRY_WIRES: readonly WireSpec[] = [
  ...CHUTES.flatMap((k): WireSpec[] => [
    [`chon-cua.is${k}`, `toi-cua-${k}.a`],
    ['cho-chuyen.done', `toi-cua-${k}.b`],
    ['tren-ban.first', `chuyen-${k}.who`],
    [`toi-cua-${k}.out`, `chuyen-${k}.go`],
  ]),
];

/**
 * Until the vehicles exist: a carton that has waited on the hand-over table for a moment is put above the chute the rule
 * names by "Dịch chuyển", one card per chute. Made of palette pieces like everything else; the main board says what it is.
 */
function carryCircuit(): Circuit {
  const { handOver } = FACTORY;
  const specs: CardSpec[] = [
    ['tren-ban', 'zone', 0, { center: { x: handOver.x, y: handOver.topY + 0.15, z: handOver.z }, size: { x: 0.5, y: 0.3, z: 0.5 }, filter: 'item', rule: 'center', color: '#a855f7' }],
    ['cho-chuyen', 'timer', 0, { seconds: FACTORY.carryAfterS, repeat: 'yes' }],
    ['chon-cua', 'select-number', 1, { choices: FACTORY.chuteCount }],
    ...CHUTES.map((k): CardSpec => [`toi-cua-${k}`, 'and', 2 + ((k - 1) % 2)]),
    ...CHUTES.map((k): CardSpec => [`chuyen-${k}`, 'teleport', 4 + ((k - 1) % 2), { position: { x: chutePlace(k).x, y: FACTORY.dropFromY, z: chutePlace(k).z } }]),
  ];
  return {
    id: FACTORY_IDS.carry,
    name: 'Chuyển tạm (thay xe)',
    color: '#c084fc',
    graph: { nodes: cards(specs), wires: wires(CARRY_WIRES) },
    pins: [
      pin('co-kien', 'Có kiện chờ', 'in', 'bool', 'cho-chuyen.run'),
      pin('cua', 'Cửa phải tới', 'in', 'number', 'chon-cua.value'),
      pin('da-chuyen', 'Vừa chuyển', 'out', 'bool', 'cho-chuyen.done'),
    ],
    exposed: [open('cho', 'Chờ bao lâu rồi chuyển (giây)', 'cho-chuyen.seconds')],
    benchIds: [],
  };
}

// ---------- the main board ----------

/** The circuits, fresh objects on every call. */
export function createFactoryCircuits(): Circuit[] {
  registerAllNodes();
  return [stationCircuit(), chuteCircuit(), ruleCircuit(), adderCircuit(), carryCircuit()];
}

const note = (id: string, color: NoteColor, x: number, y: number, h: number, text: string): Note => ({ id, color, pos: { x, y }, size: { w: 340, h }, text });

/** The main board "Xưởng (phần trạm)": one "Trạm nạp", six "Cửa thả", the rule, the totals. Fresh objects on every call. */
export function createFactoryStationsBoard(): Board {
  const circuits = createFactoryCircuits();
  const rows = new Map(circuits.map((c) => [c.id, c.pins.length]));
  const copy = (id: string, circuit: string, name: string, at: Vec3, values: Record<string, ParamValue> = {}): GraphNode => ({
    id,
    kind: CIRCUIT_KIND,
    params: instanceParams(circuit, { values, place: { position: at, heading: 0 }, name }),
    pos: { x: 0, y: 0 },
  });
  const chutes = CHUTES;
  const laid: [GraphNode, number][] = [
    [card('san', 'block', { position: { x: 0, y: -0.5, z: -1 }, size: { x: 16, y: 1, z: 12 }, color: '#cfd2d7' }), 0],
    [card('bat-dau', 'on-start'), 0],
    [card('may-quay', 'camera', { mode: 'fixed', point: { x: 0, y: 0.6, z: -1 }, zoom: 1.5, view: 'tilted' }), 0],
    [copy('tram-nap', FACTORY_IDS.station, 'Trạm nạp', { x: 0, y: 0, z: 0 }), 1],
    [copy('luat', FACTORY_IDS.rule, 'Luật chia cửa', { x: 0, y: 0, z: 0 }), 2],
    [copy('chuyen-tam', FACTORY_IDS.carry, 'Chuyển tạm (thay xe)', { x: 0, y: 0, z: 0 }), 2],
    [card('hien-cua', 'show-number', { label: 'Kiện đang chờ phải tới cửa số', corner: 'top-left' }), 3],
    ...chutes.map((k): [GraphNode, number] => [copy(`cua-${k}`, FACTORY_IDS.chute, `Cửa ${k}`, chutePlace(k), { 'so-cua': String(k), 'mau-nhan': chuteAccepts(k) }), 1]),
    [copy('tong-kien', FACTORY_IDS.adder, 'Tổng kiện', { x: 0, y: 0, z: 0 }), 2],
    [copy('tong-sai', FACTORY_IDS.adder, 'Tổng kiện sai', { x: 0, y: 0, z: 0 }), 2],
    [card('hien-kien', 'show-number', { label: 'Kiện đã vào cửa', corner: 'top-left' }), 3],
    [card('hien-sai', 'show-number', { label: 'Kiện vào sai cửa', corner: 'top-left' }), 3],
  ];
  const nodes = laid.map(([n]) => n);
  const lowest = layOut(nodes, laid.map(([, col]) => col), (n) => rows.get(String(n.params.circuit)) ?? 4);
  const graph: Graph = {
    nodes,
    wires: wires([
      ['bat-dau.started', 'tram-nap.cho-nap'],
      ['bat-dau.started', 'may-quay.on'],
      ['tram-nap.loai', 'luat.loai'],
      ['tram-nap.kg', 'luat.kg'],
      ['luat.cua', 'hien-cua.value'],
      ['tram-nap.co-kien', 'chuyen-tam.co-kien'],
      ['luat.cua', 'chuyen-tam.cua'],
      ...chutes.flatMap((k): WireSpec[] => [
        [`cua-${k}.so-kien`, `tong-kien.so-${k}`],
        [`cua-${k}.sai`, `tong-sai.so-${k}`],
      ]),
      ['tong-kien.tong', 'hien-kien.value'],
      ['tong-sai.tong', 'hien-sai.value'],
    ]),
    settings: { wireRule: true, realPhysics: true },
    stacks: [FACTORY_IDS.chute, FACTORY_IDS.adder],
  };
  return {
    name: 'Xưởng (phần trạm)',
    mode: '3d',
    graph,
    notes: [
      note(
        'note1',
        'yellow',
        MARGIN,
        lowest + 30,
        330,
        'Đây là phần đứng yên của xưởng phân loại: một "Trạm nạp" và sáu "Cửa thả". Mỗi máy là một bảng mạch: bấm đúp vào khối để xem bên trong. Trạm nạp tự tạo thùng hàng (mỗi loại một màu băng dán và một khối lượng), cho thùng chạy qua cổng quét để đọc màu, cân thùng trên băng chuyền, rồi tay máy gắp thùng đặt lên bàn giao. Bàn giao còn thùng thì tay máy đứng chờ. Xe chở thùng từ bàn giao tới các cửa chưa có ở bảng này, nên thùng đầu tiên nằm trên bàn giao cho tới khi hết "Sống bao lâu" (150 giây) rồi tay máy mới gắp thùng kế.',
      ),
      note(
        'note2',
        'green',
        MARGIN + 360,
        lowest + 30,
        330,
        'Luật chia cửa (khối "Luật chia cửa", làm từ So sánh, Đổi thành số, Phép tính): thùng mang màu số mấy thì tới cửa số đó (đỏ 1, vàng 2, xanh lá 3, xanh dương 4, tím 5). Riêng thùng nặng hơn 5 kg thì tới cửa 6, màu gì cũng vậy: thùng đỏ 8 kg tới cửa 6 chứ không tới cửa 1. Mỗi "Cửa thả" tự đếm số thùng rơi vào và số thùng mang màu không phải màu cửa đó nhận (cửa 6 nhận mọi màu). Thùng rơi vào cửa được "Dịch chuyển" ra tấm gom phía sau. Hai khối "Cộng sáu số" cộng số đếm của sáu cửa để hiện lên màn hình.',
      ),
    ],
    circuits,
  };
}
