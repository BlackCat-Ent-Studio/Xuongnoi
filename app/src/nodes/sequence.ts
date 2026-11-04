import type { NodeDef, PortDef, PortValues } from '../engine/types';
import { asBool, numParam, strParam } from './util';

export const SEQUENCE_MAX_STEPS = 6;
const MIN_STEPS = 2;

interface SequenceState {
  /** 0-based current step; meaningless once finished. */
  index: number;
  finished: boolean;
  /** Previous level of the two inputs; null until the first tick so a signal already on at the start is not an edge. */
  prevNext: boolean | null;
  prevReset: boolean | null;
}

const stepPorts: PortDef[] = Array.from({ length: SEQUENCE_MAX_STEPS }, (_, k) => ({
  id: `step${k + 1}`,
  type: 'bool' as const,
  label: `Bước ${k + 1}`,
}));

function stepCount(raw: number): number {
  return Math.min(SEQUENCE_MAX_STEPS, Math.max(MIN_STEPS, Math.round(raw)));
}

export const sequenceNode: NodeDef<SequenceState> = {
  kind: 'sequence',
  label: 'Chuỗi bước',
  category: 'brain',
  description:
    'Làm lần lượt từng bước: mỗi lúc chỉ một "Bước" bật. Khi "Sang bước kế" bật lên một nhịp thì chuyển sang bước kế tiếp (có thể lặp lại từ đầu). Nối "Bước 1", "Bước 2"... vào cổng "Bật" của các mảnh ghép Di chuyển.',
  inputs: [
    { id: 'next', type: 'bool', label: 'Sang bước kế' },
    { id: 'reset', type: 'bool', label: 'Đặt lại' },
  ],
  outputs: [
    ...stepPorts,
    { id: 'index', type: 'number', label: 'Bước hiện tại' },
    { id: 'finished', type: 'bool', label: 'Đã hoàn thành' },
  ],
  params: [
    { id: 'stepCount', label: 'Số bước (2-6)', kind: 'number', default: 2, min: MIN_STEPS, max: SEQUENCE_MAX_STEPS, step: 1 },
    {
      id: 'loop',
      label: 'Làm hết thì',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Dừng lại' },
        { value: 'yes', label: 'Lặp lại từ bước 1' },
      ],
    },
  ],
  create: () => ({ index: 0, finished: false, prevNext: null, prevReset: null }),
  evaluate(_ctx, i, params, s) {
    const count = stepCount(numParam(params, 'stepCount', 2));
    const next = asBool(i.next);
    const reset = asBool(i.reset);
    const nextEdge = s.prevNext === false && next;
    const resetEdge = s.prevReset === false && reset;
    s.prevNext = next;
    s.prevReset = reset;

    if (resetEdge) {
      s.index = 0;
      s.finished = false;
    } else if (nextEdge && !s.finished) {
      s.index += 1;
      if (s.index >= count) {
        if (strParam(params, 'loop', 'no') === 'yes') s.index = 0;
        else s.finished = true;
      }
    }

    const out: PortValues = {};
    for (let k = 0; k < SEQUENCE_MAX_STEPS; k++) out[`step${k + 1}`] = !s.finished && s.index === k;
    out.index = s.finished ? 0 : s.index + 1;
    out.finished = s.finished;
    return out;
  },
};
