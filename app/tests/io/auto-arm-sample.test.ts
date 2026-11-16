import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { AUTO_ARM, AUTO_ARM_WIRES } from '../../src/samples/auto-arm-board';
import type { Board } from '../../src/engine/types';
import { firstCardOverlap, play, without } from '../helpers/cell-run';

beforeAll(() => registerAllNodes());

const sample = (): Board => structuredClone(listSamples().find((s) => s.id === 'auto-arm')!.board);

const KEYS_OR_BUTTONS = new Set(['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog']);
/** Time limit of the runs (s): about 6 s a crate plus the queue. */
const LIMIT_S = 60;

interface Result {
  placed: number;
  slipped: number;
  crushed: number;
  /** Peak load of the shoulder (N·m) and whether any joint reported overload. */
  peakLoad: number;
  overloaded: boolean;
  /** Crates lying on the floor away from the belts (dropped by accident). */
  strayed: number;
}

function run(board: Board, seconds = LIMIT_S): Result {
  const p = play(board);
  let peakLoad = 0;
  let overloaded = false;
  p.watch(seconds, () => {
    peakLoad = Math.max(peakLoad, p.out('shoulder', 'load') as number);
    if (p.out('shoulder', 'overloaded') === true || p.out('elbow', 'overloaded') === true || p.out('swing', 'overloaded') === true) overloaded = true;
  });
  const strayed = AUTO_ARM.fragile.filter((_, i) => {
    const e = p.entity(`crate-${i + 1}`);
    // The place belt ends at x = -7; crates that fall off its end into the blue pad are not strays.
    return e.position.y < 0.5 && e.position.x > -6.9 && e.position.x < 8;
  }).length;
  return { placed: p.out('placed', 'value') as number, slipped: p.out('slips', 'value') as number, crushed: p.out('crushes', 'value') as number, peakLoad, overloaded, strayed };
}

const withForce = (n: number): Board => {
  const b = sample();
  b.graph.nodes.find((x) => x.id === 'grip-force')!.params.value = n;
  return b;
};

describe('sample Tay máy tự gắp và đặt', () => {
  it('is an automated 3D machine of palette pieces: no keys or buttons, a floor, a camera, readouts, notes', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(KEYS_OR_BUTTONS.has(n.kind), n.kind).toBe(false);
    const kinds = new Set(b.graph.nodes.map((n) => n.kind));
    for (const k of ['camera', 'sequence', 'joint', 'link', 'gripper', 'item', 'counter', 'map-range', 'show-number']) expect(kinds.has(k), k).toBe(true);
    expect(b.graph.nodes.find((n) => n.id === 'floor')?.kind).toBe('block');
    expect(b.graph.nodes.filter((n) => n.kind === 'item').some((n) => Number(n.params.crushLimit) > 0)).toBe(true);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect(firstCardOverlap(b)).toBeNull();
    expect(listSamples().find((s) => s.id === 'auto-arm')!.label).not.toMatch(/game/i);
  });

  it('at the shipped force it places at least 3 crates, none slipped, none crushed, joints never overloaded', { timeout: 120_000 }, () => {
    expect(AUTO_ARM.gripForceN).toBeGreaterThan(AUTO_ARM.holdThresholdN);
    expect(AUTO_ARM.gripForceN * 2).toBeLessThan(AUTO_ARM.fragileLimitN);
    const r = run(sample());
    expect(r.placed).toBe(AUTO_ARM.fragile.length);
    expect(r.slipped).toBe(0);
    expect(r.crushed).toBe(0);
    expect(r.overloaded).toBe(false);
    expect(r.peakLoad).toBeLessThan(140);
    expect(r.strayed).toBe(0);
  });

  it('below the hold threshold (19.62 N) crates slip and none is placed', { timeout: 120_000 }, () => {
    const r = run(withForce(AUTO_ARM.holdThresholdN - 3));
    expect(r.slipped).toBeGreaterThanOrEqual(1);
    expect(r.placed).toBe(0);
    // Just above the threshold it holds again.
    const ok = run(withForce(AUTO_ARM.holdThresholdN + 0.5), 25);
    expect(ok.slipped).toBe(0);
    expect(ok.placed).toBeGreaterThanOrEqual(1);
  });

  it('above the crush limit (30 N each finger for the fragile crate) the fragile crate is crushed', { timeout: 120_000 }, () => {
    const r = run(withForce(AUTO_ARM.fragileLimitN / 2 + 5));
    expect(r.crushed).toBeGreaterThanOrEqual(1);
    expect(r.slipped).toBe(0);
    // Just under the limit the same crate survives.
    const ok = run(withForce(AUTO_ARM.fragileLimitN / 2 - 0.5));
    expect(ok.crushed).toBe(0);
  });

  it('is anti-forced: without any essential wire no crate is placed', { timeout: 300_000 }, () => {
    const essential: [string, string, string, string][] = [
      ['gripper', 'inReach', 'done-wait', 'b'],
      ['yaw-sum', 'out', 'swing', 'angle'],
      ['sh-sum', 'out', 'shoulder', 'angle'],
      ['el-sum', 'out', 'elbow', 'angle'],
      ['close-3-4', 'out', 'gripper', 'close'],
      ['grip-force', 'value', 'gripper', 'force'],
      ['go-next', 'out', 'a-cycle', 'next'],
      ['go', 'started', 'swing', 'power'],
      ['go', 'started', 'shoulder', 'power'],
    ];
    for (const link of essential) {
      expect(AUTO_ARM_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = run(without(sample(), link), 40);
      expect(r.placed, link.join('.')).toBe(0);
    }
  });
});
