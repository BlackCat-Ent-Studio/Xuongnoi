import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { FLOOR_MARKER_LOOK, listMarkers, markerByNumber, markerNumber, markerUnder } from '../../src/nodes/floor-marker';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { marker, navRig, CHASSIS_Y } from '../helpers/nav-rig';

/**
 * "Mốc sàn" is a numbered tile painted on the floor; "Đọc mốc sàn" tells which tile an object stands on and "Tìm mốc sàn"
 * turns a number into the tile that carries it.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** A chassis pushed by two motors at a fixed power, so the tests here do not depend on the "Đi tới điểm" card. */
function cart(x: number, z: number, power: number, heading = 0): { nodes: NodeSpec[]; wires: WireSpec[] } {
  return {
    nodes: [
      ['cart', 'robot-body', { position: { x, y: CHASSIS_Y, z }, heading, length: 0.9, width: 0.7, height: 0.3, mass: 5 }],
      ['ml', 'motor', { side: -0.3 }],
      ['mr', 'motor', { side: 0.3 }],
      ['p', 'const', { value: power }],
      ['read', 'floor-marker-sensor', {}],
    ],
    wires: [['cart', 'self', 'ml', 'body'], ['cart', 'self', 'mr', 'body'], ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power'], ['cart', 'self', 'read', 'who']],
  };
}

describe('Mốc sàn', () => {
  it('is a flat non-solid tile at its place that carries its number, and gives its X, Z and number', () => {
    const r = navRig([['m', 'floor-marker', { number: 7, position: { x: 3, y: 0, z: -2 }, size: 1.4, color: '#22c55e' }]], [], rapier);
    r.tick();
    const e = r.entity('m')!;
    expect(e.kind).toBe('block');
    expect(e.look).toBe(FLOOR_MARKER_LOOK);
    expect(e.zone).toBe(true);
    expect(e.label).toBe('7');
    expect(e.color).toBe('#22c55e');
    expect([e.position.x, e.position.y, e.position.z]).toEqual([3, 0, -2]);
    expect([e.size.x, e.size.z]).toEqual([1.4, 1.4]);
    expect(e.size.y).toBeLessThan(0.05);
    expect(markerNumber(e)).toBe(7);
    expect([r.out('m', 'self'), r.out('m', 'x'), r.out('m', 'z'), r.out('m', 'number')]).toEqual([e.id, 3, -2, 7]);
    expect(r.world.solidBoxes().some((b) => Math.abs(b.position.x - 3) < 0.01 && Math.abs(b.position.z + 2) < 0.01)).toBe(false);
  });

  it('the number is kept whole and within 1..99; only a marker has one', () => {
    const r = navRig([['a', 'floor-marker', { number: 0 }], ['b', 'floor-marker', { number: 250, position: { x: 3, y: 0, z: 0 } }], ['c', 'floor-marker', { number: 4.6, position: { x: 6, y: 0, z: 0 } }]], [], rapier);
    r.tick();
    expect([r.out('a', 'number'), r.out('b', 'number'), r.out('c', 'number')]).toEqual([1, 99, 5]);
    expect(listMarkers(r.world).map((m) => m.number)).toEqual([1, 99, 5]);
    expect(markerNumber(r.entity('floor')!)).toBe(0);
  });

  it('nothing collides with it: a robot drives straight across at the speed it has on bare floor, and a crate dropped on it lies on the floor', () => {
    const run = (withMarker: boolean): number[] => {
      const c = cart(-3, 0, 0.5);
      const r = navRig([...c.nodes, ...(withMarker ? [marker(1, 0, 0, 2)] : [])], c.wires, rapier);
      const xs: number[] = [];
      for (let k = 0; k < 360; k++) {
        r.tick();
        xs.push(r.entity('cart')!.position.x);
      }
      return xs;
    };
    expect(run(true)).toEqual(run(false));

    const r = navRig([marker(1, 0, 0, 2), ['crate', 'item', { shape: 'crate', position: { x: 0, y: 1, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 2 }], ['scale', 'robot-body', { position: { x: 5, y: CHASSIS_Y, z: 5 }, showPayload: 'yes' }]], [], rapier);
    r.tick(180);
    expect(r.entity('crate')!.position.y).toBeCloseTo(0.2, 2);
    expect(r.world.massOn(r.entity('m1')!.id)).toBe(0);
  });

  it('"Dò phía trước" does not see it', () => {
    const c = cart(-3, 0, 0);
    const r = navRig([...c.nodes, marker(1, -1.5, 0, 1), ['eye', 'ahead-sensor', { reach: 5 }]], [...c.wires, ['cart', 'self', 'eye', 'who']], rapier);
    r.tick(5);
    expect(r.out('eye', 'blocked')).toBe(false);
  });
});

describe('Đọc mốc sàn', () => {
  it('reads 0 between tiles and the number while the middle of the robot is over a tile; "Khi vào mốc" pulses once per tile', () => {
    const c = cart(-4, 0, 0.5);
    const r = navRig([...c.nodes, marker(3, -2, 0, 1), marker(8, 1, 0, 1)], c.wires, rapier);
    const seen: number[] = [];
    const pulses: number[] = [];
    for (let k = 0; k < 8 / TICK_DT; k++) {
      r.tick();
      const n = r.out('read', 'number') as number;
      const x = r.entity('cart')!.position.x;
      // The reading was taken before this tick's move: compare with a little slack at the rims.
      const over3 = Math.abs(x + 2) < 0.5 - 0.03;
      const over8 = Math.abs(x - 1) < 0.5 - 0.03;
      const clear = Math.abs(x + 2) > 0.5 + 0.03 && Math.abs(x - 1) > 0.5 + 0.03;
      if (over3) expect(n).toBe(3);
      if (over8) expect(n).toBe(8);
      if (clear) expect(n).toBe(0);
      expect(r.out('read', 'on')).toBe(n !== 0);
      if (seen.at(-1) !== n) seen.push(n);
      if (r.out('read', 'entered') === true) pulses.push(n);
    }
    expect(seen).toEqual([0, 3, 0, 8, 0]);
    expect(pulses).toEqual([3, 8]);
  });

  it('gives the tile itself as an object, the nearer one where two tiles overlap, and nothing for an unwired or hidden reader', () => {
    const c = cart(0.2, 0, 0);
    const r = navRig([...c.nodes, marker(1, 0, 0, 2), marker(2, 0.5, 0, 2), ['lone', 'floor-marker-sensor', {}]], c.wires, rapier);
    r.tick(2);
    expect(r.out('read', 'number')).toBe(1);
    expect(r.out('read', 'marker')).toBe(r.entity('m1')!.id);
    expect([r.out('lone', 'number'), r.out('lone', 'on'), r.out('lone', 'marker')]).toEqual([0, false, null]);
    expect(markerUnder(r.world, '3d', { x: 0.3, z: 0 })?.number).toBe(2);
    expect(markerUnder(r.world, '3d', { x: 0.3, z: 1.2 })).toBeNull();
  });

  it('side view: only x counts', () => {
    const r = rig(
      [['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 1 } }], ['m', 'floor-marker', { number: 5, position: { x: 2, y: 0, z: 9 } }], ['cart', 'robot-body', { position: { x: 2.3, y: CHASSIS_Y, z: 0 } }], ['read', 'floor-marker-sensor', {}]],
      [['cart', 'self', 'read', 'who']],
      '2d-side',
    );
    r.tick(2);
    expect(r.out('read', 'number')).toBe(5);
    expect(r.entity('m')!.position.z).toBe(0);
  });
});

describe('Tìm mốc sàn', () => {
  it('turns a number into the marker with that number, its X and Z; an unknown number finds nothing', () => {
    const r = navRig([marker(1, 4, -1), marker(2, -3, 6), ['n', 'const', { value: 2 }], ['find', 'floor-marker-find', {}]], [['n', 'value', 'find', 'number']], rapier);
    r.tick();
    expect([r.out('find', 'marker'), r.out('find', 'x'), r.out('find', 'z'), r.out('find', 'found')]).toEqual([r.entity('m2')!.id, -3, 6, true]);
    r.set('n', { value: 1.4 });
    r.tick();
    expect([r.out('find', 'x'), r.out('find', 'z')]).toEqual([4, -1]);
    for (const none of [0, 3, -2, 1e9]) {
      r.set('n', { value: none });
      r.tick();
      expect([r.out('find', 'marker'), r.out('find', 'x'), r.out('find', 'z'), r.out('find', 'found')], `${none}`).toEqual([null, 0, 0, false]);
    }
  });

  it('two markers with one number: the one made first is found', () => {
    const r = navRig([['a', 'floor-marker', { number: 4, position: { x: 1, y: 0, z: 1 } }], ['b', 'floor-marker', { number: 4, position: { x: 9, y: 0, z: 9 } }]], [], rapier);
    r.tick();
    expect(markerByNumber(r.world, 4)?.id).toBe(r.entity('a')!.id);
  });
});
