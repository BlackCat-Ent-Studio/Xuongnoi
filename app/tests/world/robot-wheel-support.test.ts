import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { overlapDepth } from '../helpers/chassis-metrics';
import { CHASSIS, bot, bottomOf, deckRig, holeDeck, marker, seconds, slab } from './deck-rig';

/**
 * With "Vật lý thật" on a chassis stands on its wheels (and two free casters on its centre line, 0.1 m in from nose and tail):
 * a wheel with nothing under it does not grip, and a chassis whose middle is no longer over anything that holds it falls.
 * Everything is measured from the entity views.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOP = 2.6;
/** The casters are this far ahead of and behind the middle of the 0.9 m chassis. */
const CASTER = CHASSIS.length / 2 - 0.1;

interface Step {
  x: number;
  z: number;
  bottom: number;
  heading: number;
}

function trace(nodes: NodeSpec[], wires: WireSpec[], secs: number, each?: (v: EntityView, all: readonly EntityView[]) => void): Step[] {
  const r = deckRig(nodes, wires, rapier);
  const out: Step[] = [];
  for (let k = 0; k < seconds(secs); k++) {
    r.tick();
    const v = r.entity('r')!;
    out.push({ x: v.position.x, z: v.position.z, bottom: bottomOf(v), heading: v.robot!.heading });
    each?.(v, r.world.entities());
  }
  r.world.dispose?.();
  return out;
}

const deckBlocks = (all: readonly EntityView[]): EntityView[] => all.filter((e) => e.kind === 'block' && e.ownerNodeId.startsWith('deck'));

describe('wheels in the air do not drive', () => {
  it('set down 2.6 m up with the motors on: it falls straight down, then drives off once it has landed', () => {
    const b = bot({ id: 'r', x: 0, z: 0, floor: TOP, power: [1, 1] });
    const steps = trace(b.nodes, b.wires, 3);
    const landed = steps.findIndex((s) => s.bottom < 0.001);
    expect(landed).toBeGreaterThan(20);
    for (const s of steps.slice(0, landed)) {
      expect(Math.abs(s.x)).toBeLessThan(1e-9);
      expect(Math.abs(s.z)).toBeLessThan(1e-9);
      expect(s.heading).toBe(0);
    }
    expect(steps[steps.length - 1]!.x).toBeGreaterThan(0.5);
  });

  it('one motor on in the air does not turn it either', () => {
    const b = bot({ id: 'r', x: 0, z: 0, floor: TOP, power: [1, -1] });
    const steps = trace(b.nodes, b.wires, 0.6);
    for (const s of steps.filter((p) => p.bottom > 0.001)) expect(s.heading).toBe(0);
  });
});

describe('the edge of a raised deck', () => {
  const deck = (): NodeSpec[] => [slab('deck0', TOP, -6, 0, -3, 3)];

  it('driving straight off: level on the deck while its middle is on it, never inside the deck, then down to the ground beyond the edge', () => {
    const b = bot({ id: 'r', x: -2, z: 0, floor: TOP, power: [0.5, 0.5] });
    let deepest = -Infinity;
    const steps = trace([...deck(), ...b.nodes], b.wires, 6, (v, all) => {
      for (const d of deckBlocks(all)) deepest = Math.max(deepest, overlapDepth(v, d));
    });
    expect(deepest).toBeLessThan(0.001);
    // On the deck, wheels and casters on it: it keeps its height and its line to the last bit.
    for (const s of steps.filter((p) => p.x + CASTER < -0.05)) {
      expect(s.bottom).toBe(TOP);
      expect(s.z).toBe(0);
    }
    // It stays up exactly as long as its middle has deck under it.
    for (const s of steps.filter((p) => p.x < -0.01)) expect(s.bottom).toBe(TOP);
    const last = steps[steps.length - 1]!;
    expect(last.bottom).toBeLessThan(0.001);
    expect(last.x - CHASSIS.length / 2).toBeGreaterThan(-0.001);
    // In the air nothing speeds it up, slows it down or turns it: the same step forward every tick.
    const air = steps.filter((p) => p.bottom < TOP - 0.05 && p.bottom > 0.05);
    expect(air.length).toBeGreaterThan(20);
    for (let k = 2; k < air.length; k++) {
      expect(Math.abs(air[k]!.x - air[k - 1]!.x - (air[k - 1]!.x - air[k - 2]!.x))).toBeLessThan(1e-9);
      expect(air[k]!.heading).toBe(air[0]!.heading);
    }
  });

  for (const heading of [30, 45]) {
    it(`driving off at ${heading} degrees: the wheel that goes over first stops gripping, it goes over and falls, never inside the deck`, { timeout: 60_000 }, () => {
      const b = bot({ id: 'r', x: -2, z: 0, floor: TOP, heading, power: [0.5, 0.5] });
      let deepest = -Infinity;
      const steps = trace([slab('deck0', TOP, -6, 0, -30, 30), ...b.nodes], b.wires, 8, (v, all) => {
        for (const d of deckBlocks(all)) deepest = Math.max(deepest, overlapDepth(v, d));
      });
      expect(deepest).toBeLessThan(0.001);
      for (const s of steps.filter((p) => p.x < -0.01)) expect(s.bottom).toBe(TOP);
      expect(steps[steps.length - 1]!.bottom).toBeLessThan(0.001);
    });

    it(`creeping to the edge at ${heading} degrees (0.4 m/s): with one drive wheel over it lies on its underside and stays there, at rest`, { timeout: 60_000 }, () => {
      const b = bot({ id: 'r', x: -2, z: 0, floor: TOP, heading, power: [0.2, 0.2] });
      let deepest = -Infinity;
      const steps = trace([slab('deck0', TOP, -6, 0, -30, 30), ...b.nodes], b.wires, 14, (v, all) => {
        for (const d of deckBlocks(all)) deepest = Math.max(deepest, overlapDepth(v, d));
      });
      expect(deepest).toBeLessThan(0.001);
      const last = steps[steps.length - 1]!;
      const before = steps[steps.length - 1 - seconds(2)]!;
      // Its middle is still over the deck; the wheel on the far side of the nose is past the edge.
      expect(last.bottom).toBe(TOP);
      expect(last.x).toBeLessThan(0);
      expect(last.x).toBeGreaterThan(-0.35);
      expect(Math.hypot(last.x - before.x, last.z - before.z)).toBeLessThan(1e-6);
      expect(Math.abs(last.heading - before.heading)).toBeLessThan(1e-6);
    });
  }

  it('sent to a spot 0.2 m past the edge it does not park there hanging in the air: it goes over and falls', () => {
    const b = bot({ id: 'r', x: -2, z: 0, floor: TOP, goal: 1, drive: { power: 0.3 } });
    const steps = trace([...deck(), marker(1, 0.2, 0, TOP, 0.4), ...b.nodes], b.wires, 12);
    expect(steps[steps.length - 1]!.bottom).toBeLessThan(0.001);
  });

  it('set down at rest with its middle 5 cm past the edge: it slides off and falls, slowly at first, never inside the deck', () => {
    const b = bot({ id: 'r', x: 0.05, z: 0, floor: TOP });
    let deepest = -Infinity;
    const steps = trace([...deck(), ...b.nodes], b.wires, 4, (v, all) => {
      for (const d of deckBlocks(all)) deepest = Math.max(deepest, overlapDepth(v, d));
    });
    expect(deepest).toBeLessThan(0.001);
    expect(steps[steps.length - 1]!.bottom).toBeLessThan(0.001);
    // After a tenth of a second it has crept less than a centimetre: it does not jump off.
    expect(steps[5]!.x - 0.05).toBeLessThan(0.01);
    for (let k = 1; k < steps.length; k++) expect(steps[k]!.x - steps[k - 1]!.x).toBeLessThan(0.08);
  });

  it('set down at rest with its middle 5 cm before the edge, nose hanging over: it stays', () => {
    const b = bot({ id: 'r', x: -0.05, z: 0, floor: TOP });
    const steps = trace([...deck(), ...b.nodes], b.wires, 3);
    for (const s of steps) {
      expect(s.x).toBe(-0.05);
      expect(s.bottom).toBe(TOP);
    }
  });
});

describe('a hole in the deck', () => {
  /** The robot drives along +x on the line z = `offset` from x = -3 to a marker at x = 3; the hole is centred on the origin. */
  function cross(hole: number | null, offset: number, chassis = CHASSIS, secs = 12): { steps: Step[]; deepest: number } {
    const b = bot({ id: 'r', x: -3, z: offset, floor: TOP, goal: 1, chassis });
    let deepest = -Infinity;
    const steps = trace([...(hole === null ? [slab('deck0', TOP, -6, 6, -6, 6)] : holeDeck(TOP, 6, [0], [0], hole)), marker(1, 3, offset, TOP, 0.4), ...b.nodes], b.wires, secs, (v, all) => {
      for (const d of deckBlocks(all)) deepest = Math.max(deepest, overlapDepth(v, d));
    });
    return { steps, deepest };
  }

  it('0.9 x 0.7 m chassis straight across a 0.7 m hole: its wheels hang in the hole and it is stuck astride it', { timeout: 60_000 }, () => {
    const { steps, deepest } = cross(0.7, 0);
    expect(deepest).toBeLessThan(0.001);
    // Until its front caster reaches the hole it drives as on any floor.
    for (const s of steps.filter((p) => p.x + CASTER < -0.35 - 0.05)) {
      expect(s.bottom).toBe(TOP);
      expect(s.z).toBe(0);
    }
    const last = steps[steps.length - 1]!;
    // It did not get across: astride the hole (its 0.9 m do not fit through 0.7 m), at rest.
    expect(Math.abs(last.x)).toBeLessThan(0.35);
    expect(last.bottom).toBe(TOP);
    const before = steps[steps.length - 1 - seconds(2)]!;
    expect(Math.abs(last.x - before.x)).toBeLessThan(1e-6);
    expect(Math.abs(last.z - before.z)).toBeLessThan(1e-6);
  });

  it('0.5 x 0.4 m chassis across the same hole: it falls through to the floor below', { timeout: 60_000 }, () => {
    const { steps, deepest } = cross(0.7, 0, { length: 0.5, width: 0.4, height: 0.24 });
    expect(deepest).toBeLessThan(0.001);
    const fell = steps.find((s) => s.bottom < TOP - 0.3)!;
    expect(fell).toBeDefined();
    // It went down inside the hole.
    expect(Math.abs(fell.x)).toBeLessThan(0.35 - 0.25 + 0.001);
    expect(steps[steps.length - 1]!.bottom).toBeLessThan(0.001);
  });

  for (const offset of [0.75, 0.66]) {
    it(`on a lane ${offset} m beside the hole centre (every wheel on the deck${offset < 0.7 ? ', its side over the hole' : ''}): tick for tick as on a deck without a hole`, { timeout: 60_000 }, () => {
      const withHole = cross(0.7, offset);
      const without = cross(null, offset);
      let worst = 0;
      for (let k = 0; k < without.steps.length; k++) {
        const p = withHole.steps[k]!;
        const q = without.steps[k]!;
        worst = Math.max(worst, Math.abs(p.x - q.x), Math.abs(p.z - q.z), Math.abs(p.bottom - q.bottom), Math.abs(p.heading - q.heading));
      }
      expect(worst).toBe(0);
      expect(withHole.steps[withHole.steps.length - 1]!.x).toBeGreaterThan(2.9);
    });
  }

  it('starting with its left wheel over the hole: only the right one pushes, so it turns towards the hole; on a whole deck it goes straight', { timeout: 60_000 }, () => {
    // 0.5 m beside the hole centre: the left wheel (0.3 m left of the middle) is 0.15 m inside the hole's edge, the casters are on the deck.
    const start = (hole: boolean): Step[] => {
      const b = bot({ id: 'r', x: 0, z: 0.5, floor: TOP, power: [1, 1] });
      return trace([...(hole ? holeDeck(TOP, 6, [0], [0], 0.7) : [slab('deck0', TOP, -6, 6, -6, 6)]), ...b.nodes], b.wires, 0.25);
    };
    const whole = start(false);
    const holed = start(true);
    for (const s of whole) expect(s.heading).toBe(0);
    // The push of the right wheel alone turns the nose to the left (heading grows clockwise, so it falls).
    expect(holed[holed.length - 1]!.heading).toBeLessThan(-0.05);
    // And it gets half the push forward: it is behind the one on the whole deck.
    expect(holed[5]!.x).toBeLessThan(whole[5]!.x * 0.75);
    for (const s of holed) expect(s.bottom).toBe(TOP);
  });

  it('a chassis card sets its chassis down from a little above the floor: the wheels already drive while it settles, as before', () => {
    const b = bot({ id: 'r', x: 0, z: 0, floor: 0.15, power: [1, 1] });
    const steps = trace(b.nodes, b.wires, 0.5);
    const settling = steps.filter((s) => s.bottom > 0.001);
    expect(settling.length).toBeGreaterThan(5);
    expect(settling[settling.length - 1]!.x).toBeGreaterThan(0.001);
  });
});

describe('the side view', () => {
  it('rolls off the end of a ledge and falls; on the ledge it keeps its height', () => {
    const b = bot({ id: 'r', x: -2, z: 0, floor: 1, power: [0.5, 0.5] });
    const r = rig([['ledge', 'block', { position: { x: -3, y: 0.5, z: 0 }, size: { x: 6, y: 1, z: 1 } }], ['ground', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 1 } }], ...b.nodes], b.wires, '2d-side', false, true, rapier);
    let deepest = -Infinity;
    const steps: Step[] = [];
    for (let k = 0; k < seconds(6); k++) {
      r.tick();
      const v = r.entity('r')!;
      steps.push({ x: v.position.x, z: v.position.z, bottom: bottomOf(v), heading: v.robot!.heading });
      deepest = Math.max(deepest, 0.45 + 3 - Math.abs(v.position.x + 3) > 0 && bottomOf(v) < 1 ? Math.min(0.45 + 3 - Math.abs(v.position.x + 3), 1 - bottomOf(v)) : -1);
    }
    r.world.dispose?.();
    for (const s of steps.filter((p) => p.x < -0.01)) expect(s.bottom).toBe(1);
    expect(steps[steps.length - 1]!.bottom).toBeLessThan(0.001);
    expect(steps[steps.length - 1]!.x).toBeGreaterThan(0.45);
    // Never inside the ledge (overlap along x and in height at once).
    expect(deepest).toBeLessThan(0.001);
  });
});
