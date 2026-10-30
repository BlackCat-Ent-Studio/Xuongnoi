import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { Humanoid } from './humanoid-model';
import { resolveLook } from './character-styles';
import { HealthBarLayer } from './health-bar';
import { blockStyleOf } from '../engine/block-styles';
import { buildBlockLook, type BlockLookFigure } from './block-looks';
import { buildItem, liesFlat, type ItemFigure } from './item-shapes';
import { PORTAL_LOOK, PortalFigure } from './portal-model';
import { VehicleFigure } from './vehicle-models';
import { ColliderFrames } from './collider-frames';

const SUN_WITH_SHADOWS = 2;
const SKY_WITH_SHADOWS = 0.8;

/** Shadow map side in texels: a 1k map over a window of ~50 units keeps edges soft but cheap. */
const SHADOW_MAP_SIZE = 1024;

type Entry =
  | { type: 'block'; mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>; color: string }
  | { type: 'look'; figure: BlockLookFigure; style: string; color: string }
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
  | { type: 'vehicle'; figure: VehicleFigure; model: string }
  | { type: 'portal'; figure: PortalFigure };

/** Length along x, head along z, resting on its side: yaw a quarter turn, then lay the long axis down. */
const LYING_POSE = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));

function castShadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
}

/** Zone markers always stay plain translucent boxes. */
function styleOf(e: EntityView): string {
  return e.zone ? 'box' : blockStyleOf(e.blockStyle);
}

/** Whether an existing entry can keep representing the entity (same kind and, for characters/items, same look/shape). */
function matches(entry: Entry, e: EntityView): boolean {
  if (entry.type === 'portal') return e.kind === 'block' && e.look === PORTAL_LOOK;
  if (entry.type === 'block') return e.kind === 'block' && e.look !== PORTAL_LOOK && styleOf(e) === 'box';
  if (entry.type === 'look') return e.kind === 'block' && e.look !== PORTAL_LOOK && styleOf(e) === entry.style;
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
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private readonly sky = new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1);
  private shadowsAllowed = true;
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly entries = new Map<string, Entry>();
  private readonly healthBars = new HealthBarLayer(this.group);
  private readonly colliderFrames = new ColliderFrames(this.group);
  private grid: THREE.GridHelper | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private mode: ViewMode = '2d-side';

  constructor() {
    this.scene.background = new THREE.Color(0xe6e8ec);
    this.scene.add(this.sky);
    const { sun } = this;
    sun.position.set(6, 12, 8);
    sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.scene.add(this.group);
  }

  /** View mode decides how characters face; changing it drops existing figures' animation state. */
  setMode(mode: ViewMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyShadowState();
    for (const entry of this.entries.values()) {
      if (entry.type === 'character') entry.figure.setMode(mode);
    }
    // Portals are drawn differently per view; they are rebuilt on the next sync.
    for (const [id, entry] of [...this.entries]) if (entry.type === 'portal') this.removeEntry(id, entry);
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
      if (entry.type === 'portal') {
        entry.figure.update(e, dt);
        continue;
      }
      if (entry.type === 'look') {
        const { object } = entry.figure;
        object.position.set(e.position.x, e.position.y, e.position.z);
        object.scale.set(e.size.x, e.size.y, e.size.z);
        object.rotation.set(0, this.mode === '2d-side' ? 0 : (e.angle ?? 0), this.mode === '2d-side' ? (e.angle ?? 0) : 0);
        if (entry.color !== e.color) {
          entry.figure.setColor(e.color);
          entry.color = e.color;
        }
        entry.figure.update?.(e);
        object.updateMatrixWorld();
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
        entry.figure.update?.(e);
        entry.pose.updateMatrixWorld(true);
        continue;
      }
      const { mesh } = entry;
      mesh.position.set(e.position.x, e.position.y, e.position.z);
      mesh.scale.set(e.size.x, e.size.y, e.size.z);
      // Turning blocks: about Z in the side view, about the vertical axis elsewhere.
      mesh.rotation.set(0, this.mode === '2d-side' ? 0 : (e.angle ?? 0), this.mode === '2d-side' ? (e.angle ?? 0) : 0);
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

  /** Green collision-box frames for the entities owned by `owners` (pass an empty set to hide them). */
  syncColliderFrames(entities: readonly EntityView[], owners: ReadonlySet<string>): void {
    this.colliderFrames.sync(entities, owners);
  }

  /** How many collision frames are visible (for tests and checks). */
  get colliderFrameCount(): number {
    return this.colliderFrames.shown;
  }

  private createEntry(e: EntityView): Entry {
    if (e.kind === 'vehicle') {
      const figure = new VehicleFigure(e.vehicle?.model ?? 'car', e.color);
      castShadows(figure.object);
      this.group.add(figure.object);
      return { type: 'vehicle', figure, model: figure.model };
    }
    if (e.kind === 'character') {
      const figure = new Humanoid(e.color, this.mode, e.look);
      castShadows(figure.object);
      this.group.add(figure.object);
      return { type: 'character', figure, look: figure.look };
    }
    if (e.kind === 'item') {
      const shape = e.shape ?? 'box';
      const figure = buildItem(shape, e.color, `${e.ownerNodeId}|${e.id}`);
      figure.object.traverse((o) => {
        o.userData.ownerNodeId = e.ownerNodeId;
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      const pose = new THREE.Group();
      pose.add(figure.object);
      const bounds = new THREE.Box3().setFromObject(figure.object); // before the pose turns it
      const flat = liesFlat(shape);
      if (flat) pose.quaternion.copy(LYING_POSE);
      this.group.add(pose);
      return { type: 'item', figure, pose, flat, bounds, shape, color: e.color };
    }
    if (e.kind === 'block' && e.look === PORTAL_LOOK) {
      const figure = new PortalFigure(e.color, this.mode);
      this.group.add(figure.object);
      return { type: 'portal', figure };
    }
    const style = styleOf(e);
    if (style !== 'box') {
      const figure = buildBlockLook(blockStyleOf(style), e.color, e.size, e.label ?? '', e.ownerNodeId);
      figure.object.traverse((o) => {
        o.userData.ownerNodeId = e.ownerNodeId;
      });
      this.group.add(figure.object);
      return { type: 'look', figure, style, color: e.color };
    }
    const mesh = new THREE.Mesh(this.geometry, new THREE.MeshLambertMaterial(e.zone ? { color: e.color, transparent: true, opacity: 0.28, depthWrite: false } : { color: e.color }));
    if (!e.zone) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    this.group.add(mesh);
    return { type: 'block', mesh, color: e.color };
  }

  private removeEntry(id: string, entry: Entry): void {
    if (entry.type === 'portal') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'vehicle') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'character') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'item') {
      this.group.remove(entry.pose);
      entry.figure.dispose();
    } else if (entry.type === 'look') {
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

  /** Shadows only exist in the 3D view; passing false also turns them off there (slow machines). */
  setShadowsAllowed(allowed: boolean): void {
    this.shadowsAllowed = allowed;
    this.applyShadowState();
  }

  get shadowsOn(): boolean {
    return this.sun.castShadow;
  }

  private applyShadowState(): void {
    const on = this.mode === '3d' && this.shadowsAllowed;
    this.sun.castShadow = on;
    // Shadowed ground only keeps the sky light, so with shadows the sun carries a little more of the load.
    this.sun.intensity = on ? SUN_WITH_SHADOWS : 1.6;
    this.sky.intensity = on ? SKY_WITH_SHADOWS : 1.1;
  }

  /**
   * Points the sun and its shadow window at the centre; only objects within the radius cast shadows.
   * The window snaps to shadow-map texels so shadows do not shimmer while the camera moves.
   */
  focusSun(center: { x: number; y: number; z: number }, radius: number): void {
    const r = Math.min(Math.max(radius, 8), 60);
    const cam = this.sun.shadow.camera;
    if (cam.right !== r) {
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = 120;
      cam.updateProjectionMatrix();
    }
    const texel = (2 * r) / SHADOW_MAP_SIZE;
    const snap = (v: number) => Math.round(v / texel) * texel;
    const cx = snap(center.x);
    const cz = snap(center.z);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + 6 * 4.4, 12 * 4.4, cz + 8 * 4.4);
    this.sun.target.updateMatrixWorld();
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
    this.colliderFrames.dispose();
    this.setGrid('3d', false);
    this.geometry.dispose();
  }
}
