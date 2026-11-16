import type { EntityKind, EntitySpec, ParamDef, Params } from '../engine/types';
import { DEFAULT_MASS_KG, DEFAULT_MU, MAX_CRUSH_LIMIT_N, MAX_MASS_KG, MAX_MU } from '../world/material';
import { numParam, vec3Param } from './util';

/** Fine-tuning params shared by every node that owns a body in the world (shown folded under "Nâng cao"). */
export const BODY_PARAMS: ParamDef[] = [
  { id: 'colliderSize', label: 'Cỡ vùng va chạm (0 = bằng kích thước)', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, advanced: true },
  { id: 'colliderOffset', label: 'Lệch vùng va chạm', kind: 'vec3', default: { x: 0, y: 0, z: 0 }, advanced: true },
  { id: 'gravityScale', label: 'Hệ số trọng lực (0 = bay lơ lửng, 2 = nặng)', kind: 'number', default: 1, min: 0, max: 10, step: 0.1, advanced: true },
];

/** Params that only apply when the body is created. */
export const BODY_PARAM_IDS = ['colliderSize', 'colliderOffset', 'gravityScale'];

const ZERO = { x: 0, y: 0, z: 0 };

/** The collision and gravity fields of an entity spec, read from a node's params. */
export function bodySpec(params: Params): Pick<EntitySpec, 'colliderSize' | 'colliderOffset' | 'gravityScale'> {
  return {
    colliderSize: vec3Param(params, 'colliderSize', ZERO),
    colliderOffset: vec3Param(params, 'colliderOffset', ZERO),
    gravityScale: numParam(params, 'gravityScale', 1),
  };
}

/** Params that only apply when the body is created: the material in SI units (see world/material.ts). */
export const MATERIAL_PARAM_IDS = ['mass', 'mu', 'crushLimit'];

/**
 * Material params shown folded under "Nâng cao" on every body kind. They move nothing by themselves: scales, grippers,
 * joints and "Khiêng đồ" read them. The defaults are the neutral ones, so old boards behave exactly as before.
 */
export function materialParams(kind: EntityKind): ParamDef[] {
  return [
    { id: 'mass', label: 'Khối lượng (kg)', kind: 'number', default: DEFAULT_MASS_KG[kind], min: 0, max: MAX_MASS_KG, step: 0.1, advanced: true },
    { id: 'mu', label: 'Hệ số ma sát bề mặt (0 = trơn, 1,5 = rất nhám)', kind: 'number', default: DEFAULT_MU, min: 0, max: MAX_MU, step: 0.05, advanced: true },
    { id: 'crushLimit', label: 'Lực chịu nén tối đa (N, 0 = không bao giờ hỏng)', kind: 'number', default: 0, min: 0, max: MAX_CRUSH_LIMIT_N, step: 10, advanced: true },
  ];
}

/** The material fields of an entity spec, read from a node's params. */
export function materialSpec(params: Params, kind: EntityKind): Pick<EntitySpec, 'mass' | 'mu' | 'crushLimit'> {
  return {
    mass: numParam(params, 'mass', DEFAULT_MASS_KG[kind]),
    mu: numParam(params, 'mu', DEFAULT_MU),
    crushLimit: numParam(params, 'crushLimit', 0),
  };
}
