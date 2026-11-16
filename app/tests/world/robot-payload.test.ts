import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntityView, type ViewMode, type World } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';

interface Rig {
  w: World;
  robot: EntityId;
  crate: EntityId;
}

const view = (w: World, id: EntityId): EntityView => w.entities().find((e) => e.id === id)!;

/** A 1 x 0.3 x 1 m chassis on a floor, with a crate (mass in kg) lying on its top. */
function rig(mode: ViewMode, over: { crateKg?: number; chassisKg?: number; maxPayload?: number; crate?: boolean; heading?: number } = {}): Rig {
  const w = createWorld(mode);
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: mode === '2d-side' ? 1 : 80 }, color: '#888', solid: true });
  const robot = w.spawn({
    kind: 'robot',
    ownerNodeId: 'body',
    position: { x: 0, y: 0.15, z: 0 },
    size: { x: 1, y: 0.3, z: 1 },
    color: '#00f',
    solid: true,
    robot: { length: 1, width: 0.7, mass: over.chassisKg ?? 2, friction: 0.8, ...(over.maxPayload !== undefined ? { maxPayload: over.maxPayload } : {}) },
    heading: over.heading ?? 0,
  });
  const crate =
    over.crate === false
      ? ''
      : w.spawn({ kind: 'item', ownerNodeId: 'crate', position: { x: 0.2, y: 0.3 + 0.2, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#fa0', solid: false, ...(over.crateKg !== undefined ? { mass: over.crateKg } : {}) });
  return { w, robot, crate };
}

/** Both wheels at the same rpm (left and right of the centre): straight drive, or a turn when they differ. */
function drive(r: Rig, seconds: number, left: number, right: number): void {
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    r.w.setRobotWheel(r.robot, 'l', { side: -0.4, forward: 0, radius: 0.15, rpm: left });
    r.w.setRobotWheel(r.robot, 'r', { side: 0.4, forward: 0, radius: 0.15, rpm: right });
    r.w.step(TICK_DT);
  }
}

describe('payload on a robot chassis', () => {
  it('a crate lying on the chassis stays on it while the chassis drives (3D)', () => {
    const r = rig('3d');
    drive(r, 3, 120, 120);
    const bot = view(r.w, r.robot);
    const crate = view(r.w, r.crate);
    expect(bot.position.x).toBeGreaterThan(3);
    expect(crate.position.x - bot.position.x).toBeCloseTo(0.2, 1);
    expect(crate.position.y).toBeCloseTo(0.5, 1);
  });

  it('the crate swings round with the chassis when it spins on the spot', () => {
    const r = rig('3d');
    drive(r, 1.5, 60, -60);
    const bot = view(r.w, r.robot);
    const crate = view(r.w, r.crate);
    const h = bot.robot!.heading;
    expect(Math.abs(h)).toBeGreaterThan(0.5);
    // it keeps the same spot on the chassis: 0.2 m ahead of the centre, now along the new heading
    expect(crate.position.x - bot.position.x).toBeCloseTo(0.2 * Math.cos(h), 1);
    expect(crate.position.z - bot.position.z).toBeCloseTo(0.2 * Math.sin(h), 1);
    expect(crate.position.y).toBeCloseTo(0.5, 1);
  });

  it('a heavier crate makes the chassis speed up slower', () => {
    const light = rig('3d', { crateKg: 0.5 });
    const heavy = rig('3d', { crateKg: 20 });
    drive(light, 0.5, 120, 120);
    drive(heavy, 0.5, 120, 120);
    expect(view(heavy.w, heavy.robot).robot!.speed).toBeLessThan(view(light.w, light.robot).robot!.speed * 0.5);
    expect(view(heavy.w, heavy.robot).position.x).toBeLessThan(view(light.w, light.robot).position.x * 0.6);
  });

  it('reports the payload and leaves an empty chassis unchanged', () => {
    const r = rig('3d', { crateKg: 7 });
    drive(r, 0.2, 0, 0);
    expect(view(r.w, r.robot).robot!.payload).toBeCloseTo(7, 6);
    const bare = rig('3d', { crate: false });
    drive(bare, 0.2, 0, 0);
    expect('payload' in view(bare.w, bare.robot).robot!).toBe(false);
  });

  it('above the maximum payload the motors cannot move the robot', () => {
    const r = rig('3d', { crateKg: 10, maxPayload: 5 });
    drive(r, 2, 120, 120);
    const bot = view(r.w, r.robot);
    expect(bot.position.x).toBeCloseTo(0, 6);
    expect(bot.robot!.overloaded).toBe(true);
    const ok = rig('3d', { crateKg: 4, maxPayload: 5 });
    drive(ok, 2, 120, 120);
    expect(view(ok.w, ok.robot).position.x).toBeGreaterThan(1);
    expect(view(ok.w, ok.robot).robot!.overloaded).toBeUndefined();
  });

  it('maximum payload 0 means no limit', () => {
    const r = rig('3d', { crateKg: 50, maxPayload: 0 });
    drive(r, 8, 120, 120);
    expect(view(r.w, r.robot).position.x).toBeGreaterThan(1);
  });

  it('works from the side view too', () => {
    const r = rig('2d-side');
    drive(r, 2, 120, 120);
    const bot = view(r.w, r.robot);
    const crate = view(r.w, r.crate);
    expect(bot.position.x).toBeGreaterThan(1.5);
    expect(crate.position.x - bot.position.x).toBeCloseTo(0.2, 1);
  });

  it('a chassis that starts turned keeps its payload where it was put', () => {
    const r = rig('3d', { heading: Math.PI / 2 });
    drive(r, 0.3, 0, 0);
    const bot = view(r.w, r.robot);
    const crate = view(r.w, r.crate);
    expect(crate.position.x - bot.position.x).toBeCloseTo(0.2, 2);
    expect(Math.abs(crate.position.z - bot.position.z)).toBeLessThan(0.01);
  });
});
