import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { WEIGHT_SORTER, WEIGHT_SORTER_WIRES } from '../../src/samples/weight-sorter-board';
import type { Board } from '../../src/engine/types';
import { firstCardOverlap, play, without } from '../helpers/cell-run';

beforeAll(() => registerAllNodes());

const sample = (): Board => structuredClone(listSamples().find((s) => s.id === 'weight-sorter')!.board);

const KEYS_OR_BUTTONS = new Set(['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog']);
/** Long enough for the last crate to pass the piston and fall into its bin. */
const RUN_S = 60;

interface Result {
  /** Per crate (1-based index order of the queue): where it ended. */
  bins: ('side' | 'end' | 'elsewhere')[];
  side: number;
  end: number;
  overloaded: boolean;
  peakForce: number;
}

function sort(board: Board): Result {
  const p = play(board);
  let overloaded = false;
  let peakForce = 0;
  p.watch(RUN_S, () => {
    if (p.out('piston', 'overloaded') === true) overloaded = true;
    peakForce = Math.max(peakForce, p.out('piston', 'force') as number);
  });
  const bins = WEIGHT_SORTER.heavy.map((_, i) => {
    const e = p.entity(`crate-${i + 1}`);
    if (e.position.z > 5 && e.position.x > 0 && e.position.x < 4) return 'side' as const;
    if (e.position.x > 8 && Math.abs(e.position.z) < 1) return 'end' as const;
    return 'elsewhere' as const;
  });
  return { bins, side: p.out('side-bin', 'count') as number, end: p.out('end-bin', 'count') as number, overloaded, peakForce };
}

describe('sample Băng chuyền phân loại theo cân nặng', () => {
  it('is an automated 3D machine of palette pieces: no keys or buttons, a floor, a camera, readouts, notes', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(KEYS_OR_BUTTONS.has(n.kind), n.kind).toBe(false);
    const kinds = new Set(b.graph.nodes.map((n) => n.kind));
    for (const k of ['camera', 'force-sensor', 'compare', 'linear-actuator', 'timer', 'latch', 'zone', 'item', 'show-number']) expect(kinds.has(k), k).toBe(true);
    expect(b.graph.nodes.find((n) => n.id === 'floor')?.kind).toBe('block');
    expect(b.graph.nodes.filter((n) => n.kind === 'item').length).toBe(WEIGHT_SORTER.heavy.length);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect(firstCardOverlap(b)).toBeNull();
    expect(listSamples().find((s) => s.id === 'weight-sorter')!.label).not.toMatch(/game/i);
  });

  it('every heavy crate ends in the side bin and every light one in the end bin', { timeout: 120_000 }, () => {
    const r = sort(sample());
    WEIGHT_SORTER.heavy.forEach((heavy, i) => expect(r.bins[i], `crate ${i + 1} (${heavy ? 'heavy' : 'light'})`).toBe(heavy ? 'side' : 'end'));
    const heavyCount = WEIGHT_SORTER.heavy.filter(Boolean).length;
    expect(r.side).toBe(heavyCount);
    expect(r.end).toBe(WEIGHT_SORTER.heavy.length - heavyCount);
    expect(r.overloaded).toBe(false);
    // The push needs mu * m * g = 0.5 * 8 * 9.81 N; the shipped limit leaves room.
    expect(r.peakForce).toBeCloseTo(0.5 * WEIGHT_SORTER.heavyKg * 9.81, 1);
    expect(r.peakForce).toBeLessThan(WEIGHT_SORTER.pistonForceN);
  });

  it('a piston weaker than the 39.24 N push force cannot sort the heavy crates (Quá tải)', { timeout: 120_000 }, () => {
    const need = 0.5 * WEIGHT_SORTER.heavyKg * 9.81;
    const weak = sample();
    weak.graph.nodes.find((n) => n.id === 'piston')!.params.maxForce = Math.floor(need) - 1;
    const r = sort(weak);
    expect(r.overloaded).toBe(true);
    expect(r.side).toBe(0);
    for (const b of r.bins) expect(b).not.toBe('side');
    // Just above the need it works again.
    const ok = sample();
    ok.graph.nodes.find((n) => n.id === 'piston')!.params.maxForce = Math.ceil(need) + 1;
    const r2 = sort(ok);
    expect(r2.side).toBe(WEIGHT_SORTER.heavy.filter(Boolean).length);
  });

  it('is anti-forced: without the scale, the compare or the piston wire nothing is sorted', { timeout: 300_000 }, () => {
    const essential: [string, string, string, string][] = [
      ['scale', 'self', 'weigh', 'who'],
      ['weigh', 'mass', 'is-heavy', 'a'],
      ['limit', 'value', 'is-heavy', 'b'],
      ['is-heavy', 'out', 'heavy-seen', 'set'],
      ['heavy-seen', 'on', 'wait', 'run'],
      ['wait', 'done', 'now-push', 'a'],
      ['heavy-seen', 'on', 'now-push', 'b'],
      ['now-push', 'out', 'piston', 'extend'],
      ['go', 'started', 'feed', 'run'],
    ];
    for (const link of essential) {
      expect(WEIGHT_SORTER_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = sort(without(sample(), link));
      expect(r.side, link.join('.')).toBe(0);
    }
  });
});
