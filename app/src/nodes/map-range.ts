import type { NodeDef } from '../engine/types';
import { asNum, clamp, numParam, strParam } from './util';

export const mapRangeNode: NodeDef<undefined> = {
  kind: 'map-range',
  label: 'Quy đổi khoảng',
  category: 'math',
  description:
    'Đổi một số từ thang này sang thang khác. Ví dụ máu 0–100 thành độ rộng thanh 0–1, hoặc khoảng cách 0–10 thành tốc độ 5–1. "Giữ trong khoảng" không cho kết quả vượt ra ngoài thang mới.',
  inputs: [{ id: 'value', type: 'number', label: 'Giá trị vào' }],
  outputs: [{ id: 'value', type: 'number', label: 'Giá trị ra' }],
  params: [
    { id: 'inMin', label: 'Thang cũ: từ', kind: 'number', default: 0, step: 1 },
    { id: 'inMax', label: 'Thang cũ: đến', kind: 'number', default: 1, step: 1 },
    { id: 'outMin', label: 'Thang mới: từ', kind: 'number', default: 0, step: 1 },
    { id: 'outMax', label: 'Thang mới: đến', kind: 'number', default: 100, step: 1 },
    {
      id: 'clamp',
      label: 'Giữ trong khoảng',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có' },
        { value: 'no', label: 'Không' },
      ],
    },
  ],
  evaluate(_ctx, i, params) {
    const inMin = numParam(params, 'inMin', 0);
    const inMax = numParam(params, 'inMax', 1);
    const outMin = numParam(params, 'outMin', 0);
    const outMax = numParam(params, 'outMax', 100);
    const span = inMax - inMin;
    // A zero-width old scale has no slope; answer with the start of the new scale.
    let t = span === 0 ? 0 : (asNum(i.value) - inMin) / span;
    if (strParam(params, 'clamp', 'yes') !== 'no') t = clamp(t, 0, 1);
    return { value: outMin + t * (outMax - outMin) };
  },
};
