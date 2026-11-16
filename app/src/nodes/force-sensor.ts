import type { NodeDef } from '../engine/types';
import { weight } from '../world/mechanics';
import { asObject, numParam, strParam } from './util';

interface ForceSensorState {
  /** Smoothed mass in kg and the body it was measured on (the smoothing restarts when the body changes). */
  mass: number;
  who: string | null;
}

/** A load lighter than this (kg) counts as nothing, so rounding never lights "Có tải". */
const EMPTY_BELOW = 1e-6;

export const forceSensorNode: NodeDef<ForceSensorState> = {
  kind: 'force-sensor',
  label: 'Cảm biến lực / Cân',
  category: 'logic',
  description:
    'Cân và đo lực. Nối một vật vào "Đối tượng". Kiểu "Cân vật đặt lên": cộng khối lượng mọi thứ đang nằm hoặc đứng trên mặt trên của vật đó (kể cả thùng chồng lên thùng) - dùng một Vật thể phẳng làm bàn cân. Kiểu "Lực đang giữ": đo món mà nhân vật đang khiêng hoặc cầm. "Khối lượng" tính bằng kg; "Lực" là trọng lượng bằng niutơn (N) = khối lượng × 9,81, tức là lực mà tải đè xuống; "Có tải" bật khi có gì trên cân. "Làm mượt" (giây) làm số đo đỡ nhảy khi tải vừa đặt xuống; để 0 thì đo tức thì.',
  inputs: [{ id: 'who', type: 'object', label: 'Đối tượng', required: true }],
  outputs: [
    { id: 'force', type: 'number', label: 'Lực (N)' },
    { id: 'mass', type: 'number', label: 'Khối lượng (kg)' },
    { id: 'loaded', type: 'bool', label: 'Có tải' },
  ],
  params: [
    {
      id: 'mode',
      label: 'Cách đo',
      kind: 'select',
      default: 'scale',
      options: [
        { value: 'scale', label: 'Cân vật đặt lên (tổng khối lượng nằm trên mặt trên)' },
        { value: 'hold', label: 'Lực đang giữ (món nhân vật đang khiêng hoặc cầm)' },
      ],
    },
    { id: 'smoothing', label: 'Làm mượt (giây, 0 = đo tức thì)', kind: 'number', default: 0, min: 0, max: 5, step: 0.1 },
  ],
  create: () => ({ mass: 0, who: null }),
  evaluate(ctx, i, params, s) {
    const id = asObject(i.who);
    const raw = id === null ? 0 : strParam(params, 'mode', 'scale') === 'hold' ? ctx.world.massHeld(id) : ctx.world.massOn(id);
    const smoothing = Math.max(0, numParam(params, 'smoothing', 0));
    if (id !== s.who) {
      s.who = id;
      s.mass = raw;
    } else if (smoothing > 0 && ctx.dt > 0) {
      // First-order filter: closes 63% of the gap every `smoothing` seconds.
      s.mass += (raw - s.mass) * (1 - Math.exp(-ctx.dt / smoothing));
    } else {
      s.mass = raw;
    }
    const mass = s.mass < EMPTY_BELOW ? 0 : s.mass;
    return { force: weight(mass), mass, loaded: raw > EMPTY_BELOW };
  },
};
