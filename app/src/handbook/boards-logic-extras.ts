import type { Board } from '../engine/types';
import { build, v, type Spec, type Wire } from './boards-math-object-output';

/** "Thử ngay" boards for the general logic pieces: bool to number, lookup table and angle difference. */

function floor(): Spec {
  return { id: 'floor', kind: 'block', col: 1, row: 3, params: { position: v(0, -0.5), size: v(24, 1, 1), color: '#65a30d' } };
}

function tryBoolToNumber(): Board {
  const specs: Spec[] = [
    { id: 'key', kind: 'key', col: 0, row: 0, params: { key: 'Space' } },
    { id: 'convert', kind: 'bool-to-number', col: 1, row: 0, params: { whenOn: 1, whenOff: 0 } },
    { id: 'character', kind: 'character', col: 2, row: 0, params: { position: v(-6, 1) } },
    { id: 'show', kind: 'show-number', col: 2, row: 1, params: { label: 'Số ra' } },
    floor(),
  ];
  const wires: Wire[] = [
    ['key', 'held', 'convert', 'on'],
    ['convert', 'value', 'character', 'moveX'],
    ['convert', 'value', 'show', 'value'],
  ];
  return build(
    'Thử: Đổi thành số',
    '2d-side',
    'Giữ phím Space: "Bật/tắt" bật nên ra "Số khi bật" = 1, nhân vật đi sang phải. Thả phím thì ra 0 và đứng yên. Thử đổi "Số khi tắt" thành -1 để nhân vật lùi khi thả phím.',
    specs,
    wires,
  );
}

function tryValueTable(): Board {
  const specs: Spec[] = [
    { id: 'start', kind: 'on-start', col: 0, row: 0 },
    { id: 'clock', kind: 'timer', col: 0, row: 1, params: { seconds: 5, repeat: 'yes' } },
    { id: 'seq', kind: 'sequence', col: 1, row: 0, params: { stepCount: 3, loop: 'yes' } },
    { id: 'table', kind: 'value-table', col: 2, row: 0, params: { rows: 3, v1: -5, v2: 0, v3: 5 } },
    { id: 'pid', kind: 'pid', col: 3, row: 0, params: { kp: 0.8, ki: 0, kd: 0, outMin: -1, outMax: 1 } },
    { id: 'robot', kind: 'character', col: 3, row: 1, params: { position: v(-5, 1), look: 'robot', speed: 4 } },
    { id: 'show', kind: 'show-number', col: 2, row: 1, params: { label: 'Vị trí đặt' } },
    floor(),
  ];
  const wires: Wire[] = [
    ['start', 'started', 'clock', 'run'],
    ['clock', 'done', 'seq', 'next'],
    ['seq', 'index', 'table', 'index'],
    ['table', 'value', 'pid', 'target'],
    ['table', 'value', 'show', 'value'],
    ['robot', 'x', 'pid', 'measured'],
    ['pid', 'out', 'robot', 'moveX'],
  ];
  return build(
    'Thử: Bảng giá trị',
    '2d-side',
    'Cứ 5 giây Chuỗi bước sang bước kế. "Bước hiện tại" (1, 2, 3) chọn hàng của Bảng giá trị: -5, 0, 5. Rô-bốt đi tới vị trí của hàng đó rồi chờ. Sửa "Giá trị 1..3" để đổi nơi rô-bốt dừng.',
    specs,
    wires,
  );
}

function tryAngleDiff(): Board {
  const specs: Spec[] = [
    { id: 'a', kind: 'const', col: 0, row: 0, params: { value: 350 } },
    { id: 'b', kind: 'const', col: 0, row: 1, params: { value: 10 } },
    { id: 'diff', kind: 'angle-diff', col: 1, row: 0 },
    { id: 'show', kind: 'show-number', col: 2, row: 0, params: { label: 'Chênh lệch góc' } },
    { id: 'character', kind: 'character', col: 2, row: 1, params: { position: v(0, 1) } },
    floor(),
  ];
  const wires: Wire[] = [
    ['a', 'value', 'diff', 'a'],
    ['b', 'value', 'diff', 'b'],
    ['diff', 'diff', 'show', 'value'],
  ];
  return build(
    'Thử: Chênh lệch góc',
    '2d-side',
    'Góc A = 350 độ, góc B = 10 độ. Hiệu thường là 340 nhưng hướng quay ngắn nhất là -20 độ, và mảnh ghép ra -20. Sửa hai số cố định để thử các góc khác.',
    specs,
    wires,
  );
}

export const TRY_BOARDS_LOGIC_EXTRAS = {
  'bool-to-number': tryBoolToNumber,
  'value-table': tryValueTable,
  'angle-diff': tryAngleDiff,
};
