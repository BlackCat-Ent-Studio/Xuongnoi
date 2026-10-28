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
  label: `Việc ${k + 1}`,
}));

function stepCount(raw: number): number {
  return Math.min(SEQUENCE_MAX_STEPS, Math.max(MIN_STEPS, Math.round(raw)));
}

export const sequenceNode: NodeDef<SequenceState> = {
  kind: 'sequence',
  label: 'Chuỗi việc',
  category: 'brain',
  description:
    'Làm lần lượt từng việc: mỗi lúc chỉ một "Việc" bật. Khi "Xong việc" bật lên một nhịp thì chuyển sang việc kế tiếp (có thể lặp lại từ đầu). Nối "Việc 1", "Việc 2"... vào cổng "Cho đi" của các khối Đi tới.',
  inputs: [
    { id: 'next', type: 'bool', label: 'Xong việc' },
    { id: 'reset', type: 'bool', label: 'Làm lại từ đầu' },
  ],
  outputs: [
    ...stepPorts,
    { id: 'index', type: 'number', label: 'Đang làm việc số' },
    { id: 'finished', type: 'bool', label: 'Đã xong hết' },
  ],
  params: [
    { id: 'stepCount', label: 'Số việc (2-6)', kind: 'number', default: 2, min: MIN_STEPS, max: SEQUENCE_MAX_STEPS, step: 1 },
    {
      id: 'loop',
      label: 'Làm hết thì',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Dừng lại' },
        { value: 'yes', label: 'Lặp lại từ việc 1' },
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
