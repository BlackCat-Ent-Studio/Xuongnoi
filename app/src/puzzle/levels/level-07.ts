import type { GraphNode } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { slotMarkNodes, type StoreSlotsDef } from '../store-slots';
import { handReach } from '../world-options';

const RED = '#ef4444';
const BLUE = '#3b82f6';
const CRATE_SIZE = { x: 0.7, y: 0.7, z: 0.7 };
/** The crates wait in a lane beside the walking line (z = 0); the robot reads the coloured tile on the line and takes the crate from the side. */
const CRATE_Z = 1.02;

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
/** Seconds the robot stands at each pad before walking on. */
const PAD_STOP = 0.5;

/**
 * Cards of the script, packed in the left part of the 1000x560 board (the player works on the right): four columns
 * of 170-wide cards, left to right in the order the work flows (robot and store slots, where to walk, how to walk,
 * the hands). On screen a card is taller than its few rows suggest, so the cards in a column are spaced generously.
 */
const COLUMN_X = [6, 178, 350, 522] as const;
const column = (col: 0 | 1 | 2 | 3, y: number): { x: number; y: number } => ({ x: COLUMN_X[col], y });

let sceneryIndex = 0;
/** Scenery is never drawn, so it only needs a spot of its own: a strip below the board holds them all in rows. */
const nextScenery = (): { x: number; y: number } => {
  const i = sceneryIndex++;
  return { x: 20 + (i % 5) * 190, y: 640 + Math.floor(i / 5) * 44 };
};
const scenery = (id: string, kind: string, params: GraphNode['params']): GraphNode => ({ id, kind, params, pos: nextScenery() });

/** A visible locked card of the script. */
const card = (id: string, kind: string, params: GraphNode['params'], pos: { x: number; y: number }): GraphNode => ({ id, kind, params, pos });

/**
 * Level 7 (phan-loai-mau): red and blue crates sit on coloured pads in a row. The legs robot walks the row, the
 * player decides when it grabs: only on a blue pad and only with free hands. Three blue crates in the store win,
 * a red one in the store loses.
 *
 * The robot's whole routine is made of ordinary Xưởng Nối pieces that sit on the board as locked cards (left part):
 *  - "Chạy theo tuyến" walks the pads and stops at each one, turning to the crate beside it; it stays put while the hands are full.
 *  - "Đo tốc độ" says when the robot stands still; a locked "Và" lets the player's signal through only then
 *    (or while the hands are full, so the same signal puts a held crate down again).
 *  - "Ô trống kế tiếp" picks the first free store slot and "Đi tới" walks there with the crate; arriving puts it down.
 * Only the floor, pads, crates, store marks, the win/lose plumbing and the camera are scenery (not drawn).
 */
export const level07: PuzzleLevel = {
  id: 'phan-loai-mau',
  order: 7,
  title: 'Phân loại thùng màu',
  task: 'Rô-bốt chân đi dọc hàng thùng đỏ và thùng xanh. Chỉ được khiêng thùng XANH về kho. Đủ 3 thùng xanh trong kho là thắng, lỡ khiêng thùng đỏ về kho là thua!',
  hint: 'Đặt "Đọc màu", nối Rô-bốt vào "Vật" và chỉnh "Màu cần tìm" thành 2 (xanh). Rô-bốt chỉ cầm khi thấy màu xanh VÀ tay đang rảnh: nối "Đang khiêng" qua "Đảo ngược", rồi cùng "Đúng màu" vào "Và". Kết quả của "Và" nối vào "Nhấc lên".',
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
      scenery('blue-store', 'zone', { center: { x: STORE_CENTER.x, y: 0.5, z: STORE_CENTER.z }, size: { x: STORE_SIZE.x, y: 3, z: STORE_SIZE.z }, filter: 'item', goods: 'xanh', rule: 'center', color: BLUE }),
      scenery('red-store', 'zone', { center: { x: STORE_CENTER.x, y: 0.5, z: STORE_CENTER.z }, size: { x: STORE_SIZE.x, y: 3, z: STORE_SIZE.z }, filter: 'item', goods: 'do', rule: 'center', color: RED }),
      scenery('need', 'const', { value: 3 }),
      scenery('enough', 'compare', { op: 'ge' }),
      scenery('cam', 'camera', { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'tilted', zoom: 0.85 }),
      scenery('end', 'win-lose', { winMessage: 'Ba thùng xanh đã về kho!', loseMessage: 'Có thùng đỏ lẫn vào kho rồi!' }),
      // Left column: the robot, the three store slots and the card that picks the next free one.
      card('robot', 'character', { name: 'Rô-bốt chân', position: { x: -7.6, y: 1, z: 0 }, speed: 5, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, column(0, 10)),
      ...slotMarkNodes(STORE, (i) => column(0, 190 + i * 110)),
      // Second column: which slot is next and the walk there with the crate.
      card('next-slot', 'next-free-slot', {}, column(1, 10)),
      card('to-store', 'go-to', { stopDistance: PARK_REACH, slowRadius: 3, pathfind: 'off' }, column(1, 225)),
      // Third column: the walk along the pads, the sum of the two walks, and the sensor that says "standing still".
      card(
        'route',
        'route-follow',
        {
          count: PADS.length,
          ...Object.fromEntries(PADS.map((p, i) => [`p${i + 1}`, { x: p.x, y: 0.5, z: 0 }])),
          style: 'loop',
          follow: 'steer',
          speed: 5,
          lookAhead: 0,
          arriveRadius: 0.2,
          stopFor: PAD_STOP,
          faceAtStop: 'item',
        },
        column(2, 10),
      ),
      card('sum-x', 'math', { op: 'add' }, column(2, 225)),
      card('speed', 'speed-sensor', {}, column(2, 405)),
      // Fourth column: when the hands may close (standing still, or already full), and the hands themselves.
      card('still-or-full', 'or', {}, column(3, 10)),
      card('gate', 'and', {}, column(3, 185)),
      card('hands', 'carry', { mode: 'toggle' }, column(3, 355)),
    ],
    wires: [
      { id: 'b1', from: { node: 'robot', port: 'self' }, to: { node: 'route', port: 'self' } },
      { id: 'b2', from: { node: 'robot', port: 'self' }, to: { node: 'to-store', port: 'self' } },
      { id: 'b3', from: { node: 'robot', port: 'self' }, to: { node: 'hands', port: 'character' } },
      { id: 'b4', from: { node: 'robot', port: 'self' }, to: { node: 'speed', port: 'who' } },
      { id: 'b5', from: { node: 'route', port: 'moveX' }, to: { node: 'sum-x', port: 'a' } },
      { id: 'b6', from: { node: 'to-store', port: 'moveX' }, to: { node: 'sum-x', port: 'b' } },
      { id: 'b7', from: { node: 'sum-x', port: 'out' }, to: { node: 'robot', port: 'moveX' } },
      { id: 'b8', from: { node: 'route', port: 'moveY' }, to: { node: 'robot', port: 'moveY' } },
      { id: 'b9', from: { node: 'speed', port: 'still' }, to: { node: 'still-or-full', port: 'a' } },
      { id: 'b10', from: { node: 'hands', port: 'holding' }, to: { node: 'still-or-full', port: 'b' } },
      { id: 'b11', from: { node: 'still-or-full', port: 'out' }, to: { node: 'gate', port: 'b' } },
      { id: 'b12', from: { node: 'gate', port: 'out' }, to: { node: 'hands', port: 'grab' } },
      { id: 'b13', from: { node: 'hands', port: 'holding' }, to: { node: 'route', port: 'stop' } },
      { id: 'b14', from: { node: 'hands', port: 'holding' }, to: { node: 'to-store', port: 'go' } },
      { id: 'b15', from: { node: 'slot-1', port: 'self' }, to: { node: 'next-slot', port: 's1' } },
      { id: 'b16', from: { node: 'slot-2', port: 'self' }, to: { node: 'next-slot', port: 's2' } },
      { id: 'b17', from: { node: 'slot-3', port: 'self' }, to: { node: 'next-slot', port: 's3' } },
      { id: 'b18', from: { node: 'next-slot', port: 'slot' }, to: { node: 'to-store', port: 'target' } },
      { id: 'b19', from: { node: 'to-store', port: 'arrived' }, to: { node: 'hands', port: 'drop' } },
      { id: 'b20', from: { node: 'blue-store', port: 'count' }, to: { node: 'enough', port: 'a' } },
      { id: 'b21', from: { node: 'need', port: 'value' }, to: { node: 'enough', port: 'b' } },
      { id: 'b22', from: { node: 'enough', port: 'out' }, to: { node: 'end', port: 'win' } },
      { id: 'b23', from: { node: 'red-store', port: 'inside' }, to: { node: 'end', port: 'lose' } },
    ],
  },
  shownPorts: {
    ...Object.fromEntries(
      ['floor', 'store-mark', 'blue-store', 'red-store', 'enough', 'cam', 'end', ...PADS.flatMap((_, i) => [`pad-${i + 1}`, `crate-${i + 1}`])].map((id) => [id, { in: [], out: [] }]),
    ),
    need: { out: [] },
    robot: { in: ['moveX', 'moveY'], out: ['self'] },
    'slot-1': { in: [], out: ['self'] },
    'slot-2': { in: [], out: ['self'] },
    'slot-3': { in: [], out: ['self'] },
    'next-slot': { in: ['s1', 's2', 's3'], out: ['slot'] },
    speed: { in: ['who'], out: ['still'] },
    'still-or-full': { in: ['a', 'b'], out: ['out'] },
    gate: { in: ['a', 'b'], out: ['out'] },
    hands: { in: ['character', 'grab', 'drop'], out: ['holding'] },
    route: { in: ['self', 'stop'], out: ['moveX', 'moveY'] },
    'sum-x': { in: ['a', 'b'], out: ['out'] },
    'to-store': { in: ['self', 'target', 'go'], out: ['moveX', 'arrived'] },
  },
  tray: [
    { kind: 'color-sensor', count: 1, params: { where: 'feet', want: 1, color1: RED, color2: BLUE } },
    { kind: 'not', count: 1 },
    { kind: 'and', count: 1 },
    { kind: 'or', count: 1 },
  ],
  editable: [{ kind: 'color-sensor', paramId: 'want' }],
  par: 3,
  freeHints: 3,
  timeLimit: 60,
  solution: {
    nodes: [
      { id: 's-eye', kind: 'color-sensor', params: { where: 'feet', want: 2, color1: RED, color2: BLUE }, pos: { x: 620, y: 40 } },
      { id: 's-free', kind: 'not', params: {}, pos: { x: 620, y: 300 } },
      { id: 's-and', kind: 'and', params: {}, pos: { x: 820, y: 170 } },
    ],
    wires: [
      { id: 'sw1', from: { node: 'robot', port: 'self' }, to: { node: 's-eye', port: 'who' } },
      { id: 'sw2', from: { node: 's-eye', port: 'match' }, to: { node: 's-and', port: 'a' } },
      { id: 'sw3', from: { node: 'hands', port: 'holding' }, to: { node: 's-free', port: 'in' } },
      { id: 'sw4', from: { node: 's-free', port: 'out' }, to: { node: 's-and', port: 'b' } },
      { id: 'sw5', from: { node: 's-and', port: 'out' }, to: { node: 'gate', port: 'a' } },
    ],
  },
};
