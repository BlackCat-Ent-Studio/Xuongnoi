import type { GraphNode, Wire } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { slotMarkNodes, type StoreSlotsDef } from '../store-slots';
import { handReach } from '../world-options';

/**
 * The store pad has three marked slots in a row, filled far end first. The three crates lie far apart on the floor
 * (top, middle, bottom of the west side); the robot fetches them one by one into the next empty slot.
 * `pickup` is only the middle of the crate field.
 */
const STORE: StoreSlotsDef = { pickup: { x: -8, y: 0.5, z: 0 }, first: { x: 10.3, z: 0 }, step: { x: -1.8, z: 0 }, count: 3 };
const CRATE_SIZE = { x: 0.6, y: 0.6, z: 0.6 };
/** The robot stops this far from a crate (clear of the crate's body, inside the hands' reach) to pick it up. */
const FETCH_STOP = 1.05;
/** The robot stops this far from a slot, so the crate in its hands lands in the slot's middle. */
const PARK_REACH = Math.round(handReach(CRATE_SIZE) * 100) / 100;
/** Seconds the robot stands still before it grabs or lets go. */
const SETTLE = 0.3;

const wire = (id: string, from: [string, string], to: [string, string]): Wire => ({ id, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] } });

let sceneryIndex = 0;
/** Scenery is never drawn, so it only needs a spot of its own: a strip below the board holds them all in rows. */
const nextScenery = (): { x: number; y: number } => {
  const i = sceneryIndex++;
  return { x: 20 + (i % 5) * 190, y: 640 + Math.floor(i / 5) * 44 };
};
const scenery = (id: string, kind: string, params: GraphNode['params']): GraphNode => ({ id, kind, params, pos: nextScenery() });
const card = (id: string, kind: string, params: GraphNode['params'], x: number, y: number): GraphNode => ({ id, kind, params, pos: { x, y } });

/** Left part of the board, three columns: the robot's whole circuit as locked cards. */
const COL = [6, 184, 362] as const;

/**
 * Level 5 (du-ba-thung): the legs robot shuttles crates into a storage zone; the player counts them.
 *
 * The robot's behaviour is a circuit of ordinary Xưởng Nối pieces, drawn as locked cards on the left: "Tìm vật gần
 * nhất" picks the nearest crate not yet in a slot, "Đi tới" walks up to it, "Khiêng đồ" grabs it, a second "Đi tới"
 * walks it to the "Ô trống kế tiếp", and the hands let go there. The floor, store mark, crates and camera are scenery.
 */
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
      scenery('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 14 }, color: '#94a3b8', type: 'solid' }),
      scenery('store-pad', 'block', { name: 'Kho', position: { x: 8.5, y: 0.01, z: 0 }, size: { x: 5.6, y: 0.02, z: 2 }, color: '#22c55e', type: 'pickup' }),
      // Three crates spread over the west side of the floor, 4.5 apart, nothing between a crate and the store.
      scenery('crate-1', 'item', { name: 'Thùng 1', position: { x: -9, y: 0.3, z: -4.5 }, size: CRATE_SIZE, shape: 'crate', color: '#b45309' }),
      scenery('crate-2', 'item', { name: 'Thùng 2', position: { x: -7.5, y: 0.3, z: 0 }, size: CRATE_SIZE, shape: 'crate', color: '#b45309' }),
      scenery('crate-3', 'item', { name: 'Thùng 3', position: { x: -9, y: 0.3, z: 4.5 }, size: CRATE_SIZE, shape: 'crate', color: '#b45309' }),
      scenery('cam', 'camera', { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'tilted', zoom: 0.9 }),
      // Column 1: the robot, the three slot marks and its hands.
      card('robot', 'character', { name: 'Rô-bốt chân', position: { x: 8, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, COL[0], 4),
      ...slotMarkNodes(STORE, (i) => ({ x: COL[0], y: 120 + i * 64 })),
      card('hands', 'carry', {}, COL[0], 316),
      // Column 2: finds the nearest loose crate and the next free slot, and adds the sideways walk of the two trips.
      card('finder', 'nearest-item', {}, COL[1], 4),
      card('next', 'next-free-slot', {}, COL[1], 228),
      card('sum-x', 'math', { op: 'add' }, COL[1], 374),
      // Column 3: the two trips (to the crate, to the slot) and the forward-backward sum.
      card('fetch', 'go-to', { stopDistance: FETCH_STOP, slowRadius: 3, settle: SETTLE, pathfind: 'off' }, COL[2], 4),
      card('store', 'go-to', { stopDistance: PARK_REACH, slowRadius: 3, settle: SETTLE, pathfind: 'off' }, COL[2], 202),
      card('sum-y', 'math', { op: 'add' }, COL[2], 400),
      // Player's targets on the right.
      { id: 'need', kind: 'const', params: { value: 3 }, pos: { x: 640, y: 20 } },
      { id: 'end', kind: 'win-lose', params: { winMessage: 'Kho đủ ba thùng, cổng mở rồi!' }, pos: { x: 820, y: 20 } },
    ],
    wires: [
      wire('b1', ['robot', 'self'], ['finder', 'who']),
      wire('b2', ['robot', 'self'], ['fetch', 'self']),
      wire('b3', ['robot', 'self'], ['store', 'self']),
      wire('b4', ['robot', 'self'], ['hands', 'character']),
      ...[1, 2, 3].map((n) => wire(`b${4 + n}`, [`slot-${n}`, 'self'], ['next', `s${n}`])),
      ...[1, 2, 3].map((n) => wire(`b${7 + n}`, [`slot-${n}`, 'self'], ['finder', `i${n}`])),
      wire('b11', ['finder', 'item'], ['fetch', 'target']),
      wire('b12', ['finder', 'found'], ['fetch', 'go']),
      wire('b13', ['next', 'slot'], ['store', 'target']),
      wire('b14', ['hands', 'holding'], ['finder', 'pause']),
      wire('b15', ['hands', 'holding'], ['store', 'go']),
      wire('b16', ['fetch', 'moveX'], ['sum-x', 'a']),
      wire('b17', ['store', 'moveX'], ['sum-x', 'b']),
      wire('b18', ['sum-x', 'out'], ['robot', 'moveX']),
      wire('b19', ['fetch', 'moveY'], ['sum-y', 'a']),
      wire('b20', ['store', 'moveY'], ['sum-y', 'b']),
      wire('b21', ['sum-y', 'out'], ['robot', 'moveY']),
      wire('b22', ['fetch', 'arrived'], ['hands', 'grab']),
      wire('b23', ['store', 'arrived'], ['hands', 'drop']),
    ],
  },
  shownPorts: {
    ...Object.fromEntries(['floor', 'store-pad', 'crate-1', 'crate-2', 'crate-3', 'cam'].map((id) => [id, { in: [], out: [] }])),
    robot: { in: ['moveX', 'moveY'], out: ['self'] },
    'slot-1': { in: [], out: ['self'] },
    'slot-2': { in: [], out: ['self'] },
    'slot-3': { in: [], out: ['self'] },
    hands: { in: ['character', 'grab', 'drop'], out: ['holding'] },
    finder: { in: ['who', 'pause', 'i1', 'i2', 'i3'], out: ['item', 'found'] },
    next: { in: ['s1', 's2', 's3'], out: ['slot'] },
    'sum-x': { in: ['a', 'b'], out: ['out'] },
    'sum-y': { in: ['a', 'b'], out: ['out'] },
    fetch: { in: ['self', 'target', 'go'], out: ['moveX', 'moveY', 'arrived'] },
    store: { in: ['self', 'target', 'go'], out: ['moveX', 'moveY', 'arrived'] },
    need: { out: ['value'] },
    end: { in: ['win'] },
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
