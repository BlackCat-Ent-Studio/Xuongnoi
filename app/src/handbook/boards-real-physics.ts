import type { Board } from '../engine/types';
import { build, v, type Spec, type Wire } from './boards-math-object-output';

/** Ready-wired "Thử ngay" board of the "Vật lý thật" page (the setting itself is saved in the board). */

const NOTE =
  'Hai thùng giống nhau (cao 1,2 m, rộng 0,4 m, nặng 10 kg, μ = 0,5). Bệ bên trái đẩy sát đỉnh (cao 1,1 m) nên thùng đổ; bệ bên phải đẩy sát đất (cao 0,15 m) nên thùng chỉ trượt. Bảng này đã bật "Vật lý thật" (công tắc ở bảng Thuộc tính, khi chưa chọn mảnh ghép nào). Đổi "Khối lượng" hay "Hệ số ma sát" của thùng rồi Chạy lại để so sánh.';

const crate = (id: string, x: number, row: number): Spec => ({
  id,
  kind: 'item',
  col: 1,
  row,
  // A plain box (not the Thùng picture) so the tall shape is what you see.
  params: { position: v(x, 0.6), size: v(0.4, 1.2, 0.4), shape: 'box', color: '#c2813a', carryable: 'no', mass: 10, mu: 0.5 },
});

const pusher = (id: string, y: number, from: number, to: number, row: number): Spec => ({
  id,
  kind: 'moving-platform',
  col: 0,
  row,
  params: { position: v(from, y), to: v(to, y), size: v(0.4, 0.2, 1), speed: 0.6, wait: 0, loop: 'once', color: '#f59e0b' },
});

/** Two identical tall crates: one pushed at the top tips over, one pushed near the floor slides. */
export function tryCrateTipping(): Board {
  const specs: Spec[] = [
    { id: 'floor', kind: 'block', col: 1, row: 3, params: { position: v(0, -0.5), size: v(24, 1, 1), color: '#65a30d' } },
    crate('crate-high', -2, 0),
    crate('crate-low', 6, 1),
    pusher('push-high', 1.1, -4, 3, 0),
    pusher('push-low', 0.15, 4, 11, 1),
  ];
  const wires: Wire[] = [];
  const board = build('Thử: Thùng đổ và thùng trượt', '2d-side', NOTE, specs, wires);
  return { ...board, graph: { ...board.graph, settings: { ...board.graph.settings, realPhysics: true } } };
}
