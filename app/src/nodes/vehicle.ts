import type { EntityId, NodeDef, SteerMode, VehicleModel, VehicleSpec } from '../engine/types';
import { VEHICLE_MODELS } from '../engine/types';
import { vehicleSize } from '../world/vehicles';
import { BODY_PARAMS, BODY_PARAM_IDS, bodySpec } from './body-params';
import { asBool, asNum, asObject, clamp, numParam, strParam, vec3Param } from './util';

function modelParam(raw: string): VehicleModel {
  return VEHICLE_MODELS.find((m) => m === raw) ?? 'car';
}

function steerParam(raw: string): SteerMode {
  return raw === 'throttle' ? 'throttle' : 'direction';
}

/** Advanced handling values that differ from the built-in defaults (so a plain vehicle spawns with the plain spec). */
function tuning(params: Parameters<typeof numParam>[0]): Partial<VehicleSpec> {
  const out: Partial<VehicleSpec> = {};
  const brake = numParam(params, 'brake', 2);
  const reverse = numParam(params, 'reverseShare', 0.4);
  const crash = numParam(params, 'crashSpeed', 1.5);
  const shove = numParam(params, 'shove', 0.25);
  if (brake !== 2) out.brakeFactor = brake;
  if (reverse !== 0.4) out.reverseShare = reverse;
  if (crash !== 1.5) out.crashSpeed = crash;
  if (shove !== 0.25) out.shoveShare = shove;
  return out;
}

interface VehicleState {
  id: EntityId;
  /** Crash count already reported as a pulse. */
  seenHits: number;
}

export const vehicleNode: NodeDef<VehicleState> = {
  kind: 'vehicle',
  label: 'Phương tiện',
  category: 'object',
  description:
    'Một chiếc xe: xe hơi, xe máy hoặc xe tải nhỏ. Nối "Đi ngang" / "Đi dọc" từ cần điều khiển (hoặc từ mảnh ghép Bộ não của bot) để lái. Xe chỉ chạy khi có người ngồi (dùng mảnh ghép "Lên / Xuống xe"), trừ khi chọn "Tự chạy". Tàu: chọn "Đầu máy" kéo bằng mảnh ghép "Chạy theo tuyến" (cách chạy "Bám ray"); nối "Xe" của đầu máy vào "Kéo theo bởi" của một "Toa tàu" để toa chạy theo sau, và nối tiếp toa sau vào toa trước để thành đoàn tàu.',
  inputs: [
    { id: 'moveX', type: 'number', label: 'Đi ngang' },
    { id: 'moveY', type: 'number', label: 'Đi dọc' },
    { id: 'stop', type: 'bool', label: 'Dừng' },
    { id: 'leader', type: 'object', label: 'Kéo theo bởi' },
  ],
  outputs: [
    { id: 'self', type: 'object', label: 'Xe' },
    { id: 'hasDriver', type: 'bool', label: 'Có người lái' },
    { id: 'speed', type: 'number', label: 'Tốc độ' },
    { id: 'driver', type: 'object', label: 'Người lái' },
    { id: 'crashed', type: 'bool', label: 'Vừa va chạm' },
    { id: 'crashedWith', type: 'object', label: 'Va với' },
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
        { value: 'locomotive', label: 'Đầu máy (tàu)' },
        { value: 'wagon', label: 'Toa tàu' },
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
    {
      id: 'collide',
      label: 'Va chạm xe khác',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (xe đụng nhau, không đi xuyên qua)' },
        { value: 'no', label: 'Không (xe đi xuyên qua nhau)' },
      ],
    },
    { id: 'brake', label: 'Sức phanh (nhân với độ tăng tốc)', kind: 'number', default: 2, min: 0.5, max: 10, step: 0.5, advanced: true },
    {
      id: 'reverseShare',
      label: 'Tốc độ lùi (phần của tốc độ tối đa)',
      kind: 'number',
      default: 0.4,
      min: 0.1,
      max: 1,
      step: 0.05,
      advanced: true,
    },
    { id: 'crashSpeed', label: 'Tốc độ tính là đâm', kind: 'number', default: 1.5, min: 0.1, max: 20, step: 0.1, advanced: true },
    { id: 'shove', label: 'Lực hất khi đâm', kind: 'number', default: 0.25, min: 0, max: 2, step: 0.05, advanced: true },
    {
      id: 'towDistance',
      label: 'Khoảng cách toa (tâm tới tâm với xe kéo; 0 = tự tính từ độ dài hai xe + khe nhỏ)',
      kind: 'number',
      default: 0,
      min: 0,
      max: 30,
      step: 0.1,
      advanced: true,
    },
    ...BODY_PARAMS,
  ],
  createOnly: [
    'model', 'position', 'color', 'solid', 'steerMode', 'maxSpeed', 'accel', 'collide',
    'brake', 'reverseShare', 'crashSpeed', 'shove', ...BODY_PARAM_IDS,
  ],
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
        ...(strParam(params, 'collide', 'yes') === 'no' ? { collide: false } : {}),
        ...tuning(params),
      },
      ...bodySpec(params),
    });
    return { id, seenHits: 0 };
  },
  evaluate(ctx, i, params, s) {
    const view = ctx.world.getEntity(s.id);
    const driver = view?.vehicle?.driver ?? null;
    // Coupled behind another vehicle ("Kéo theo bởi"): it follows that vehicle's trail and ignores its own drive input.
    ctx.world.setVehicleTow(s.id, asObject(i.leader), Math.max(0, numParam(params, 'towDistance', 0)));
    const live = driver !== null || strParam(params, 'control', 'driver') === 'auto';
    ctx.world.setVehicleInput(
      s.id,
      live ? clamp(asNum(i.moveX), -1, 1) : 0,
      live ? clamp(asNum(i.moveY), -1, 1) : 0,
      asBool(i.stop),
    );
    const hits = view?.vehicle?.hitSeq ?? 0;
    const crashed = hits > s.seenHits;
    s.seenHits = hits;
    return {
      self: s.id,
      hasDriver: driver !== null,
      speed: Math.abs(view?.vehicle?.speed ?? 0),
      driver,
      crashed,
      crashedWith: view?.vehicle?.hitWith ?? null,
    };
  },
};
