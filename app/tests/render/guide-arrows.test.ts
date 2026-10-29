import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView, HudItem } from '../../src/engine/types';
import { guideArrowShapes } from '../../src/render/guide-arrows';

function view(id: string, x: number, z: number, visible = true): EntityView {
  return { id, kind: 'vehicle', ownerNodeId: 'n', position: { x, y: 0.5, z }, size: { x: 1, y: 1, z: 1 }, color: '#888', visible };
}
const world = new Map<string, EntityView>();
const get = (id: string): EntityView | undefined => world.get(id);

// Top-down camera: world +x is screen right, world +z is screen down.
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
camera.position.set(0, 20, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const item = (over: Partial<HudItem> = {}): HudItem => ({
  key: 'arrow', label: '', value: 12.4, corner: 'top-left', anchor: 'a', guide: { to: 'b', showDistance: true }, color: '#f00', ...over,
});

describe('guideArrowShapes', () => {
  world.set('a', view('a', 0, 0));

  it('rotates the arrow towards the target on screen and labels the rounded distance', () => {
    world.set('b', view('b', 10, 0));
    const [right] = guideArrowShapes([item()], get, camera, 200, 200);
    expect(right).toMatchObject({ key: 'arrow', text: '12', color: '#f00' });
    expect(right!.angle).toBeCloseTo(Math.PI / 2); // pointing right
    expect(right!.x).toBeCloseTo(100);
    world.set('b', view('b', 0, 10));
    expect(guideArrowShapes([item()], get, camera, 200, 200)[0]!.angle).toBeCloseTo(Math.PI); // down the screen
    world.set('b', view('b', 0, -10));
    expect(guideArrowShapes([item()], get, camera, 200, 200)[0]!.angle).toBeCloseTo(0); // up the screen
  });

  it('leaves the label empty when the distance is switched off', () => {
    world.set('b', view('b', 10, 0));
    const [s] = guideArrowShapes([item({ guide: { to: 'b', showDistance: false } })], get, camera, 200, 200);
    expect(s!.text).toBe('');
  });

  it('skips hidden items, missing or hidden entities, and plain labels', () => {
    world.set('b', view('b', 10, 0));
    expect(guideArrowShapes([item({ hidden: true })], get, camera, 200, 200)).toEqual([]);
    expect(guideArrowShapes([item({ guide: { to: 'nope', showDistance: true } })], get, camera, 200, 200)).toEqual([]);
    world.set('b', view('b', 10, 0, false));
    expect(guideArrowShapes([item()], get, camera, 200, 200)).toEqual([]);
    world.set('b', view('b', 10, 0));
    const plain: HudItem = { key: 'p', label: '', value: 0, corner: 'top-left', text: 'hi', anchor: 'a' };
    expect(guideArrowShapes([plain], get, camera, 200, 200)).toEqual([]);
  });
});
