import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import type { Graph, HudItem } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import {
  PLOT_MAX_POINTS,
  clampWindow,
  createRing,
  plotFraction,
  plotRange,
  plotSampling,
  ringPush,
  ringToArray,
} from '../../src/nodes/plot-buffer';
import { signalPlotNode } from '../../src/nodes/signal-plot';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld } from './fake-world';

describe('plot buffer', () => {
  it('keeps the newest samples in order and drops the oldest', () => {
    const r = createRing(3);
    for (const v of [1, 2]) ringPush(r, v);
    expect(ringToArray(r)).toEqual([1, 2]);
    for (const v of [3, 4, 5]) ringPush(r, v);
    expect(ringToArray(r)).toEqual([3, 4, 5]);
  });

  it('stores non-finite values as 0', () => {
    const r = createRing(2);
    ringPush(r, Number.NaN);
    expect(ringToArray(r)).toEqual([0]);
  });

  it('samples long windows less often so the history stays small', () => {
    expect(plotSampling(4)).toEqual({ period: 1, capacity: 240 });
    const w10 = plotSampling(10);
    expect(w10.period).toBe(2);
    expect(w10.capacity).toBeLessThanOrEqual(PLOT_MAX_POINTS);
    expect((w10.capacity * w10.period) / 60).toBeCloseTo(10, 1);
    expect(plotSampling(60).capacity).toBeLessThanOrEqual(PLOT_MAX_POINTS);
    expect(clampWindow(0)).toBe(1);
    expect(clampWindow(1000)).toBe(60);
    expect(clampWindow(Number.NaN)).toBe(10);
  });

  it('scales: auto pads the data range, a flat signal gets room, fixed ranges are repaired', () => {
    expect(plotRange([[0, 10]], true, 0, 0)).toEqual({ min: -0.8, max: 10.8 });
    expect(plotRange([[5, 5]], true, 0, 0)).toEqual({ min: 4, max: 6 });
    expect(plotRange([[]], true, 0, 0)).toEqual({ min: -1, max: 1 });
    expect(plotRange([[100]], false, -2, 2)).toEqual({ min: -2, max: 2 });
    expect(plotRange([], false, 3, -3)).toEqual({ min: -3, max: 3 });
    expect(plotRange([], false, 1, 1)).toEqual({ min: 0, max: 2 });
  });

  it('maps a value to 0..1 and pins outliers to the edge', () => {
    const r = { min: -2, max: 2 };
    expect(plotFraction(0, r)).toBe(0.5);
    expect(plotFraction(9, r)).toBe(1);
    expect(plotFraction(-9, r)).toBe(0);
  });
});

describe('signal-plot node', () => {
  const NaNv = Number.NaN;
  const lastHud = (huds: HudItem[]) => huds[huds.length - 1]!;
  const plotOf = (h: HudItem) => (h.widget?.type === 'plot' ? h.widget : null);

  function drive(inputs: (tick: number) => Record<string, number | boolean>, ticks: number, over = {}) {
    const w = makeWorld();
    const params = defaultParams(signalPlotNode, { windowSeconds: 4, ...over });
    const s = signalPlotNode.create!(makeCtx(w), params);
    for (let t = 0; t < ticks; t++) signalPlotNode.evaluate(makeCtx(w, { tick: t }), { a: NaNv, b: NaNv, c: NaNv, ...inputs(t) }, params, s);
    return w.huds;
  }

  it('stays hidden while no signal is wired', () => {
    expect(lastHud(drive(() => ({}), 30)).hidden).toBe(true);
  });

  it('draws only the wired traces with their colours, labels and latest value', () => {
    const huds = drive((t) => ({ a: t, c: -t }), 120, { labelA: 'Đặt', colorC: '#00ff00' });
    const h = lastHud(huds);
    const plot = plotOf(h)!;
    expect(h.hidden).toBe(false);
    expect(plot.traces.map((x) => x.label)).toEqual(['Đặt', 'Tín hiệu 3']);
    expect(plot.traces[1]!.color).toBe('#00ff00');
    expect(plot.traces[0]!.values.length).toBeGreaterThan(50);
    expect(plot.traces[0]!.values.at(-1)).toBeGreaterThan(plot.traces[0]!.values[0]!);
    expect(plot.max).toBeGreaterThan(plot.min);
  });

  it('redraws at most every third tick', () => {
    const huds = drive((t) => ({ a: t }), 120);
    const revs = new Set(huds.map((h) => plotOf(h)?.rev));
    expect(revs.size).toBeLessThanOrEqual(Math.ceil(120 / 3) + 1);
  });

  it('keeps no more than the window holds', () => {
    const plot = plotOf(lastHud(drive((t) => ({ a: t }), 60 * 12)))!;
    expect(plot.traces[0]!.values.length).toBe(plot.points);
    expect(plot.points).toBe(240);
  });

  it('pause freezes the chart', () => {
    const huds = drive((t) => ({ a: t, pause: t >= 60 }), 180);
    const frozen = plotOf(lastHud(huds))!;
    expect(frozen.traces[0]!.values.at(-1)!).toBeLessThan(70);
  });

  it('uses the fixed scale when auto scale is off', () => {
    const plot = plotOf(lastHud(drive((t) => ({ a: t }), 60, { autoScale: 'no', min: -5, max: 5 })))!;
    expect([plot.min, plot.max]).toEqual([-5, 5]);
  });

  it('through the runtime: an unwired plot makes a hidden HUD item', () => {
    registerAllNodes();
    const graph: Graph = { nodes: [{ id: 'plot', kind: 'signal-plot', params: {}, pos: { x: 0, y: 0 } }], wires: [] };
    const world = createWorld('2d-side');
    const rt = createRuntime(graph, world, '2d-side');
    for (let k = 0; k < 10; k++) rt.tick({ keysDown: new Set() });
    expect(world.hudItems().filter((h) => h.hidden !== true)).toEqual([]);
  });
});
