import type { NodeDef, Params, PortDef, PortValues } from '../engine/types';
import { asBool, asNum, numParam, risingEdge, strParam, type EdgeState } from './util';

export const DISPATCHER_MAX_MACHINES = 12;
const MIN_MACHINES = 2;

interface DispatcherState {
  job: EdgeState;
  /** Codes of the jobs that arrived and are not handed over yet, oldest first. */
  waiting: number[];
  /** 0-based machine the round-robin looks at first. */
  next: number;
  /** Machine (1-based) that got the latest job; 0 before the first hand-over. */
  chosen: number;
  given: number;
  /** Code of the latest job each machine got. */
  codes: number[];
  /** Code of the job handed over last, to whichever machine. */
  lastCode: number;
}

const machinePorts = (id: string, type: PortDef['type'], vi: (k: number) => string, en: (k: number) => string, extra: Partial<PortDef> = {}): PortDef[] =>
  Array.from({ length: DISPATCHER_MAX_MACHINES }, (_, k) => ({ id: `${id}${k + 1}`, type, label: vi(k + 1), labelEn: en(k + 1), ...extra }));

const JOB_CODE_PORT: PortDef = { id: 'jobId', type: 'number', label: 'Mã việc', labelEn: 'Job code' };
const busyPorts = machinePorts(
  'busy',
  'bool',
  (k) => `Máy ${k} đang bận`,
  (k) => `Machine ${k} busy`,
  // Usually wired back from something this card's own "Giao máy k" starts: that wire is where the loop is cut, whatever the card ids.
  { feedback: true },
);
const givePorts = machinePorts('give', 'bool', (k) => `Giao máy ${k}`, (k) => `Give to machine ${k}`);
const codePorts = machinePorts('code', 'number', (k) => `Mã cho máy ${k}`, (k) => `Code for machine ${k}`);

/** Machine count as the node uses it: rounded and kept within 2..12. */
export function machineCount(params: Params): number {
  return Math.min(DISPATCHER_MAX_MACHINES, Math.max(MIN_MACHINES, Math.round(numParam(params, 'machines', MIN_MACHINES))));
}

/** True when each machine also shows its own "Mã cho máy k" output. */
const showsCodes = (params: Params): boolean => strParam(params, 'showCode', 'no') === 'yes';

export const dispatcherNode: NodeDef<DispatcherState> = {
  kind: 'dispatcher',
  label: 'Bộ điều phối',
  category: 'brain',
  description:
    'Chia việc cho nhiều máy. Mỗi lần "Có việc" bật lên là có một việc mới. Mảnh ghép chọn một máy đang rảnh (cổng "Máy k đang bận" đang tắt) và bật "Giao máy k" một nhịp. Máy nào cũng bận thì việc xếp hàng chờ, có máy rảnh là giao ngay: không việc nào bị mất, không việc nào giao hai lần. "Cách chọn": "Lần lượt" chia đều cho các máy, "Máy rảnh đầu tiên" luôn ưu tiên máy số nhỏ. Ví dụ: ba xe chở hàng chia nhau các kiện hàng vừa tới. Nối "Giao máy k" vào "Bật" của một Công tắc nhớ, rồi nối "Đang bật" của nó về "Máy k đang bận". Mỗi việc có thể mang theo một con số ở cổng "Mã việc" (ví dụ số cửa phải tới); lúc giao, số đó hiện ở "Mã vừa giao".',
  inputs: [{ id: 'job', type: 'bool', label: 'Có việc', required: true }, JOB_CODE_PORT],
  optionalInputs: {
    all: busyPorts,
    active: (params) => busyPorts.slice(0, machineCount(params)),
  },
  outputs: [
    { id: 'chosen', type: 'number', label: 'Máy được chọn' },
    { id: 'waiting', type: 'bool', label: 'Đang chờ' },
    { id: 'given', type: 'number', label: 'Đã giao' },
    { id: 'lastCode', type: 'number', label: 'Mã vừa giao', labelEn: 'Latest code' },
  ],
  optionalOutputs: {
    all: [...givePorts, ...codePorts],
    active: (params) => {
      const n = machineCount(params);
      return [...givePorts.slice(0, n), ...(showsCodes(params) ? codePorts.slice(0, n) : [])];
    },
  },
  params: [
    { id: 'machines', label: `Số máy (${MIN_MACHINES}-${DISPATCHER_MAX_MACHINES})`, kind: 'number', default: MIN_MACHINES, min: MIN_MACHINES, max: DISPATCHER_MAX_MACHINES, step: 1 },
    {
      id: 'mode',
      label: 'Cách chọn',
      kind: 'select',
      default: 'round',
      options: [
        { value: 'round', label: 'Lần lượt' },
        { value: 'first', label: 'Máy rảnh đầu tiên' },
      ],
    },
    {
      id: 'showCode',
      label: 'Hiện cổng Mã cho máy k',
      kind: 'select',
      default: 'no',
      options: [
        { value: 'no', label: 'Không' },
        { value: 'yes', label: 'Có (mỗi máy có một cổng giữ mã của việc nó nhận gần nhất)' },
      ],
      advanced: true,
    },
  ],
  create: () => ({ job: { prev: false }, waiting: [], next: 0, chosen: 0, given: 0, lastCode: 0, codes: Array.from({ length: DISPATCHER_MAX_MACHINES }, () => 0) }),
  evaluate(_ctx, i, params, s) {
    const n = machineCount(params);
    if (risingEdge(s.job, asBool(i.job))) s.waiting.push(asNum(i.jobId));

    // At most one hand-over per tick, so "Máy được chọn" names one machine and each "Giao máy k" is a clean pulse.
    let givenTo = -1;
    if (s.waiting.length > 0) {
      const from = strParam(params, 'mode', 'round') === 'first' ? 0 : s.next % n;
      for (let step = 0; step < n && givenTo < 0; step++) {
        const k = (from + step) % n;
        if (!asBool(i[`busy${k + 1}`])) givenTo = k;
      }
      if (givenTo >= 0) {
        s.lastCode = s.waiting.shift() ?? 0;
        s.codes[givenTo] = s.lastCode;
        s.next = (givenTo + 1) % n;
        s.chosen = givenTo + 1;
        s.given += 1;
      }
    }

    const out: PortValues = { chosen: s.chosen, waiting: s.waiting.length > 0 && givenTo < 0, given: s.given, lastCode: s.lastCode };
    for (let k = 0; k < n; k++) {
      out[`give${k + 1}`] = k === givenTo;
      out[`code${k + 1}`] = s.codes[k] ?? 0;
    }
    return out;
  },
};
