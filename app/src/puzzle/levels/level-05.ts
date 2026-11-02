import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { slotBrainParams, slotMarkNodes, type StoreSlotsDef } from '../store-slots';

/**
 * The store pad has three marked slots in a row, filled far end first. The three crates lie far apart on the floor
 * (top, middle, bottom of the west side); the robot fetches them one by one into the next empty slot.
 * `pickup` is only the middle of the crate field (the fetching brain finds the crates itself).
 */
const STORE: StoreSlotsDef = { pickup: { x: -8, y: 0.5, z: 0 }, first: { x: 10.3, z: 0 }, step: { x: -1.8, z: 0 }, count: 3 };
const SLOT_CARDS = [{ x: 620, y: 500 }, { x: 820, y: 500 }, { x: 820, y: 440 }];

/** Level 5 (du-ba-thung): the legs robot shuttles crates into a storage zone; the player counts them. */
export const level05: PuzzleLevel = {
  id: 'du-ba-thung',
  order: 5,
  title: 'Đủ ba thùng',
  task: 'Rô-bốt chân đang chở thùng vào kho. Khi kho có đủ 3 thùng thì mở cổng thắng! Hãy đặt vùng kho để đếm thùng, rồi so sánh với số cần.',
  hint: 'Đặt "Vùng kích hoạt" (nó đã nằm đúng chỗ kho), nối "Số lượng" vào "Số A" của "So sánh". Nối "Số cần" vào "Số B", rồi nối "Đúng" vào "Thắng".',
  mode: '3d',
  cast: [PUZZLE_LOOKS.robotLegs],
  storeSlots: STORE,
  base: {
    nodes: [
      { id: 'floor', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 14 }, color: '#94a3b8', type: 'solid' }, pos: { x: 20, y: 440 } },
      { id: 'store-pad', kind: 'block', params: { name: 'Kho', position: { x: 8.5, y: 0.01, z: 0 }, size: { x: 5.6, y: 0.02, z: 2 }, color: '#22c55e', type: 'pickup' }, pos: { x: 20, y: 500 } },
      ...slotMarkNodes(STORE, (i) => SLOT_CARDS[i]!),
      { id: 'robot', kind: 'character', params: { name: 'Rô-bốt chân', position: { x: 8, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, pos: { x: 20, y: 20 } },
      // Three crates spread over the west side of the floor, 4.5 apart, nothing between a crate and the store.
      { id: 'crate-1', kind: 'item', params: { name: 'Thùng 1', position: { x: -9, y: 0.3, z: -4.5 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' }, pos: { x: 220, y: 440 } },
      { id: 'crate-2', kind: 'item', params: { name: 'Thùng 2', position: { x: -7.5, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' }, pos: { x: 220, y: 500 } },
      { id: 'crate-3', kind: 'item', params: { name: 'Thùng 3', position: { x: -9, y: 0.3, z: 4.5 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color: '#b45309' }, pos: { x: 420, y: 500 } },
      { id: 'brain', kind: 'fetch-store', params: slotBrainParams(STORE, 0.5), pos: { x: 220, y: 20 } },
      { id: 'hands', kind: 'carry', params: { mode: 'toggle' }, pos: { x: 420, y: 20 } },
      { id: 'need', kind: 'const', params: { value: 3 }, pos: { x: 620, y: 20 } },
      { id: 'cam', kind: 'camera', params: { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'tilted', zoom: 0.9 }, pos: { x: 620, y: 440 } },
      { id: 'end', kind: 'win-lose', params: { winMessage: 'Kho đủ ba thùng, cổng mở rồi!' }, pos: { x: 820, y: 20 } },
    ],
    wires: [
      { id: 'b1', from: { node: 'robot', port: 'self' }, to: { node: 'brain', port: 'self' } },
      { id: 'b2', from: { node: 'brain', port: 'moveX' }, to: { node: 'robot', port: 'moveX' } },
      { id: 'b3', from: { node: 'brain', port: 'moveY' }, to: { node: 'robot', port: 'moveY' } },
      { id: 'b4', from: { node: 'robot', port: 'self' }, to: { node: 'hands', port: 'character' } },
      { id: 'b5', from: { node: 'brain', port: 'atEnd' }, to: { node: 'hands', port: 'grab' } },
    ],
  },
  shownPorts: {
    floor: { in: [], out: [] },
    'store-pad': { in: [], out: [] },
    'slot-1': { in: [], out: [] },
    'slot-2': { in: [], out: [] },
    'slot-3': { in: [], out: [] },
    'crate-1': { in: [], out: [] },
    'crate-2': { in: [], out: [] },
    'crate-3': { in: [], out: [] },
    robot: { in: [], out: [] },
    brain: { in: [], out: [] },
    hands: { in: [], out: [] },
    need: { out: ['value'] },
    end: { in: ['win'] },
    cam: { in: [], out: [] },
  },
  tray: [
    { kind: 'zone', count: 1, params: { center: { x: 8.5, y: 1, z: 0 }, size: { x: 5.6, y: 3, z: 2 }, filter: 'item', rule: 'center', color: '#22c55e' } },
    { kind: 'compare', count: 1, params: { op: 'ge' } },
    { kind: 'counter', count: 1 },
  ],
  par: 2,
  freeHints: 2,
  timeLimit: 90,
  solution: {
    nodes: [
      { id: 's-zone', kind: 'zone', params: { center: { x: 8.5, y: 1, z: 0 }, size: { x: 5.6, y: 3, z: 2 }, filter: 'item', rule: 'center', color: '#22c55e' }, pos: { x: 220, y: 200 } },
      { id: 's-cmp', kind: 'compare', params: { op: 'ge' }, pos: { x: 420, y: 200 } },
    ],
    wires: [
      { id: 'sw1', from: { node: 's-zone', port: 'count' }, to: { node: 's-cmp', port: 'a' } },
      { id: 'sw2', from: { node: 'need', port: 'value' }, to: { node: 's-cmp', port: 'b' } },
      { id: 'sw3', from: { node: 's-cmp', port: 'out' }, to: { node: 'end', port: 'win' } },
    ],
  },
};
