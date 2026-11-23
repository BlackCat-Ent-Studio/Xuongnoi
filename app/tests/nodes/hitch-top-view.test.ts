import { describe, expect, it } from 'vitest';
import { hitchRig } from '../world/hitch-rig';

/**
 * "Chốt gài" seen from straight above. A cage is only a painted square there (nothing of it is a block with the cage
 * look), so it cannot be taken; a loose item can.
 */
describe('a hitch in the top-down view', () => {
  const make = () =>
    hitchRig({
      mode: '2d-top',
      nodes: [['crate', 'item', { shape: 'crate', position: { x: 0.9, y: 0.15, z: 3 }, size: { x: 0.3, y: 0.3, z: 0.3 } }]],
      hitch: { what: 'both', reach: 1.5, offset: { x: 0.8, y: 0, z: 0 } },
    });

  it('the painted cage is not taken, however near the robot stands', () => {
    const r = make();
    r.send(0, 0);
    expect(r.drive(20)).toBe(true);
    r.latch(true);
    r.play(1);
    expect(r.holding()).toBe(false);
    expect(r.out('hitch', 'thing')).toBeNull();
  });

  it('a loose crate is taken, drawn to 0.8 m ahead of the nose and carried there round a turn', () => {
    const r = make();
    r.send(0, 3);
    expect(r.drive(20)).toBe(true);
    r.latch(true);
    r.play(3);
    expect(r.out('hitch', 'thing')).toBe(r.entity('crate')!.id);
    const off = (): number => {
      const t = r.tug();
      const c = r.entity('crate')!.position;
      return Math.hypot(c.x - (t.position.x + Math.cos(t.robot!.heading) * 0.8), c.z - (t.position.z + Math.sin(t.robot!.heading) * 0.8));
    };
    expect(off()).toBeLessThan(1e-9);
    let worst = 0;
    r.send(4, 3);
    expect(
      r.drive(20, () => {
        worst = Math.max(worst, off());
      }),
    ).toBe(true);
    expect(worst).toBeLessThan(0.001);
    expect(r.entity('crate')!.position.x).toBeGreaterThan(4.5);
    r.latch(false);
    r.play(0.2);
    const set = { ...r.entity('crate')!.position };
    r.send(0, 0);
    r.drive(20);
    expect(r.entity('crate')!.position).toEqual(set);
  });
});
