import type { NodeDef, Params } from '../engine/types';
import { asBool, numParam, risingEdge, strParam, type EdgeState } from './util';

interface RandomState {
  next: () => number;
  roll: EdgeState;
  value: number;
}

/** Small fast seeded generator (mulberry32): same seed, same sequence. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function draw(next: () => number, params: Params): number {
  const a = numParam(params, 'min', 1);
  const b = numParam(params, 'max', 6);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (strParam(params, 'whole', 'yes') === 'no') return lo + next() * (hi - lo);
  const first = Math.ceil(lo);
  const last = Math.floor(hi);
  if (last < first) return Math.round(lo);
  return first + Math.floor(next() * (last - first + 1));
}

export const randomNode: NodeDef<RandomState> = {
  kind: 'random',
  label: 'Số ngẫu nhiên',
  category: 'math',
  description:
    'Tung ra một số ngẫu nhiên trong khoảng bạn chọn, như tung xúc xắc. Chọn lúc nào tung: mỗi lần "Tung" bật, liên tục mỗi nhịp, hoặc một lần lúc bắt đầu (chưa tung lần nào thì ra 0). Để "Hạt giống" = 0 thì mỗi lần chơi ra số khác nhau; đặt số khác 0 thì lần nào cũng ra y hệt.',
  inputs: [{ id: 'roll', type: 'bool', label: 'Tung' }],
  outputs: [
    { id: 'value', type: 'number', label: 'Giá trị' },
    { id: 'rolled', type: 'bool', label: 'Khi tung' },
  ],
  params: [
    { id: 'min', label: 'Nhỏ nhất', kind: 'number', default: 1, step: 1 },
    { id: 'max', label: 'Lớn nhất', kind: 'number', default: 6, step: 1 },
    {
      id: 'whole',
      label: 'Số nguyên',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (1, 2, 3...)' },
        { value: 'no', label: 'Không (có số lẻ)' },
      ],
    },
    {
      id: 'mode',
      label: 'Tung khi nào',
      kind: 'select',
      default: 'press',
      options: [
        { value: 'press', label: 'Mỗi lần bấm "Tung"' },
        { value: 'tick', label: 'Liên tục mỗi nhịp' },
        { value: 'start', label: 'Một lần lúc bắt đầu' },
      ],
    },
    { id: 'seed', label: 'Hạt giống (0 = mỗi lần chơi khác nhau)', kind: 'number', default: 0, step: 1 },
  ],
  createOnly: ['seed'],
  create(ctx, params) {
    const seed = Math.trunc(numParam(params, 'seed', 0));
    const base = seed !== 0 ? seed : ctx.world.runSeed();
    const next = createRng((base ^ hashText(ctx.nodeId)) >>> 0);
    // In press mode nothing has been rolled yet, so the output reads 0 until the first roll.
    const value = strParam(params, 'mode', 'press') === 'press' ? 0 : draw(next, params);
    return { next, roll: { prev: false }, value };
  },
  evaluate(_ctx, i, params, s) {
    const edge = risingEdge(s.roll, asBool(i.roll));
    const mode = strParam(params, 'mode', 'press');
    const rolled = mode === 'tick' || (mode === 'press' && edge);
    if (rolled) s.value = draw(s.next, params);
    return { value: s.value, rolled };
  },
};
