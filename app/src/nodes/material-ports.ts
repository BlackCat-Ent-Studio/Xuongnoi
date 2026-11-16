import type { EntityId, EvalCtx, ParamDef, Params, PortDef, PortValues } from '../engine/types';
import { weight } from '../world/mechanics';
import { strParam } from './util';

/** Optional outputs of a body node that report its material: damaged state and weight in newtons. Off by default (the card does not change). */
export const DAMAGED_PORT: PortDef = { id: 'damaged', type: 'bool', label: 'Bị hỏng' };
export const WEIGHT_PORT: PortDef = { id: 'weight', type: 'number', label: 'Trọng lượng (N)' };

/** The two switches that show those outputs; folded under "Nâng cao". */
export const MATERIAL_OUT_PARAMS: ParamDef[] = [
  {
    id: 'showDamagedOut',
    label: 'Báo bị hỏng',
    kind: 'select',
    default: 'no',
    options: [
      { value: 'no', label: 'Không' },
      { value: 'yes', label: 'Có (hiện ô ra "Bị hỏng": bật khi bị ép quá "Lực chịu nén tối đa")' },
    ],
    advanced: true,
  },
  {
    id: 'showWeightOut',
    label: 'Báo trọng lượng',
    kind: 'select',
    default: 'no',
    options: [
      { value: 'no', label: 'Không' },
      { value: 'yes', label: 'Có (hiện ô ra "Trọng lượng (N)" = khối lượng × 9,81)' },
    ],
    advanced: true,
  },
];

/** The material outputs switched on by the params, in card order. */
export function materialPortsActive(params: Params): PortDef[] {
  return [...(strParam(params, 'showDamagedOut', 'no') === 'yes' ? [DAMAGED_PORT] : []), ...(strParam(params, 'showWeightOut', 'no') === 'yes' ? [WEIGHT_PORT] : [])];
}

/** Values for the material outputs that are on (empty when both are off). */
export function materialPortValues(ctx: EvalCtx, id: EntityId, params: Params): PortValues {
  const out: PortValues = {};
  const wantDamaged = strParam(params, 'showDamagedOut', 'no') === 'yes';
  const wantWeight = strParam(params, 'showWeightOut', 'no') === 'yes';
  if (!wantDamaged && !wantWeight) return out;
  const m = ctx.world.materialOf(id);
  if (wantDamaged) out.damaged = m?.damaged ?? false;
  if (wantWeight) out.weight = m ? weight(m.massKg) : 0;
  return out;
}
