import { describe, expect, it } from 'vitest';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { getNodeDef } from '../../src/engine/registry';
import { parseBoard, serializeBoard } from '../../src/io';
import { createNode } from '../../src/editor/editor-state';
import type { Graph, ParamValue, ViewMode } from '../../src/engine/types';

/**
 * Gripper on a small block at the origin pointing +x: the grasp point (middle of the fingers) is 0.3 m ahead, at
 * (0.3, 0.3). The opening is `width`. A crate is "between the fingers" when the grasp point is inside it along the arm
 * (and along the third direction in 3D) and it fits whole between the open fingers.
 */
function hand(crate: { x: number; y?: number; z?: number; size?: number }, gripper: Record<string, ParamValue> = {}, mode: ViewMode = '2d-side') {
  const size = crate.size ?? 0.4;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 4 } }],
    ['hand', 'block', { position: { x: 0, y: 0.3, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 }, type: 'pickup' }],
    // A shelf under the crate keeps it where it was put.
    ['shelf', 'block', { position: { x: crate.x, y: (crate.y ?? 0.3) - size / 2 - 0.25, z: crate.z ?? 0 }, size: { x: 1.2, y: 0.5, z: 2 } }],
    ['g', 'gripper', { width: 1, ...gripper }],
    ['c', 'item', { shape: 'crate', position: { x: crate.x, y: crate.y ?? 0.3, z: crate.z ?? 0 }, size: { x: size, y: size, z: size }, mass: 1 }],
    ['k', 'key', { key: 'Space' }],
  ];
  const wires: WireSpec[] = [
    ['hand', 'self', 'g', 'base'],
    ['k', 'held', 'g', 'close'],
  ];
  const r = rig(nodes, wires, mode);
  r.tick(20);
  return r;
}

const between = { grip: 'between' };

describe('gripper rule "between the fingers"', () => {
  it('a crate centred on the grasp point is grippable and gets held', () => {
    const r = hand({ x: 0.3 }, between);
    expect(r.out('g', 'inReach')).toBe(true);
    expect(r.out('g', 'candidate')).toBe(r.entity('c')!.id);
    r.hold('Space');
    r.tick(10);
    expect(r.out('g', 'holding')).toBe(true);
  });

  it('a crate only 0.4 m ahead of the grasp point (inside the old 0.5 m reach) is not grippable: the point is not inside it', () => {
    const r = hand({ x: 0.7 }, between);
    expect(r.out('g', 'inReach')).toBe(false);
    expect(r.out('g', 'candidate')).toBeNull();
    r.hold('Space');
    r.tick(10);
    expect(r.out('g', 'holding')).toBe(false);
    const old = hand({ x: 0.7 }, { grip: 'reach', reach: 0.5 });
    expect(old.out('g', 'inReach')).toBe(true);
  });

  it('the crate must lie between the open fingers: 0.2 m off the middle fits a 1 m opening, 0.35 m does not', () => {
    // Crate 0.4 wide: half 0.2; the opening reaches 0.5 each side of the middle.
    expect(hand({ x: 0.3, y: 0.5 }, between).out('g', 'inReach')).toBe(true);
    expect(hand({ x: 0.3, y: 0.65 }, between).out('g', 'inReach')).toBe(false);
    expect(hand({ x: 0.3, y: 0.65 }, { grip: 'reach', reach: 0.5 }).out('g', 'inReach')).toBe(true);
  });

  it('a crate that is wider than the opening is not grippable even when centred', () => {
    expect(hand({ x: 0.3 }, { ...between, width: 0.3 }).out('g', 'inReach')).toBe(false);
    expect(hand({ x: 0.3 }, { ...between, width: 0.5 }).out('g', 'inReach')).toBe(true);
  });

  it('in 3D the third direction counts too: a crate resting under the fingers is out, one around them is in', () => {
    // The hand floats at y 0.3; the grasp point is at y 0.3. A 0.4 crate at y 0.3 contains it, at y 0.9 does not.
    expect(hand({ x: 0.3, y: 0.3 }, between, '3d').out('g', 'inReach')).toBe(true);
    expect(hand({ x: 0.3, y: 0.9 }, between, '3d').out('g', 'inReach')).toBe(false);
  });

  it('the pose decides: swinging the arm brings the grasp point into a crate or out of it', () => {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 4 } }],
      ['ped', 'block', { position: { x: -0.5, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: 0 }],
      ['j', 'joint', { start: 0, min: -90, max: 90, maxTorque: 100, mount: { x: 0.5, y: 0.5, z: 0 } }],
      ['l', 'link', { length: 0.8, mass: 0 }],
      ['table', 'block', { position: { x: 1.1, y: 0.4, z: 0 }, size: { x: 1, y: 0.8, z: 1.5 } }],
      ['g', 'gripper', { width: 1, grip: 'between', mass: 0 }],
      ['c', 'item', { shape: 'crate', position: { x: 1.1, y: 1.0, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 1 }],
    ];
    const a = rig(
      nodes,
      [
        ['ped', 'self', 'j', 'base'],
        ['go', 'started', 'j', 'power'],
        ['ang', 'value', 'j', 'angle'],
        ['j', 'tip', 'l', 'base'],
        ['l', 'tip', 'g', 'base'],
      ],
    );
    // Grasp point of the level arm: x 0.8 + 0.3 = 1.1, y 1.0: in the crate.
    a.tick(60);
    expect(a.out('g', 'inReach')).toBe(true);
    // Lifted 40 degrees the point is about 0.7 m higher: out of it, though the old reach rule would still see it (reach 0.8).
    a.set('ang', { value: 40 });
    a.tick(90);
    expect(Number(a.out('j', 'angleNow'))).toBeCloseTo(40, 0);
    expect(a.out('g', 'inReach')).toBe(false);
  });
});

describe('gripper rule on saved boards', () => {
  it('a new card starts with the between-fingers rule', () => {
    const node = createNode({ nodes: [], wires: [] }, 'gripper', { x: 0, y: 0 })!;
    expect(node.params.grip).toBe('between');
  });

  it('a card without the setting (an old board) keeps the reach rule, in the file, the inspector default and the run', () => {
    const def = getNodeDef('gripper')!;
    const param = def.params.find((p) => p.id === 'grip')!;
    expect(param.default).toBe('between');
    expect(param.legacyDefault).toBe('reach');
    const graph: Graph = { nodes: [{ id: 'g', kind: 'gripper', params: { width: 1 }, pos: { x: 0, y: 0 } }], wires: [] };
    const text = JSON.stringify({ format_version: 1, name: 'old', mode: '2d-side', graph });
    const loaded = parseBoard(text);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.board.graph.nodes[0]!.params.grip).toBe('reach');
    // And it survives a save and load unchanged.
    const again = parseBoard(serializeBoard(loaded.board));
    expect(again.ok && again.board.graph.nodes[0]!.params.grip).toBe('reach');
    // Played without the setting at all: the 0.4 m ahead crate is still in reach.
    const r = hand({ x: 0.7 }, {});
    expect(r.out('g', 'inReach')).toBe(true);
  });
});
