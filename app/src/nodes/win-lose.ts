import type { NodeDef } from '../engine/types';
import { asBool, strParam } from './util';

export const winLoseNode: NodeDef<null> = {
  kind: 'win-lose',
  label: 'Thắng/Thua',
  category: 'output',
  description: 'Kết thúc trò chơi. Khi "Thắng" bật thì báo thắng, khi "Thua" bật thì báo thua.',
  inputs: [
    { id: 'win', type: 'bool', label: 'Thắng' },
    { id: 'lose', type: 'bool', label: 'Thua' },
  ],
  outputs: [],
  params: [
    { id: 'winMessage', label: 'Lời khi thắng', kind: 'text', default: 'Bạn thắng rồi!' },
    { id: 'loseMessage', label: 'Lời khi thua', kind: 'text', default: 'Thua mất rồi!' },
  ],
  create: () => null,
  evaluate(ctx, i, params) {
    if (asBool(i.win)) ctx.world.endGame('win', strParam(params, 'winMessage', 'Bạn thắng rồi!'));
    else if (asBool(i.lose)) ctx.world.endGame('lose', strParam(params, 'loseMessage', 'Thua mất rồi!'));
    return {};
  },
};
