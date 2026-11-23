import type { NodeDef } from '../engine/types';
import { numParam } from './util';

export const constNode: NodeDef<null> = {
  kind: 'const',
  label: 'Hằng số',
  category: 'math',
  description: 'Một con số cố định mà bạn tự đặt, để nối vào các nút khác.',
  inputs: [],
  outputs: [{ id: 'value', type: 'number', label: 'Số' }],
  params: [{ id: 'value', label: 'Giá trị', kind: 'number', default: 1, step: 1 }],
  evaluate: (_ctx, _i, params) => ({ value: numParam(params, 'value', 1) }),
};
