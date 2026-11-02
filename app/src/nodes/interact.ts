import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, type EdgeState } from './util';

export const interactNode: NodeDef<EdgeState> = {
  kind: 'interact',
  label: 'Tương tác',
  category: 'action',
  description:
    'Khi bấm, nhân vật "dùng" món đồ vật gần nhất (trong tầm với). Món đó sẽ báo "Vừa được dùng" một nhịp. Món đang cầm trên tay không tính.',
  inputs: [
    { id: 'character', type: 'object', label: 'Nhân vật', required: true },
    { id: 'press', type: 'bool', label: 'Bấm' },
  ],
  outputs: [
    { id: 'fired', type: 'bool', label: 'Vừa tương tác' },
    { id: 'target', type: 'object', label: 'Món được dùng' },
  ],
  params: [{ id: 'reach', label: 'Tầm với', kind: 'number', default: 1.5, min: 0, max: 10, step: 0.5 }],
  create: () => ({ prev: false }),
  evaluate(ctx, i, params, s) {
    const who = asObject(i.character);
    const pressed = risingEdge(s, asBool(i.press));
    const target = pressed && who !== null ? ctx.world.interact(who, numParam(params, 'reach', 1.5)) : null;
    return { fired: target !== null, target };
  },
};
