import { describe, expect, it } from 'vitest';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import type { EntityView, ViewMode } from '../../src/engine/types';

/**
 * A barrier arm: a gantry block 3 m up beside the gate, a pitch joint on its side (pivot at x = 3, y = 3) and a 3 m link. Angle -90 hangs
 * the link straight down to the floor (a closed barrier); +90 swings it up out of the way. Walkers start at x = 0.
 */
interface Barrier {
  solid: 'yes' | 'no';
  angle: number;
  torque?: number;
  walker?: 'character' | 'robot';
  mode?: ViewMode;
}

function barrier(o: Barrier) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
    ['gantry', 'block', { position: { x: 3.8, y: 3, z: 0 }, size: { x: 1, y: 1, z: 0.6 } }],
    ['go', 'on-start'],
    ['ang', 'const', { value: o.angle }],
    ['j', 'joint', { min: -90, max: 90, start: o.angle, maxTorque: o.torque ?? 500, mount: { x: -0.8, y: 0, z: 0 }, solid: o.solid }],
    ['l', 'link', { length: 3, mass: 1, thickness: 0.2, solid: o.solid }],
  ];
  const wires: WireSpec[] = [
    ['gantry', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['ang', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
  ];
  if ((o.walker ?? 'character') === 'character') {
    nodes.push(['mx', 'const', { value: 1 }], ['who', 'character', { position: { x: 0, y: 1, z: 0 }, speed: 3 }]);
    wires.push(['mx', 'value', 'who', 'moveX']);
  } else {
    nodes.push(
      ['who', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3, pushObjects: 'yes' }],
      ['ml', 'motor', { side: -0.4, maxForce: 30 }],
      ['mr', 'motor', { side: 0.4, maxForce: 30 }],
      ['pw', 'const', { value: 1 }],
    );
    wires.push(['who', 'self', 'ml', 'body'], ['who', 'self', 'mr', 'body'], ['pw', 'value', 'ml', 'power'], ['pw', 'value', 'mr', 'power']);
  }
  const r = rig(nodes, wires, o.mode ?? '2d-side');
  return { ...r, whoX: (): number => r.entity('who')!.position.x, seconds: (s: number) => r.tick(Math.round(s * 60)) };
}

describe('a solid arm is a barrier', () => {
  it('lowered: a walking character is stopped by the link', () => {
    const r = barrier({ solid: 'yes', angle: -90 });
    r.seconds(4);
    // Link hangs at x = 3 (0.2 thick): the character's centre cannot pass x = 2.9 - half its width.
    expect(r.whoX()).toBeLessThan(2.9);
    expect(r.whoX()).toBeGreaterThan(1.5);
  });

  it('raised: the same character walks right under it', () => {
    const r = barrier({ solid: 'yes', angle: 90 });
    r.seconds(4);
    expect(r.whoX()).toBeGreaterThan(5);
  });

  it('lowered: a robot chassis is stopped, raised it drives past', () => {
    const down = barrier({ solid: 'yes', angle: -90, walker: 'robot' });
    down.seconds(8);
    expect(down.whoX()).toBeLessThan(2.9);
    const up = barrier({ solid: 'yes', angle: 90, walker: 'robot' });
    up.seconds(8);
    expect(up.whoX()).toBeGreaterThan(5);
  });

  it('works in the 3D view too', () => {
    const down = barrier({ solid: 'yes', angle: -90, mode: '3d' });
    down.seconds(4);
    expect(down.whoX()).toBeLessThan(2.9);
    const up = barrier({ solid: 'yes', angle: 90, mode: '3d' });
    up.seconds(4);
    expect(up.whoX()).toBeGreaterThan(5);
  });

  it('off (the default): the arm is only a drawing and the character walks through it, with no extra bodies', () => {
    const off = barrier({ solid: 'no', angle: -90 });
    off.seconds(4);
    expect(off.whoX()).toBeGreaterThan(5);
    off.tick(2);
    const on = barrier({ solid: 'yes', angle: -90 });
    on.tick(2);
    expect(on.world.entities().length).toBeGreaterThan(off.world.entities().length);
  });

  it('an arm that was never given the setting behaves like off', () => {
    const r = rig(
      [
        ['gantry', 'block', { position: { x: 3.8, y: 3, z: 0 }, size: { x: 1, y: 1, z: 0.6 } }],
        ['go', 'on-start'],
        ['j', 'joint', { mount: { x: -0.8, y: 0, z: 0 } }],
        ['l', 'link', { length: 3 }],
      ],
      [
        ['gantry', 'self', 'j', 'base'],
        ['go', 'started', 'j', 'power'],
        ['j', 'tip', 'l', 'base'],
      ],
    );
    r.tick(30);
    expect(r.world.entities().filter((e) => e.ownerNodeId === 'l')).toHaveLength(1);
    expect(r.world.entities().filter((e) => e.ownerNodeId === 'j')).toHaveLength(1);
  });
});

describe('a solid arm holds up loose items', () => {
  function shelf(solid: 'yes' | 'no') {
    const r = rig(
      [
        ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
        ['post', 'block', { position: { x: 2.2, y: 3, z: 0 }, size: { x: 1, y: 1, z: 0.6 } }],
        ['go', 'on-start'],
        ['j', 'joint', { min: -90, max: 90, start: 0, maxTorque: 500, mount: { x: 0.8, y: 0, z: 0 }, solid }],
        ['l', 'link', { length: 3, mass: 1, thickness: 0.2, solid }],
        ['c', 'item', { shape: 'crate', position: { x: 4.5, y: 5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: 2 }],
      ],
      [
        ['post', 'self', 'j', 'base'],
        ['go', 'started', 'j', 'power'],
        ['j', 'tip', 'l', 'base'],
      ],
    );
    r.tick(180);
    return r.entity('c')!.position.y;
  }

  it('a crate dropped on a horizontal link lands on it; with the setting off it falls through to the floor', () => {
    // Link top at y = 3.1, crate half height 0.3.
    expect(shelf('yes')).toBeCloseTo(3.4, 1);
    expect(shelf('no')).toBeCloseTo(0.3, 1);
  });
});

describe('a solid arm is a gate in the top view', () => {
  /** A yaw joint on a post at z = 3 (x = 3) with a 6 m link: yaw 90 stretches it across the path along z, yaw 0 lays it along x, out of the way. */
  function gate(yaw: number, walker: 'character' | 'robot') {
    const nodes: NodeSpec[] = [
      ['post', 'block', { position: { x: 3, y: 0.1, z: 3.9 }, size: { x: 1, y: 0.2, z: 1.4 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: yaw }],
      ['j', 'joint', { axis: 'yaw', min: -90, max: 90, start: yaw, maxTorque: 500, mount: { x: 0, y: 0.1, z: -0.9 }, solid: 'yes' }],
      ['l', 'link', { length: 6, mass: 1, thickness: 0.2, solid: 'yes' }],
    ];
    const wires: WireSpec[] = [
      ['post', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['ang', 'value', 'j', 'angle'],
      ['j', 'tip', 'l', 'base'],
    ];
    if (walker === 'character') {
      nodes.push(['mx', 'const', { value: 1 }], ['who', 'character', { position: { x: 0, y: 0.4, z: 0 }, speed: 3 }]);
      wires.push(['mx', 'value', 'who', 'moveX']);
    } else {
      nodes.push(
        ['who', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3, pushObjects: 'yes' }],
        ['ml', 'motor', { side: -0.4, maxForce: 30 }],
        ['mr', 'motor', { side: 0.4, maxForce: 30 }],
        ['pw', 'const', { value: 1 }],
      );
      wires.push(['who', 'self', 'ml', 'body'], ['who', 'self', 'mr', 'body'], ['pw', 'value', 'ml', 'power'], ['pw', 'value', 'mr', 'power']);
    }
    const r = rig(nodes, wires, '2d-top');
    r.tick(480);
    return r.entity('who')!.position.x;
  }

  it('closed: a character and a robot are stopped; open: they pass', () => {
    expect(gate(90, 'character')).toBeLessThan(2.9);
    expect(gate(0, 'character')).toBeGreaterThan(5);
    expect(gate(90, 'robot')).toBeLessThan(2.9);
    expect(gate(0, 'robot')).toBeGreaterThan(5);
  });
});

describe('a turning solid arm never tunnels', () => {
  /** An arm out to +x at height 3; a wall block under its path. Asking for -90 swings it down onto the wall. */
  function swing(torque: number, wall = true) {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
      ['pivot', 'block', { position: { x: -1, y: 3, z: 0 }, size: { x: 1.2, y: 1, z: 0.6 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: -90 }],
      ['j', 'joint', { min: -90, max: 90, start: 0, maxTorque: torque, mount: { x: 1, y: 0, z: 0 }, solid: 'yes' }],
      ['l', 'link', { length: 2, mass: 1, thickness: 0.2, solid: 'yes' }],
    ];
    if (wall) nodes.push(['wall', 'block', { position: { x: 1.4, y: 1, z: 0 }, size: { x: 0.4, y: 2, z: 2 } }]);
    const r = rig(nodes, [
      ['pivot', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['ang', 'value', 'j', 'angle'],
      ['j', 'tip', 'l', 'base'],
    ]);
    const cubes = (): EntityView[] => r.world.entities().filter((e) => e.ownerNodeId === 'l' || e.ownerNodeId === 'j');
    return { ...r, cubes };
  }

  it('stalls on a wall block: overloaded, reached false, and no cube ever enters the wall', () => {
    const r = swing(500);
    const wall = r.world.entities().find((e) => e.ownerNodeId === 'wall')!;
    let worst = -Infinity;
    for (let i = 0; i < 300; i++) {
      r.tick();
      for (const c of r.cubes()) {
        const inside = Math.min(...(['x', 'y', 'z'] as const).map((k) => (c.size[k] + wall.size[k]) / 2 - Math.abs(c.position[k] - wall.position[k])));
        if (c.size.x === 0.2 || c.size.x === 0.3) worst = Math.max(worst, inside);
      }
    }
    expect(worst).toBeLessThan(0.02);
    expect(Number(r.out('j', 'angleNow'))).toBeGreaterThan(-60);
    expect(r.out('j', 'overloaded')).toBe(true);
    expect(r.out('j', 'reached')).toBe(false);
  });

  it('without the wall the same arm reaches its angle', () => {
    const r = swing(500, false);
    r.tick(300);
    expect(Number(r.out('j', 'angleNow'))).toBeCloseTo(-90, 0);
    expect(r.out('j', 'overloaded')).toBe(false);
    expect(r.out('j', 'reached')).toBe(true);
  });
});

describe('a turning solid arm pushes only within its torque', () => {
  /**
   * Top view, yaw joint at the origin, 2 m link along +x. A crate lies in the way of the sweep toward -z, about 1.5 m
   * out. The crate (m kg, mu 0.5) needs 0.5 * m * 9.81 N at about 1.5 m of lever.
   */
  function sweep(torque: number, kg: number) {
    const nodes: NodeSpec[] = [
      ['pivot', 'block', { position: { x: -1, y: 0.3, z: 0 }, size: { x: 1.2, y: 0.6, z: 0.6 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: 60 }],
      ['j', 'joint', { axis: 'yaw', min: -90, max: 90, start: 0, maxTorque: torque, mount: { x: 1, y: 0, z: 0 }, solid: 'yes' }],
      ['l', 'link', { length: 2, mass: 1, thickness: 0.2, solid: 'yes' }],
      ['c', 'item', { shape: 'crate', position: { x: 1.5, y: 0.3, z: -0.5 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: kg }],
    ];
    return rig(
      nodes,
      [
        ['pivot', 'self', 'j', 'base'],
        ['go', 'started', 'j', 'power'],
        ['ang', 'value', 'j', 'angle'],
        ['j', 'tip', 'l', 'base'],
      ],
      '2d-top',
    );
  }

  it('10 kg crate (49 N at about 1.5 m is 74 N m): 200 N m pushes it aside, 40 N m cannot', () => {
    const strong = sweep(200, 10);
    strong.tick(240);
    expect(strong.out('j', 'overloaded')).toBe(false);
    expect(strong.out('j', 'reached')).toBe(true);
    expect(strong.entity('c')!.position.z).toBeLessThan(-1);

    const weak = sweep(40, 10);
    weak.tick(240);
    expect(weak.out('j', 'overloaded')).toBe(true);
    expect(weak.out('j', 'reached')).toBe(false);
    expect(weak.entity('c')!.position.z).toBeCloseTo(-0.5, 2);
    expect(Number(weak.out('j', 'angleNow'))).toBeLessThan(20);
  });
});
