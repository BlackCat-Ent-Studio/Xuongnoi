import type { NodeDef } from '../engine/types';
import { asNum, strParam } from './util';

const EPS = 1e-9;

export const compareNode: NodeDef<null> = {
  kind: 'compare',
  label: 'So sánh',
  category: 'logic',
  description: 'So sánh hai số và bật khi điều kiện đúng, ví dụ "A lớn hơn B".',
  inputs: [
    { id: 'a', type: 'number', label: 'Số A' },
    { id: 'b', type: 'number', label: 'Số B' },
  ],
  outputs: [{ id: 'out', type: 'bool', label: 'Kết quả' }],
  params: [
    {
      id: 'op',
      label: 'Kiểu so sánh',
      kind: 'select',
      default: 'ge',
      options: [
        { value: 'lt', label: '< nhỏ hơn' },
        { value: 'le', label: '≤ nhỏ hơn hoặc bằng' },
        { value: 'eq', label: '= bằng' },
        { value: 'ne', label: '≠ khác' },
        { value: 'ge', label: '≥ lớn hơn hoặc bằng' },
        { value: 'gt', label: '> lớn hơn' },
      ],
    },
  ],
  evaluate(_ctx, i, params) {
    const a = asNum(i.a);
    const b = asNum(i.b);
    let out: boolean;
    switch (strParam(params, 'op', 'ge')) {
      case 'lt':
        out = a < b;
        break;
      case 'le':
        out = a <= b;
        break;
      case 'eq':
        out = Math.abs(a - b) < EPS;
        break;
      case 'ne':
        out = Math.abs(a - b) >= EPS;
        break;
      case 'gt':
        out = a > b;
        break;
      default:
        out = a >= b;
    }
    return { out };
  },
};
