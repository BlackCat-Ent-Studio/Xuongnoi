import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { addWire } from '../../src/engine/wiring';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { headingOf, spotCentre } from '../../src/nodes/line-sensor';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const node = (id: string, kind: string, params: Params = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });
const robotView = (heading: number): EntityView => ({
  id: 'r', kind: 'robot', ownerNodeId: 'r', position: { x: 2, y: 0.3, z: 1 }, size: { x: 1, y: 0.3, z: 0.7 }, color: '#fff', visible: true,
  robot: { length: 1, width: 0.7, speed: 0, heading, turnRate: 0, wheels: [] },
});

describe('line sensor on a robot chassis', () => {
  it('reads the chassis heading (0 = +x, clockwise seen from above)', () => {
    const h0 = headingOf(robotView(0), '2d-top');
    expect(h0.x).toBeCloseTo(1);
    expect(h0.z).toBeCloseTo(0);
    const h90 = headingOf(robotView(Math.PI / 2), '2d-top');
    expect(h90.x).toBeCloseTo(0);
    expect(h90.z).toBeCloseTo(1);
  });

  it('forward and side offsets rotate with the chassis', () => {
    const a = spotCentre(robotView(0), '2d-top', 1, 0.5);
    expect(a.u).toBeCloseTo(3);
    expect(a.v).toBeCloseTo(1.5); // right of a +x nose is +z
    const b = spotCentre(robotView(Math.PI / 2), '2d-top', 1, 0.5);
    expect(b.u).toBeCloseTo(1.5); // nose +z: right is -x
    expect(b.v).toBeCloseTo(2);
    const c = spotCentre(robotView(Math.PI), '2d-top', 1, 0.5);
    expect(c.u).toBeCloseTo(1);
    expect(c.v).toBeCloseTo(0.5);
  });

  it('a chassis that spins in place turns the eye away from a line it first looked at', () => {
    const nodes = [
      node('body', 'robot-body', { position: { x: 0, y: 0.3, z: 0 } }),
      node('ml', 'motor', { side: -0.4 }),
      node('mr', 'motor', { side: 0.4 }),
      node('pl', 'const', { value: 0.5 }),
      node('pr', 'const', { value: -0.5 }),
      node('track', 'line-track', { shape: 'straight', length: 12, center: { x: 0, y: 0.5, z: 0 } }),
      node('eye', 'line-sensor', { forward: 1, side: 0 }),
    ];
    let g: Graph = { nodes, wires: [] };
    const wires: [string, string, string, string][] = [
      ['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'], ['pl', 'value', 'ml', 'power'], ['pr', 'value', 'mr', 'power'],
      ['body', 'self', 'eye', 'who'],
    ];
    for (const [fn, fp, tn, tp] of wires) {
      const res = addWire(g, { node: fn, port: fp }, { node: tn, port: tp });
      if ('ok' in res) throw new Error(res.reason);
      g = res;
    }
    const world = createWorld('2d-top');
    const rt = createRuntime(g, world, '2d-top');
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    expect(rt.getOutput('eye', 'onLine')).toBe(true);
    let turned = false;
    for (let i = 0; i < 60 * 12 && !turned; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      const heading = world.entities().find((e) => e.kind === 'robot')!.robot!.heading;
      if (Math.abs(Math.sin(heading)) > 0.95) {
        turned = true;
        expect(rt.getOutput('eye', 'onLine')).toBe(false);
      }
    }
    expect(turned).toBe(true);
  });
});
