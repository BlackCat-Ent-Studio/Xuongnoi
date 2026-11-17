import type { NodeDef, PortDef, PortValues } from '../engine/types';
import { asNum, numParam } from './util';

export const SELECT_MAX_CHOICES = 12;
/** Cards on boards saved before the limit grew always showed these many "Bằng" ports; they keep doing so. */
export const SELECT_BASE_CHOICE_PORTS = 6;
const MIN_CHOICES = 2;

interface SelectNumberState {
  /** Selected choice last tick (1-based, 0 = none); null until the first tick so the starting value is not a change. */
  prev: number | null;
}

const allChoicePorts: PortDef[] = Array.from({ length: SELECT_MAX_CHOICES }, (_, k) => ({
  id: `is${k + 1}`,
  type: 'bool' as const,
  label: `Bằng ${k + 1}`,
}));

function choiceCount(raw: number): number {
  return Math.min(SELECT_MAX_CHOICES, Math.max(MIN_CHOICES, Math.round(raw)));
}

/** How many "Bằng" outputs the card shows and the piece produces: at least the old six, more only when asked. */
const shownChoices = (raw: number): number => Math.max(SELECT_BASE_CHOICE_PORTS, choiceCount(raw));

export const selectNumberNode: NodeDef<SelectNumberState> = {
  kind: 'select-number',
  label: 'Chọn theo số',
  category: 'logic',
  description:
    'Nhận một số và bật đúng một cổng "Bằng 1", "Bằng 2"... tương ứng với số đó (làm tròn). Số ngoài khoảng thì không cổng nào bật. "Khi đổi" báo một nhịp mỗi khi lựa chọn đổi sang cái khác.',
  inputs: [{ id: 'value', type: 'number', label: 'Giá trị' }],
  outputs: [...allChoicePorts.slice(0, SELECT_BASE_CHOICE_PORTS), { id: 'changed', type: 'bool', label: 'Khi đổi' }],
  optionalOutputs: {
    all: allChoicePorts.slice(SELECT_BASE_CHOICE_PORTS),
    active: (params) => allChoicePorts.slice(SELECT_BASE_CHOICE_PORTS, shownChoices(numParam(params, 'choices', 3))),
  },
  params: [
    { id: 'choices', label: `Số lựa chọn (2-${SELECT_MAX_CHOICES})`, kind: 'number', default: 3, min: MIN_CHOICES, max: SELECT_MAX_CHOICES, step: 1 },
  ],
  create: () => ({ prev: null }),
  evaluate(_ctx, i, params, s) {
    const rawCount = numParam(params, 'choices', 3);
    const count = choiceCount(rawCount);
    const n = Math.round(asNum(i.value));
    const selected = n >= 1 && n <= count ? n : 0;
    const changed = s.prev !== null && s.prev !== selected;
    s.prev = selected;
    const out: PortValues = {};
    const shown = shownChoices(rawCount);
    for (let k = 0; k < shown; k++) out[`is${k + 1}`] = selected === k + 1;
    out.changed = changed;
    return out;
  },
};
