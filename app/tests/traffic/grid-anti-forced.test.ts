import { beforeAll, describe, expect, it } from 'vitest';
import type { Board } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { BOT_WIRES, TUNED_DRIVE, buildFloor, cutInBot, cutOnMain, floorBoard, runFloor, type FloorOptions } from '../helpers/grid-floor';
import { say } from './traffic-log';

/**
 * Nothing on the grid floor happens without its wire. The floor of 4 robots runs 150 s whole (every robot delivers), then
 * again with ONE wire taken out: each inner wire of the robot circuit (gone from every copy), and each wire between the
 * first robot and the main board. Every cut must show as a robot that no longer delivers.
 */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const OPTIONS: FloorOptions = { robots: 4, pitch: 1.4, seed: 20261122, drive: TUNED_DRIVE };
const SECONDS = 150;

interface Outcome {
  perRobot: number[];
  /** Robots that ever got farther than half a cell from where they started. */
  left: number;
  minGap: number;
  middleInHoleTicks: number;
}

function outcome(board: Board): Outcome {
  const f = buildFloor(OPTIONS, rapier, board);
  const start = f.ids.map((id) => ({ ...f.run.robot(id).position }));
  const left = f.ids.map(() => false);
  const x = runFloor(f, SECONDS, (_t, views) => views.forEach((v, i) => (left[i] ||= Math.hypot(v.position.x - start[i]!.x, v.position.z - start[i]!.z) > 0.7)));
  return { perRobot: x.perRobot, left: left.filter(Boolean).length, minGap: x.minGap, middleInHoleTicks: x.middleInHoleTicks };
}

const show = (name: string, o: Outcome): void => say(`CUT [${name}]: delivered per robot ${o.perRobot.join('/')}, robots that left their start cell ${o.left}, min gap ${(o.minGap * 1000).toFixed(0)} mm, middle in a hole cell ${o.middleInHoleTicks} ticks`);

describe('grid floor, anti-forced', () => {
  it('whole: every robot delivers', () => {
    const o = outcome(floorBoard(OPTIONS));
    show('nothing cut', o);
    expect(Math.min(...o.perRobot)).toBeGreaterThanOrEqual(3);
    expect(o.left).toBe(4);
    expect(o.minGap).toBeGreaterThan(0.3);
  });

  it.each(BOT_WIRES)('robot circuit without %s: no robot delivers', (link) => {
    const o = outcome(cutInBot(floorBoard(OPTIONS), link));
    show(`circuit: ${link}`, o);
    expect(o.perRobot).toEqual([0, 0, 0, 0]);
  });

  it.each(['r1.robot>giu-o.robot1', 'r1.o-muon>giu-o.want1', 'giu-o.cell1>r1.o-duoc-di', 'r1.o-dang-dung>r1-jobs.at', 'giu-o.stood1>r1-jobs.stood', 'r1-jobs.goal>r1.o-dich'])('main board without %s: robot 1 does not deliver', (link) => {
    const o = outcome(cutOnMain(floorBoard(OPTIONS), link));
    show(`main board: ${link}`, o);
    expect(o.perRobot[0]).toBe(0);
  });
});
