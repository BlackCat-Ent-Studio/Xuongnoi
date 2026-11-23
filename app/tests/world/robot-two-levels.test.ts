import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec } from '../helpers/arm-rig';
import { bot, deckRig, holeDeck, join, marker, seconds } from './deck-rig';

/**
 * Two levels: a robot on a raised deck and a robot parked on the ground right under it. What lies on the deck is not riding on
 * the robot below, however exactly it stands over it: the deck robot meets it as if the ground robot were not there.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOP = 2.6;

interface Trace {
  robot: { x: number; z: number }[];
  crate: { x: number; y: number; z: number }[];
  pushing: number;
}

function run(kg: number, under: boolean): Trace {
  const a = bot({ id: 'a', x: -3, z: 1, floor: TOP, goal: 1, body: { pushObjects: 'yes' } });
  const b = bot({ id: 'b', x: 0, z: 1, floor: 0, body: { pushObjects: 'yes' } });
  const parts = join(a, under ? b : { nodes: [], wires: [] });
  const nodes: NodeSpec[] = [
    ...holeDeck(TOP, 6, [-2, 0, 2], [-2, 0, 2], 0.7),
    marker(1, 3, 1, TOP, 0.6),
    ['box', 'item', { shape: 'crate', position: { x: 0, y: TOP + 0.2, z: 1 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: kg }],
    ...parts.nodes,
  ];
  const r = deckRig(nodes, parts.wires, rapier);
  const out: Trace = { robot: [], crate: [], pushing: 0 };
  for (let k = 0; k < seconds(10); k++) {
    r.tick();
    const e = r.entity('a') as EntityView;
    const c = r.entity('box') as EntityView;
    out.robot.push({ x: e.position.x, z: e.position.z });
    out.crate.push({ ...c.position });
    if (r.out('a', 'pushing') === true) out.pushing++;
  }
  r.world.dispose?.();
  return out;
}

const worstGap = (p: Trace, q: Trace): number => {
  let worst = 0;
  for (let k = 0; k < p.robot.length; k++) {
    worst = Math.max(worst, Math.abs(p.robot[k]!.x - q.robot[k]!.x), Math.abs(p.robot[k]!.z - q.robot[k]!.z));
    worst = Math.max(worst, Math.abs(p.crate[k]!.x - q.crate[k]!.x), Math.abs(p.crate[k]!.y - q.crate[k]!.y), Math.abs(p.crate[k]!.z - q.crate[k]!.z));
  }
  return worst;
};

describe('a crate on the deck does not ride on a robot parked on the ground under it', () => {
  it('a 60 kg crate the deck robot cannot shove stays where it is, with or without a robot below, tick for tick', { timeout: 120_000 }, () => {
    const alone = run(60, false);
    const withBelow = run(60, true);
    // Alone the robot stalls against the crate: the crate does not travel.
    const moved = Math.abs(alone.crate[alone.crate.length - 1]!.x - alone.crate[0]!.x);
    expect(moved).toBeLessThan(0.05);
    expect(alone.pushing).toBeGreaterThan(100);
    expect(worstGap(alone, withBelow)).toBe(0);
  });

  it('a 2 kg crate is shoved the same way, with or without a robot below, tick for tick', { timeout: 120_000 }, () => {
    const alone = run(2, false);
    const withBelow = run(2, true);
    expect(alone.crate[alone.crate.length - 1]!.x - alone.crate[0]!.x).toBeGreaterThan(0.5);
    expect(worstGap(alone, withBelow)).toBe(0);
  });
});
