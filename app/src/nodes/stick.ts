import type { NodeDef } from '../engine/types';
import { strParam } from './util';

const SCHEMES = {
  wasd: { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' },
  arrows: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
} as const;

export const stickNode: NodeDef<null> = {
  kind: 'stick',
  label: 'Cần điều khiển',
  category: 'input',
  description:
    'Biến 4 phím mũi tên hoặc W-A-S-D thành hướng đi. Phải/lên cho số dương, trái/xuống cho số âm.',
  inputs: [],
  outputs: [
    { id: 'x', type: 'number', label: 'Trục ngang' },
    { id: 'y', type: 'number', label: 'Trục dọc' },
  ],
  params: [
    {
      id: 'scheme',
      label: 'Dùng phím',
      kind: 'select',
      default: 'arrows',
      options: [
        { value: 'arrows', label: 'Mũi tên' },
        { value: 'wasd', label: 'W A S D' },
      ],
    },
  ],
  create: () => null,
  evaluate(ctx, _inputs, params) {
    const scheme = strParam(params, 'scheme', 'arrows') === 'wasd' ? SCHEMES.wasd : SCHEMES.arrows;
    const k = ctx.input.keysDown;
    const x = (k.has(scheme.right) ? 1 : 0) - (k.has(scheme.left) ? 1 : 0);
    const y = (k.has(scheme.up) ? 1 : 0) - (k.has(scheme.down) ? 1 : 0);
    return { x, y };
  },
};
