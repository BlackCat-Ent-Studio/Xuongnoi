import type { NodeDef, ParamDef } from '../engine/types';
import { asNum, numParam, strParam } from './util';

export const TABLE_MAX_ROWS = 12;
const MIN_ROWS = 2;
const DEFAULT_ROWS = 3;

/** Row count as the node uses it: rounded and kept within 2..12. */
export function tableRowCount(raw: number): number {
  return Math.min(TABLE_MAX_ROWS, Math.max(MIN_ROWS, Math.round(raw)));
}

const rowParams: ParamDef[] = Array.from({ length: TABLE_MAX_ROWS }, (_, k) => ({
  id: `v${k + 1}`,
  label: `Giá trị ${k + 1}`,
  kind: 'number' as const,
  default: 0,
  step: 1,
}));

export const valueTableNode: NodeDef<undefined> = {
  kind: 'value-table',
  label: 'Bảng giá trị',
  category: 'math',
  description:
    'Một bảng có nhiều hàng, mỗi hàng chứa một con số do bạn nhập. "Số thứ tự" (làm tròn, tính từ 1) chọn hàng nào được đọc ra. Chỉ các hàng từ 1 tới "Số hàng" được dùng. Ví dụ nối "Bước hiện tại" của Chuỗi bước vào để mỗi bước có một góc riêng.',
  inputs: [{ id: 'index', type: 'number', label: 'Số thứ tự' }],
  outputs: [{ id: 'value', type: 'number', label: 'Giá trị' }],
  params: [
    { id: 'rows', label: 'Số hàng (2-12)', kind: 'number', default: DEFAULT_ROWS, min: MIN_ROWS, max: TABLE_MAX_ROWS, step: 1 },
    ...rowParams,
    {
      id: 'outside',
      label: 'Số thứ tự ngoài bảng thì',
      kind: 'select',
      default: 'hold',
      options: [
        { value: 'hold', label: 'Lấy hàng gần nhất' },
        { value: 'zero', label: 'Ra 0' },
      ],
    },
  ],
  evaluate(_ctx, i, params) {
    const rows = tableRowCount(numParam(params, 'rows', DEFAULT_ROWS));
    const n = Math.round(asNum(i.index));
    if (n < 1 || n > rows) {
      if (strParam(params, 'outside', 'hold') === 'zero') return { value: 0 };
    }
    const row = Math.min(rows, Math.max(1, n));
    return { value: numParam(params, `v${row}`, 0) };
  },
};
