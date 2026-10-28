import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';

interface MeshEntry {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  color: string;
}

/** Mirrors world entities as colored boxes. One shared unit geometry, one material per mesh. */
export class SceneView {
  readonly scene = new THREE.Scene();
  private readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly meshes = new Map<string, MeshEntry>();
  private grid: THREE.GridHelper | null = null;
  private readonly raycaster = new THREE.Raycaster();

  constructor() {
    this.scene.background = new THREE.Color(0xe6e8ec);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 8);
    this.scene.add(sun);
    this.scene.add(this.group);
  }

  /** Create / update / remove meshes so they match the entity list. */
  sync(entities: readonly EntityView[]): void {
    const seen = new Set<string>();
    for (const e of entities) {
      if (!e.visible) continue;
      seen.add(e.id);
      let entry = this.meshes.get(e.id);
      if (!entry) {
        const mesh = new THREE.Mesh(this.geometry, new THREE.MeshLambertMaterial({ color: e.color }));
        entry = { mesh, color: e.color };
        this.meshes.set(e.id, entry);
        this.group.add(mesh);
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
    for (const [id, entry] of this.meshes) {
      if (seen.has(id)) continue;
      this.group.remove(entry.mesh);
      entry.mesh.material.dispose();
      this.meshes.delete(id);
    }
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
    const hits = this.raycaster.intersectObjects(this.group.children, false);
    const owner: unknown = hits[0]?.object.userData.ownerNodeId;
    return typeof owner === 'string' ? owner : null;
  }

  dispose(): void {
    this.clear();
    this.setGrid('3d', false);
    this.geometry.dispose();
  }
}
