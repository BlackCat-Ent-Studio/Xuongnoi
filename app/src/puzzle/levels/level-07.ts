import type { GraphNode, Wire } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { SLOT_SIZE, slotCentres, slotMarkNodes, type StoreSlotsDef } from '../store-slots';
import { handReach } from '../world-options';

const RED = '#ef4444';
const BLUE = '#3b82f6';
const CRATE_SIZE = { x: 0.7, y: 0.7, z: 0.7 };
/** The crates wait in a lane beside the walking line (z = 0); the robot reads the coloured tile on the line and takes the crate from the side. */
const CRATE_Z = 1.12;

/** Colour of the crate on each pad, left to right. Three blue ones, three red ones. */
const PADS: readonly { x: number; color: string }[] = [
  { x: -6, color: RED },
  { x: -3, color: BLUE },
  { x: 0, color: RED },
  { x: 3, color: BLUE },
  { x: 6, color: RED },
  { x: 9, color: BLUE },
];

/**
 * The blue store at the left end has three marked slots in a row, filled far end first. The crates are 0.7, so the
 * slots sit 1.9 apart (a little more than the usual spacing).
 */
const STORE: StoreSlotsDef = { pickup: { x: 11, y: 0.5, z: 0 }, first: { x: -12.6, z: 0 }, step: { x: 1.9, z: 0 }, count: 3 };
const STORE_CENTER = { x: -10.7, z: 0 };
const STORE_SIZE = { x: 5.6, z: 2 };

/** How far in front of the robot's middle the hands hold one of these crates: the robot stops this far from a slot so the crate lands in its middle. */
const PARK_REACH = Math.round(handReach(CRATE_SIZE) * 100) / 100;

let sceneryIndex = 0;
/** Scenery is never drawn, so it only needs a spot of its own: a strip below the board holds them all in rows. */
const nextScenery = (): { x: number; y: number } => {
  const i = sceneryIndex++;
  return { x: 20 + (i % 5) * 190, y: 640 + Math.floor(i / 5) * 44 };
};
const scenery = (id: string, kind: string, params: GraphNode['params']): GraphNode => ({ id, kind, params, pos: nextScenery() });

/** Pieces the player takes from the tray, ready set up for this level (the walk along the pads, the walk to the store, the sum). */
const ROUTE_PARAMS: GraphNode['params'] = {
  count: PADS.length,
  ...Object.fromEntries(PADS.map((p, i) => [`p${i + 1}`, { x: p.x, y: 0.5, z: 0 }])),
  style: 'loop',
  follow: 'steer',
  speed: 5,
  lookAhead: 0,
  arriveRadius: 0.2,
};
const GO_TO_PARAMS: GraphNode['params'] = { stopDistance: PARK_REACH, slowRadius: 3, pathfind: 'off' };
/** Seconds the robot waits at each pad before walking on. */
const PAD_STOP = 0.5;
/** The timer that holds the robot at each pad (the player's own "Hẹn giờ": restarted by "Tới điểm", wired into "Dừng"). */
const PAD_TIMER_PARAMS: GraphNode['params'] = { seconds: PAD_STOP };

const wire = (id: string, from: [string, string], to: [string, string]): Wire => ({ id, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] } });

/**
 * Level 7 (phan-loai-mau): red and blue crates sit on coloured pads in a row. The player builds the whole circuit of
 * the legs robot: walk the pads and wait at each one on a timer, read the colour, grab only on blue while waiting at a pad,
 * walk the crate to the first free store slot, put it down and go on. Three blue crates in the store win, a red one
 * in the store loses.
 *
 * On the board only the robot and the three store slot marks are drawn. The floor, pads, crates, store zones, the
 * win/lose plumbing and the camera are scenery (not drawn). Every behaviour comes from ordinary Xưởng Nối pieces
 * the player places and wires: "Chạy theo tuyến", "Đọc màu", "Và", "Khiêng đồ", "Đi tới", "Ô trống kế tiếp", "Phép tính".
 */
export const level07: PuzzleLevel = {
  id: 'phan-loai-mau',
  order: 7,
  title: 'Phân loại thùng màu',
  task: 'Rô-bốt chân đi dọc hàng thùng đỏ và thùng xanh. Chỉ được khiêng thùng XANH về kho. Đủ 3 thùng xanh trong kho là thắng, lỡ khiêng thùng đỏ về kho là thua! Bạn tự nối cả mạch cho rô-bốt.',
  hint: 'Cho rô-bốt đi theo hàng ô bằng "Chạy theo tuyến" (nối "Khi bắt đầu" vào "Bật" cho nó chạy). Mỗi lần "Tới điểm" thì "Hẹn giờ" đếm lại, và trong lúc đếm thì tuyến "Dừng". "Đọc màu" chỉnh về 2 (xanh); thấy xanh VÀ đang đợi ở ô thì "Nhấc lên". Khiêng xong thì tuyến dừng, "Đi tới" đem thùng tới "Ô trống kế tiếp", tới nơi thì "Thả". "Phép tính" cộng hai lối đi ngang.',
  mode: '3d',
  cast: [PUZZLE_LOOKS.robotLegs],
  storeSlots: STORE,
  base: {
    nodes: [
      scenery('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 28, y: 1, z: 8 }, color: '#cbd5e1', type: 'solid' }),
      scenery('store-mark', 'block', { name: 'Kho', position: { x: STORE_CENTER.x, y: 0.01, z: STORE_CENTER.z }, size: { x: STORE_SIZE.x, y: 0.02, z: STORE_SIZE.z }, color: '#22c55e', type: 'pickup' }),
      ...PADS.map((p, i) =>
        scenery(`pad-${i + 1}`, 'block', { name: `Ô ${i + 1}`, position: { x: p.x, y: 0.02, z: 0 }, size: { x: 1, y: 0.04, z: 1 }, color: p.color, type: 'pickup' }),
      ),
      ...PADS.map((p, i) =>
        scenery(`crate-${i + 1}`, 'item', {
          name: `Thùng ${p.color === BLUE ? 'xanh' : 'đỏ'} ${i + 1}`,
          position: { x: p.x, y: 0.5, z: CRATE_Z },
          size: CRATE_SIZE,
          shape: 'crate',
          color: p.color,
          tag: p.color === BLUE ? 'xanh' : 'do',
        }),
      ),
      // The win asks for a blue crate resting in each of the three slots (so one slot cannot be piled up).
      ...slotCentres(STORE).map((c, i) =>
        scenery(`slot-zone-${i + 1}`, 'zone', { center: { x: c.x, y: 0.5, z: c.z }, size: { x: SLOT_SIZE, y: 3, z: SLOT_SIZE }, filter: 'item', goods: 'xanh', rule: 'center', color: BLUE }),
      ),
      scenery('slots-12', 'and', {}),
      scenery('slots-all', 'and', {}),
      scenery('red-store', 'zone', { center: { x: STORE_CENTER.x, y: 0.5, z: STORE_CENTER.z }, size: { x: STORE_SIZE.x, y: 3, z: STORE_SIZE.z }, filter: 'item', goods: 'do', rule: 'center', color: RED }),
      scenery('cam', 'camera', { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'tilted', zoom: 0.85 }),
      // Locked and not drawn: it switches the fixed camera on, since nothing acts without a wire.
      scenery('start', 'on-start', {}),
      scenery('end', 'win-lose', { winMessage: 'Ba thùng xanh đã về kho!', loseMessage: 'Có thùng đỏ lẫn vào kho rồi!' }),
      // The two things the player wires to: the robot and the store slot marks, in a column on the left.
      { id: 'robot', kind: 'character', params: { name: 'Rô-bốt chân', position: { x: -7.6, y: 1, z: 0 }, speed: 5, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, pos: { x: 10, y: 10 } },
      ...slotMarkNodes(STORE, (i) => ({ x: 10, y: 128 + i * 80 })),
    ],
    wires: [
      wire('b1', ['slot-zone-1', 'inside'], ['slots-12', 'a']),
      wire('b2', ['slot-zone-2', 'inside'], ['slots-12', 'b']),
      wire('b3', ['slots-12', 'out'], ['slots-all', 'a']),
      wire('b4', ['slot-zone-3', 'inside'], ['slots-all', 'b']),
      wire('b5', ['slots-all', 'out'], ['end', 'win']),
      wire('b6', ['red-store', 'inside'], ['end', 'lose']),
      wire('b7', ['start', 'started'], ['cam', 'on']),
    ],
  },
  shownPorts: {
    ...Object.fromEntries(
      ['floor', 'store-mark', 'red-store', 'slots-12', 'slots-all', 'cam', 'start', 'end', ...[1, 2, 3].map((n) => `slot-zone-${n}`), ...PADS.flatMap((_, i) => [`pad-${i + 1}`, `crate-${i + 1}`])].map((id) => [id, { in: [], out: [] }]),
    ),
    robot: { in: ['moveX'], out: ['self'] },
    'slot-1': { in: [], out: ['self'] },
    'slot-2': { in: [], out: ['self'] },
    'slot-3': { in: [], out: ['self'] },
  },
  tray: [
    { kind: 'route-follow', count: 1, params: ROUTE_PARAMS },
    { kind: 'color-sensor', count: 1, params: { where: 'feet', want: 1, color1: RED, color2: BLUE } },
    { kind: 'and', count: 1 },
    { kind: 'carry', count: 1 },
    { kind: 'go-to', count: 1, params: GO_TO_PARAMS },
    { kind: 'next-free-slot', count: 1 },
    { kind: 'math', count: 1, params: { op: 'add' } },
    { kind: 'on-start', count: 1 },
    { kind: 'timer', count: 1, params: PAD_TIMER_PARAMS },
    { kind: 'compare', count: 1, params: { op: 'gt' } },
    { kind: 'or', count: 1 },
    // Spare piece: it measures speed, which looks like the way to tell the robot stands still, but "Dừng" already tells that. (Not "Đảo ngược", "Công tắc nhớ" or a second "Và": left alone, or set by the stops, they can do the colour sensor's or the start card's work.)
    { kind: 'speed-sensor', count: 1 },
  ],
  editable: [{ kind: 'color-sensor', paramId: 'want' }],
  par: 11,
  freeHints: 7,
  timeLimit: 60,
  solution: {
    nodes: [
      { id: 's-route', kind: 'route-follow', params: ROUTE_PARAMS, pos: { x: 620, y: 20 } },
      { id: 's-sum', kind: 'math', params: { op: 'add' }, pos: { x: 820, y: 20 } },
      { id: 's-eye', kind: 'color-sensor', params: { where: 'feet', want: 2, color1: RED, color2: BLUE }, pos: { x: 620, y: 260 } },
      { id: 's-and', kind: 'and', params: {}, pos: { x: 820, y: 200 } },
      { id: 's-hands', kind: 'carry', params: {}, pos: { x: 820, y: 330 } },
      { id: 's-next', kind: 'next-free-slot', params: {}, pos: { x: 620, y: 400 } },
      { id: 's-goto', kind: 'go-to', params: GO_TO_PARAMS, pos: { x: 820, y: 450 } },
      { id: 's-start', kind: 'on-start', params: {}, pos: { x: 380, y: 20 } },
      { id: 's-timer', kind: 'timer', params: PAD_TIMER_PARAMS, pos: { x: 380, y: 160 } },
      { id: 's-cmp', kind: 'compare', params: { op: 'gt' }, pos: { x: 380, y: 300 } },
      { id: 's-or', kind: 'or', params: {}, pos: { x: 380, y: 420 } },
    ],
    wires: [
      wire('sw1', ['robot', 'self'], ['s-route', 'self']),
      wire('sw2', ['s-route', 'moveX'], ['s-sum', 'a']),
      wire('sw3', ['s-sum', 'out'], ['robot', 'moveX']),
      wire('sw4', ['robot', 'self'], ['s-eye', 'who']),
      wire('sw5', ['s-eye', 'match'], ['s-and', 'a']),
      wire('sw6', ['s-route', 'halted'], ['s-and', 'b']),
      wire('sw7', ['robot', 'self'], ['s-hands', 'character']),
      wire('sw8', ['s-and', 'out'], ['s-hands', 'grab']),
      wire('sw9', ['s-or', 'out'], ['s-route', 'stop']),
      wire('sw10', ['slot-1', 'self'], ['s-next', 's1']),
      wire('sw11', ['slot-2', 'self'], ['s-next', 's2']),
      wire('sw12', ['slot-3', 'self'], ['s-next', 's3']),
      wire('sw13', ['robot', 'self'], ['s-goto', 'self']),
      wire('sw14', ['s-next', 'slot'], ['s-goto', 'target']),
      wire('sw15', ['s-hands', 'holding'], ['s-goto', 'go']),
      wire('sw16', ['s-goto', 'moveX'], ['s-sum', 'b']),
      wire('sw17', ['s-goto', 'arrived'], ['s-hands', 'drop']),
      wire('sw18', ['s-start', 'started'], ['s-route', 'on']),
      wire('sw19', ['s-route', 'reached'], ['s-timer', 'reset']),
      wire('sw20', ['s-start', 'started'], ['s-timer', 'run']),
      wire('sw21', ['s-timer', 'left'], ['s-cmp', 'a']),
      wire('sw22', ['s-cmp', 'out'], ['s-or', 'a']),
      wire('sw23', ['s-hands', 'holding'], ['s-or', 'b']),
    ],
  },
};
