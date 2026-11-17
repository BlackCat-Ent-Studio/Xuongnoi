import type { NodeDef } from '../engine/types';
import { asBool, numParam } from './util';

export const boolToNumberNode: NodeDef<undefined> = {
  kind: 'bool-to-number',
  label: 'Đổi thành số',
  category: 'math',
  description:
    'Đổi tín hiệu bật/tắt thành một con số. Bật ra "Số khi bật" (mặc định 1), tắt ra "Số khi tắt" (mặc định 0). Dùng để đưa công tắc hay cảm biến vào các mảnh ghép chỉ nhận số.',
  inputs: [{ id: 'on', type: 'bool', label: 'Bật/tắt' }],
  outputs: [{ id: 'value', type: 'number', label: 'Giá trị' }],
  params: [
    { id: 'whenOn', label: 'Số khi bật', kind: 'number', default: 1, step: 1 },
    { id: 'whenOff', label: 'Số khi tắt', kind: 'number', default: 0, step: 1 },
  ],
  evaluate(_ctx, i, params) {
    return { value: asBool(i.on) ? numParam(params, 'whenOn', 1) : numParam(params, 'whenOff', 0) };
  },
};
