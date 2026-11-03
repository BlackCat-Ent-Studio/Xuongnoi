import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import type { EntityView, Graph } from '../../src/engine/types';
import { TICK_DT } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { UiInputBuffer, createClickTracker, pickEntities } from '../../src/render/ui-input';
import { createWorld } from '../../src/world/world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

describe('UiInputBuffer', () => {
  it('hands clicks and picks over once, then forgets them', () => {
    const b = new UiInputBuffer();
    b.click('btn');
    b.pick(['e1']);
    const first = b.take();
    expect([...first.clicked]).toEqual(['btn']);
    expect([...first.picked]).toEqual(['e1']);
    const second = b.take();
    expect(second.clicked.size).toBe(0);
    expect(second.picked.size).toBe(0);
  });

  it('keeps a button held until released, and a press-release between ticks still reads as held once', () => {
    const b = new UiInputBuffer();
    b.hold('btn', true);
    expect(b.take().held.has('btn')).toBe(true);
    expect(b.peekHeld().held.has('btn')).toBe(true);
    b.hold('btn', false);
    expect(b.take().held.has('btn')).toBe(false);
    b.hold('btn', true);
    b.hold('btn', false);
    expect(b.take().held.has('btn')).toBe(true);
    expect(b.take().held.has('btn')).toBe(false);
  });

  it('peekHeld carries no one-shot events and clear() drops everything', () => {
    const b = new UiInputBuffer();
    b.click('a');
    b.hold('h', true);
    expect(b.peekHeld().clicked.size).toBe(0);
    b.clear();
    const t = b.take();
    expect(t.clicked.size + t.held.size + t.picked.size).toBe(0);
  });
});

describe('createClickTracker', () => {
  it('counts a short press as a click and a drag or other pointer as not', () => {
    const t = createClickTracker();
    t.down(1, 100, 100);
    expect(t.up(1, 103, 102)).toBe(true);
    t.down(1, 100, 100);
    expect(t.up(1, 140, 100)).toBe(false);
    t.down(1, 0, 0);
    expect(t.up(2, 0, 0)).toBe(false);
    expect(t.up(1, 0, 0)).toBe(false);
  });
});

function view(id: string, x: number, z: number, over: Partial<EntityView> = {}): EntityView {
  return { id, kind: 'block', ownerNodeId: 'o', position: { x, y: 0, z }, size: { x: 1, y: 1, z: 1 }, color: '#fff', visible: true, ...over };
}

describe('pickEntities', () => {
  const side = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  side.position.set(0, 0, 10);
  side.updateMatrixWorld(true);
  side.updateProjectionMatrix();

  it('side view reports every box on the ray and skips hidden, zone and held ones', () => {
    const list = [
      view('a', 0, 0),
      view('b', 0, 2),
      view('far', 3, 0),
      view('gone', 0, 0, { visible: false }),
      view('zone', 0, 0, { zone: true }),
      view('held', 0, 0, { inHand: true }),
    ];
    const hits = pickEntities(new THREE.Vector2(0, 0), side, list, false);
    expect(hits.sort()).toEqual(['a', 'b']);
  });

  it('perspective view reports only the nearest box', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.set(0, 0, 10);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const hits = pickEntities(new THREE.Vector2(0, 0), cam, [view('back', 0, -2), view('front', 0, 2)], true);
    expect(hits).toEqual(['front']);
  });

  it('misses empty space', () => {
    expect(pickEntities(new THREE.Vector2(0.9, 0.9), side, [view('a', 0, 0)], false)).toEqual([]);
  });
});

describe('runtime input plumbing', () => {
  const graph: Graph = {
    nodes: [
      { id: 'btn', kind: 'ui-button', params: {}, pos: { x: 0, y: 0 } },
      { id: 'start', kind: 'ui-start', params: {}, pos: { x: 0, y: 0 } },
    ],
    wires: [],
  };

  it('delivers input.ui to the nodes and keeps ticks without it working', () => {
    const world = createWorld('2d-side');
    const rt = createRuntime(wireStarts(graph, '2d-side'), world, '2d-side');
    rt.tick({ keysDown: new Set() });
    expect(rt.getOutput('btn', 'pressed')).toBe(false);
    rt.tick({ keysDown: new Set(), ui: { clicked: new Set(['btn', 'start']), held: new Set(['btn']), picked: new Set() } });
    expect(rt.getOutput('btn', 'pressed')).toBe(true);
    expect(rt.getOutput('btn', 'held')).toBe(true);
    expect(rt.getOutput('start', 'started')).toBe(true);
    world.step(TICK_DT);
    rt.tick({ keysDown: new Set() });
    expect(rt.getOutput('btn', 'pressed')).toBe(false);
    expect(rt.getOutput('start', 'started')).toBe(true);
    expect(world.hudItems().find((h) => h.key === 'btn')?.widget).toEqual({ type: 'button', text: 'Bấm vào đây' });
  });
});
