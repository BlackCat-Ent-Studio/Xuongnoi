import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, type EdgeState } from './util';

export const enterExitNode: NodeDef<EdgeState> = {
  kind: 'enter-exit',
  label: 'Lên / Xuống xe',
  category: 'action',
  description:
    'Mỗi lần "Bấm" bật lên một nhịp: nhân vật đứng gần xe thì lên xe ngồi lái; đang ngồi trên xe thì xuống xe, đứng cạnh xe. Nối nhân vật vào "Ai", nối nút bấm (ví dụ phím E) vào "Bấm".',
  inputs: [
    { id: 'character', type: 'object', label: 'Ai' },
    { id: 'press', type: 'bool', label: 'Bấm' },
  ],
  outputs: [
    { id: 'inVehicle', type: 'bool', label: 'Đang ngồi trên xe' },
    { id: 'vehicle', type: 'object', label: 'Xe đang ngồi' },
  ],
  params: [{ id: 'reach', label: 'Với tới xe trong (đơn vị)', kind: 'number', default: 1.5, min: 0.2, max: 10, step: 0.1 }],
  create: () => ({ prev: false }),
  evaluate(ctx, i, params, s) {
    const who = asObject(i.character);
    const edge = risingEdge(s, asBool(i.press));
    if (who !== null && edge) {
      if (ctx.world.exitVehicle(who) === null) ctx.world.enterVehicle(who, numParam(params, 'reach', 1.5));
    }
    const seated = who !== null ? ctx.world.getEntity(who)?.seatedIn : undefined;
    return { inVehicle: seated !== undefined, vehicle: seated ?? null };
  },
};
