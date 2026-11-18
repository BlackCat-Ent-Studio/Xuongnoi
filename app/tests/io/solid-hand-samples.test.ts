import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { createAgvBoard } from '../../src/samples/agv-board';
import { createAutoArmBoard } from '../../src/samples/auto-arm-board';
import { crateInArm } from '../helpers/grip-metrics';
import { loadEngine, playReal, type PlayedReal } from '../helpers/cell-run-real';

/**
 * The samples run on "Vật lý thật": the hand and the links are solid and a crate is pushed (or blocked) by them, never entered.
 * Every tick of a long run the drawn palm, both fingers and every link are measured against every crate: overlap under 1 mm.
 */
const OVERLAP = 0.001;

beforeAll(async () => {
  registerAllNodes();
  await loadEngine();
});

/** Worst overlap (m) of any crate with the arm over a run; also returns which joints ever read overloaded. */
function worstOverlap(p: PlayedReal, seconds: number, links: string[], gripper: string, joints: string[]): { worst: number; overloaded: string[] } {
  let worst = -Infinity;
  const overloaded = new Set<string>();
  p.watch(seconds, () => {
    for (const j of joints) if (p.out(j, 'overloaded') === true) overloaded.add(j);
    for (const e of p.world.entities()) {
      if (e.kind !== 'item' || !e.visible) continue;
      worst = Math.max(worst, crateInArm(p.world, links, gripper, e));
    }
  });
  return { worst, overloaded: [...overloaded] };
}

describe('the solid hand in the samples', () => {
  it('auto-arm, 300 s: no crate is ever inside a finger, the palm or a link (under 1 mm); all that arrive are placed; no joint overloaded', { timeout: 600_000 }, () => {
    const p = playReal(createAutoArmBoard());
    const r = worstOverlap(p, 300, ['upper', 'fore'], 'gripper', ['swing', 'shoulder', 'elbow']);
    expect(r.worst).toBeLessThan(OVERLAP);
    expect(r.overloaded).toEqual([]);
    expect(Number(p.out('slips', 'value'))).toBe(0);
    expect(Number(p.out('crushes', 'value'))).toBe(0);
    // One crate every 8 s: 37 in 300 s; the last ones are still on the way in.
    expect(Number(p.out('placed', 'value'))).toBeGreaterThanOrEqual(33);
    p.dispose();
  });

  it('AGV, 180 s: no crate is ever inside the arm (under 1 mm); crates are delivered; no joint overloaded', { timeout: 600_000 }, () => {
    const p = playReal(createAgvBoard());
    const r = worstOverlap(p, 180, ['canh-tren', 'canh-duoi'], 'kep', ['vai', 'khuyu']);
    expect(r.worst).toBeLessThan(OVERLAP);
    expect(r.overloaded).toEqual([]);
    expect(Number(p.out('dem-thung', 'value'))).toBeGreaterThanOrEqual(4);
    p.dispose();
  });
});
