import type { GraphNode, Wire } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { SLOT_SIZE, slotCentres, slotMarkNodes, type StoreSlotsDef } from '../store-slots';
import { handReach } from '../world-options';

/**
 * The store pad has three marked slots in a row, filled far end first. The three crates lie far apart on the floor
 * (top, middle, bottom of the west side); the robot fetches them one by one into the next empty slot.
 * `pickup` is only the middle of the crate field.
 */
const STORE: StoreSlotsDef = { pickup: { x: -8, y: 0.5, z: 0 }, first: { x: 10.3, z: 0 }, step: { x: -1.8, z: 0 }, count: 3 };
const CRATE_SIZE = { x: 0.6, y: 0.6, z: 0.6 };
/**
 * The robot stops this far from its goal: clear of a crate's body (robot box 0.65 + crate 0.3 = 0.95) and inside the
 * hands' reach, and exactly where a crate in its hands lands in the middle of a slot.
 */
const STOP = Math.round(handReach(CRATE_SIZE) * 100) / 100;
/** Seconds the robot stands still before it reports "Đã đến", so it never grabs or lets go on the move. */
const SETTLE = 0.3;

let sceneryIndex = 0;
/** Scenery is never drawn, so it only needs a spot of its own: a strip below the board holds them all in rows. */
const nextScenery = (): { x: number; y: number } => {
  const i = sceneryIndex++;
  return { x: 20 + (i % 5) * 190, y: 640 + Math.floor(i / 5) * 44 };
};
const scenery = (id: string, kind: string, params: GraphNode['params']): GraphNode => ({ id, kind, params, pos: nextScenery() });
const wire = (id: string, from: [string, string], to: [string, string]): Wire => ({ id, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] } });

/** Pieces the player takes from the tray, ready set up for this level (walk up to the goal and stand still; "Nhấc lên" and "Thả" are two separate inputs). */
const GO_TO_PARAMS: GraphNode['params'] = { stopDistance: STOP, slowRadius: 3, settle: SETTLE, pathfind: 'off' };
const CARRY_PARAMS: GraphNode['params'] = { mode: 'separate' };

/**
 * Level 5 (du-ba-thung): the first 3D level. Three crates lie scattered on the floor and the legs robot must set
 * each one in its own slot of the store. The player builds the whole circuit from four pieces: "Tìm đồ gần nhất"
 * picks the nearest loose crate (not those already in a slot), "Ô trống kế tiếp" picks the slot to fill, "Di chuyển"
 * walks to the crate and then (second goal) to the slot, and "Khiêng đồ" lifts on one input and puts down on another.
 *
 * On the board only the robot and the three slot marks are drawn. The floor, store mark, crates, the slot zones that
 * decide the win, the win/lose rule and the camera are scenery (not drawn).
 */
export const level05: PuzzleLevel = {
  id: 'du-ba-thung',
  order: 5,
  title: 'Đủ ba thùng',
  task: 'Ba thùng nằm rải rác trên sàn. Hãy nối mạch để rô-bốt chân tự nhặt từng thùng và cất vào kho, mỗi thùng một ô. Đủ ba ô có thùng là thắng!',
  hint: '"Tìm đồ gần nhất" chọn thùng (Ô kho 1, 2, 3 báo thùng nào cất rồi), nối vào "Điểm đến" của "Di chuyển". "Ô trống kế tiếp" chọn ô cất, nối vào "Điểm đến 2". Khiêng xong ("Đang khiêng") thì bật "Dùng điểm đến 2". Tới nơi ("Đã đến") thì "Khiêng đồ" nhấc hoặc thả.',
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
      // Locked and not drawn: it switches the fixed camera on, since nothing acts without a wire.
      scenery('start', 'on-start', {}),
      // The win asks for a crate resting in each of the three slots (so one slot cannot be piled up).
      ...slotCentres(STORE).map((c, i) =>
        scenery(`slot-zone-${i + 1}`, 'zone', { center: { x: c.x, y: 0.5, z: c.z }, size: { x: SLOT_SIZE, y: 3, z: SLOT_SIZE }, filter: 'item', rule: 'center', color: '#22c55e' }),
      ),
      scenery('slots-12', 'and', {}),
      scenery('slots-all', 'and', {}),
      scenery('end', 'win-lose', { winMessage: 'Ba thùng đã nằm gọn trong kho!' }),
      // The two things the player wires to: the robot and the store slot marks, in a column on the left.
      { id: 'robot', kind: 'character', params: { name: 'Rô-bốt chân', position: { x: 8, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, pos: { x: 10, y: 10 } },
      ...slotMarkNodes(STORE, (i) => ({ x: 10, y: 128 + i * 80 })),
    ],
    wires: [
      wire('b1', ['slot-zone-1', 'inside'], ['slots-12', 'a']),
      wire('b2', ['slot-zone-2', 'inside'], ['slots-12', 'b']),
      wire('b3', ['slots-12', 'out'], ['slots-all', 'a']),
      wire('b4', ['slot-zone-3', 'inside'], ['slots-all', 'b']),
      wire('b5', ['slots-all', 'out'], ['end', 'win']),
      wire('b6', ['start', 'started'], ['cam', 'on']),
    ],
  },
  shownPorts: {
    ...Object.fromEntries(
      ['floor', 'store-pad', 'crate-1', 'crate-2', 'crate-3', 'cam', 'start', 'slots-12', 'slots-all', 'end', ...[1, 2, 3].map((n) => `slot-zone-${n}`)].map((id) => [id, { in: [], out: [] }]),
    ),
    robot: { in: ['moveX', 'moveY'], out: ['self'] },
    'slot-1': { in: [], out: ['self'] },
    'slot-2': { in: [], out: ['self'] },
    'slot-3': { in: [], out: ['self'] },
  },
  tray: [
    { kind: 'nearest-item', count: 1 },
    { kind: 'go-to', count: 1, params: GO_TO_PARAMS },
    { kind: 'next-free-slot', count: 1 },
    { kind: 'carry', count: 1, params: CARRY_PARAMS },
    { kind: 'on-start', count: 1 },
    // Spare piece: nothing in the circuit needs gathering two signals, so "Hoặc" only looks useful. (Not "Đảo ngược": left alone it gives a steady "bật", the same as "Khi bắt đầu".)
    { kind: 'or', count: 1 },
  ],
  par: 5,
  freeHints: 8,
  timeLimit: 90,
  solution: {
    nodes: [
      { id: 's-find', kind: 'nearest-item', params: {}, pos: { x: 260, y: 20 } },
      { id: 's-go', kind: 'go-to', params: GO_TO_PARAMS, pos: { x: 480, y: 120 } },
      { id: 's-next', kind: 'next-free-slot', params: {}, pos: { x: 260, y: 300 } },
      { id: 's-hands', kind: 'carry', params: CARRY_PARAMS, pos: { x: 480, y: 400 } },
      { id: 's-start', kind: 'on-start', params: {}, pos: { x: 260, y: 480 } },
    ],
    wires: [
      wire('sw1', ['robot', 'self'], ['s-find', 'who']),
      wire('sw2', ['slot-1', 'self'], ['s-find', 'i1']),
      wire('sw3', ['slot-2', 'self'], ['s-find', 'i2']),
      wire('sw4', ['slot-3', 'self'], ['s-find', 'i3']),
      wire('sw5', ['s-find', 'item'], ['s-go', 'target']),
      wire('sw6', ['robot', 'self'], ['s-go', 'self']),
      wire('sw7', ['slot-1', 'self'], ['s-next', 's1']),
      wire('sw8', ['slot-2', 'self'], ['s-next', 's2']),
      wire('sw9', ['slot-3', 'self'], ['s-next', 's3']),
      wire('sw10', ['s-next', 'slot'], ['s-go', 'target2']),
      wire('sw11', ['robot', 'self'], ['s-hands', 'character']),
      wire('sw12', ['s-hands', 'holding'], ['s-go', 'useTarget2']),
      wire('sw13', ['s-go', 'arrivedAt1'], ['s-hands', 'grab']),
      wire('sw16', ['s-go', 'arrivedAt2'], ['s-hands', 'drop']),
      wire('sw17', ['s-start', 'started'], ['s-go', 'go']),
      wire('sw14', ['s-go', 'moveX'], ['robot', 'moveX']),
      wire('sw15', ['s-go', 'moveY'], ['robot', 'moveY']),
    ],
  },
};
