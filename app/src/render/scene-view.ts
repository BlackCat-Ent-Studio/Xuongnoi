import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { Humanoid } from './humanoid-model';

type Entry =
  | { type: 'block'; mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>; color: string }
  | { type: 'character'; figure: Humanoid };

/**
 * Mirrors world entities: blocks as colored boxes, characters as animated blocky humanoids.
 * One shared unit geometry for blocks, one material per block mesh.
 */
export class SceneView {
  readonly scene = new THREE.Scene();
  private readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly entries = new Map<string, Entry>();
  private grid: THREE.GridHelper | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private mode: ViewMode = '2d-side';

  constructor() {
    this.scene.background = new THREE.Color(0xe6e8ec);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);
    this.scene.add(this.group);
  }

  /** View mode decides how characters face; changing it drops existing figures' animation state. */
  setMode(mode: ViewMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const entry of this.entries.values()) {
      if (entry.type === 'character') entry.figure.setMode(mode);
    }
  }

  /** Create / update / remove objects so they match the entity list. `dt` drives character animation. */
  sync(entities: readonly EntityView[], dt = 0): void {
    const seen = new Set<string>();
    for (const e of entities) {
      if (!e.visible) continue;
      seen.add(e.id);
      let entry = this.entries.get(e.id);
      if (entry && (entry.type === 'character') !== (e.kind === 'character')) {
        this.removeEntry(e.id, entry);
        entry = undefined;
      }
      if (!entry) {
        entry = this.createEntry(e);
        this.entries.set(e.id, entry);
      }
      if (entry.type === 'character') {
        entry.figure.update(e, dt);
        continue;
      }
      const { mesh } = entry;
      mesh.position.set(e.position.x, e.position.y, e.position.z);
      mesh.scale.set(e.size.x, e.size.y, e.size.z);
      mesh.userData.ownerNodeId = e.ownerNodeId;
      if (entry.color !== e.color) {
        mesh.material.color.set(e.color);
        entry.color = e.color;
      }
      mesh.updateMatrixWorld();
    }
    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) this.removeEntry(id, entry);
    }
  }

  private createEntry(e: EntityView): Entry {
    if (e.kind === 'character') {
      const figure = new Humanoid(e.color, this.mode);
      this.group.add(figure.object);
      return { type: 'character', figure };
    }
    const mesh = new THREE.Mesh(this.geometry, new THREE.MeshLambertMaterial({ color: e.color }));
    this.group.add(mesh);
    return { type: 'block', mesh, color: e.color };
  }

  private removeEntry(id: string, entry: Entry): void {
    if (entry.type === 'character') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else {
      this.group.remove(entry.mesh);
      entry.mesh.material.dispose();
    }
    this.entries.delete(id);
  }

  clear(): void {
    this.sync([]);
  }

  /** Grid aligned to the mode's plane; only shown while editing. */
  setGrid(mode: ViewMode, visible: boolean): void {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = null;
    }
    if (!visible) return;
    const grid = new THREE.GridHelper(100, 100, 0x9aa0ab, 0xc4c8d0);
    if (mode === '2d-side') {
      grid.rotation.x = Math.PI / 2;
      grid.position.z = -0.51;
    } else {
      grid.position.y = 0.001;
    }
    this.grid = grid;
    this.scene.add(grid);
  }

  pick(ndc: THREE.Vector2, camera: THREE.Camera): string | null {
    this.raycaster.setFromCamera(ndc, camera);
    // Recursive: humanoid parts are nested meshes; each carries the owner id in userData.
    const hits = this.raycaster.intersectObjects(this.group.children, true);
    const owner: unknown = hits[0]?.object.userData.ownerNodeId;
    return typeof owner === 'string' ? owner : null;
  }

  dispose(): void {
    this.clear();
    this.setGrid('3d', false);
    this.geometry.dispose();
  }
}
