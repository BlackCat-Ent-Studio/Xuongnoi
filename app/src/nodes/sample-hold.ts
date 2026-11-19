import type { NodeDef } from '../engine/types';
import { asBool, asNum, numParam, risingEdge, type EdgeState } from './util';

interface SampleHoldState {
  value: number;
  store: EdgeState;
  clear: EdgeState;
}

export const sampleHoldNode: NodeDef<SampleHoldState> = {
  kind: 'sample-hold',
  label: 'Nhớ số',
  category: 'math',
  description:
    'Nhớ một con số. Mỗi lần "Lưu" bật lên, mảnh ghép chép con số đang ở "Giá trị" vào bộ nhớ và giữ nguyên, dù "Giá trị" sau đó đổi. "Xoá" đưa về "Số ban đầu". "Vừa lưu" bật một nhịp mỗi lần lưu. Ví dụ: xe nhận hàng nhớ số cửa phải tới, chạy xong mới nhận số cửa mới. Nếu "Lưu" và "Xoá" bật cùng lúc thì "Xoá" thắng.',
  inputs: [
    { id: 'value', type: 'number', label: 'Giá trị' },
    { id: 'store', type: 'bool', label: 'Lưu' },
    { id: 'clear', type: 'bool', label: 'Xoá' },
  ],
  outputs: [
    { id: 'held', type: 'number', label: 'Số nhớ' },
    { id: 'stored', type: 'bool', label: 'Vừa lưu' },
  ],
  params: [{ id: 'start', label: 'Số ban đầu', kind: 'number', default: 0, step: 1 }],
  createOnly: ['start'],
  create: (_ctx, params) => ({ value: numParam(params, 'start', 0), store: { prev: false }, clear: { prev: false } }),
  evaluate(_ctx, i, params, s) {
    const store = risingEdge(s.store, asBool(i.store));
    const clear = risingEdge(s.clear, asBool(i.clear));
    const stored = store && !clear;
    if (stored) s.value = asNum(i.value);
    if (clear) s.value = numParam(params, 'start', 0);
    return { held: s.value, stored };
  },
};
