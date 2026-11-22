import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { beltLipView, isBeltFrame } from '../../src/render/factory-blocks';
import { SceneView } from '../../src/render/scene-view';

const BELT_TOP = 0.6;

function block(id: string, extra: Partial<EntityView>): EntityView {
  return { id, kind: 'block', ownerNodeId: 'belt', position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#a3a3a3', visible: true, ...extra };
}

/** A 2.4 m belt along x whose top is at BELT_TOP, and its two real side walls (0.3 m high, 0.1 m thick). */
function beltWithWalls(style: string): EntityView[] {
  const belt = block('b', { position: { x: 0, y: BELT_TOP / 2, z: 0 }, size: { x: 2.4, y: BELT_TOP, z: 0.8 }, blockStyle: style, belt: { axis: 'x', speed: 1, phase: 0 } });
  const wall = (id: string, side: number): EntityView => block(id, { position: { x: 0, y: BELT_TOP + 0.15, z: side * 0.35 }, size: { x: 2.4, y: 0.3, z: 0.1 } });
  return [belt, wall('w1', 1), wall('w2', -1)];
}

function topOfScene(entities: EntityView[]): number {
  const scene = new SceneView();
  scene.setMode('3d');
  scene.sync(entities);
  scene.scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) box.union(new THREE.Box3().setFromObject(o));
  });
  scene.dispose();
  return box.max.y;
}

describe('side walls of the open-frame belt', () => {
  it('a wall is drawn as a low lip along its foot, in the frame colour, as long as the wall', () => {
    const [belt, wall] = beltWithWalls('belt-frame');
    expect(isBeltFrame(belt!)).toBe(true);
    expect(isBeltFrame(wall!)).toBe(false);
    const lip = beltLipView(wall!);
    expect(lip.size.x).toBe(2.4);
    expect(lip.size.y).toBeCloseTo(0.07, 6);
    expect(lip.size.z).toBeLessThanOrEqual(0.04);
    // It stands on the same floor as the wall: the belt top.
    expect(lip.position.y - lip.size.y / 2).toBeCloseTo(BELT_TOP, 6);
    expect(lip.color).not.toBe('#a3a3a3');
    // A recoloured belt hands its colour to the lip.
    expect(beltLipView({ ...wall!, color: '#ff0000' }).color).toBe('#ff0000');
    // The real wall is untouched.
    expect(wall!.size.y).toBe(0.3);
  });

  it('the scene draws nothing taller than the lip above an open-frame belt, and the full slabs above the classic belt', () => {
    expect(topOfScene(beltWithWalls('belt-frame'))).toBeLessThan(BELT_TOP + 0.08);
    expect(topOfScene(beltWithWalls('conveyor'))).toBeCloseTo(BELT_TOP + 0.3, 2);
  });

  it('other blocks of other owners keep their own size', () => {
    const other = block('o', { ownerNodeId: 'crate', position: { x: 3, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 } });
    expect(topOfScene([...beltWithWalls('belt-frame'), other])).toBeCloseTo(2, 2);
  });
});
