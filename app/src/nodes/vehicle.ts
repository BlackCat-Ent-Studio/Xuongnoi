import type { EntityId, NodeDef, SteerMode, VehicleModel } from '../engine/types';
import { VEHICLE_MODELS } from '../engine/types';
import { vehicleSize } from '../world/vehicles';
import { asNum, clamp, numParam, strParam, vec3Param } from './util';

function modelParam(raw: string): VehicleModel {
  return VEHICLE_MODELS.find((m) => m === raw) ?? 'car';
}

function steerParam(raw: string): SteerMode {
  return raw === 'throttle' ? 'throttle' : 'direction';
}

export const vehicleNode: NodeDef<{ id: EntityId }> = {
  kind: 'vehicle',
  label: 'Phương tiện',
  category: 'object',
  description:
    'Một chiếc xe: xe hơi, xe máy hoặc xe tải nhỏ. Nối "Đi ngang" / "Đi dọc" từ cần điều khiển (hoặc từ khối Bộ não của bot) để lái. Xe chỉ chạy khi có người ngồi (dùng khối "Lên / Xuống xe"), trừ khi chọn "Tự chạy".',
  inputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Xe' },
    { id: 'hasDriver', type: 'bool', label: 'Có người lái' },
    { id: 'speed', type: 'number', label: 'Tốc độ' },
    { id: 'driver', type: 'object', label: 'Người lái' },
  ],
  params: [
    { id: 'position', label: 'Vị trí xuất hiện', kind: 'vec3', default: { x: 0, y: 0.5, z: 0 } },
    {
      id: 'model',
      label: 'Loại xe',
      kind: 'select',
      default: 'car',
      options: [
        { value: 'car', label: 'Xe hơi' },
        { value: 'bike', label: 'Xe máy' },
        { value: 'truck', label: 'Xe tải nhỏ' },
      ],
    },
    {
      id: 'steerMode',
      label: 'Cách lái',
      kind: 'select',
      default: 'direction',
      options: [
        { value: 'direction', label: 'Theo hướng (bấm hướng nào, xe quay hướng đó)' },
        { value: 'throttle', label: 'Ga - Lái (lên = ga, xuống = lùi, trái/phải = đánh lái)' },
      ],
    },
    { id: 'maxSpeed', label: 'Tốc độ tối đa', kind: 'number', default: 9, min: 1, max: 40, step: 0.5 },
    { id: 'accel', label: 'Độ tăng tốc', kind: 'number', default: 8, min: 1, max: 60, step: 0.5 },
    { id: 'color', label: 'Màu', kind: 'color', default: '#ef4444' },
    {
      id: 'solid',
      label: 'Chặn người đi bộ',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (không đi xuyên qua xe)' },
        { value: 'no', label: 'Không' },
      ],
    },
    {
      id: 'control',
      label: 'Ai điều khiển',
      kind: 'select',
      default: 'driver',
      options: [
        { value: 'driver', label: 'Người ngồi trên xe' },
        { value: 'auto', label: 'Tự chạy (xe không cần người lái)' },
      ],
    },
  ],
  createOnly: ['model', 'position', 'color', 'solid', 'steerMode', 'maxSpeed', 'accel'],
  liveApply: {
    color: (ctx, p, s) => ctx.world.setEntityStyle(s.id, { color: String(p.color) }),
  },
  create(ctx, params) {
    const model = modelParam(strParam(params, 'model', 'car'));
    const id = ctx.world.spawn({
      kind: 'vehicle',
      ownerNodeId: ctx.nodeId,
      position: vec3Param(params, 'position', { x: 0, y: 0.5, z: 0 }),
      size: vehicleSize(model),
      color: strParam(params, 'color', '#ef4444'),
      solid: strParam(params, 'solid', 'yes') !== 'no',
      vehicle: {
        model,
        steerMode: steerParam(strParam(params, 'steerMode', 'direction')),
        maxSpeed: numParam(params, 'maxSpeed', 9),
        accel: numParam(params, 'accel', 8),
      },
    });
    return { id };
  },
  evaluate(ctx, i, params, s) {
    const view = ctx.world.getEntity(s.id);
    const driver = view?.vehicle?.driver ?? null;
    const live = driver !== null || strParam(params, 'control', 'driver') === 'auto';
    ctx.world.setVehicleInput(s.id, live ? clamp(asNum(i.moveX), -1, 1) : 0, live ? clamp(asNum(i.moveY), -1, 1) : 0);
    return {
      self: s.id,
      hasDriver: driver !== null,
      speed: Math.abs(view?.vehicle?.speed ?? 0),
      driver,
    };
  },
};
