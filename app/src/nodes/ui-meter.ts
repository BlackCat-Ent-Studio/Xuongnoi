import type { NodeDef } from '../engine/types';
import { CORNER_OPTIONS, cornerParam, uiText } from './ui-util';
import { asNum, asObject, clamp, numParam, strParam } from './util';

const DEFAULT_COLOR = '#e11d48';

/** 0..1 position of `value` between `min` and `max`; a flat range reads as full once the value reaches it. */
export function meterFraction(value: number, min: number, max: number): number {
  if (max <= min) return value >= max ? 1 : 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export const uiMeterNode: NodeDef<null> = {
  kind: 'ui-meter',
  label: 'Thanh đo',
  category: 'output',
  description:
    'Vẽ một thanh đo cho một con số, ví dụ máu hoặc thời gian còn lại. Số bằng "Nhỏ nhất" thì thanh rỗng, bằng "Lớn nhất" thì thanh đầy. Nối "Gắn vào đối tượng" để thanh đi theo vật, không nối thì thanh nằm ở góc màn hình.',
  inputs: [
    { id: 'value', type: 'number', label: 'Giá trị', required: true },
    { id: 'anchor', type: 'object', label: 'Gắn vào đối tượng' },
    { id: 'show', type: 'bool', label: 'Hiện' },
  ],
  outputs: [],
  params: [
    { id: 'label', label: 'Tên thanh', kind: 'text', default: 'Máu' },
    { id: 'min', label: 'Nhỏ nhất', kind: 'number', default: 0, step: 1 },
    { id: 'max', label: 'Lớn nhất', kind: 'number', default: 100, step: 1 },
    { id: 'color', label: 'Màu thanh', kind: 'color', default: DEFAULT_COLOR },
    { id: 'corner', label: 'Góc màn hình (khi không gắn vào vật)', kind: 'select', default: 'top-left', options: CORNER_OPTIONS },
  ],
  create: () => null,
  evaluate(ctx, i, params) {
    const value = asNum(i.value);
    const anchor = asObject(i.anchor);
    const show = i.show === true;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: uiText(params, 'label', 'Máu'),
      value,
      corner: cornerParam(params, 'top-left'),
      color: strParam(params, 'color', DEFAULT_COLOR),
      ...(anchor !== null ? { anchor } : {}),
      hidden: !show,
      widget: { type: 'bar', fraction: meterFraction(value, numParam(params, 'min', 0), numParam(params, 'max', 100)) },
    });
    return {};
  },
};
