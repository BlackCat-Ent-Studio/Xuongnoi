import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { SceneView } from '../../src/render/scene-view';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { buildPlayGraph } from '../../src/puzzle/run-level';
import { createCozyStage, stageRoleOf } from '../../src/puzzle/stage/cozy-stage';
import { createWorld } from '../../src/world/world';

/** Entities of a level at the first tick (solution wired). */
function entitiesOf(id: string): { entities: EntityView[]; mode: '2d-side' | '3d' | '2d-top' } {
  registerAllNodes();
  const level = PUZZLE_LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`no level ${id}`);
  const world = createWorld(level.mode);
  const rt = createRuntime(buildPlayGraph(level, level.solution), world, level.mode);
  rt.tick({ keysDown: new Set<string>() });
  world.step(TICK_DT);
  return { entities: [...world.entities()], mode: level.mode };
}

const rolesOf = (id: string): Record<string, string | null> => {
  const { entities, mode } = entitiesOf(id);
  return Object.fromEntries(entities.filter((e) => e.kind !== 'character').map((e) => [e.ownerNodeId, stageRoleOf(e, mode)]));
};

describe('stage roles per level', () => {
  it('level 1 and 2 (side view): floor, button, door, flag', () => {
    expect(rolesOf('bot-dau-tien')).toMatchObject({ ground: 'floor-side', flag: 'flag' });
    expect(rolesOf('cua-kho')).toMatchObject({ ground: 'floor-side', button: 'button', door: 'door', flag: 'flag' });
  });

  it('level 3 is a side view with three stars and the same wooden door', () => {
    expect(rolesOf('nhat-sao')).toMatchObject({ ground: 'floor-side', 'star-1': 'star', 'star-2': 'star', 'star-3': 'star', gate: 'door', goal: 'flag' });
  });

  it('level 4: two buttons, one door', () => {
    expect(rolesOf('hai-nut-mot-cua')).toMatchObject({ ground: 'floor-side', door: 'door' });
  });

  it('level 5: tray floor, painted storage pad, three crates', () => {
    expect(rolesOf('du-ba-thung')).toMatchObject({ floor: 'floor-tray', 'store-pad': 'zone', 'crate-1': 'crate', 'crate-2': 'crate', 'crate-3': 'crate' });
  });

  it('level 6: tray floor, goal pad', () => {
    expect(rolesOf('ne-linh-gac')).toMatchObject({ floor: 'floor-tray', goal: 'goal' });
  });

  it('level 7: the red and the blue floor tiles are both plain flat tiles, never a push button', () => {
    const roles = rolesOf('phan-loai-mau');
    for (const n of [1, 2, 3, 4, 5, 6]) expect(roles[`pad-${n}`], `pad-${n}`).toBeNull();
  });

  it('keeps the plain drawing for the editor-only modes; a sensor zone is a flat floor marker in 3D only', () => {
    const zone: EntityView = { id: 'z', kind: 'block', ownerNodeId: 'z', position: { x: 0, y: 1, z: 0 }, size: { x: 3, y: 3, z: 3 }, color: '#22c55e', visible: true, zone: true };
    expect(stageRoleOf(zone, '3d')).toBe('zone-mark');
    expect(stageRoleOf(zone, '2d-side')).toBeNull();
    expect(stageRoleOf(zone, '2d-top')).toBeNull();
    const door: EntityView = { id: 'd', kind: 'block', ownerNodeId: 'd', position: { x: 3, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', visible: true };
    expect(stageRoleOf(door, '2d-top')).toBeNull();
    expect(stageRoleOf(door, '2d-side')).toBe('door');
  });
});

describe('stage scene', () => {
  it('draws every level without errors and puts props where the plain boxes were', () => {
    for (const level of PUZZLE_LEVELS) {
      const { entities, mode } = entitiesOf(level.id);
      const view = new SceneView(createCozyStage());
      view.setMode(mode);
      expect(() => view.sync(entities, 0)).not.toThrow();
      let meshes = 0;
      view.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes++;
      });
      expect(meshes, level.id).toBeGreaterThan(20);
      view.dispose();
    }
  });

  it('a hidden door stays standing open and closes again when shown; a hidden star pops and goes', () => {
    const { entities } = entitiesOf('nhat-sao');
    const view = new SceneView(createCozyStage());
    view.setMode('2d-side');
    view.sync(entities, 0);
    const count = (): number => {
      let n = 0;
      view.scene.traverse(() => n++);
      return n;
    };
    const before = count();
    const without = (ids: string[]): EntityView[] => entities.map((e) => (ids.includes(e.ownerNodeId) ? { ...e, visible: false } : e));
    view.sync(without(['gate']), 0.2);
    view.sync(without(['gate']), 3);
    expect(count()).toBe(before); // the open door is still drawn
    view.sync(without(['star-1']), 0.1);
    expect(count()).toBe(before); // mid-pop
    view.sync(without(['star-1']), 1);
    expect(count()).toBeLessThan(before); // finished and removed
    view.sync(entities, 0);
    expect(count()).toBe(before);
    view.dispose();
  });

  it('draws characters bigger than their box but keeps the editor look at 1', () => {
    const { entities } = entitiesOf('cua-kho');
    const heightOf = (stage: boolean): number => {
      const view = new SceneView(stage ? createCozyStage() : null);
      view.setMode('2d-side');
      view.sync(entities, 0);
      const hero = entities.find((e) => e.kind === 'character');
      let box: THREE.Box3 | null = null;
      view.scene.traverse((o) => {
        if (o.userData.ownerNodeId === hero?.ownerNodeId && o instanceof THREE.Mesh) {
          const b = new THREE.Box3().setFromObject(o);
          box = box ? box.union(b) : b;
        }
      });
      view.dispose();
      const found = box as THREE.Box3 | null;
      return found ? found.max.y - found.min.y : 0;
    };
    const plain = heightOf(false);
    const staged = heightOf(true);
    expect(plain).toBeGreaterThan(0.5);
    expect(staged / plain).toBeGreaterThan(1.45);
    expect(staged / plain).toBeLessThan(1.75);
  });

  it('the plain scene (no stage) has far fewer parts than the dressed one', () => {
    const { entities, mode } = entitiesOf('cua-kho');
    const meshesOf = (stage: boolean): number => {
      const view = new SceneView(stage ? createCozyStage() : null);
      view.setMode(mode);
      view.sync(entities, 0);
      let n = 0;
      view.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) n++;
      });
      view.dispose();
      return n;
    };
    expect(meshesOf(false)).toBeLessThan(meshesOf(true) * 0.7);
  });
});
