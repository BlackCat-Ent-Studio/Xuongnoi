import type { EntitySpec, ParamDef, Params } from '../engine/types';
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
