import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, type EdgeState } from './util';

interface EnterExitState {
  press: EdgeState;
  enter: EdgeState;
  exit: EdgeState;
}

export const enterExitNode: NodeDef<EnterExitState> = {
  kind: 'enter-exit',
  label: 'Lên / Xuống xe',
  category: 'action',
  description:
    'Nối nhân vật vào "Ai". Mỗi nhịp bật ở "Lên xe": nhân vật đứng gần xe thì lên xe ngồi lái. Mỗi nhịp bật ở "Xuống xe": nhân vật đang ngồi trên xe thì xuống, đứng cạnh xe. "Bấm" là cổng cũ (một cổng làm cả hai việc, lên rồi xuống), chỉ để game cũ vẫn chạy.',
  inputs: [
    { id: 'character', type: 'object', label: 'Ai', required: true },
    { id: 'enter', type: 'bool', label: 'Lên xe' },
    { id: 'exit', type: 'bool', label: 'Xuống xe' },
    { id: 'press', type: 'bool', label: 'Bấm', legacy: true },
  ],
  outputs: [
    { id: 'inVehicle', type: 'bool', label: 'Đang ngồi trên xe' },
    { id: 'vehicle', type: 'object', label: 'Xe đang ngồi' },
  ],
  params: [{ id: 'reach', label: 'Với tới xe trong (đơn vị)', kind: 'number', default: 1.5, min: 0.2, max: 10, step: 0.1 }],
  create: () => ({ press: { prev: false }, enter: { prev: false }, exit: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const who = asObject(i.character);
    const edge = risingEdge(s.press, asBool(i.press));
    const enter = risingEdge(s.enter, asBool(i.enter));
    const exit = risingEdge(s.exit, asBool(i.exit));
    if (who !== null) {
      if (edge && ctx.world.exitVehicle(who) === null) ctx.world.enterVehicle(who, numParam(params, 'reach', 1.5));
      if (enter && ctx.world.getEntity(who)?.seatedIn === undefined) ctx.world.enterVehicle(who, numParam(params, 'reach', 1.5));
      if (exit) ctx.world.exitVehicle(who);
    }
    const seated = who !== null ? ctx.world.getEntity(who)?.seatedIn : undefined;
    return { inVehicle: seated !== undefined, vehicle: seated ?? null };
  },
};
