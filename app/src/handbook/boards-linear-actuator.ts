import { build, type NodeSpec, type WireSpec } from './boards-robot-arm';
import type { Board } from '../engine/types';

/**
 * The world of the piston pages and lesson: a platform whose top is the ground level (y = 0) and ends at x = 4.7, with a
 * lower floor 3 m below. A crate waits on the platform at x = 4. A piston with the default settings sits at the origin,
 * pushes along +x, and at full stroke (2 m) its head front is at x = 4.8, so the crate ends up beyond the edge and falls.
 */
export function pushScene(crateKg: number): NodeSpec[] {
  return [
    { alias: 'platform', kind: 'block', x: 20, y: 20, params: { position: { x: 0.85, y: -0.5, z: 0 }, size: { x: 7.7, y: 1, z: 3 }, color: '#78716c' } },
    { alias: 'ground', kind: 'block', x: 20, y: 200, params: { position: { x: 0, y: -3.5, z: 0 }, size: { x: 30, y: 1, z: 10 }, color: '#65a30d' } },
    { alias: 'crate', kind: 'item', x: 300, y: 330, params: { shape: 'crate', position: { x: 4, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#a16207', mass: crateKg } },
    { alias: 'zone', kind: 'zone', x: 300, y: 20, params: { center: { x: 4, y: 0.3, z: 0 }, size: { x: 1.6, y: 1.6, z: 1.6 }, filter: 'item' } },
    { alias: 'latch', kind: 'latch', x: 580, y: 20 },
  ];
}

/** The wires that tell the piston to push when a crate arrives, and to stop pushing once it is fully out. */
export const PUSH_TRIGGER_WIRES: WireSpec[] = [
  ['zone', 'entered', 'latch', 'set'],
  ['latch', 'on', 'piston', 'extend'],
  ['piston', 'extended', 'latch', 'reset'],
];

export const tryLinearActuator = (): Board =>
  build(
    'Xi lanh đẩy',
    'Bấm Chạy: vùng kích hoạt thấy thùng 10 kg trên bệ, xi lanh đẩy thùng rơi khỏi mép. Cần lực 0,5 × 10 × 9,81 = 49 N, xi lanh có tới 100 N. Chọn thùng, đổi "Khối lượng" thành 30 kg rồi chạy lại: cần 147 N, lớn hơn 100 N nên xi lanh đứng lại và hiện "Quá tải". Chọn xi lanh, nâng "Lực đẩy tối đa" lên 150 thì đẩy được. Gỡ dây nối vào "Đẩy ra" thì xi lanh nằm im.',
    [
      ...pushScene(10),
      { alias: 'piston', kind: 'linear-actuator', x: 860, y: 20 },
      { alias: 'force', kind: 'show-number', x: 860, y: 340, params: { label: 'Lực đang đẩy (N)', corner: 'top-left' } },
      { alias: 'over', kind: 'show-text', x: 580, y: 340, params: { text: 'Quá tải!', corner: 'top-right', color: '#ef4444' } },
    ],
    [...PUSH_TRIGGER_WIRES, ['piston', 'force', 'force', 'value'], ['piston', 'overloaded', 'over', 'show']],
    '3d',
  );
