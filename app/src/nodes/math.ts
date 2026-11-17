import type { NodeDef } from '../engine/types';
import { asNum, strParam } from './util';

export const mathNode: NodeDef<null> = {
  kind: 'math',
  label: 'Phép tính',
  category: 'math',
  description: 'Cộng, trừ, nhân, chia hoặc chia lấy dư hai số. Chia cho 0 (hay chia lấy dư cho 0) sẽ ra 0.',
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
        { value: 'mod', label: '% Chia lấy dư' },
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
      case 'mod':
        // Remainder takes the sign of the divisor (so -1 mod 3 = 2); a zero divisor gives 0.
        out = b === 0 ? 0 : a - b * Math.floor(a / b);
        break;
      default:
        out = a + b;
    }
    return { out: Number.isFinite(out) ? out : 0 };
  },
};
