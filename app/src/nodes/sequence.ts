import type { NodeDef, Params, PortDef, PortValues } from '../engine/types';
import { asBool, numParam, strParam } from './util';

export const SEQUENCE_MAX_STEPS = 12;
/** Cards on boards saved before the limit grew always showed these many "Bước" ports; they keep doing so. */
export const SEQUENCE_BASE_STEP_PORTS = 6;
const MIN_STEPS = 2;

interface SequenceState {
  /** 0-based current step; meaningless once finished. */
  index: number;
  finished: boolean;
  /** Previous level of the two inputs; null until the first tick so a signal already on at the start is not an edge. */
  prevNext: boolean | null;
  prevReset: boolean | null;
}

const allStepPorts: PortDef[] = Array.from({ length: SEQUENCE_MAX_STEPS }, (_, k) => ({
  id: `step${k + 1}`,
  type: 'bool' as const,
  label: `Bước ${k + 1}`,
}));

const allDonePorts: PortDef[] = Array.from({ length: SEQUENCE_MAX_STEPS }, (_, k) => ({
  id: `done${k + 1}`,
  type: 'bool' as const,
  label: `Xong bước ${k + 1}`,
  // Often wired back from something this card's own step drives (a joint that reached its angle): where that loop is cut, whatever the card ids.
  feedback: true,
}));

function stepCount(raw: number): number {
  return Math.min(SEQUENCE_MAX_STEPS, Math.max(MIN_STEPS, Math.round(raw)));
}

const showsDone = (params: Params): boolean => strParam(params, 'showDone', 'no') === 'yes';

/** How many "Bước" outputs the card shows and the piece produces: at least the old six, more only when asked. */
const shownSteps = (params: Params): number => Math.max(SEQUENCE_BASE_STEP_PORTS, stepCount(numParam(params, 'stepCount', 2)));

export const sequenceNode: NodeDef<SequenceState> = {
  kind: 'sequence',
  label: 'Chuỗi bước',
  category: 'brain',
  description:
    'Làm lần lượt từng bước: mỗi lúc chỉ một "Bước" bật. Khi "Sang bước kế" bật lên một nhịp thì chuyển sang bước kế tiếp (có thể lặp lại từ đầu). Bật "Hiện cổng Xong từng bước" thì mỗi bước có cổng "Xong bước k": đang ở bước k mà cổng đó đang bật là sang bước kế. Nối "Bước 1", "Bước 2"... vào cổng "Bật" của các mảnh ghép Di chuyển.',
  inputs: [
    { id: 'next', type: 'bool', label: 'Sang bước kế' },
    { id: 'reset', type: 'bool', label: 'Đặt lại' },
  ],
  // Only while "Hiện cổng Xong từng bước" is on, so a sequence card keeps its size on every old board.
  optionalInputs: {
    all: allDonePorts,
    active: (params) => (showsDone(params) ? allDonePorts.slice(0, stepCount(numParam(params, 'stepCount', 2))) : []),
  },
  outputs: [
    ...allStepPorts.slice(0, SEQUENCE_BASE_STEP_PORTS),
    { id: 'index', type: 'number', label: 'Bước hiện tại' },
    { id: 'finished', type: 'bool', label: 'Đã hoàn thành' },
  ],
  optionalOutputs: {
    all: allStepPorts.slice(SEQUENCE_BASE_STEP_PORTS),
    active: (params) => allStepPorts.slice(SEQUENCE_BASE_STEP_PORTS, shownSteps(params)),
  },
  params: [
    { id: 'stepCount', label: `Số bước (2-${SEQUENCE_MAX_STEPS})`, kind: 'number', default: 2, min: MIN_STEPS, max: SEQUENCE_MAX_STEPS, step: 1 },
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
    {
      id: 'showDone',
      label: 'Hiện cổng Xong từng bước',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (đang ở bước k mà "Xong bước k" bật là sang bước kế)' },
      ],
      advanced: true,
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
    // A level, not an edge: a condition that is already true when the step starts moves on at the next tick.
    const doneNow = !s.finished && showsDone(params) && asBool(i[`done${s.index + 1}`]);

    if (resetEdge) {
      s.index = 0;
      s.finished = false;
    } else if ((nextEdge || doneNow) && !s.finished) {
      s.index += 1;
      if (s.index >= count) {
        if (strParam(params, 'loop', 'no') === 'yes') s.index = 0;
        else s.finished = true;
      }
    }

    const out: PortValues = {};
    const shown = shownSteps(params);
    for (let k = 0; k < shown; k++) out[`step${k + 1}`] = !s.finished && s.index === k;
    out.index = s.finished ? 0 : s.index + 1;
    out.finished = s.finished;
    return out;
  },
};
