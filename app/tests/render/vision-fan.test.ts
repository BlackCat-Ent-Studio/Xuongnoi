import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type SolidBox } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { FanSpec, VisionFanLayer, fanOutline, fanSpecs } from '../../src/render/vision-fan';
import { createWorld } from '../../src/world/world';

const spec = (over: Partial<FanSpec> = {}): FanSpec => ({
  id: 'g',
  x: 0,
  z: 0,
  feetY: 0,
  eyeY: 0.5,
  facing: { x: 0, z: 1 },
  range: 10,
  angle: 90,
  walls: true,
  seen: false,
  ...over,
});
const crate: SolidBox = { position: { x: 0, y: 1.1, z: 4 }, size: { x: 2, y: 2.2, z: 2 } };

describe('fan outline', () => {
  it('reaches the full range with nothing in the way, inside the cone', () => {
    const pts = fanOutline(spec(), []);
    expect(pts.length).toBeGreaterThan(10);
    for (const p of pts) expect(Math.hypot(p.x, p.z)).toBeCloseTo(10, 5);
    expect(Math.min(...pts.map((p) => p.z))).toBeGreaterThan(6.9);
  });

  it('is cut short by a crate that reaches eye height, and only there', () => {
    const pts = fanOutline(spec(), [crate]);
    const straight = pts.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a));
    expect(straight.z).toBeCloseTo(3, 1);
    expect(Math.max(...pts.map((p) => Math.hypot(p.x, p.z)))).toBeCloseTo(10, 5);
  });

  it('ignores low blocks (floor) for hiding, and every block when walls do not hide', () => {
    const floor: SolidBox = { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 } };
    for (const p of fanOutline(spec(), [floor])) expect(Math.hypot(p.x, p.z)).toBeCloseTo(10, 5);
    for (const p of fanOutline(spec({ walls: false }), [crate])) expect(Math.hypot(p.x, p.z)).toBeCloseTo(10, 5);
  });
});

it('stops at the edge of the floor the viewer stands on', () => {
  const small: SolidBox = { position: { x: 0, y: -0.5, z: 2 }, size: { x: 30, y: 1, z: 8 } };
  const pts = fanOutline(spec(), [small]);
  expect(Math.max(...pts.map((p) => p.z))).toBeLessThanOrEqual(6.0001);
  expect(Math.max(...pts.map((p) => p.z))).toBeGreaterThan(5.9);
});

describe('fan layer', () => {
  it('shows a fan for a viewer with a sensor, red when it sees, and takes it away with the viewer', () => {
    registerAllNodes();
    const nodes: GraphNode[] = [
      { id: 'eye', kind: 'vision-sensor', params: { range: 6, angle: 90 }, pos: { x: 0, y: 0 } },
      { id: 'g', kind: 'character', params: { position: { x: 0, y: 1, z: 0 }, role: 'bot' }, pos: { x: 0, y: 0 } },
      { id: 'floor', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 }, type: 'solid' }, pos: { x: 0, y: 0 } },
      { id: 'prey', kind: 'character', params: { position: { x: 0, y: 1, z: 20 }, role: 'bot' }, pos: { x: 0, y: 0 } },
    ];
    const wires = [
      { id: 'w1', from: { node: 'g', port: 'self' }, to: { node: 'eye', port: 'viewer' } },
      { id: 'w2', from: { node: 'prey', port: 'self' }, to: { node: 'eye', port: 'target' } },
    ];
    const graph: Graph = { nodes, wires };
    const world = createWorld('3d');
    const rt = createRuntime(graph, world, '3d');
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const specs = fanSpecs(world, rt.tickIndex, world.entities(), '3d');
    expect(specs).toHaveLength(1);
    expect(specs[0]!.range).toBe(6);
    expect(specs[0]!.seen).toBe(false);
    expect(fanSpecs(world, rt.tickIndex, world.entities(), '2d-side')).toEqual([]);
    expect(fanSpecs(world, rt.tickIndex + 10, world.entities(), '3d')).toEqual([]);

    const group = new THREE.Group();
    const layer = new VisionFanLayer(group);
    layer.sync(specs, () => world.solidBoxes());
    expect(group.children).toHaveLength(2);
    layer.sync([], () => []);
    expect(group.children).toHaveLength(0);
    layer.dispose();
  });
});
