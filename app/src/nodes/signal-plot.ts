import type { HudWidget, NodeDef, Params, PlotTrace } from '../engine/types';
import { CORNER_OPTIONS, cornerParam, uiText } from './ui-util';
import { asBool, clamp, numParam, strParam } from './util';
import { createRing, plotRange, plotSampling, ringPush, ringToArray, type Ring } from './plot-buffer';

/** The three trace inputs; an unwired one reads NaN and is simply not drawn. */
const TRACES = [
  { input: 'a', label: 'labelA', color: 'colorA', fallbackLabel: 'Tín hiệu 1', fallbackColor: '#5aa9ff' },
  { input: 'b', label: 'labelB', color: 'colorB', fallbackLabel: 'Tín hiệu 2', fallbackColor: '#f7d046' },
  { input: 'c', label: 'labelC', color: 'colorC', fallbackLabel: 'Tín hiệu 3', fallbackColor: '#f27ad0' },
] as const;

/** The picture is rebuilt at most every this many ticks (20 times a second). */
const REFRESH_TICKS = 3;
const MIN_SIZE = 120;
const MAX_SIZE = 600;

type PlotWidget = Extract<HudWidget, { type: 'plot' }>;

interface PlotState {
  rings: (Ring | null)[];
  capacity: number;
  period: number;
  sinceSample: number;
  dirty: boolean;
  rev: number;
  widget: PlotWidget | null;
}

function wired(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function fresh(windowSeconds: number): Pick<PlotState, 'rings' | 'capacity' | 'period' | 'sinceSample'> {
  const { period, capacity } = plotSampling(windowSeconds);
  return { rings: [null, null, null], capacity, period, sinceSample: period };
}

export const signalPlotNode: NodeDef<PlotState> = {
  kind: 'signal-plot',
  label: 'Đồ thị tín hiệu',
  category: 'output',
  description:
    'Vẽ lên màn hình game một đồ thị đường chạy dần sang trái, tối đa ba tín hiệu (số) cùng lúc, ví dụ giá trị đặt và giá trị đo của bộ điều khiển. Cổng nào không nối thì không vẽ đường đó. Bật "Dừng vẽ" để đóng băng đồ thị.',
  inputs: [
    { id: 'a', type: 'number', label: 'Tín hiệu 1', default: Number.NaN },
    { id: 'b', type: 'number', label: 'Tín hiệu 2', default: Number.NaN },
    { id: 'c', type: 'number', label: 'Tín hiệu 3', default: Number.NaN },
    { id: 'pause', type: 'bool', label: 'Dừng vẽ' },
  ],
  outputs: [],
  params: [
    { id: 'title', label: 'Tên đồ thị', kind: 'text', default: 'Tín hiệu' },
    { id: 'windowSeconds', label: 'Khoảng thời gian hiện (giây)', kind: 'number', default: 10, min: 1, max: 60, step: 1 },
    {
      id: 'autoScale',
      label: 'Tự chỉnh thang đứng',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có (theo số liệu)' },
        { value: 'no', label: 'Không (dùng Nhỏ nhất / Lớn nhất)' },
      ],
    },
    { id: 'min', label: 'Nhỏ nhất (khi không tự chỉnh)', kind: 'number', default: -10, step: 1 },
    { id: 'max', label: 'Lớn nhất (khi không tự chỉnh)', kind: 'number', default: 10, step: 1 },
    { id: 'labelA', label: 'Tên đường 1', kind: 'text', default: 'Tín hiệu 1' },
    { id: 'labelB', label: 'Tên đường 2', kind: 'text', default: 'Tín hiệu 2' },
    { id: 'labelC', label: 'Tên đường 3', kind: 'text', default: 'Tín hiệu 3' },
    { id: 'colorA', label: 'Màu đường 1', kind: 'color', default: '#5aa9ff' },
    { id: 'colorB', label: 'Màu đường 2', kind: 'color', default: '#f7d046' },
    { id: 'colorC', label: 'Màu đường 3', kind: 'color', default: '#f27ad0' },
    {
      id: 'legend',
      label: 'Hiện chú thích và số hiện tại',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có' },
        { value: 'no', label: 'Không' },
      ],
    },
    { id: 'corner', label: 'Góc màn hình', kind: 'select', default: 'top-right', options: CORNER_OPTIONS },
    { id: 'width', label: 'Rộng (điểm ảnh)', kind: 'number', default: 260, min: MIN_SIZE, max: MAX_SIZE, step: 20, advanced: true },
    { id: 'height', label: 'Cao (điểm ảnh)', kind: 'number', default: 150, min: MIN_SIZE / 2, max: MAX_SIZE, step: 10, advanced: true },
  ],
  create: (_ctx, params) => ({
    ...fresh(numParam(params, 'windowSeconds', 10)),
    dirty: false,
    rev: 0,
    widget: null,
  }),
  evaluate(ctx, i, params, s) {
    const { period, capacity } = plotSampling(numParam(params, 'windowSeconds', 10));
    // A changed window restarts the history: samples of the old spacing would be drawn at the wrong speed.
    if (capacity !== s.capacity || period !== s.period) Object.assign(s, fresh(numParam(params, 'windowSeconds', 10)), { dirty: true });

    const paused = asBool(i.pause);
    const vals = TRACES.map((t) => i[t.input]);
    if (!paused) {
      s.sinceSample++;
      if (s.sinceSample >= s.period) {
        s.sinceSample = 0;
        TRACES.forEach((_t, k) => {
          const v = vals[k];
          if (!wired(v)) return;
          const ring = (s.rings[k] ??= createRing(s.capacity));
          ringPush(ring, v);
          s.dirty = true;
        });
      }
    }

    if (s.widget === null || (s.dirty && ctx.tick % REFRESH_TICKS === 0)) {
      s.dirty = false;
      s.widget = buildWidget(s, params, vals, ++s.rev);
    }
    const active = s.widget.traces.length > 0;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: uiText(params, 'title', 'Tín hiệu'),
      value: 0,
      corner: cornerParam(params, 'top-right'),
      hidden: !active,
      widget: s.widget,
    });
    return {};
  },
};

function buildWidget(s: PlotState, params: Params, vals: readonly unknown[], rev: number): PlotWidget {
  const traces: PlotTrace[] = [];
  TRACES.forEach((t, k) => {
    const ring = s.rings[k];
    const v = vals[k];
    if (!ring || !wired(v)) return;
    traces.push({
      label: uiText(params, t.label, t.fallbackLabel),
      color: strParam(params, t.color, t.fallbackColor),
      values: ringToArray(ring),
      current: v,
    });
  });
  const range = plotRange(
    traces.map((tr) => tr.values),
    strParam(params, 'autoScale', 'yes') !== 'no',
    numParam(params, 'min', -10),
    numParam(params, 'max', 10),
  );
  return {
    type: 'plot',
    title: uiText(params, 'title', 'Tín hiệu'),
    width: clamp(numParam(params, 'width', 260), MIN_SIZE, MAX_SIZE),
    height: clamp(numParam(params, 'height', 150), MIN_SIZE / 2, MAX_SIZE),
    min: range.min,
    max: range.max,
    legend: strParam(params, 'legend', 'yes') !== 'no',
    points: s.capacity,
    traces,
    rev,
  };
}
