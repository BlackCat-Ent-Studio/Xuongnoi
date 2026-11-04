import type { CargoLayout, NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, strParam, type EdgeState } from './util';

interface CargoState {
  load: EdgeState;
  unload: EdgeState;
  unloadAll: EdgeState;
}

export const cargoNode: NodeDef<CargoState> = {
  kind: 'cargo',
  label: 'Chở hàng',
  category: 'action',
  description:
    'Chất đồ vật lên thùng xe rồi dỡ xuống. Mỗi lần "Chất" bật lên một nhịp, xe nhận món đồ gần nhất (không ai đang cầm) trong tầm với. Hàng nằm trên thùng xe và chạy theo xe, người khác không cầm đi được. "Dỡ" đặt món trên cùng xuống cạnh xe (ưu tiên phía sau), "Dỡ hết" dỡ tất cả. Xe đầy (hết "Sức chứa") thì không chất thêm. Ẩn xe thì hàng rơi xuống tại chỗ. Điền "Loại cần dỡ" thì "Dỡ" chỉ lấy món trên cùng thuộc loại đó ("Số hàng theo loại" đếm đúng loại ấy); điền "Loại cần chất" thì "Chất" chỉ nhận hàng loại đó. Để trống thì loại nào cũng được.',
  inputs: [
    { id: 'vehicle', type: 'object', label: 'Xe', required: true },
    { id: 'load', type: 'bool', label: 'Chất' },
    { id: 'unload', type: 'bool', label: 'Dỡ' },
    { id: 'unloadAll', type: 'bool', label: 'Dỡ hết' },
  ],
  outputs: [
    { id: 'count', type: 'number', label: 'Số hàng' },
    { id: 'loaded', type: 'bool', label: 'Khi chất hàng' },
    { id: 'unloaded', type: 'bool', label: 'Khi dỡ hàng' },
    { id: 'top', type: 'object', label: 'Hàng trên cùng' },
    { id: 'typeCount', type: 'number', label: 'Số hàng theo loại' },
  ],
  params: [
    { id: 'capacity', label: 'Sức chứa (số món)', kind: 'number', default: 4, min: 1, max: 12, step: 1 },
    { id: 'loadType', label: 'Loại cần chất (để trống = loại nào cũng chất)', kind: 'text', default: '' },
    { id: 'unloadType', label: 'Loại cần dỡ (để trống = món trên cùng)', kind: 'text', default: '' },
    { id: 'reach', label: 'Tầm với (tính từ mép xe)', kind: 'number', default: 2, min: 0.2, max: 10, step: 0.1 },
    { id: 'unloadGap', label: 'Khoảng cách đặt hàng (từ mép xe)', kind: 'number', default: 0.1, min: 0, max: 3, step: 0.1, advanced: true },
    {
      id: 'cellsPerLayer',
      label: 'Số món mỗi tầng trên thùng xe',
      kind: 'select',
      default: '4',
      advanced: true,
      options: [
        { value: '1', label: '1 (một chỗ giữa thùng)' },
        { value: '2', label: '2 (một hàng ngang)' },
        { value: '4', label: '4 (2 hàng x 2 cột)' },
        { value: '6', label: '6 (3 hàng x 2 cột)' },
      ],
    },
  ],
  create: () => ({ load: { prev: false }, unload: { prev: false }, unloadAll: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const veh = asObject(i.vehicle);
    const load = risingEdge(s.load, asBool(i.load));
    const unload = risingEdge(s.unload, asBool(i.unload));
    const unloadAll = risingEdge(s.unloadAll, asBool(i.unloadAll));
    const unloadType = strParam(params, 'unloadType', '').trim();
    const layout: CargoLayout = {
      cellsPerLayer: Number(strParam(params, 'cellsPerLayer', '4')),
      unloadGap: numParam(params, 'unloadGap', 0.1),
    };
    let loaded = false;
    let unloaded = false;
    if (veh !== null) {
      if (unloadAll) {
        // Stops at the first item with no free spot, so nothing is dropped into a wall.
        while (ctx.world.unloadCargo(veh, unloadType, layout) !== null) unloaded = true;
      } else if (unload) {
        unloaded = ctx.world.unloadCargo(veh, unloadType, layout) !== null;
      } else if (load) {
        const capacity = Math.max(1, Math.floor(numParam(params, 'capacity', 4)));
        loaded = ctx.world.loadCargo(veh, numParam(params, 'reach', 2), capacity, strParam(params, 'loadType', '').trim(), layout) !== null;
      }
    }
    const onBoard = veh !== null ? ctx.world.cargoOf(veh) : [];
    // With an unload type set, "Hàng trên cùng" and "Số hàng theo loại" talk about that goods type, like "Dỡ" does.
    const ofType = unloadType === '' ? onBoard : onBoard.filter((id) => ctx.world.tagOf(id) === unloadType);
    return {
      count: onBoard.length,
      loaded,
      unloaded,
      top: ofType.length > 0 ? ofType[ofType.length - 1]! : null,
      typeCount: ofType.length,
    };
  },
};
