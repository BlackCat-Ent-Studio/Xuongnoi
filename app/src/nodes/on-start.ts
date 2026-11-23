import type { NodeDef } from '../engine/types';

export const onStartNode: NodeDef<null> = {
  kind: 'on-start',
  label: 'Khi bắt đầu',
  category: 'input',
  description: 'Bật đúng một nhịp ngay khi trò chơi bắt đầu chạy.',
  inputs: [],
  outputs: [{ id: 'fired', type: 'bool', label: 'Vừa bắt đầu' }],
  params: [],
  create: () => null,
  evaluate: (ctx) => ({ fired: ctx.tick === 0 }),
};
