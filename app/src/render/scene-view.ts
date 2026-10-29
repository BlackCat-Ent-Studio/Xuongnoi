import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { Humanoid } from './humanoid-model';
import { resolveLook } from './character-styles';
import { HealthBarLayer } from './health-bar';
import { buildItem, liesFlat, type ItemFigure } from './item-shapes';
import { VehicleFigure } from './vehicle-models';

type Entry =
  | { type: 'block'; mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>; color: string }
  | { type: 'character'; figure: Humanoid; look: string }
  | {
      type: 'item';
      figure: ItemFigure;
      /** Parent of the figure; turns lying tools onto their side. */
      pose: THREE.Group;
      flat: boolean;
      /** Bounds of the figure at unit scale, unrotated. */
      bounds: THREE.Box3;
      shape: string;
      color: string;
    }
  | { type: 'vehicle'; figure: VehicleFigure; model: string };

/** Length along x, head along z, resting on its side: yaw a quarter turn, then lay the long axis down. */
const LYING_POSE = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));

/** Whether an existing entry can keep representing the entity (same kind and, for characters/items, same look/shape). */
function matches(entry: Entry, e: EntityView): boolean {
  if (entry.type === 'block') return e.kind === 'block';
  if (entry.type === 'item') return e.kind === 'item' && entry.shape === (e.shape ?? 'box');
  if (entry.type === 'vehicle') return e.kind === 'vehicle' && entry.model === e.vehicle?.model;
  return e.kind === 'character' && entry.look === resolveLook(e.look);
}

/** Share of its height a driver keeps while sitting. */
const SEATED_HEIGHT = 0.65;

/** The driver as drawn: shorter, with feet on the same floor, so the legs sink into the seat. */
function seatedView(e: EntityView): EntityView {
  const h = e.size.y * SEATED_HEIGHT;
  return { ...e, size: { ...e.size, y: h }, position: { ...e.position, y: e.position.y - e.size.y / 2 + h / 2 } };
}

/**
 * Mirrors world entities: blocks as colored boxes, characters as animated blocky humanoids.
 * One shared unit geometry for blocks, one material per block mesh.
 */
export class SceneView {
  readonly scene = new THREE.Scene();
  private readonly group = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly entries = new Map<string, Entry>();
  private readonly healthBars = new HealthBarLayer(this.group);
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
      // A tool in hand is drawn on its holder's figure, not as a separate object.
      if (!e.visible || e.inHand) continue;
      seen.add(e.id);
      let entry = this.entries.get(e.id);
      if (entry && !matches(entry, e)) {
        this.removeEntry(e.id, entry);
        entry = undefined;
      }
      if (!entry) {
        entry = this.createEntry(e);
        this.entries.set(e.id, entry);
      }
      if (entry.type === 'vehicle') {
        entry.figure.update(e);
        continue;
      }
      if (entry.type === 'character') {
        entry.figure.setSeated(e.seatedIn !== undefined);
        entry.figure.update(e.seatedIn !== undefined ? seatedView(e) : e, dt);
        continue;
      }
      if (entry.type === 'item') {
        const { object } = entry.figure;
        object.scale.set(e.size.x, e.size.y, e.size.z);
        if (entry.flat) {
          // Lying tool: the pose group turns it onto its side; lift so its lowest point rests on the entity's floor.
          object.position.set(0, 0, 0);
          entry.pose.position.set(e.position.x, e.position.y - e.size.y / 2 - entry.bounds.min.z * e.size.z, e.position.z);
        } else {
          object.position.set(e.position.x, e.position.y, e.position.z);
        }
        if (entry.color !== e.color) {
          entry.figure.setColor(e.color);
          entry.color = e.color;
        }
        entry.pose.updateMatrixWorld(true);
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
    this.healthBars.sync(entities);
  }

  private createEntry(e: EntityView): Entry {
    if (e.kind === 'vehicle') {
      const figure = new VehicleFigure(e.vehicle?.model ?? 'car', e.color);
      this.group.add(figure.object);
      return { type: 'vehicle', figure, model: figure.model };
    }
    if (e.kind === 'character') {
      const figure = new Humanoid(e.color, this.mode, e.look);
      this.group.add(figure.object);
      return { type: 'character', figure, look: figure.look };
    }
    if (e.kind === 'item') {
      const shape = e.shape ?? 'box';
      const figure = buildItem(shape, e.color);
      figure.object.traverse((o) => {
        o.userData.ownerNodeId = e.ownerNodeId;
      });
      const pose = new THREE.Group();
      pose.add(figure.object);
      const bounds = new THREE.Box3().setFromObject(figure.object); // before the pose turns it
      const flat = liesFlat(shape);
      if (flat) pose.quaternion.copy(LYING_POSE);
      this.group.add(pose);
      return { type: 'item', figure, pose, flat, bounds, shape, color: e.color };
    }
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshLambertMaterial(e.zone ? { color: e.color, transparent: true, opacity: 0.28, depthWrite: false } : { color: e.color }),
    );
    this.group.add(mesh);
    return { type: 'block', mesh, color: e.color };
  }

  private removeEntry(id: string, entry: Entry): void {
    if (entry.type === 'vehicle') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'character') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'item') {
      this.group.remove(entry.pose);
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
    this.healthBars.dispose();
    this.setGrid('3d', false);
    this.geometry.dispose();
  }
}
