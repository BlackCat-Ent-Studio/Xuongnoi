import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type PortValues, type Vec3 } from '../../src/engine/types';
import { chaseNode } from '../../src/nodes/chase';
import { enterExitNode } from '../../src/nodes/enter-exit';
import { goToNode } from '../../src/nodes/go-to';
import { patrolNode } from '../../src/nodes/patrol';
import { vehicleNode } from '../../src/nodes/vehicle';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld, runNode } from './fake-world';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe('vehicle node', () => {
  it('spawns a vehicle with the footprint of its model and the chosen handling', () => {
    const w = makeWorld();
    vehicleNode.create!(makeCtx(w), defaultParams(vehicleNode, { model: 'truck', steerMode: 'throttle', maxSpeed: 6, accel: 3, solid: 'no' }));
    const spec = w.spawned[0]!;
    expect(spec.kind).toBe('vehicle');
    expect(spec.size.x).toBe(spec.size.z);
    expect(spec.size.x).toBeGreaterThan(1.5);
    expect(spec.solid).toBe(false);
    expect(spec.vehicle).toEqual({ model: 'truck', steerMode: 'throttle', maxSpeed: 6, accel: 3 });
  });

  it('falls back to a car with easy steering for unknown params', () => {
    const w = makeWorld();
    vehicleNode.create!(makeCtx(w), defaultParams(vehicleNode, { model: 'rocket', steerMode: 'banana' }));
    expect(w.spawned[0]!.vehicle).toMatchObject({ model: 'car', steerMode: 'direction' });
  });

  it('only listens to the stick while somebody sits in it, unless it drives itself', () => {
    const real = createWorld('2d-top');
    const params = defaultParams(vehicleNode);
    const ctx = makeCtx(real);
    const s = vehicleNode.create!(ctx, params);
    const out0 = vehicleNode.evaluate(ctx, { moveX: 1, moveY: 0 }, params, s);
    expect(out0).toMatchObject({ self: s.id, hasDriver: false, speed: 0, driver: null });
    real.step(TICK_DT);
    expect(real.getEntity(s.id)!.vehicle!.speed).toBe(0);

    const person = real.spawn({ kind: 'character', ownerNodeId: 'p', position: v(1.4, 0.5, 0), size: v(1, 1, 1), color: '#00f', solid: true });
    expect(real.enterVehicle(person, 2)).toBe(s.id);
    for (let i = 0; i < 20; i++) {
      const out = vehicleNode.evaluate(ctx, { moveX: 1, moveY: 0 }, params, s);
      real.step(TICK_DT);
      if (i === 19) expect(out).toMatchObject({ hasDriver: true, driver: person });
    }
    expect(real.getEntity(s.id)!.vehicle!.speed).toBeGreaterThan(1);
    const out = vehicleNode.evaluate(ctx, {}, params, s);
    expect(out.speed as number).toBeGreaterThan(1);

    const auto = createWorld('2d-top');
    const autoParams = defaultParams(vehicleNode, { control: 'auto' });
    const actx = makeCtx(auto);
    const as = vehicleNode.create!(actx, autoParams);
    for (let i = 0; i < 20; i++) {
      vehicleNode.evaluate(actx, { moveX: 1, moveY: 0 }, autoParams, as);
      auto.step(TICK_DT);
    }
    expect(auto.getEntity(as.id)!.vehicle!.speed).toBeGreaterThan(1);
  });

  it('clamps and sanitizes the stick values', () => {
    const real = createWorld('2d-top');
    const params = defaultParams(vehicleNode, { control: 'auto' });
    const ctx = makeCtx(real);
    const s = vehicleNode.create!(ctx, params);
    expect(() => vehicleNode.evaluate(ctx, { moveX: 99, moveY: Number.NaN }, params, s)).not.toThrow();
  });
});

describe('enter-exit node', () => {
  const setup = () => {
    const world = createWorld('2d-top');
    const ctx = makeCtx(world);
    const vParams = defaultParams(vehicleNode);
    const vs = vehicleNode.create!(ctx, vParams);
    const person: EntityId = world.spawn({ kind: 'character', ownerNodeId: 'p', position: v(1.5, 0.5, 0), size: v(1, 1, 1), color: '#00f', solid: true });
    const params = defaultParams(enterExitNode);
    const state = enterExitNode.create!(ctx, params);
    const press = (on: boolean): PortValues => enterExitNode.evaluate(ctx, { character: person, press: on }, params, state);
    return { world, vs, person, press };
  };

  it('boards on a press, gets out on the next one, and only reacts to the rising edge', () => {
    const { world, vs, person, press } = setup();
    expect(press(false)).toEqual({ inVehicle: false, vehicle: null });
    expect(press(true)).toEqual({ inVehicle: true, vehicle: vs.id });
    expect(press(true)).toEqual({ inVehicle: true, vehicle: vs.id }); // held: nothing happens
    expect(press(false)).toEqual({ inVehicle: true, vehicle: vs.id });
    expect(press(true)).toEqual({ inVehicle: false, vehicle: null });
    expect(world.getEntity(person)!.seatedIn).toBeUndefined();
  });

  it('does nothing when no character is wired or nothing is within reach', () => {
    const { world, press } = setup();
    const ctx = makeCtx(world);
    const params = defaultParams(enterExitNode, { reach: 0.2 });
    const state = enterExitNode.create!(ctx, params);
    expect(enterExitNode.evaluate(ctx, { character: null, press: true }, params, state)).toEqual({ inVehicle: false, vehicle: null });
    const far = world.spawn({ kind: 'character', ownerNodeId: 'f', position: v(30, 0.5, 0), size: v(1, 1, 1), color: '#00f', solid: true });
    const farState = enterExitNode.create!(ctx, params);
    expect(enterExitNode.evaluate(ctx, { character: far, press: true }, params, farState).inVehicle).toBe(false);
    expect(press(false).inVehicle).toBe(false);
  });

  it('the fake world answers the new calls without side effects', () => {
    const w = makeWorld();
    const out = runNode(enterExitNode, [{ inputs: { character: 'e1', press: true } }], {}, w);
    expect(out[0]).toEqual({ inVehicle: false, vehicle: null });
  });
});

describe('"Tìm đường" switch on brain nodes', () => {
  const wallLevel = () => {
    const world = createWorld('2d-top');
    // A wall between the bot and its goal, open at the north end.
    world.spawn({ kind: 'block', ownerNodeId: 'wall', position: v(8, 0.5, 2), size: v(1, 1, 12), color: '#777', solid: true });
    world.spawn({ kind: 'block', ownerNodeId: 'frame-n', position: v(8, 0.5, -9), size: v(24, 1, 1), color: '#777', solid: true });
    world.spawn({ kind: 'block', ownerNodeId: 'frame-s', position: v(8, 0.5, 9), size: v(24, 1, 1), color: '#777', solid: true });
    const bot = world.spawn({ kind: 'character', ownerNodeId: 'bot', position: v(3, 0.5, 2), size: v(1, 1, 1), color: '#f00', role: 'bot', solid: true });
    return { world, bot };
  };

  function drive(pathfind: string | undefined): number {
    const { world, bot } = wallLevel();
    const params = defaultParams(goToNode, { targetPos: v(13, 0.5, 2), ...(pathfind !== undefined ? { pathfind } : {}) });
    if (pathfind === undefined) delete params.pathfind; // an old save has no such param
    const ctx = makeCtx(world);
    const state = goToNode.create!(ctx, params);
    for (let i = 0; i < 900; i++) {
      const out = goToNode.evaluate(ctx, { self: bot, go: true }, params, state);
      world.setCharacterIntent(bot, { moveX: out.moveX as number, moveY: out.moveY as number, jump: out.jump === true, speed: 5, jumpPower: 10 });
      world.step(TICK_DT);
    }
    return world.getEntity(bot)!.position.x;
  }

  it('On (and missing, for older saves) walks around the wall; Off heads straight and stays stuck', () => {
    expect(drive('on')).toBeGreaterThan(12);
    expect(drive(undefined)).toBeGreaterThan(12);
    expect(drive('off')).toBeLessThan(8);
  });

  it('is the last param of patrol, go-to and chase, defaulting to On', () => {
    for (const def of [patrolNode, goToNode, chaseNode]) {
      const last = def.params[def.params.length - 1]!;
      expect(last.id).toBe('pathfind');
      expect(last.default).toBe('on');
      expect(last.options?.map((o) => o.value)).toEqual(['on', 'off']);
    }
  });

  it('Off makes chase and patrol steer straight too', () => {
    const { world, bot } = wallLevel();
    const target = world.spawn({ kind: 'character', ownerNodeId: 'target', position: v(13, 0.5, 2), size: v(1, 1, 1), color: '#00f', solid: true });
    const ctx = makeCtx(world);
    const cp = defaultParams(chaseNode, { sightRange: 30, giveUpRange: 40, pathfind: 'off' });
    const cs = chaseNode.create!(ctx, cp);
    for (let i = 0; i < 600; i++) {
      const out = chaseNode.evaluate(ctx, { self: bot, target, go: true }, cp, cs);
      world.setCharacterIntent(bot, { moveX: out.moveX as number, moveY: out.moveY as number, jump: false, speed: 5, jumpPower: 10 });
      world.step(TICK_DT);
    }
    expect(world.getEntity(bot)!.position.x).toBeLessThan(8);

    const { world: w2, bot: b2 } = wallLevel();
    const pp = defaultParams(patrolNode, { pointA: v(3, 0.5, 2), pointB: v(13, 0.5, 2), pathfind: 'off', wait: 0 });
    const ps = patrolNode.create!(makeCtx(w2), pp);
    for (let i = 0; i < 600; i++) {
      const out = patrolNode.evaluate(makeCtx(w2), { self: b2, on: true }, pp, ps);
      w2.setCharacterIntent(b2, { moveX: out.moveX as number, moveY: out.moveY as number, jump: false, speed: 5, jumpPower: 10 });
      w2.step(TICK_DT);
    }
    expect(w2.getEntity(b2)!.position.x).toBeLessThan(8);
  });
});

describe('bots driving vehicles', () => {
  it('plans with the vehicle body: skips a gap too narrow for the car and takes the wide one', () => {
    const world = createWorld('2d-top');
    const wall = (z: number, sz: number) =>
      world.spawn({ kind: 'block', ownerNodeId: 'w', position: v(10, 0.5, z), size: v(1, 1, sz), color: '#777', solid: true });
    // A wall at x=10 with a 1.2-wide gap on the direct line and a 3-wide gap further north.
    wall(-12.5, 7); // z -16..-9
    wall(-3.55, 4.9); // z -6..-1.1: the wide gap is z -9..-6, the narrow one z -1.1..0.1
    wall(6.05, 11.9); // z 0.1..12
    world.spawn({ kind: 'block', ownerNodeId: 'n', position: v(10, 0.5, -17), size: v(60, 1, 1), color: '#777', solid: true });
    world.spawn({ kind: 'block', ownerNodeId: 's', position: v(10, 0.5, 13), size: v(60, 1, 1), color: '#777', solid: true });
    const goal = world.spawn({ kind: 'block', ownerNodeId: 'goal', position: v(20, 0.5, -1), size: v(1, 1, 1), color: '#ff0', solid: false });

    const vParams = defaultParams(vehicleNode, { position: v(0, 0.4, -1), maxSpeed: 7, control: 'auto' });
    const ctx = makeCtx(world);
    const vs = vehicleNode.create!(ctx, vParams);
    const gParams = defaultParams(goToNode, { stopDistance: 1 });
    const gs = goToNode.create!(ctx, gParams);

    let minAbsZAtWall = Infinity;
    for (let i = 0; i < 60 * 40; i++) {
      const out = goToNode.evaluate(ctx, { self: vs.id, target: goal, go: true }, gParams, gs);
      vehicleNode.evaluate(ctx, { moveX: out.moveX as number, moveY: out.moveY as number }, vParams, vs);
      world.step(TICK_DT);
      const p = world.getEntity(vs.id)!.position;
      if (Math.abs(p.x - 10) < 0.5) minAbsZAtWall = Math.min(minAbsZAtWall, Math.abs(p.z + 7.5));
      if (out.arrived === true) break;
    }
    const end = world.getEntity(vs.id)!.position;
    expect(end.x).toBeGreaterThan(18);
    expect(minAbsZAtWall).toBeLessThan(1.6); // crossed the wall in the wide gap around z = -7.5
  });
});
