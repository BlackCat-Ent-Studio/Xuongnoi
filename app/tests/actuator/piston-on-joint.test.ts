import { describe, expect, it } from 'vitest';
import { rig, type NodeSpec } from '../helpers/arm-rig';

/**
 * A piston bolted on the tip of a pitch joint (pivot at x = 0, y = 3, 3D view). Barrel 1.2 m (stroke 1 + 0.2) and a 0.6 m
 * head: with the rod in, the head centre is 1.5 m from the pivot along the arm. Asking for -90 turns the piston down
 * onto a table whose top is at y = 2.
 */
function pistonArm(o: { torque: number }) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 8 } }],
    ['post', 'block', { position: { x: -1, y: 3, z: 0 }, size: { x: 1.2, y: 1, z: 0.6 } }],
    ['table', 'block', { position: { x: 0, y: 1, z: 0 }, size: { x: 4, y: 2, z: 3 } }],
    ['go', 'on-start'],
    ['ang', 'const', { value: -90 }],
    ['j', 'joint', { min: -90, max: 90, start: 0, maxTorque: o.torque, mount: { x: 1, y: 0, z: 0 } }],
    ['p', 'linear-actuator', { stroke: 1, maxForce: 100, headSize: 0.6 }],
  ];
  const r = rig(
    nodes,
    [
      ['post', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['ang', 'value', 'j', 'angle'],
      ['j', 'tip', 'p', 'base'],
    ],
    '3d',
  );
  return { ...r, head: () => r.world.getEntity(String(r.out('p', 'tip')))! };
}

describe('a piston on a turning joint', () => {
  it('the head never goes into the table: the joint stops short, overloaded, not reached', () => {
    const r = pistonArm({ torque: 500 });
    let lowest = Infinity;
    for (let i = 0; i < 300; i++) {
      r.tick();
      lowest = Math.min(lowest, r.head().position.y - r.head().size.y / 2);
    }
    expect(lowest).toBeGreaterThanOrEqual(2 - 0.02);
    expect(Number(r.out('j', 'angleNow'))).toBeGreaterThan(-45);
    expect(r.out('j', 'overloaded')).toBe(true);
    expect(r.out('j', 'reached')).toBe(false);
  });

  it('a piston carried by the joint with nothing in the way reaches its angle', () => {
    const r = pistonArm({ torque: 500 });
    r.set('ang', { value: 0 });
    r.tick(120);
    expect(r.out('j', 'reached')).toBe(true);
    expect(r.out('j', 'overloaded')).toBe(false);
  });
});
