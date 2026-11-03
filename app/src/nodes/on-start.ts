import type { NodeDef } from '../engine/types';

export const onStartNode: NodeDef<null> = {
  kind: 'on-start',
  label: 'Khi bắt đầu',
  category: 'input',
  description:
    'Báo ngay khi trò chơi bắt đầu chạy. "Vừa bắt đầu" bật đúng một nhịp; "Đã bắt đầu" bật suốt từ lúc đó (nối vào "Cho đi", "Bật", "Chạy"... của mảnh ghép cần được bật).',
  inputs: [],
  outputs: [
    { id: 'fired', type: 'bool', label: 'Vừa bắt đầu' },
    { id: 'started', type: 'bool', label: 'Đã bắt đầu' },
  ],
  params: [],
  create: () => null,
  evaluate: (ctx) => ({ fired: ctx.tick === 0, started: true }),
};
