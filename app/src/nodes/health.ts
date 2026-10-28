import type { EntityId, NodeDef } from '../engine/types';
import { asBool, asObject, numParam, risingEdge, strParam, type EdgeState } from './util';

interface HealthState {
  registered: EntityId | null;
  heal: EdgeState;
}

export const healthNode: NodeDef<HealthState> = {
  kind: 'health',
  label: 'Máu',
  category: 'action',
  description:
    'Cho một nhân vật có máu. Bị đánh (tay không hoặc dụng cụ trong tay người khác) hoặc bị ném trúng thì mất máu, bị đẩy lùi và nháy đỏ, rồi được miễn đòn nửa giây. Hết máu thì nhân vật ngã xuống rồi biến mất. Nhân vật không có node Máu thì không bị đau.',
  inputs: [
    { id: 'self', type: 'object', label: 'Nhân vật' },
    { id: 'heal', type: 'bool', label: 'Hồi máu' },
  ],
  outputs: [
    { id: 'hp', type: 'number', label: 'Máu còn' },
    { id: 'hurtPulse', type: 'bool', label: 'Vừa bị đánh' },
    { id: 'dead', type: 'bool', label: 'Hết máu' },
  ],
  params: [
    { id: 'maxHp', label: 'Máu tối đa', kind: 'number', default: 5, min: 1, max: 100, step: 1 },
    { id: 'healAmount', label: 'Mỗi lần hồi', kind: 'number', default: 1, min: 0, max: 100, step: 1 },
    {
      id: 'showBar',
      label: 'Thanh máu trên đầu',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Hiện' },
        { value: 'no', label: 'Ẩn' },
      ],
    },
  ],
  create: () => ({ registered: null, heal: { prev: false } }),
  evaluate(ctx, i, params, s) {
    const world = ctx.world;
    const who = asObject(i.self);
    const healNow = risingEdge(s.heal, asBool(i.heal));
    if (who === null) return { hp: 0, hurtPulse: false, dead: false };

    const maxHp = Math.max(1, numParam(params, 'maxHp', 5));
    const showBar = strParam(params, 'showBar', 'yes') !== 'no';
    // Registering again is cheap and keeps edits to max / bar in sync; a new wire target registers fresh.
    world.setHealth(who, maxHp, showBar);
    s.registered = who;
    if (healNow) world.heal(who, numParam(params, 'healAmount', 1));

    const h = world.healthOf(who);
    return { hp: h ? h.hp : 0, hurtPulse: world.wasHurt(who), dead: h ? h.dead : false };
  },
};
