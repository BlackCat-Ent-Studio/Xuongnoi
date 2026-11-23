import type { ParamDef, Params } from '../engine/types';
import { strParam } from './util';

/** The "Tìm đường" switch shared by the brain nodes that walk somewhere (patrol, go-to, chase). Added last so old saves keep their params. */
export const PATHFIND_PARAM: ParamDef = {
  id: 'pathfind',
  label: 'Tìm đường',
  kind: 'select',
  default: 'on',
  options: [
    { value: 'on', label: 'Bật (đi vòng qua tường, leo bục)' },
    { value: 'off', label: 'Tắt (đi thẳng tới đích)' },
  ],
};

/** True unless the node was told to skip route planning (missing = on, so older saves behave as before). */
export function pathfindOn(params: Params): boolean {
  return strParam(params, 'pathfind', 'on') !== 'off';
}
