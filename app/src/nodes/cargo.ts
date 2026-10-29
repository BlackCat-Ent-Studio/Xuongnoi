import type { NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, type EdgeState } from './util';

interface CargoState {
  load: EdgeState;
  unload: EdgeState;
  unloadAll: EdgeState;
}

export const cargoNode: NodeDef<CargoState> = {
  kind: 'cargo',
  label: 'Chất / Dỡ hàng',
  category: 'action',
  description:
    'Chất đồ vật lên thùng xe rồi dỡ xuống. Mỗi lần "Chất" bật lên một nhịp, xe nhận món đồ gần nhất (không ai đang cầm) trong tầm với. Hàng nằm trên thùng xe và chạy theo xe, người khác không cầm đi được. "Dỡ" đặt món trên cùng xuống cạnh xe (ưu tiên phía sau), "Dỡ hết" dỡ tất cả. Xe đầy (hết "Sức chứa") thì không chất thêm. Ẩn xe thì hàng rơi xuống tại chỗ.',
  inputs: [
    { id: 'vehicle', type: 'object', label: 'Xe', required: true },
    { id: 'load', type: 'bool', label: 'Chất' },
    { id: 'unload', type: 'bool', label: 'Dỡ' },
    { id: 'unloadAll', type: 'bool', label: 'Dỡ hết' },
  ],
  outputs: [
    { id: 'count', type: 'number', label: 'Số hàng' },
    { id: 'loaded', type: 'bool', label: 'Vừa chất' },
    { id: 'unloaded', type: 'bool', label: 'Vừa dỡ' },
    { id: 'top', type: 'object', label: 'Hàng trên cùng' },
  ],
  params: [
    { id: 'capacity', label: 'Sức chứa (số món)', kind: 'number', default: 4, min: 1, max: 12, step: 1 },
    { id: 'reach', label: 'Tầm với (tính từ mép xe)', kind: 'number', default: 2, min: 0.2, max: 10, step: 0.1 },
  ],
  create: () => ({ load: { prev: false }, unload: { prev: false }, unloadAll: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const veh = asObject(i.vehicle);
    const load = risingEdge(s.load, asBool(i.load));
    const unload = risingEdge(s.unload, asBool(i.unload));
    const unloadAll = risingEdge(s.unloadAll, asBool(i.unloadAll));
    let loaded = false;
    let unloaded = false;
    if (veh !== null) {
      if (unloadAll) {
        // Stops at the first item with no free spot, so nothing is dropped into a wall.
        while (ctx.world.unloadCargo(veh) !== null) unloaded = true;
      } else if (unload) {
        unloaded = ctx.world.unloadCargo(veh) !== null;
      } else if (load) {
        const capacity = Math.max(1, Math.floor(numParam(params, 'capacity', 4)));
        loaded = ctx.world.loadCargo(veh, numParam(params, 'reach', 2), capacity) !== null;
      }
    }
    const onBoard = veh !== null ? ctx.world.cargoOf(veh) : [];
    return { count: onBoard.length, loaded, unloaded, top: onBoard.length > 0 ? onBoard[onBoard.length - 1]! : null };
  },
};
