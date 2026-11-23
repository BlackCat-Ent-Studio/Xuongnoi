import { instanceParams } from '../circuits/instance';
import { laneArrows } from '../handbook/boards-grid-floor';
import { CIRCUIT_KIND, type Board, type Circuit, type Graph, type GraphNode, type Note, type NoteColor, type ParamValue, type Vec3 } from '../engine/types';
import { registerAllNodes } from '../nodes';
import { GAP_Y, MARGIN, card, cards, layOut, open, pin, table, wires, type CardSpec, type Link } from './sorting-grid-kit';
import { CAGE, CATCH, COVER, GRID, GRID_IDS, LAMP, ROUTES, STARTS, cellNumber, cellPlace, isLaneCell, mm, stationCell } from './sorting-grid-plan';
import { robotCircuit } from './sorting-grid-robot';
import { gridStationCircuit } from './sorting-grid-station';

/**
 * "Xưởng phân loại kiện hàng (đang dựng: sàn lưới)": a raised deck with nine drop holes and a floor of one-way lanes, two
 * feeding stations on its west edge and six sorting robots. Every part is a circuit board made of palette pieces and wires:
 * "Sàn lưới" (the deck and its floor markers), "Trạm nạp" x2, "Xe phân loại" x6 (all wired to one "Bảng giữ ô"), "Lỗ thả"
 * x9 (the roll cage under a hole with its lamp, the plate that locks a full hole, the counters) and "Cộng chín số" x3. The
 * main board holds the copies, the button that stands in for swapping the cages, and the read-outs.
 */

/** Name of the sample in the "Bài mẫu" menu and on the board. */
export const GRID_FLOOR_NAME = 'Xưởng phân loại kiện hàng (đang dựng: sàn lưới)';

const ROUTE_NUMBERS = ROUTES.map((r) => r.code);
const ROBOT_NUMBERS = Array.from({ length: GRID.robots }, (_, n) => n + 1);

// ---------- Sàn lưới ----------

/** The deck and one "Mốc sàn" per lane cell; on the canvas the marker cards lie as the cells lie on the floor. */
function floorCircuit(): Circuit {
  const middle = mm(((GRID.cols - 1) * GRID.pitch) / 2);
  const side = mm(GRID.cols * GRID.pitch);
  const deck = card('san', 'raised-deck', { position: { x: middle, y: 0, z: middle }, top: GRID.top, holeCols: 3, holeRows: 3, hole: GRID.hole, pitch: 2 * GRID.pitch, length: side, width: side, legs: 'solid' });
  deck.pos = { x: MARGIN, y: MARGIN };
  const nodes: GraphNode[] = [deck];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      if (!isLaneCell(r, c)) continue;
      const n = card(`o-${cellNumber(r, c)}`, 'floor-marker', { number: cellNumber(r, c), position: cellPlace(r, c), size: GRID.pitch, exits: laneArrows(r, c, GRID.rows, GRID.cols) || 'none' });
      n.pos = { x: MARGIN + 360 + c * 260, y: MARGIN + r * 230 };
      nodes.push(n);
    }
  }
  return { id: GRID_IDS.floor, name: 'Sàn lưới', color: '#f59e0b', graph: { nodes, wires: [] }, pins: [], exposed: [], benchIds: [] };
}

// ---------- Lỗ thả ----------

/** Wires of "Lỗ thả" (exported so the tests can cut them one at a time). */
export const CATCH_WIRES: readonly Link[] = [
  ['bat-dau.started', 'bang-dan.run'],
  ['long.took', 'dem.up'],
  // A carton that falls past with a code that is not this hole's route counts as wrong
  ['vung.first', 'doc-ma.thing'],
  ['doc-ma.code', 'khac-tuyen.a'],
  ['tuyen.value', 'khac-tuyen.b'],
  ['khac-tuyen.out', 'sai-luc-vao.a'],
  ['vung.entered', 'sai-luc-vao.b'],
  ['sai-luc-vao.out', 'dem-sai.up'],
  // The lamp: its colour is read from a table by the number of cartons in the cage
  ['long.count', 'bang-mau.index'],
  ['bang-mau.value', 'den.pick'],
  // Full = locked, and it stays locked until the cage is empty again
  ['long.full', 'khoa.set'],
  ['long.count', 'long-trong.a'],
  ['long-trong.out', 'khoa.reset'],
  ['khoa.on', 'lo-mo.in'],
  // Locked: the plate over the hole shows and the one parked beside it hides; open: the other way round
  ['khoa.on', 'nap-dong.show'],
  ['lo-mo.out', 'nap-dong.hide'],
  ['khoa.on', 'nap-mo.hide'],
  ['lo-mo.out', 'nap-mo.show'],
  ['khoa.on', 'so-khoa.on'],
];

/** "Đặt màu" of the lamp by the number of cartons in the cage: row n for n cartons (none reads row 1, more than six reads row 6). */
export const LAMP_ROWS: readonly number[] = Array.from({ length: CAGE.capacity }, (_, n) => (n + 1 >= CAGE.capacity ? LAMP.red : n + 1 >= CAGE.almost ? LAMP.amber : LAMP.green));

/**
 * One hole, in its own frame (the hole's middle on the ground is the origin): on the deck a short belt between the stop
 * cell and the hole, a lamp tower and the plate that closes the hole (one card over the hole, one parked beside it); under
 * the hole a roll cage that keeps the cartons and counts them; in the shaft between the two a zone that reads the code of
 * each carton falling past.
 */
function catchCircuit(): Circuit {
  const { belt, shaft } = CATCH;
  const plate = (id: string, z: number, type: 'solid' | 'pickup'): CardSpec => [id, 'block', 5, { position: { x: 0, y: mm(GRID.top + COVER.size.y / 2), z: mm(z) }, size: { ...COVER.size }, type, style: 'hole-cover' }];
  const specs: CardSpec[] = [
    ['bat-dau', 'on-start', 0],
    ['bang-dan', 'block', 0, { position: { x: 0, y: mm(GRID.top + belt.height / 2), z: mm(-GRID.pitch + (belt.from + belt.to) / 2) }, size: { x: belt.length, y: belt.height, z: mm(belt.to - belt.from) }, style: 'belt-frame', beltSpeed: belt.speed, beltDir: 'z', beltWalls: 'no' }],
    ['long', 'container', 1, { position: { x: 0, y: 0, z: 0 }, inside: CAGE.inside, wall: CAGE.wall, capacity: CAGE.capacity, clearance: CAGE.clearance, look: 'roll-cage' }],
    ['dem', 'counter', 1],
    ['vung', 'zone', 2, { center: { x: 0, y: mm((shaft.from + shaft.to) / 2), z: 0 }, size: { x: shaft.side, y: mm(shaft.to - shaft.from), z: shaft.side }, filter: 'item', rule: 'center', color: '#38bdf8' }],
    ['doc-ma', 'code-reader', 2],
    ['tuyen', 'const', 2, { value: 1 }],
    ['khac-tuyen', 'compare', 3, { op: 'ne' }],
    ['sai-luc-vao', 'and', 3],
    ['dem-sai', 'counter', 3],
    ['bang-mau', 'value-table', 3, table(LAMP_ROWS)],
    ['den', 'block', 4, { position: { x: LAMP.offset, y: mm(GRID.top + LAMP.size.y / 2), z: LAMP.offset }, size: { ...LAMP.size }, type: 'pickup', style: 'signal-tower' }],
    ['long-trong', 'compare', 4, { op: 'eq' }],
    ['khoa', 'latch', 4],
    ['lo-mo', 'not', 4],
    // The plate over the hole is solid; the parked one lies where the wheels of a passing robot come close, so it is only a picture
    plate('nap-dong', COVER.shiftZ, 'solid'),
    plate('nap-mo', COVER.shiftZ + COVER.size.z, 'pickup'),
    ['so-khoa', 'bool-to-number', 5, { whenOn: 1, whenOff: 0 }],
  ];
  return {
    id: GRID_IDS.catch,
    name: 'Lỗ thả',
    color: '#f7d046',
    graph: { nodes: cards(specs), wires: wires(CATCH_WIRES) },
    pins: [
      pin('so-kien', 'Số kiện trong lồng', 'out', 'number', 'long.count'),
      pin('da-nhan', 'Số kiện đã nhận', 'out', 'number', 'dem.value'),
      pin('sai', 'Kiện sai tuyến', 'out', 'number', 'dem-sai.value'),
      pin('bao-khoa', 'Số báo khoá', 'out', 'number', 'so-khoa.value'),
    ],
    exposed: [open('tuyen', 'Tuyến của lỗ này (1-9)', 'tuyen.value'), open('so-bao-khoa', 'Số báo khi lỗ khoá (lỗ 1 = 1, lỗ 2 = 10, lỗ 3 = 100...)', 'so-khoa.whenOn')],
    benchIds: [],
  };
}

// ---------- Cộng chín số ----------

function adderCircuit(): Circuit {
  const steps = ROUTE_NUMBERS.slice(1);
  const specs: CardSpec[] = steps.map((k): CardSpec => [`cong-${k - 1}`, 'math', (k - 2) % 4, { op: 'add' }]);
  return {
    id: GRID_IDS.adder,
    name: 'Cộng chín số',
    graph: { nodes: cards(specs), wires: wires(steps.slice(1).map((k): Link => [`cong-${k - 2}.out`, `cong-${k - 1}.a`])) },
    pins: [pin('so-1', 'Số 1', 'in', 'number', 'cong-1.a'), ...steps.map((k) => pin(`so-${k}`, `Số ${k}`, 'in', 'number', `cong-${k - 1}.b`)), pin('tong', 'Tổng', 'out', 'number', `cong-${steps.length}.out`)],
    exposed: [],
    benchIds: [],
  };
}

// ---------- the main board ----------

/** The circuits, fresh objects on every call. */
export function createGridFloorCircuits(): Circuit[] {
  registerAllNodes();
  return [floorCircuit(), gridStationCircuit(), robotCircuit(), catchCircuit(), adderCircuit()];
}

/** Where the cage of route k stands: under its hole, on the ground. */
export const catchPlace = (k: number): Vec3 => {
  const [r, c] = ROUTES[k - 1]!.hole;
  return { x: mm(c * GRID.pitch), y: 0, z: mm(r * GRID.pitch) };
};

/** The four wires between copy k of "Xe phân loại" and row k of the hold card, and the one that tells it which holes are locked. */
export const robotLinks = (k: number): Link[] => [
  [`xe-${k}.robot`, `giu-o.robot${k}`],
  [`xe-${k}.o-muon`, `giu-o.want${k}`],
  [`giu-o.cell${k}`, `xe-${k}.o-duoc-di`],
  [`giu-o.stood${k}`, `xe-${k}.dung-giua-o`],
  ['tong-khoa.tong', `xe-${k}.so-khoa`],
];

/** The number a locked hole k adds to the lock number every robot reads: 1, 10, 100... so digit k says "hole k is locked". */
export const lockNumber = (k: number): number => 10 ** (k - 1);

/** Wires of the main board (exported so the tests can cut them one at a time). */
export const GRID_MAIN_WIRES: readonly Link[] = [
  ['bat-dau.started', 'may-quay.on'],
  ...ROBOT_NUMBERS.flatMap(robotLinks),
  // "Đổi lồng": one press takes every carton that lies in a cage back, one per beat, until the cages are empty. The first
  // carton in the cage zone is named to both stations; the one that made it takes it back
  ['bat-dau.started', 'nut-doi.show'],
  ['nut-doi.pressed', 'bat-doi.a'],
  ['vung-thu-hoi.inside', 'bat-doi.b'],
  ['bat-doi.out', 'dang-doi.set'],
  ['vung-thu-hoi.inside', 'het-thung.in'],
  ['het-thung.out', 'dang-doi.reset'],
  ['dang-doi.on', 'nhip-thu-hoi.run'],
  ...[1, 2].flatMap((s): Link[] => [
    ['vung-thu-hoi.first', `tram-${s}.vat-thu-hoi`],
    ['nhip-thu-hoi.done', `tram-${s}.thu-hoi`],
    [`tram-${s}.ma-cho`, `hien-ma-${s}.value`],
  ]),
  // Read-outs, and the lock number: every locked hole adds its own digit
  ...ROUTE_NUMBERS.flatMap((k): Link[] => [
    [`o-${k}.so-kien`, `hien-${k}.value`],
    [`o-${k}.da-nhan`, `tong-kien.so-${k}`],
    [`o-${k}.sai`, `tong-sai.so-${k}`],
    [`o-${k}.bao-khoa`, `tong-khoa.so-${k}`],
  ]),
  ['tong-kien.tong', 'hien-tong.value'],
  ['tong-sai.tong', 'hien-sai.value'],
  // A carton that stays on the deck floor for more than a second is counted once
  ['tren-san.inside', 'san-trong.in'],
  ['tren-san.inside', 'nam-lau.run'],
  ['san-trong.out', 'nam-lau.reset'],
  ['nam-lau.done', 'dem-roi.up'],
  ['dem-roi.value', 'hien-roi.value'],
];

/** The text on the button that stands in for swapping the cages, and the label of the read-out of cage k. */
export const SWAP_BUTTON = 'Đổi lồng';
export const cageLabel = (k: number): string => `Lồng ${k} đang có`;

const note = (id: string, color: NoteColor, x: number, y: number, w: number, h: number, text: string): Note => ({ id, color, pos: { x, y }, size: { w, h }, text });

const MAIN_COLS = [0, 330, 730, 1010, 1400, 1660] as const;
const BANNER_H = 220;
const NOTE2_H = 560;
/** Step between the copies of a stacked block (the smallest the app leaves between two cards). */
const STACK_STEP = 104;

/** The main board. Fresh objects on every call. */
export function createGridFloorBoard(): Board {
  const circuits = createGridFloorCircuits();
  const rows = new Map(circuits.map((c) => [c.id, Math.max(c.pins.filter((q) => q.dir === 'in').length, c.pins.filter((q) => q.dir === 'out').length)]));
  const copy = (id: string, circuit: string, name: string, at: Vec3 | null, values: Record<string, ParamValue> = {}, heading = 0): GraphNode => ({
    id,
    kind: CIRCUIT_KIND,
    params: instanceParams(circuit, { values, ...(at ? { place: { position: at, heading } } : {}), name }),
    pos: { x: 0, y: 0 },
  });
  const hud = (id: string, label: string, corner: string): GraphNode => card(id, 'show-number', { label, corner });
  const middle = mm(((GRID.cols - 1) * GRID.pitch) / 2);
  const side = mm(GRID.cols * GRID.pitch);
  const stationPlace = (s: 1 | 2): Vec3 => cellPlace(...stationCell(s));
  const laid: [GraphNode, number][] = [
    [card('bat-dau', 'on-start'), 0],
    [card('may-quay', 'camera', { mode: 'fixed', point: { x: mm(middle - 1), y: GRID.top, z: mm(middle + 0.4) }, zoom: 0.72, view: 'free' }), 0],
    [card('nen', 'block', { position: { x: mm(middle - 1), y: -0.5, z: middle }, size: { x: 20, y: 1, z: 16 }, color: '#cfd2d7' }), 0],
    [copy('san-luoi', GRID_IDS.floor, 'Sàn lưới', null), 0],
    [copy('tram-1', GRID_IDS.station, 'Trạm nạp 1', stationPlace(1), { 'hat-giong': GRID.seed + 1 }), 1],
    [copy('tram-2', GRID_IDS.station, 'Trạm nạp 2', stationPlace(2), { 'hat-giong': GRID.seed + 2 }), 1],
    ...STARTS.map((s, n): [GraphNode, number] => [copy(`xe-${n + 1}`, GRID_IDS.robot, `Xe ${n + 1}`, cellPlace(...s.cell), { 'tuyen-dau': s.route }, s.heading), 1]),
    [card('giu-o', 'cell-hold', { robots: GRID.robots }), 2],
    ...ROUTE_NUMBERS.map((k): [GraphNode, number] => [copy(`o-${k}`, GRID_IDS.catch, `Lỗ thả ${k}`, catchPlace(k), { tuyen: k, 'so-bao-khoa': lockNumber(k) }), 3]),
    [copy('tong-kien', GRID_IDS.adder, 'Tổng kiện', null), 3],
    [copy('tong-sai', GRID_IDS.adder, 'Tổng kiện sai', null), 3],
    [copy('tong-khoa', GRID_IDS.adder, 'Số khoá các lỗ', null), 3],
    [card('nut-doi', 'ui-button', { text: SWAP_BUTTON, corner: 'bottom-right' }), 4],
    [card('bat-doi', 'and'), 4],
    [card('dang-doi', 'latch'), 4],
    [card('het-thung', 'not'), 4],
    // Everything that lies in a cage: from the floor plates up to the rims, over all nine cages
    [card('vung-thu-hoi', 'zone', { center: { x: middle, y: mm((CAGE.floorY + CAGE.rimY) / 2), z: middle }, size: { x: mm(4 * GRID.pitch + CAGE.inside), y: mm(CAGE.rimY - CAGE.floorY), z: mm(4 * GRID.pitch + CAGE.inside) }, filter: 'item', rule: 'center', color: '#ef4444' }), 4],
    [card('nhip-thu-hoi', 'timer', { seconds: CATCH.recallEveryS, repeat: 'yes' }), 4],
    [card('tren-san', 'zone', { center: { x: middle, y: mm(GRID.top + 0.11), z: middle }, size: { x: side, y: 0.2, z: side }, filter: 'item', rule: 'center', color: '#a855f7' }), 4],
    [card('san-trong', 'not'), 4],
    [card('nam-lau', 'timer', { seconds: 1, repeat: 'no' }), 4],
    [card('dem-roi', 'counter'), 4],
    [hud('hien-tong', 'Tổng kiện đã phân loại', 'top-right'), 5],
    [hud('hien-sai', 'Kiện vào sai ô', 'top-right'), 5],
    [hud('hien-roi', 'Kiện nằm lại trên mặt sàn', 'top-right'), 5],
    ...ROUTE_NUMBERS.map((k): [GraphNode, number] => [hud(`hien-${k}`, cageLabel(k), 'top-left'), 5]),
    [hud('hien-ma-1', 'Trạm 1: mã kiện đang chờ', 'bottom-left'), 5],
    [hud('hien-ma-2', 'Trạm 2: mã kiện đang chờ', 'bottom-left'), 5],
  ];
  const stacks: string[] = [GRID_IDS.robot, GRID_IDS.catch];
  // Copies drawn as one stacked block: the block stands where the first copy is and the others wait close under it. Only
  // the first takes part in the column layout, with room for the whole stack.
  const firstOf = new Map(stacks.map((id) => [id, laid.find(([n]) => n.params.circuit === id)![0]]));
  const inFlow = laid.filter(([n]) => !stacks.includes(String(n.params.circuit)) || firstOf.get(String(n.params.circuit)) === n);
  const stackRows = (n: GraphNode): number => {
    const id = String(n.params.circuit);
    const own = rows.get(id) ?? 4;
    if (!stacks.includes(id)) return own;
    const members = laid.filter(([m]) => m.params.circuit === id).length;
    return own + Math.ceil(((members - 1) * STACK_STEP) / 34);
  };
  const top = MARGIN + BANNER_H + GAP_Y;
  layOut(inFlow.map(([n]) => n), inFlow.map(([, col]) => col), stackRows, top, (col) => MAIN_COLS[col] ?? 0);
  for (const id of stacks) {
    const members = laid.filter(([n]) => n.params.circuit === id).map(([n]) => n);
    members.forEach((n, k) => (n.pos = { x: members[0]!.pos.x, y: members[0]!.pos.y + k * STACK_STEP }));
  }
  const nodes = laid.map(([n]) => n);
  const graph: Graph = { nodes, wires: wires(GRID_MAIN_WIRES), settings: { wireRule: true, realPhysics: true }, stacks };
  const notesX = MARGIN + MAIN_COLS[5] + 240;
  return {
    name: GRID_FLOOR_NAME,
    mode: '3d',
    graph,
    notes: [
      note(
        'note1',
        'yellow',
        MARGIN,
        MARGIN,
        800,
        BANNER_H,
        'XƯỞNG ĐANG DỰNG DỞ, PHẦN SÀN LƯỚI: một sàn nâng cao 2,6 m có 9 lỗ thả, chia thành 7 x 7 ô; các làn chạy một chiều theo mũi tên trên ô. Hai "Trạm nạp" ở mép tây tạo thùng có mã tuyến 1-9 rồi đẩy thùng lên khay của xe đang đỗ. Sáu "Xe phân loại" tự đọc mã thùng trên khay, chạy tới ô cạnh lỗ của tuyến đó, nghiêng khay cho thùng trượt lên băng dẫn vào lỗ, rồi quay về trạm. Dưới mỗi lỗ có một lồng lưới: thùng rơi vào và nằm lại như vật thật. Lồng đủ 6 thùng thì lỗ bị khoá, xe phải chờ. Tầng dưới chưa có xe kéo lồng. Bấm Chạy để xem; bấm "Mở" trên một khối để xem bên trong.',
      ),
      note(
        'note2',
        'blue',
        notesX,
        MARGIN,
        380,
        NOTE2_H,
        'Xe phân loại (6 bản sao của một bảng mạch): mỗi xe nối 4 dây với "Bảng giữ ô" để không xe nào vào ô xe khác đang giữ (ô đang bị giữ đổi màu đỏ). Trong xe có các "Bảng giá trị" tra theo mã thùng: "ô phải tới để đổ", "đổ xong về trạm nào", "khay quay sang bên nào" (90 = bên phải, -90 = bên trái). Khay trống thì xe về trạm; có thùng nằm yên 1,2 giây thì xe mới chạy. Tới giữa ô đích, khay quay về phía lỗ rồi nghiêng 35 độ; thùng rơi khỏi khay thì khay hạ xuống và xe đi tiếp. Dây thứ 5 là "Số khoá các lỗ": lỗ 1 khoá thì cộng 1, lỗ 2 cộng 10, lỗ 3 cộng 100... Ví dụ 100010 nghĩa là lỗ 2 và lỗ 6 đang khoá. Xe xem chữ số ứng với mã thùng của mình: lỗ đang khoá thì xe KHÔNG đổ, đứng chờ 4 giây, rồi chạy sang ô kế tiếp và theo làn một chiều đi một vòng quay lại.',
      ),
      note(
        'note3',
        'green',
        notesX,
        MARGIN + NOTE2_H + GAP_Y,
        380,
        560,
        'Lỗ thả (9 bản sao): băng dẫn ngắn trên sàn đưa thùng vào lỗ; "Lồng chứa" bên dưới giữ thùng và đếm. Đèn tháp cạnh lỗ: xanh khi còn chỗ, vàng khi có 5 thùng, đỏ khi đủ 6. Đủ 6 thì "Công tắc nhớ" bật: tấm nắp sọc đỏ trắng hiện ra đậy lỗ và lỗ báo khoá cho các xe. Công tắc chỉ tắt khi lồng trống trở lại, nên số đếm có nhảy 5-6 thì nắp cũng không đóng mở liên tục. "Vùng kích hoạt" giữa sàn và lồng đọc mã thùng đang rơi: khác tuyến thì tính là sai lỗ. NÚT "Đổi lồng" (góc dưới bên phải khi chạy) ĐỨNG THAY cho xe kéo chưa làm: bấm một lần thì thùng trong CẢ 9 lồng được "Thu hồi" từng thùng một, lồng trống thì nắp mở, đèn xanh lại. Góc trái màn hình: số thùng đang nằm trong từng lồng. Góc phải: tổng số thùng đã phân loại, số thùng vào sai lỗ, số lần có thùng nằm lại trên mặt sàn quá 1 giây (phải luôn là 0).',
      ),
    ],
    circuits,
  };
}
