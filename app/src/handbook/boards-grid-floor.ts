import { instanceParams } from '../circuits/instance';
import { STUDENT_CARD_METRICS } from '../editor/graph/shipped-layout';
import { estimateNodeSize } from '../editor/graph/graph-geometry';
import { migrateBoardWireRule } from '../editor/graph/wire-rule-migration';
import { getNodeDef } from '../engine/registry';
import { CIRCUIT_KIND, type Board, type Circuit, type CircuitPin, type GraphNode, type Note, type ParamValue, type Params, type PortType, type Wire } from '../engine/types';
import { registerAllNodes } from '../nodes';

/**
 * Boards about a floor of one-way lanes: the "Thử ngay" boards of "Tìm đường trên lưới" and "Bảng giữ ô", the robot
 * circuit a learner wires for such a floor ("Xe trên lưới"), and a bigger floor with four copies of it to watch.
 */

type CardSpec = [id: string, kind: string, col: number, params?: Record<string, ParamValue>];
/** A wire as `from card.port`, `to card.port`. */
export type Link = readonly [from: string, to: string];

const MARGIN = 30;
const COL_W = 330;
const GAP_Y = 24;

function card(id: string, kind: string, given: Record<string, ParamValue> = {}): GraphNode {
  const def = getNodeDef(kind);
  if (!def) throw new Error(`grid floor boards: unknown piece ${kind}`);
  const params: Params = {};
  for (const p of def.params) params[p.id] = typeof p.default === 'object' ? { ...p.default } : p.default;
  for (const [key, value] of Object.entries(given)) params[key] = typeof value === 'object' ? { ...value } : value;
  return { id, kind, params, pos: { x: 0, y: 0 } };
}

/** Height of a card at the biggest card size; a copy of a circuit shows its in pins and out pins side by side. */
function heightOf(node: GraphNode, pinRows: number): number {
  return node.kind === CIRCUIT_KIND ? 60 + 34 * Math.max(1, pinRows) : estimateNodeSize(node, STUDENT_CARD_METRICS).h;
}

/** Stacks the cards of each column downwards in the order given, so no two overlap. Returns the lowest edge. */
function layOut(nodes: GraphNode[], cols: readonly number[], pinRows = 4, top = MARGIN, colW = COL_W): number {
  const bottoms = new Map<number, number>();
  nodes.forEach((n, i) => {
    const col = cols[i] ?? 0;
    const y = bottoms.get(col) ?? top;
    n.pos = { x: MARGIN + col * colW, y };
    bottoms.set(col, y + heightOf(n, pinRows) + GAP_Y);
  });
  return Math.max(top, ...bottoms.values());
}

function cards(specs: readonly CardSpec[], top = MARGIN): { nodes: GraphNode[]; bottom: number } {
  const nodes = specs.map(([id, kind, , params]) => card(id, kind, params));
  const bottom = layOut(nodes, specs.map((s) => s[2]), 4, top);
  return { nodes, bottom };
}

const ref = (text: string): { node: string; port: string } => {
  const [node, port] = text.split('.') as [string, string];
  return { node, port };
};
const wires = (links: readonly Link[]): Wire[] => links.map(([from, to], i) => ({ id: `w${i + 1}`, from: ref(from), to: ref(to) }));
const pin = (id: string, label: string, dir: 'in' | 'out', type: PortType, inner: string): CircuitPin => ({ id, label, dir, type, inner: ref(inner) });
const note = (text: string, x: number, y: number, w = 420, h = 230): Note => ({ id: 'note-1', text, color: 'yellow', pos: { x, y }, size: { w, h } });

// ---------------------------------------------------------------- floors

/**
 * Arrows of a cell of a floor of `rows` x `cols` cells whose holes sit on (odd row, odd column): even rows run east, west,
 * east...; even columns north, south, north... An arrow that would point off the floor is left out.
 */
export function laneArrows(row: number, col: number, rows: number, cols: number): string {
  const along = row % 2 === 0 ? ((row / 2) % 2 === 0 ? 'E' : 'W') : '';
  const across = col % 2 === 0 ? ((col / 2) % 2 === 1 ? 'S' : 'N') : '';
  const stays = (d: string): boolean => (d === 'E' ? col + 1 < cols : d === 'W' ? col > 0 : d === 'S' ? row + 1 < rows : d === 'N' ? row > 0 : false);
  return [along, across].filter(stays).join('');
}

export const RING_PITCH = 1.4;
/** The eight cells round one hole (a 3 x 3 floor), in the order the arrows lead: 1 -> 2 -> 3 -> 6 -> 9 -> 8 -> 7 -> 4 -> 1. */
export const RING_CELLS: readonly { number: number; row: number; col: number; exits: string }[] = [
  { number: 1, row: 0, col: 0, exits: 'E' },
  { number: 2, row: 0, col: 1, exits: 'E' },
  { number: 3, row: 0, col: 2, exits: 'S' },
  { number: 6, row: 1, col: 2, exits: 'S' },
  { number: 9, row: 2, col: 2, exits: 'W' },
  { number: 8, row: 2, col: 1, exits: 'W' },
  { number: 7, row: 2, col: 0, exits: 'N' },
  { number: 4, row: 1, col: 0, exits: 'N' },
];
/** Middle of a ring cell on the floor (the ring is centred on the origin). */
export const ringPlace = (number: number, y = 0.5): { x: number; y: number; z: number } => {
  const c = RING_CELLS.find((r) => r.number === number)!;
  return { x: (c.col - 1) * RING_PITCH, y, z: (c.row - 1) * RING_PITCH };
};
/** The eight marker cards, four to a column, in the order the arrows lead. */
const ringMarkers = (col: number): CardSpec[] => RING_CELLS.map((c, k): CardSpec => [`moc-${c.number}`, 'floor-marker', col + (k < 4 ? 0 : 1), { number: c.number, position: ringPlace(c.number), size: RING_PITCH, exits: c.exits }]);

// ---------------------------------------------------------------- one robot of plain cards (try boards)

const CHASSIS = { length: 0.9, width: 0.7 };
const MOTOR_SIDE = CHASSIS.width / 2 - 0.05;

/** Chassis, two motors, driver, marker reader, route finder and marker lookup of robot `id`, in three columns from `col`. */
function plainRobot(id: string, col: number, cell: number, heading: number, color: string): CardSpec[] {
  return [
    [`than-${id}`, 'robot-body', col, { position: ringPlace(cell), heading, length: CHASSIS.length, width: CHASSIS.width, color }],
    [`doc-moc-${id}`, 'floor-marker-sensor', col],
    [`tim-duong-${id}`, 'grid-route', col],
    [`tim-moc-${id}`, 'floor-marker-find', col + 1],
    [`lai-${id}`, 'robot-goto', col + 1],
    [`trai-${id}`, 'motor', col + 2, { side: -MOTOR_SIDE }],
    [`phai-${id}`, 'motor', col + 2, { side: MOTOR_SIDE }],
  ];
}
/** Wires inside robot `id` that are the same with and without a hold card. */
const plainRobotWires = (id: string): Link[] => [
  [`than-${id}.self`, `trai-${id}.body`],
  [`than-${id}.self`, `phai-${id}.body`],
  [`than-${id}.self`, `lai-${id}.robot`],
  [`than-${id}.self`, `doc-moc-${id}.who`],
  ['bat-dau.started', `lai-${id}.go`],
  [`lai-${id}.left`, `trai-${id}.power`],
  [`lai-${id}.right`, `phai-${id}.power`],
  [`doc-moc-${id}.number`, `tim-duong-${id}.at`],
  [`tim-moc-${id}.marker`, `lai-${id}.target`],
];

export const ROUTE_GOAL_LABEL = 'Ô đích';
export const ROUTE_LEFT_LABEL = 'Số ô còn lại';

/** "Tìm đường trên lưới" alone: one robot on the ring is sent to the cell behind it and has to go all the way round. */
export function tryGridRoute(): Board {
  registerAllNodes();
  const specs: CardSpec[] = [
    ['bat-dau', 'on-start', 0],
    ['o-dich', 'const', 0, { value: 4 }],
    ...ringMarkers(1),
    ...plainRobot('1', 3, 1, 0, '#3b82f6'),
    ['hien-con-lai', 'show-number', 5, { label: ROUTE_LEFT_LABEL, corner: 'top-right' }],
  ];
  const { nodes, bottom } = cards(specs);
  const links: Link[] = [...plainRobotWires('1'), ['o-dich.value', 'tim-duong-1.goal'], ['tim-duong-1.next', 'tim-moc-1.number'], ['tim-duong-1.steps', 'hien-con-lai.value']];
  return migrateBoardWireRule({
    name: 'Thử: Tìm đường trên lưới',
    mode: '2d-top',
    graph: { nodes, wires: wires(links) },
    notes: [
      note(
        'Nhìn từ trên xuống: tám ô mốc xếp vòng quanh một cái lỗ, mỗi ô có mũi tên chiều đi. Robot đứng ở ô 1, đích là ô 4 ngay sau lưng nó. Bấm Chạy: robot không quay đầu mà đi hết một vòng theo mũi tên (2, 3, 6, 9, 8, 7, 4), vì Tìm đường trên lưới chỉ đi theo mũi tên. Đang chạy, đổi "Giá trị" của Số cố định "Ô đích" thành 9 hay 2. Thử đổi mũi tên của một Mốc sàn rồi bấm Chạy lại.',
        MARGIN,
        bottom + 10,
      ),
    ],
  });
}

export const HELD_COUNT_LABEL = 'Số ô đang bị giữ';
export const WAITING_GOAL = 'dich-2';

/** "Bảng giữ ô": robot 2 stands in the way of robot 1 until the learner gives robot 2 somewhere to go. */
export function tryCellHold(): Board {
  registerAllNodes();
  const specs: CardSpec[] = [
    ['bat-dau', 'on-start', 0],
    ['dich-1', 'const', 0, { value: 9 }],
    [WAITING_GOAL, 'const', 0, { value: 0 }],
    ['hien-giu', 'show-number', 0, { label: HELD_COUNT_LABEL, corner: 'top-right' }],
    ...ringMarkers(1),
    ...plainRobot('1', 3, 1, 0, '#3b82f6'),
    ...plainRobot('2', 3, 3, 90, '#22c55e'),
    ['giu-o', 'cell-hold', 6, { robots: 2 }],
  ];
  const { nodes, bottom } = cards(specs);
  const robot = (id: '1' | '2'): Link[] => [
    ...plainRobotWires(id),
    [`dich-${id}.value`, `tim-duong-${id}.goal`],
    [`than-${id}.self`, `giu-o.robot${id}`],
    [`tim-duong-${id}.next`, `giu-o.want${id}`],
    [`giu-o.cell${id}`, `tim-moc-${id}.number`],
    [`giu-o.wait${id}`, `tim-duong-${id}.avoid`],
  ];
  return migrateBoardWireRule({
    name: 'Thử: Bảng giữ ô',
    mode: '2d-top',
    graph: { nodes, wires: wires([...robot('1'), ...robot('2'), ['giu-o.held', 'hien-giu.value']]) },
    notes: [
      note(
        'Nhìn từ trên xuống. Robot màu cam (số 1) muốn tới ô 9; robot xanh lá (số 2) đứng ở ô 3 và chưa có đích. Bấm Chạy: ô nào đang có robot giữ thì đổi sang màu đỏ. Robot 1 sang ô 2 rồi phải đứng chờ, vì ô 3 đang bị robot 2 giữ. Đang chạy, đổi "Giá trị" của Số cố định thứ hai (đích của robot 2) từ 0 thành 7: robot 2 đi, ô 3 trống ra, robot 1 đi tiếp tới ô 9. Thử gỡ dây "Ô robot 1 được đi": robot 1 không bao giờ nhúc nhích.',
        MARGIN,
        bottom + 10,
        460,
        250,
      ),
    ],
  });
}

// ---------------------------------------------------------------- the robot circuit a learner wires for a grid floor

export const GRID_BOT = 'xe-luoi';
/** Inner wires of "Xe trên lưới" (exported so the tests can cut them one at a time). */
export const GRID_BOT_WIRES: readonly Link[] = [
  ['than.self', 'trai.body'],
  ['than.self', 'phai.body'],
  ['than.self', 'lai.robot'],
  ['than.self', 'doc-moc.who'],
  ['bat-dau.started', 'lai.go'],
  ['lai.left', 'trai.power'],
  ['lai.right', 'phai.power'],
  ['doc-moc.number', 'tim-duong.at'],
  ['tim-moc.marker', 'lai.target'],
];

export interface GridBotOptions {
  /** Settings of "Đi tới điểm". */
  drive?: Record<string, ParamValue>;
  /** "Chờ quá bao lâu thì đổi lối ra" of "Tìm đường trên lưới" (s). */
  detourAfter?: number;
  /** Height of the chassis middle above the floor the copy is placed on (m). */
  bodyY?: number;
}

const gridBotCards = (o: GridBotOptions): CardSpec[] => [
  ['bat-dau', 'on-start', 0],
  ['than', 'robot-body', 0, { position: { x: 0, y: o.bodyY ?? 0.15, z: 0 }, heading: 0, length: CHASSIS.length, width: CHASSIS.width, height: 0.3, mass: 5, friction: 0.8 }],
  ['doc-moc', 'floor-marker-sensor', 1],
  ['tim-duong', 'grid-route', 1, o.detourAfter === undefined ? {} : { detourAfter: o.detourAfter }],
  ['tim-moc', 'floor-marker-find', 2],
  ['lai', 'robot-goto', 2, o.drive ?? {}],
  ['trai', 'motor', 3, { side: -MOTOR_SIDE }],
  ['phai', 'motor', 3, { side: MOTOR_SIDE }],
];

const GRID_BOT_PINS: readonly CircuitPin[] = [
  pin('o-duoc-di', 'Ô được đi', 'in', 'number', 'tim-moc.number'),
  pin('dang-cho', 'Đang chờ ô', 'in', 'bool', 'tim-duong.avoid'),
  pin('robot', 'Robot', 'out', 'object', 'than.self'),
  pin('o-muon', 'Ô muốn tới', 'out', 'number', 'tim-duong.next'),
  pin('o-dang-dung', 'Ô đang đứng', 'out', 'number', 'doc-moc.number'),
  pin('con-phai-di', 'Còn phải đi', 'out', 'bool', 'tim-duong.hasNext'),
];

/**
 * "Xe trên lưới": chassis, two motors, the driver, the marker reader, the route finder and the marker lookup. The goal
 * cell comes in through the pin "Ô đích". What the robot shares with the rest of the floor goes through its pins only:
 * it tells "Bảng giữ ô" who it is and which cell it wants, and is told which cell it may drive to.
 */
export function gridBotCircuit(o: GridBotOptions = {}): Circuit {
  registerAllNodes();
  return {
    id: GRID_BOT,
    name: 'Xe trên lưới',
    color: '#3b82f6',
    graph: { nodes: cards(gridBotCards(o)).nodes, wires: wires(GRID_BOT_WIRES) },
    pins: [pin('o-dich', 'Ô đích', 'in', 'number', 'tim-duong.goal'), ...GRID_BOT_PINS],
    exposed: [],
    benchIds: [],
  };
}

/** The four wires between a copy of the robot circuit and row k of a hold card. */
export const holdLinks = (copy: string, k: number, hold = 'giu-o'): Link[] => [
  [`${copy}.robot`, `${hold}.robot${k}`],
  [`${copy}.o-muon`, `${hold}.want${k}`],
  [`${hold}.cell${k}`, `${copy}.o-duoc-di`],
  [`${hold}.wait${k}`, `${copy}.dang-cho`],
];

export function botCopy(id: string, circuit: string, at: { x: number; y: number; z: number }, heading: number, name?: string): GraphNode {
  return { id, kind: CIRCUIT_KIND, params: instanceParams(circuit, { place: { position: at, heading }, ...(name ? { name } : {}) }), pos: { x: 0, y: 0 } };
}

// ---------------------------------------------------------------- a floor to watch: 9 holes, 4 robots that never stop

export const FLEET_BOT = 'xe-di-tuan';
export const FLEET_FLOOR = 'san-luoi';
export const FLEET = { rows: 7, cols: 7, pitch: 1.4, robots: 4, restSeconds: 1.5 } as const;
export const fleetCell = (row: number, col: number): number => row * FLEET.cols + col + 1;
/** The twelve cells a robot may be sent to: the middles of the cross lanes, beside the holes. */
export const FLEET_GOALS: readonly number[] = [0, 2, 4, 6].flatMap((r) => [1, 3, 5].map((c) => fleetCell(r, c)));
/** Inner wires "Xe đi tuần" adds to those of "Xe trên lưới": how it picks its next goal by itself. */
export const FLEET_BOT_EXTRA_WIRES: readonly Link[] = [
  ['tim-duong.hasNext', 'da-o-dich.in'],
  ['da-o-dich.out', 'toi-noi.b'],
  ['toi-noi.out', 'nghi.run'],
  ['nghi.done', 'xuc-xac.roll'],
  ['xuc-xac.value', 'bang-dich.index'],
  ['bang-dich.value', 'tim-duong.goal'],
];

/**
 * "Xe đi tuần": "Xe trên lưới" plus five cards that give it somewhere to go for ever. When it stands on the middle of
 * its goal cell (pin "Đứng giữa ô" from the hold card AND no cell left to go), a timer runs; when it ends a die picks a
 * row of a table of goal cells. Before the first roll the table gives 0: no goal, which counts as "there already".
 */
function fleetBotCircuit(): Circuit {
  const table: Record<string, ParamValue> = { rows: FLEET_GOALS.length, outside: 'zero', ...Object.fromEntries(FLEET_GOALS.map((v, k) => [`v${k + 1}`, v])) };
  const specs: CardSpec[] = [
    ...gridBotCards({ drive: { power: 0.8, slowDistance: 0.6 } }),
    ['da-o-dich', 'not', 0],
    ['toi-noi', 'and', 0],
    ['nghi', 'timer', 0, { seconds: FLEET.restSeconds, repeat: 'yes' }],
    ['xuc-xac', 'random', 1, { min: 1, max: FLEET_GOALS.length, whole: 'yes', mode: 'press', seed: 11 }],
    ['bang-dich', 'value-table', 1, table],
  ];
  return {
    id: FLEET_BOT,
    name: 'Xe đi tuần',
    color: '#3b82f6',
    graph: { nodes: cards(specs).nodes, wires: wires([...GRID_BOT_WIRES, ...FLEET_BOT_EXTRA_WIRES]) },
    pins: [...GRID_BOT_PINS.filter((p) => p.id !== 'con-phai-di' && p.id !== 'o-dang-dung'), pin('dung-giua-o', 'Đứng giữa ô', 'in', 'bool', 'toi-noi.a')],
    exposed: [],
    benchIds: [],
  };
}

/** "Sàn lưới 7 x 7": the 40 lane cells as floor markers with their arrows; on its canvas the cards lie as the cells lie on the floor. */
function fleetFloorCircuit(): Circuit {
  const nodes: GraphNode[] = [];
  for (let r = 0; r < FLEET.rows; r++) {
    for (let c = 0; c < FLEET.cols; c++) {
      if (r % 2 !== 0 && c % 2 !== 0) continue;
      const n = card(`o-${fleetCell(r, c)}`, 'floor-marker', { number: fleetCell(r, c), position: { x: c * FLEET.pitch, y: 0, z: r * FLEET.pitch }, size: FLEET.pitch, exits: laneArrows(r, c, FLEET.rows, FLEET.cols) || 'none' });
      n.pos = { x: MARGIN + c * 260, y: MARGIN + r * 230 };
      nodes.push(n);
    }
  }
  return { id: FLEET_FLOOR, name: 'Sàn lưới 7 x 7', color: '#f59e0b', graph: { nodes, wires: [] }, pins: [], exposed: [], benchIds: [] };
}

/** Where the four robots start: cell, and the heading of its arrow (degrees). */
const FLEET_STARTS: readonly { row: number; col: number; heading: number }[] = [
  { row: 0, col: 1, heading: 0 },
  { row: 2, col: 5, heading: 180 },
  { row: 4, col: 3, heading: 0 },
  { row: 6, col: 1, heading: 180 },
];

/** The five wires between copy k of "Xe đi tuần" and the hold card. */
export const fleetLinks = (k: number): Link[] => [
  [`xe-${k}.robot`, `giu-o.robot${k}`],
  [`xe-${k}.o-muon`, `giu-o.want${k}`],
  [`giu-o.cell${k}`, `xe-${k}.o-duoc-di`],
  [`giu-o.wait${k}`, `xe-${k}.dang-cho`],
  [`giu-o.stood${k}`, `xe-${k}.dung-giua-o`],
];

/**
 * Four robots on a one-way floor with nine holes, "Vật lý thật" on. The main board holds one copy of the floor, one
 * "Bảng giữ ô" and four copies of "Xe đi tuần"; every robot is wired to the hold card and to nothing else.
 */
export function tryGridFleet(): Board {
  registerAllNodes();
  const middle = ((FLEET.cols - 1) * FLEET.pitch) / 2;
  const span = FLEET.cols * FLEET.pitch + 2;
  const laid: [GraphNode, number][] = [
    [card('bat-dau', 'on-start'), 0],
    [card('may-quay', 'camera', { mode: 'fixed', point: { x: middle, y: 0, z: middle + 0.6 }, zoom: 0.62, view: 'tilted' }), 0],
    [card('san', 'block', { position: { x: middle, y: -0.5, z: middle }, size: { x: span, y: 1, z: span }, color: '#cfd2d7' }), 0],
    [{ id: 'san-luoi', kind: CIRCUIT_KIND, params: instanceParams(FLEET_FLOOR, { name: 'Sàn lưới 7 x 7' }), pos: { x: 0, y: 0 } }, 1],
    ...FLEET_STARTS.map((s, k): [GraphNode, number] => [botCopy(`xe-${k + 1}`, FLEET_BOT, { x: s.col * FLEET.pitch, y: 0, z: s.row * FLEET.pitch }, s.heading, `Xe ${k + 1}`), 1]),
    [card('giu-o', 'cell-hold', { robots: FLEET.robots }), 2],
    [card('hien-giu', 'show-number', { label: HELD_COUNT_LABEL, corner: 'top-right' }), 3],
  ];
  const nodes = laid.map(([n]) => n);
  const bottom = layOut(nodes, laid.map(([, col]) => col), 3, MARGIN, 400);
  return {
    name: 'Thử: 4 robot trên sàn lưới 9 lỗ',
    mode: '3d',
    graph: {
      nodes,
      wires: wires([['bat-dau.started', 'may-quay.on'], ...FLEET_STARTS.flatMap((_, k) => fleetLinks(k + 1)), ['giu-o.held', 'hien-giu.value']]),
      settings: { wireRule: true, realPhysics: true },
    },
    notes: [
      note(
        'Sàn 7 x 7 ô, 9 ô lẻ-lẻ là lỗ (không có mốc). Mũi tên trên mỗi ô là chiều được đi. Bốn robot là bốn bản sao của bảng mạch "Xe đi tuần": mỗi xe tự gieo số chọn một ô đích, tới nơi đứng 1,5 giây rồi chọn ô khác. Xe nào cũng nối vào "Bảng giữ ô": ô đang bị giữ có màu đỏ, xe gặp ô đỏ thì chờ. Thử gỡ một sợi dây "Ô robot k được đi": xe đó đứng im. Mở bảng mạch "Xe đi tuần" để xem bên trong.',
        MARGIN,
        bottom + 10,
        520,
        230,
      ),
    ],
    circuits: [fleetFloorCircuit(), fleetBotCircuit()],
  };
}
