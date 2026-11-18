import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { block, crate, crateWorld, floor, view } from './crate-helpers';

/**
 * "Vật lý thật": a rigid crate that rests on a support touches it, it is not inside it. The free-spot search that decides where a
 * teleported crate may stand therefore takes a thin skin (1 cm) off every face, and a crate never pops up half a metre (the search
 * step) because it rests on a floor, a table or a piston head. These cover the two places a rigid crate is put somewhere by game code
 * while it rests on something: carried by a piston head, and sent through a portal.
 *
 * Hand numbers: a 0.4 m cube resting on a support stays within 1 mm of its place when teleported onto itself; a piston head that
 * rises 1.0 m carries a crate resting on it 1.0 m (+- 2 cm) and no tick moves it by more than 0.05 m more than the head
 * (the head rises 1 m/s = 0.0167 m a tick); a crate sent through a portal arrives standing on the floor under the exit (y = 0.2 +- 1 cm).
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

describe('a rigid crate resting on a support is not moved by being teleported', () => {
  it('onto its own place: within 1 mm, not lifted 0.5 m', async () => {
    const w = await crateWorld();
    floor(w);
    const c = crate(w, 0, 0.2, 0);
    for (let i = 0; i < 60; i++) w.step(TICK_DT);
    const at = view(w, c).position;
    const spot = w.teleport(c, { ...at }, false);
    expect(spot).not.toBeNull();
    expect(Math.hypot(spot!.x - at.x, spot!.y - at.y, spot!.z - at.z)).toBeLessThan(0.001);
    for (let i = 0; i < 30; i++) w.step(TICK_DT);
    expect(Math.abs(view(w, c).position.y - at.y)).toBeLessThan(0.01);
  });

  it('on a table, 0.3 m from where it rests: lands on the table, not 0.5 m above it', async () => {
    const w = await crateWorld();
    floor(w);
    block(w, 0, 0.5, 0, 4, 1, 4);
    const c = crate(w, 0, 1.2, 0);
    for (let i = 0; i < 60; i++) w.step(TICK_DT);
    const spot = w.teleport(c, { x: 0.3, y: 1.2, z: 0 }, false);
    expect(spot).not.toBeNull();
    expect(Math.abs(spot!.y - 1.2)).toBeLessThan(0.001);
    expect(Math.abs(spot!.x - 0.3)).toBeLessThan(0.001);
  });
});

describe('a rigid crate carried by a piston head does not pop', () => {
  // Piston pointing up from the floor: stroke 1 m, head 0.6 m, 1 m/s. The barrel is 1.2 m long, so the head (0.6 m) stands from 1.2 to 1.8 m at the start and the 0.4 m crate rests on it.
  const board = (): { nodes: NodeSpec[]; wires: WireSpec[] } => ({
    nodes: [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
      ['on', 'const', { value: 1 }],
      ['p', 'linear-actuator', { position: { x: 0, y: 0, z: 0 }, orient: 'up', stroke: 1, speed: 1, maxForce: 500, headSize: 0.6 }],
    ],
    wires: [['on', 'value', 'p', 'position']],
  });
  it('rising 1 m with the crate on its head: the crate rises 1 m (+- 2 cm) and never jumps', () => {
    const { nodes, wires } = board();
    nodes.push(['c', 'item', { shape: 'crate', position: { x: 0, y: 1.2 + 0.6 + 0.2 + 0.001, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 2, mu: 0.5 }]);
    const r = rig(nodes, wires, '3d', false, true, rapier);
    const y0 = r.entity('c')!.position.y;
    let worstJump = 0;
    let last = y0;
    for (let i = 0; i < 180; i++) {
      r.tick();
      const y = r.entity('c')!.position.y;
      worstJump = Math.max(worstJump, Math.abs(y - last));
      last = y;
    }
    // The head rises 1 m/s: 0.0167 m a tick; the crate rides at most 0.05 m a tick, never the 0.5 m of a free-spot search step.
    expect(worstJump).toBeLessThan(0.05);
    expect(last - y0).toBeGreaterThan(0.9);
    expect(last - y0).toBeLessThan(1.02);
    expect(Math.abs(r.entity('c')!.position.x)).toBeLessThan(0.02);
  });

  it('pushed along a support by a horizontal piston: slides on the support, stays at its height (+- 1 cm)', async () => {
    const w = await crateWorld();
    floor(w);
    block(w, 3, 0.5, 0, 8, 1, 4);
    const c = crate(w, 1, 1.2, 0);
    for (let i = 0; i < 60; i++) w.step(TICK_DT);
    const y0 = view(w, c).position.y;
    // A pusher block moved by game code 1 m along +x, in 1.7 cm steps (what a piston head does).
    const head = block(w, -0.3, 1.2, 0, 0.6, 0.6, 0.6);
    let worst = 0;
    for (let i = 0; i < 120; i++) {
      w.moveBlock(head, { x: -0.3 + i * 0.0167, y: 1.2, z: 0 });
      w.step(TICK_DT);
      worst = Math.max(worst, Math.abs(view(w, c).position.y - y0));
    }
    expect(worst).toBeLessThan(0.01);
    expect(view(w, c).position.x).toBeGreaterThan(1.5);
  });
});

describe('a rigid crate sent through a portal arrives standing on the floor', () => {
  it('exit portal on the floor: the crate stands under it (y = 0.2 +- 1 cm), then stays', async () => {
    const w = await crateWorld();
    floor(w);
    const a = w.spawn({ kind: 'block', ownerNodeId: 'pa', position: { x: -3, y: 1, z: 0 }, size: { x: 1.2, y: 2, z: 1.2 }, color: '#80f', look: 'portal', solid: false });
    const b = w.spawn({ kind: 'block', ownerNodeId: 'pb', position: { x: 4, y: 1, z: 0 }, size: { x: 1.2, y: 2, z: 1.2 }, color: '#80f', look: 'portal', solid: false });
    w.setPortal(a, { partner: b, pair: '', enabled: true, cooldown: 0.5 });
    w.setPortal(b, { partner: a, pair: '', enabled: true, cooldown: 0.5 });
    const c = crate(w, -3, 0.2, 0);
    let arrived = false;
    let worstY = 0;
    for (let i = 0; i < 120; i++) {
      w.step(TICK_DT);
      const p = view(w, c).position;
      if (p.x > 3) {
        arrived = true;
        worstY = Math.max(worstY, Math.abs(p.y - 0.2));
      }
    }
    expect(arrived).toBe(true);
    expect(Math.abs(view(w, c).position.x - 4)).toBeLessThan(0.05);
    expect(worstY).toBeLessThan(0.01);
  });
});
