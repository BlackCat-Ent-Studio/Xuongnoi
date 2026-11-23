import type { NodeDef } from '../engine/types';
import { asNum, strParam } from './util';

export const mathNode: NodeDef<null> = {
  kind: 'math',
  label: 'Phép tính',
  category: 'math',
  description: 'Cộng, trừ, nhân hoặc chia hai số. Chia cho 0 sẽ ra 0.',
  inputs: [
    { id: 'a', type: 'number', label: 'Số A' },
    { id: 'b', type: 'number', label: 'Số B' },
  ],
  outputs: [{ id: 'out', type: 'number', label: 'Kết quả' }],
  params: [
    {
      id: 'op',
      label: 'Phép tính',
      kind: 'select',
      default: 'add',
      options: [
        { value: 'add', label: '+ Cộng' },
        { value: 'sub', label: '− Trừ' },
        { value: 'mul', label: '× Nhân' },
        { value: 'div', label: '÷ Chia' },
      ],
    },
  ],
  evaluate(_ctx, i, params) {
    const a = asNum(i.a);
    const b = asNum(i.b);
    let out: number;
    switch (strParam(params, 'op', 'add')) {
      case 'sub':
        out = a - b;
        break;
      case 'mul':
        out = a * b;
        break;
      case 'div':
        out = b === 0 ? 0 : a / b;
        break;
      default:
        out = a + b;
    }
    return { out: Number.isFinite(out) ? out : 0 };
  },
};
