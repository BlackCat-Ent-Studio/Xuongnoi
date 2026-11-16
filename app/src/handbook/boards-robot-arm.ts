import { createNode } from '../editor/editor-state';
import { migrateBoardWireRule } from '../editor/graph/wire-rule-migration';
import { addWire } from '../engine/wiring';
import type { Board, Graph, Note, Params } from '../engine/types';

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

function build(label: string, note: string, nodes: NodeSpec[], wires: WireSpec[]): Board {
  let graph: Graph = { nodes: [], wires: [] };
  const ids = new Map<string, string>();
  for (const spec of nodes) {
    const node = createNode(graph, spec.kind, { x: spec.x, y: spec.y });
    if (!node) throw new Error(`Unknown node kind in handbook board: ${spec.kind}`);
    node.params = { ...node.params, ...spec.params };
    ids.set(spec.alias, node.id);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  for (const [fa, fp, ta, tp] of wires) {
    const from = ids.get(fa);
    const to = ids.get(ta);
    if (!from || !to) throw new Error(`Unknown alias in handbook wire: ${fa} -> ${ta}`);
    const res = addWire(graph, { node: from, port: fp }, { node: to, port: tp });
    if (!('nodes' in res)) throw new Error(`Cannot wire ${fa}.${fp} -> ${ta}.${tp}: ${res.reason}`);
    graph = res;
  }
  const notes: Note[] = [{ id: 'note-1', text: note, color: 'yellow', pos: { x: 20, y: 860 }, size: { w: 340, h: 190 } }];
  return migrateBoardWireRule({ name: `Thử: ${label}`, mode: '2d-side', graph, notes });
}

const text = (alias: string, x: number, y: number, t: string, corner = 'top-right'): NodeSpec => ({
  alias,
  kind: 'show-text',
  x,
  y,
  params: { text: t, corner, color: '#ef4444' },
});

/** A pillar with a small cap block on top: the arm is mounted on the cap, which sits exactly on the pivot. */
const PILLAR: NodeSpec[] = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'pillar', kind: 'block', x: 20, y: 200, params: { position: { x: -2, y: 0.5, z: 0 }, size: { x: 0.6, y: 1, z: 1 }, color: '#a3a3a3' } },
  { alias: 'cap', kind: 'block', x: 20, y: 360, params: { position: { x: -2, y: 1.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#78716c' } },
];

/** Up / Down arrows set the shoulder angle; "Khi bắt đầu" powers the servo. */
const SHOULDER_CONTROL: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 300, y: 20 },
  { alias: 'scale', kind: 'map-range', x: 300, y: 200, params: { inMin: -1, inMax: 1, outMin: -60, outMax: 60, clamp: 'yes' } },
  { alias: 'go', kind: 'on-start', x: 300, y: 380 },
];
const SHOULDER_WIRES: WireSpec[] = [
  ['stick', 'y', 'scale', 'value'],
  ['scale', 'value', 'shoulder', 'angle'],
  ['go', 'started', 'shoulder', 'power'],
  ['cap', 'self', 'shoulder', 'base'],
];

export const tryJoint = (): Board =>
  build(
    'Khớp xoay (Servo)',
    'Bấm Chơi, rồi bấm mũi tên lên / xuống: khớp quay theo góc đặt. Thanh nặng 8 kg, trọng tâm cách khớp 0,5 m cần 8 × 9,81 × 0,5 = 39 N·m, hơn mô-men tối đa 30 của khớp, nên khi thanh gần nằm ngang chữ "Quá tải" hiện lên và thanh sụp dần. Chọn khớp, tăng "Mô-men tối đa" lên 50 để nâng nổi.',
    [
      ...PILLAR,
      ...SHOULDER_CONTROL,
      { alias: 'shoulder', kind: 'joint', x: 600, y: 20, params: { start: 0, min: -60, max: 60, maxTorque: 30 } },
      { alias: 'arm', kind: 'link', x: 880, y: 20, params: { length: 1, mass: 8 } },
      { alias: 'load', kind: 'show-number', x: 600, y: 300, params: { label: 'Mô-men đang chịu (N·m)', corner: 'top-left' } },
      text('over', 880, 300, 'Quá tải!'),
    ],
    [...SHOULDER_WIRES, ['shoulder', 'tip', 'arm', 'base'], ['shoulder', 'load', 'load', 'value'], ['shoulder', 'overloaded', 'over', 'show']],
  );

export const tryLink = (): Board =>
  build(
    'Thanh nối',
    'Bấm Chơi, rồi bấm mũi tên lên / xuống. Thanh nối chỉ đi theo khớp: đầu kia là "Đầu thanh", nơi gắn thanh khác hoặc tay kẹp. Chọn thanh, đổi "Chiều dài" hoặc "Khối lượng" rồi chơi lại: thanh càng dài và nặng thì số Mô-men đang chịu càng lớn.',
    [
      ...PILLAR,
      ...SHOULDER_CONTROL,
      { alias: 'shoulder', kind: 'joint', x: 600, y: 20, params: { start: 0, min: -60, max: 60, maxTorque: 50 } },
      { alias: 'arm', kind: 'link', x: 880, y: 20, params: { length: 1.5, mass: 2 } },
      { alias: 'load', kind: 'show-number', x: 600, y: 300, params: { label: 'Mô-men đang chịu (N·m)', corner: 'top-left' } },
    ],
    [...SHOULDER_WIRES, ['shoulder', 'tip', 'arm', 'base'], ['shoulder', 'load', 'load', 'value']],
  );

export const tryGripper = (): Board =>
  build(
    'Tay kẹp',
    'Bấm Chơi. Mũi tên xuống hạ tay tới thùng 5 kg, giữ phím Cách để kẹp, rồi mũi tên lên để nhấc. Lực 20 N mỗi ngón không đủ (cần 5 × 9,81 ÷ (2 × 0,5) = 49 N): thùng tuột. Chọn tay kẹp, đặt "Lực kẹp mặc định" 50 rồi chơi lại thì giữ được.',
    [
      ...PILLAR,
      { alias: 'table', kind: 'block', x: 20, y: 520, params: { position: { x: -0.7, y: 0.3, z: 0 }, size: { x: 1.4, y: 0.6, z: 1 }, color: '#78716c' } },
      { alias: 'crate', kind: 'item', x: 20, y: 680, params: { shape: 'crate', position: { x: -0.7, y: 0.9, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#a16207', mass: 5 } },
      { alias: 'stick', kind: 'stick', x: 300, y: 20 },
      { alias: 'scale', kind: 'map-range', x: 300, y: 200, params: { inMin: -1, inMax: 1, outMin: -20, outMax: 40, clamp: 'yes' } },
      { alias: 'go', kind: 'on-start', x: 300, y: 380 },
      { alias: 'key', kind: 'key', x: 300, y: 520, params: { key: 'Space' } },
      { alias: 'shoulder', kind: 'joint', x: 600, y: 20, params: { start: 0, min: -60, max: 60, maxTorque: 200 } },
      { alias: 'arm', kind: 'link', x: 880, y: 20, params: { length: 1, mass: 1 } },
      { alias: 'grip', kind: 'gripper', x: 1160, y: 20, params: { defaultForce: 20 } },
      { alias: 'force', kind: 'show-number', x: 1160, y: 300, params: { label: 'Lực kẹp mỗi ngón (N)', corner: 'top-left' } },
      { alias: 'slipLatch', kind: 'latch', x: 600, y: 520 },
      text('slip', 1160, 480, 'Vật tuột!'),
    ],
    [
      ...SHOULDER_WIRES,
      ['shoulder', 'tip', 'arm', 'base'],
      ['arm', 'tip', 'grip', 'base'],
      ['key', 'held', 'grip', 'close'],
      ['grip', 'gripForce', 'force', 'value'],
      ['grip', 'slipped', 'slipLatch', 'set'],
      ['key', 'pressed', 'slipLatch', 'reset'],
      ['slipLatch', 'on', 'slip', 'show'],
    ],
  );
