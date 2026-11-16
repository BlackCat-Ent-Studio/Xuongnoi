import type { Board, GraphNode, Note, Params, Wire } from '../engine/types';

/**
 * Sample game "Tay máy gắp thùng": a two-joint arm on a pillar picks up crates from a table.
 * Built only from general pieces: keys and counters decide the angles and the grip force, the arm pieces do the physics.
 * Plain data (no registry lookups), so the sample list can build it before any node is registered.
 */

type Spec = { id: string; kind: string; x: number; y: number; params?: Params };
type Link = [fromNode: string, fromPort: string, toNode: string, toPort: string];

/** Numbers the notes on the board quote. */
export const ARM_SETTINGS = {
  shoulderTorque: 120,
  elbowTorque: 130,
  maxGrip: 120,
};

const COL = 300;
const ROW = 170;

function nodes(): Spec[] {
  const at = (c: number, r: number): { x: number; y: number } => ({ x: 20 + c * COL, y: 20 + r * ROW });
  return [
    // --- the world ---
    { id: 'floor', kind: 'block', ...at(0, 0), params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
    { id: 'pillar', kind: 'block', ...at(0, 1), params: { position: { x: -1.8, y: 0.8, z: 0 }, size: { x: 0.6, y: 1.6, z: 1 }, color: '#a3a3a3' } },
    { id: 'table', kind: 'block', ...at(0, 2), params: { position: { x: 0.6, y: 0.3, z: 0 }, size: { x: 2.6, y: 0.6, z: 1 }, color: '#78716c' } },
    { id: 'crate-light', kind: 'item', ...at(0, 3), params: { shape: 'box', position: { x: -0.1, y: 0.9, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#a16207', mass: 2 } },
    { id: 'crate-heavy', kind: 'item', ...at(0, 4), params: { shape: 'box', position: { x: 0.7, y: 0.9, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ef4444', mass: 6 } },
    { id: 'crate-fragile', kind: 'item', ...at(0, 5), params: { shape: 'box', position: { x: 1.5, y: 0.9, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#facc15', mass: 2, crushLimit: 60 } },

    // --- the arm ---
    { id: 'go', kind: 'on-start', ...at(1, 0) },
    {
      id: 'shoulder',
      kind: 'joint',
      ...at(2, 1),
      params: { axis: 'pitch', start: 50, min: -60, max: 90, maxTorque: ARM_SETTINGS.shoulderTorque, maxSpeed: 60, mount: { x: 0, y: 0.8, z: 0 } },
    },
    { id: 'upper', kind: 'link', ...at(3, 1), params: { length: 1.8, mass: 1.2, thickness: 0.22 } },
    { id: 'elbow', kind: 'joint', ...at(4, 1), params: { axis: 'pitch', start: -90, min: -150, max: 30, maxTorque: ARM_SETTINGS.elbowTorque, maxSpeed: 60 } },
    { id: 'fore', kind: 'link', ...at(5, 1), params: { length: 1.4, mass: 0.9, thickness: 0.18 } },
    { id: 'gripper', kind: 'gripper', ...at(6, 1), params: { defaultForce: 10, maxForce: ARM_SETTINGS.maxGrip, fingerMu: 0.8, width: 1, reach: 0.5, mass: 0.5 } },

    // --- shoulder control: W raises, S lowers (10 degrees a press) ---
    { id: 'key-w', kind: 'key', ...at(1, 2), params: { key: 'KeyW' } },
    { id: 'key-s', kind: 'key', ...at(1, 3), params: { key: 'KeyS' } },
    { id: 'count-shoulder', kind: 'counter', ...at(2, 2), params: { start: 8 } },
    { id: 'scale-shoulder', kind: 'map-range', ...at(3, 2), params: { inMin: 0, inMax: 12, outMin: -30, outMax: 90, clamp: 'yes' } },

    // --- elbow control: D opens the elbow, A bends it (15 degrees a press) ---
    { id: 'key-d', kind: 'key', ...at(1, 4), params: { key: 'KeyD' } },
    { id: 'key-a', kind: 'key', ...at(1, 5), params: { key: 'KeyA' } },
    { id: 'count-elbow', kind: 'counter', ...at(2, 4), params: { start: 4 } },
    { id: 'scale-elbow', kind: 'map-range', ...at(3, 4), params: { inMin: 0, inMax: 12, outMin: -150, outMax: 30, clamp: 'yes' } },

    // --- gripper control: Space holds it closed, Up / Down set the force (10 N a press) ---
    { id: 'key-close', kind: 'key', ...at(4, 2), params: { key: 'Space' } },
    { id: 'key-up', kind: 'key', ...at(4, 3), params: { key: 'ArrowUp' } },
    { id: 'key-down', kind: 'key', ...at(4, 4), params: { key: 'ArrowDown' } },
    { id: 'count-force', kind: 'counter', ...at(5, 3), params: { start: 1 } },
    { id: 'scale-force', kind: 'map-range', ...at(6, 3), params: { inMin: 0, inMax: 12, outMin: 0, outMax: ARM_SETTINGS.maxGrip, clamp: 'yes' } },

    // --- readouts ---
    { id: 'show-force', kind: 'show-number', ...at(7, 1), params: { label: 'Lực kẹp mỗi ngón (N)', corner: 'top-left' } },
    { id: 'show-shoulder', kind: 'show-number', ...at(7, 2), params: { label: 'Mô-men vai (N·m)', corner: 'top-left' } },
    { id: 'show-elbow', kind: 'show-number', ...at(7, 3), params: { label: 'Mô-men khuỷu (N·m)', corner: 'top-left' } },
    { id: 'text-over-shoulder', kind: 'show-text', ...at(7, 4), params: { text: 'Vai quá tải: tay không nâng nổi!', corner: 'top-right', color: '#ef4444' } },
    { id: 'text-over-elbow', kind: 'show-text', ...at(7, 5), params: { text: 'Khuỷu quá tải: tay không nâng nổi!', corner: 'top-right', color: '#ef4444' } },
    { id: 'latch-slip', kind: 'latch', ...at(6, 4) },
    { id: 'text-slip', kind: 'show-text', ...at(7, 6), params: { text: 'Vật tuột! Tăng lực kẹp rồi kẹp lại.', corner: 'top-right', color: '#f59e0b' } },
    { id: 'latch-crush', kind: 'latch', ...at(6, 5) },
    { id: 'text-crush', kind: 'show-text', ...at(7, 7), params: { text: 'Vật bị hỏng vì kẹp quá mạnh!', corner: 'top-right', color: '#ef4444' } },
  ];
}

/** Every wire of the board. The arm pieces are linked only by the wires below: nothing is hidden inside a piece. */
export const ROBOT_ARM_WIRES: readonly Link[] = [
  // The arm: base -> joint -> link -> joint -> link -> gripper
  ['pillar', 'self', 'shoulder', 'base'],
  ['shoulder', 'tip', 'upper', 'base'],
  ['upper', 'tip', 'elbow', 'base'],
  ['elbow', 'tip', 'fore', 'base'],
  ['fore', 'tip', 'gripper', 'base'],
  // Power for both servos
  ['go', 'started', 'shoulder', 'power'],
  ['go', 'started', 'elbow', 'power'],
  // Shoulder: keys -> counter -> scale -> angle
  ['key-w', 'pressed', 'count-shoulder', 'up'],
  ['key-s', 'pressed', 'count-shoulder', 'down'],
  ['count-shoulder', 'value', 'scale-shoulder', 'value'],
  ['scale-shoulder', 'value', 'shoulder', 'angle'],
  // Elbow
  ['key-d', 'pressed', 'count-elbow', 'up'],
  ['key-a', 'pressed', 'count-elbow', 'down'],
  ['count-elbow', 'value', 'scale-elbow', 'value'],
  ['scale-elbow', 'value', 'elbow', 'angle'],
  // Gripper
  ['key-close', 'held', 'gripper', 'close'],
  ['key-up', 'pressed', 'count-force', 'up'],
  ['key-down', 'pressed', 'count-force', 'down'],
  ['count-force', 'value', 'scale-force', 'value'],
  ['scale-force', 'value', 'gripper', 'force'],
  // Readouts
  ['gripper', 'gripForce', 'show-force', 'value'],
  ['shoulder', 'load', 'show-shoulder', 'value'],
  ['elbow', 'load', 'show-elbow', 'value'],
  ['shoulder', 'overloaded', 'text-over-shoulder', 'show'],
  ['elbow', 'overloaded', 'text-over-elbow', 'show'],
  ['gripper', 'slipped', 'latch-slip', 'set'],
  ['key-close', 'pressed', 'latch-slip', 'reset'],
  ['latch-slip', 'on', 'text-slip', 'show'],
  ['gripper', 'crushedOut', 'latch-crush', 'set'],
  ['latch-crush', 'on', 'text-crush', 'show'],
];

const NOTES: Note[] = [
  {
    id: 'note1',
    color: 'yellow',
    pos: { x: 20, y: 1500 },
    size: { w: 320, h: 260 },
    text:
      'Điều khiển (bấm Chơi):\n• W / S: nâng / hạ vai (mỗi lần 10 độ)\n• D / A: mở / gập khuỷu (mỗi lần 15 độ)\n• Cách (giữ): kẹp lại\n• Mũi tên lên / xuống: tăng / giảm lực kẹp (10 N mỗi lần)\nĐưa tay kẹp tới sát một cái thùng rồi giữ phím Cách.',
  },
  {
    id: 'note2',
    color: 'green',
    pos: { x: 360, y: 1500 },
    size: { w: 340, h: 260 },
    text:
      'Thử 1: thùng nâu nặng 2 kg, ma sát 0,5. Kẹp giữ được khi 2 ngón × 0,5 × lực ≥ 2 × 9,81 = 19,6 N, tức mỗi ngón ≥ 19,6 N. Bắt đầu 10 N thì thùng TUỘT; bấm mũi tên lên cho tới khi giữ được rồi nâng vai lên.',
  },
  {
    id: 'note3',
    color: 'pink',
    pos: { x: 740, y: 1500 },
    size: { w: 340, h: 260 },
    text:
      'Thử 2: thùng vàng 2 kg nhưng dễ vỡ (chịu tối đa 60 N). Tổng lực ép = 2 ngón × lực. Quá 30 N mỗi ngón là thùng bị HỎNG (méo, sẫm màu). Cần giữ trong khoảng 19,6 đến 30 N.',
  },
  {
    id: 'note4',
    color: 'blue',
    pos: { x: 1120, y: 1500 },
    size: { w: 360, h: 260 },
    text:
      'Thử 3: thùng đỏ nặng 6 kg cần ≥ 58,9 N mỗi ngón, và vai (tối đa 120 N·m) KHÔNG nâng nổi: hiện "Vai quá tải" rồi tay sụp dần. Chọn mảnh Khớp xoay "vai", mở Thuộc tính, tăng "Mô-men tối đa" lên 250 rồi chơi lại. Mô-men = khối lượng × 9,81 × khoảng cách ngang tới khớp.',
  },
];

/** The sample board. Fresh objects on every call. */
export function createRobotArmBoard(): Board {
  const graphNodes: GraphNode[] = nodes().map((n) => ({ id: n.id, kind: n.kind, params: structuredClone(n.params ?? {}), pos: { x: n.x, y: n.y } }));
  const wires: Wire[] = ROBOT_ARM_WIRES.map(([fn, fp, tn, tp], i) => ({ id: `w${i + 1}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } }));
  return {
    name: 'Tay máy gắp thùng',
    mode: '2d-side',
    graph: { nodes: graphNodes, wires, settings: { wireRule: true } },
    notes: structuredClone(NOTES),
  };
}
