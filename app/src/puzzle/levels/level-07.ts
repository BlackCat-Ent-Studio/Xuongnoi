import type { GraphNode } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

const RED = '#ef4444';
const BLUE = '#3b82f6';
const CRATE_SIZE = { x: 0.7, y: 0.7, z: 0.7 };
/** The crates wait in a lane beside the walking line (z = 0); the robot reads the coloured tile on the line and takes the crate from the side. */
const CRATE_Z = 1.02;
/** A crate is set down this far to the side of the robot: out of reach of the crate lane, so a dropped crate is not picked up again by the next tile. */
const DROP_DISTANCE = 2;

/** Colour of the crate on each pad, left to right. Three blue ones, three red ones. */
const PADS: readonly { x: number; color: string }[] = [
  { x: -6, color: RED },
  { x: -3, color: BLUE },
  { x: 0, color: RED },
  { x: 3, color: BLUE },
  { x: 6, color: RED },
  { x: 9, color: BLUE },
];

/** Hidden locked cards are stacked in columns so none overlap on the 1000x560 board. */
const slot = (i: number): { x: number; y: number } => ({ x: 20 + Math.floor(i / 12) * 180, y: 20 + (i % 12) * 44 });

let slotIndex = 0;
const hidden = (id: string, kind: string, params: GraphNode['params']): GraphNode => ({ id, kind, params, pos: slot(slotIndex++) });

/**
 * Level 7 (phan-loai-mau): red and blue crates sit on coloured pads in a row. The legs robot walks the row, the
 * player decides when it grabs: only on a blue pad and only with free hands. Three blue crates in the store win,
 * a red one in the store loses.
 */
export const level07: PuzzleLevel = {
  id: 'phan-loai-mau',
  order: 7,
  title: 'Phân loại thùng màu',
  task: 'Rô-bốt chân đi dọc hàng thùng đỏ và thùng xanh. Chỉ được khiêng thùng XANH về kho. Đủ 3 thùng xanh trong kho là thắng, lỡ khiêng thùng đỏ về kho là thua!',
  hint: 'Đặt "Cảm biến màu", nối Rô-bốt vào "Vật" và chỉnh "Màu cần tìm" thành 2 (xanh). Rô-bốt chỉ cầm khi thấy màu xanh VÀ tay đang rảnh: nối "Đang cầm" qua "Không", rồi cùng "Đúng màu" vào "Và". Kết quả của "Và" nối vào "Cầm".',
  mode: '3d',
  cast: [PUZZLE_LOOKS.robotLegs],
  base: {
    nodes: [
      hidden('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 28, y: 1, z: 8 }, color: '#cbd5e1', type: 'solid' }),
      hidden('store-mark', 'block', { name: 'Kho', position: { x: -10, y: 0.01, z: 0 }, size: { x: 6, y: 0.02, z: 5 }, color: '#22c55e', type: 'pickup' }),
      ...PADS.map((p, i) =>
        hidden(`pad-${i + 1}`, 'block', { name: `Ô ${i + 1}`, position: { x: p.x, y: 0.02, z: 0 }, size: { x: 1, y: 0.04, z: 1 }, color: p.color, type: 'pickup' }),
      ),
      ...PADS.map((p, i) =>
        hidden(`crate-${i + 1}`, 'item', {
          name: `Thùng ${p.color === BLUE ? 'xanh' : 'đỏ'} ${i + 1}`,
          position: { x: p.x, y: 0.5, z: CRATE_Z },
          size: CRATE_SIZE,
          shape: 'crate',
          color: p.color,
          tag: p.color === BLUE ? 'xanh' : 'do',
        }),
      ),
      hidden('brain', 'patrol', { pointA: { x: -10, y: 0.5, z: 0 }, pointB: { x: 11, y: 0.5, z: 0 }, wait: 0.5, pathfind: 'off' }),
      hidden('drop-zone', 'zone', { center: { x: -9, y: 1, z: 0 }, size: { x: 3, y: 3, z: 3 }, filter: 'bot', rule: 'center', color: '#22c55e' }),
      hidden('blue-store', 'zone', { center: { x: -10, y: 0.5, z: 0 }, size: { x: 6, y: 3, z: 5 }, filter: 'item', goods: 'xanh', rule: 'center', color: BLUE }),
      hidden('red-store', 'zone', { center: { x: -10, y: 0.5, z: 0 }, size: { x: 6, y: 3, z: 5 }, filter: 'item', goods: 'do', rule: 'center', color: RED }),
      hidden('need', 'const', { value: 3 }),
      hidden('enough', 'compare', { op: 'ge' }),
      hidden('cam', 'camera', { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'tilted', zoom: 0.85 }),
      hidden('end', 'win-lose', { winMessage: 'Ba thùng xanh đã về kho!', loseMessage: 'Có thùng đỏ lẫn vào kho rồi!' }),
      { id: 'robot', kind: 'character', params: { name: 'Rô-bốt chân', position: { x: -10, y: 1, z: 0 }, speed: 5, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, pos: { x: 400, y: 20 } },
      { id: 'hands', kind: 'carry', params: { mode: 'toggle', dropDistance: DROP_DISTANCE }, pos: { x: 400, y: 120 } },
    ],
    wires: [
      { id: 'b1', from: { node: 'robot', port: 'self' }, to: { node: 'brain', port: 'self' } },
      { id: 'b2', from: { node: 'brain', port: 'moveX' }, to: { node: 'robot', port: 'moveX' } },
      { id: 'b3', from: { node: 'brain', port: 'moveY' }, to: { node: 'robot', port: 'moveY' } },
      { id: 'b4', from: { node: 'robot', port: 'self' }, to: { node: 'hands', port: 'character' } },
      { id: 'b5', from: { node: 'drop-zone', port: 'inside' }, to: { node: 'hands', port: 'drop' } },
      { id: 'b6', from: { node: 'blue-store', port: 'count' }, to: { node: 'enough', port: 'a' } },
      { id: 'b7', from: { node: 'need', port: 'value' }, to: { node: 'enough', port: 'b' } },
      { id: 'b8', from: { node: 'enough', port: 'out' }, to: { node: 'end', port: 'win' } },
      { id: 'b9', from: { node: 'red-store', port: 'inside' }, to: { node: 'end', port: 'lose' } },
    ],
  },
  shownPorts: {
    floor: { in: [], out: [] },
    'store-mark': { in: [], out: [] },
    'pad-1': { in: [], out: [] },
    'pad-2': { in: [], out: [] },
    'pad-3': { in: [], out: [] },
    'pad-4': { in: [], out: [] },
    'pad-5': { in: [], out: [] },
    'pad-6': { in: [], out: [] },
    'crate-1': { in: [], out: [] },
    'crate-2': { in: [], out: [] },
    'crate-3': { in: [], out: [] },
    'crate-4': { in: [], out: [] },
    'crate-5': { in: [], out: [] },
    'crate-6': { in: [], out: [] },
    brain: { in: [], out: [] },
    'drop-zone': { in: [], out: [] },
    'blue-store': { in: [], out: [] },
    'red-store': { in: [], out: [] },
    need: { out: [] },
    enough: { in: [], out: [] },
    cam: { in: [], out: [] },
    end: { in: [] },
    robot: { in: [], out: ['self'] },
    hands: { in: ['grab'], out: ['holding'] },
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
      { id: 'sw5', from: { node: 's-and', port: 'out' }, to: { node: 'hands', port: 'grab' } },
    ],
  },
};
