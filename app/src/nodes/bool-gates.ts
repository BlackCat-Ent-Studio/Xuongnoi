import type { NodeDef } from '../engine/types';
import { asBool } from './util';

export const andNode: NodeDef<null> = {
  kind: 'and',
  label: 'Và',
  category: 'logic',
  description: 'Chỉ bật khi CẢ HAI đầu vào đều bật.',
  inputs: [
    { id: 'a', type: 'bool', label: 'A' },
    { id: 'b', type: 'bool', label: 'B' },
  ],
  outputs: [{ id: 'out', type: 'bool', label: 'Kết quả' }],
  params: [],
  evaluate: (_ctx, i) => ({ out: asBool(i.a) && asBool(i.b) }),
};

export const orNode: NodeDef<null> = {
  kind: 'or',
  label: 'Hoặc',
  category: 'logic',
  description: 'Bật khi ÍT NHẤT MỘT đầu vào bật.',
  inputs: [
    { id: 'a', type: 'bool', label: 'A' },
    { id: 'b', type: 'bool', label: 'B' },
  ],
  outputs: [{ id: 'out', type: 'bool', label: 'Kết quả' }],
  params: [],
  evaluate: (_ctx, i) => ({ out: asBool(i.a) || asBool(i.b) }),
};

export const notNode: NodeDef<null> = {
  kind: 'not',
  label: 'Không',
  category: 'logic',
  description: 'Đảo ngược: đang bật thì thành tắt, đang tắt thì thành bật.',
  inputs: [{ id: 'in', type: 'bool', label: 'Vào' }],
  outputs: [{ id: 'out', type: 'bool', label: 'Kết quả' }],
  params: [],
  evaluate: (_ctx, i) => ({ out: !asBool(i.in) }),
};
