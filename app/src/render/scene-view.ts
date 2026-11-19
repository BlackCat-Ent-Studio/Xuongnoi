import * as THREE from 'three';
import type { EntityView, SolidBox, ViewMode } from '../engine/types';
import { Humanoid } from './humanoid-model';
import { resolveLook } from './character-styles';
import { HealthBarLayer } from './health-bar';
import { blockStyleOf } from '../engine/block-styles';
import { buildBlockLook, type BlockLookFigure } from './block-looks';
import { buildItem, liesFlat, type ItemFigure } from './item-shapes';
import { PORTAL_LOOK, PortalFigure } from './portal-model';
import { RobotFigure } from './robot-models';
import { LINE_DOT_LOOK, LINE_TRACK_LOOK } from '../world/line-track';
import { LineDotFigure, LineTrackFigure } from './line-track-figure';
import { VehicleFigure } from './vehicle-models';
import { ColliderFrames } from './collider-frames';
import { damagedView, tintDamaged } from './damaged-look';
import { ObjectHighlight } from './object-highlight';
import { ArmPartFigure } from './arm-part-models';
import { AGV_LOOK } from '../engine/factory-looks';
import { AgvFigure } from './factory-agv';
import { FactoryArmFigure, hasFactoryArmFigure } from './factory-arm';
import { buildParcel, isParcelLook } from './factory-parcels';
import { LoadTagLayer } from './load-tag';
import { armHintOf, type ArmPartKind } from '../engine/render-hints';
import { VisionFanLayer, type FanSpec } from './vision-fan';
import type { StageFigure, StageTheme } from './stage-theme';

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
      /** The parcel look it was built for ('' = drawn by its shape). */
      look: string;
      color: string;
      /** True while the pose group stands at the item's centre and carries a physics turn (it must be put back when the turn ends). */
      turned?: boolean;
    }
  | { type: 'arm'; figure: ArmPartFigure | FactoryArmFigure; part: ArmPartKind; look: string }
  | { type: 'vehicle'; figure: VehicleFigure; model: string }
  | { type: 'robot'; figure: RobotFigure | AgvFigure; look: string }
  | { type: 'portal'; figure: PortalFigure }
  | { type: 'track'; figure: LineTrackFigure }
  | { type: 'dot'; figure: LineDotFigure }
  | { type: 'stage'; figure: StageFigure; role: string };

/** Length along x, head along z, resting on its side: yaw a quarter turn, then lay the long axis down. */
const LYING_POSE = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));

const turnQuat = new THREE.Quaternion();
const turnShift = new THREE.Vector3();

function castShadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
}

/** Zone markers always stay plain translucent boxes. */
function styleOf(e: EntityView): string {
  return e.zone ? 'box' : blockStyleOf(e.blockStyle);
}

/** The look an arm block is drawn in: a factory look this part has a figure for, or '' for the classic figure. */
function armLookOf(part: ArmPartKind, e: EntityView): string {
  return hasFactoryArmFigure(part, e.look) ? e.look : '';
}
const robotLookOf = (e: EntityView): string => (e.look === AGV_LOOK ? AGV_LOOK : '');
const parcelLookOf = (e: EntityView): string => (isParcelLook(e.look) ? e.look : '');

/** Whether an existing entry can keep representing the entity (same kind and, for characters/items, same look/shape). */
function matches(entry: Entry, e: EntityView): boolean {
  if (entry.type === 'stage') return false; // decided by the role, see sync
  if (entry.type === 'portal') return e.kind === 'block' && e.look === PORTAL_LOOK;
  if (entry.type === 'track') return e.kind === 'block' && e.look === LINE_TRACK_LOOK;
  if (entry.type === 'dot') return e.kind === 'block' && e.look === LINE_DOT_LOOK;
  if (entry.type === 'arm') return e.kind === 'block' && armHintOf(e.ownerNodeId, e.id)?.part === entry.part && armLookOf(entry.part, e) === entry.look;
  if (entry.type === 'block') return e.kind === 'block' && !armHintOf(e.ownerNodeId, e.id) && e.look !== PORTAL_LOOK && e.look !== LINE_TRACK_LOOK && e.look !== LINE_DOT_LOOK && styleOf(e) === 'box';
  if (entry.type === 'look') return e.kind === 'block' && e.look !== PORTAL_LOOK && styleOf(e) === entry.style;
  if (entry.type === 'item') return e.kind === 'item' && entry.shape === (e.shape ?? 'box') && entry.look === parcelLookOf(e);
  if (entry.type === 'vehicle') return e.kind === 'vehicle' && entry.model === e.vehicle?.model;
  if (entry.type === 'robot') return e.kind === 'robot' && entry.look === robotLookOf(e);
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
  private readonly visionFans = new VisionFanLayer(this.group);
  private readonly loadTags = new LoadTagLayer(this.group);
  private readonly highlight = new ObjectHighlight();
  private grid: THREE.GridHelper | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private mode: ViewMode = '2d-side';

  /** `stage` dresses the scene with a themed look (the puzzle game); without it the scene is the plain editor look. */
  constructor(private readonly stage: StageTheme | null = null) {
    this.scene.background = new THREE.Color(0xe6e8ec);
    if (stage) {
      this.sky.color.set(stage.light.sky);
      this.sky.groundColor.set(stage.light.ground);
      this.sun.color.set(stage.light.sun);
    }
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

  /** Background colour behind the scene (the editor's light grey, or the puzzle stage's mint). */
  setBackdrop(color: number | null): void {
    // null leaves the scene clear so a transparent canvas shows the page behind it
    this.scene.background = color === null ? null : new THREE.Color(color);
  }

  /** View mode decides how characters face; changing it drops existing figures' animation state. */
  setMode(mode: ViewMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyShadowState();
    for (const entry of this.entries.values()) {
      if (entry.type === 'character') entry.figure.setMode(mode);
    }
    // Portals and stage props are drawn differently per view; they are rebuilt on the next sync.
    for (const [id, entry] of [...this.entries]) if (entry.type === 'portal' || entry.type === 'stage' || entry.type === 'track' || entry.type === 'dot') this.removeEntry(id, entry);
  }

  /** Items riding on a character, by item id: the stage draws them at the figure's scale instead of the box position. */
  private findCarried(entities: readonly EntityView[]): Map<string, EntityView> {
    const out = new Map<string, EntityView>();
    for (const holder of entities) {
      if (holder.kind !== 'character' || !holder.visible || holder.carriedHeight === undefined) continue;
      const topY = holder.position.y + holder.size.y / 2 + holder.carriedHeight / 2 + 0.025;
      for (const it of entities) {
        if (it.kind !== 'item' || !it.visible || it.inHand) continue;
        const near = Math.abs(it.position.x - holder.position.x) < 0.02 && Math.abs(it.position.z - holder.position.z) < 0.02;
        if (near && Math.abs(it.position.y - topY) < 0.05) out.set(it.id, holder);
      }
    }
    return out;
  }

  /** A carried item as the stage draws it: lifted with the bigger figure, or held out front by the legs robot. */
  private carriedView(item: EntityView, holder: EntityView): EntityView {
    const k = this.stage?.characterScale ?? 1;
    const offset = this.stage?.carryOffset ?? { reach: 0, height: 0 };
    const floor = holder.position.y - holder.size.y / 2;
    if (resolveLook(holder.look) !== 'robot-legs') {
      return { ...item, position: { ...item.position, y: item.position.y + (k - 1) * holder.size.y } };
    }
    const f = holder.facing ?? { x: 1, z: 0 };
    return {
      ...item,
      position: { x: holder.position.x + f.x * offset.reach, y: floor + offset.height + item.size.y / 2, z: holder.position.z + f.z * offset.reach },
    };
  }

  /** Create / update / remove objects so they match the entity list. `dt` drives character animation. */
  sync(entities: readonly EntityView[], dt = 0): void {
    const seen = new Set<string>();
    // Car and truck models have closed cabs: a seated driver would poke through the roof, so it is hidden. Bikes stay open.
    const closedCabs = new Set<string>();
    for (const e of entities) if (e.kind === 'vehicle' && (e.vehicle?.model === 'car' || e.vehicle?.model === 'truck')) closedCabs.add(e.id);
    const stage = this.stage;
    stage?.observe(entities);
    const carried = stage ? this.findCarried(entities) : null;
    const hidden = new Set<string>();
    for (const original of entities) {
      const e = damagedView(original);
      if (!e.visible) hidden.add(e.id);
      // A tool in hand is drawn on its holder's figure, not as a separate object.
      if (!e.visible || e.inHand) continue;
      seen.add(e.id);
      const role = stage ? stage.roleOf(e, this.mode) : null;
      let entry = this.entries.get(e.id);
      if (entry && (entry.type === 'stage' ? entry.role !== role : role !== null || !matches(entry, e))) {
        this.removeEntry(e.id, entry);
        entry = undefined;
      }
      if (!entry) {
        entry = this.createEntry(e, role, entities);
        this.entries.set(e.id, entry);
      }
      if (original.damaged && entry.type !== 'block') {
        const root = this.rootOf(entry);
        if (root) tintDamaged(root);
      }
      if (entry.type === 'stage') {
        const holder = carried?.get(e.id);
        entry.figure.update(holder ? this.carriedView(e, holder) : e, dt);
        continue;
      }
      if (entry.type === 'arm') {
        entry.figure.update(e, this.mode, armHintOf(e.ownerNodeId, e.id) ?? { part: entry.part }, performance.now());
        continue;
      }
      if (entry.type === 'vehicle') {
        entry.figure.update(e);
        continue;
      }
      if (entry.type === 'robot') {
        entry.figure.update(e);
        continue;
      }
      if (entry.type === 'portal') {
        entry.figure.update(e, dt);
        continue;
      }
      if (entry.type === 'track' || entry.type === 'dot') {
        entry.figure.update(e);
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
        entry.figure.object.visible = e.seatedIn === undefined || !closedCabs.has(e.seatedIn);
        entry.figure.update(e.seatedIn !== undefined ? seatedView(e) : e, dt);
        continue;
      }
      if (entry.type === 'item') {
        const { object } = entry.figure;
        object.scale.set(e.size.x, e.size.y, e.size.z);
        if (e.rotation) {
          // A crate the physics turned (tipped over, tumbling): the pose group sits at its centre and turns about it.
          turnQuat.set(e.rotation.x, e.rotation.y, e.rotation.z, e.rotation.w);
          turnShift.set(0, entry.flat ? -e.size.y / 2 - entry.bounds.min.z * e.size.z : 0, 0).applyQuaternion(turnQuat);
          object.position.set(0, 0, 0);
          entry.pose.position.set(e.position.x + turnShift.x, e.position.y + turnShift.y, e.position.z + turnShift.z);
          entry.pose.quaternion.copy(turnQuat);
          if (entry.flat) entry.pose.quaternion.multiply(LYING_POSE);
          entry.turned = true;
        } else if (entry.flat) {
          if (entry.turned) {
            entry.pose.quaternion.copy(LYING_POSE);
            entry.turned = false;
          }
          // Lying tool: the pose group turns it onto its side; lift so its lowest point rests on the entity's floor.
          object.position.set(0, 0, 0);
          entry.pose.position.set(e.position.x, e.position.y - e.size.y / 2 - entry.bounds.min.z * e.size.z, e.position.z);
        } else {
          if (entry.turned) {
            entry.pose.position.set(0, 0, 0);
            entry.pose.quaternion.identity();
            entry.turned = false;
          }
          object.position.set(e.position.x, e.position.y, e.position.z);
        }
        if (entry.color !== e.color) {
          entry.figure.setColor(e.color);
          entry.color = e.color;
        }
        // The model is laid out for the whole body; the squashed object scale then flattens it instead of shrinking it.
        entry.figure.update?.(original);
        entry.pose.updateMatrixWorld(true);
        continue;
      }
      const { mesh } = entry;
      mesh.position.set(e.position.x, e.position.y, e.position.z);
      mesh.scale.set(e.size.x, e.size.y, e.size.z);
      // Turning blocks: about Z in the side view, about the vertical axis elsewhere.
      mesh.rotation.order = 'YZX';
      mesh.rotation.set(0, this.mode === '2d-side' ? 0 : (e.angle ?? 0), this.mode === '2d-side' ? (e.angle ?? 0) : this.mode === '3d' ? (e.tilt ?? 0) : 0);
      mesh.userData.ownerNodeId = e.ownerNodeId;
      if (entry.color !== e.color) {
        mesh.material.color.set(e.color);
        entry.color = e.color;
      }
      mesh.updateMatrixWorld();
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      // A hidden door or star finishes its exit animation before it goes.
      if (entry.type === 'stage' && entry.figure.fadeOut && hidden.has(id)) {
        if (entry.figure.fadeOut(dt)) this.removeEntry(id, entry);
      } else {
        this.removeEntry(id, entry);
      }
    }
    this.healthBars.sync(entities);
    this.loadTags.sync(entities, this.mode);
  }

  /** Sight fans of the characters that have a "Tầm nhìn" sensor (none when the list is empty). `boxes` is only asked for when there is a fan. */
  syncVisionFans(specs: readonly FanSpec[], boxes: () => readonly SolidBox[]): void {
    this.visionFans.sync(specs, boxes);
  }

  /** Green collision-box frames for the entities owned by `owners` (pass an empty set to hide them). */
  syncColliderFrames(entities: readonly EntityView[], owners: ReadonlySet<string>): void {
    this.colliderFrames.sync(entities, owners);
  }

  /**
   * Glowing outline around the visible entities owned by `owners` (empty set = none). It follows the drawn figure's silhouette.
   * `strength` 0..1 is the pulse. Call `renderHighlight` after the frame is drawn.
   */
  syncHighlight(entities: readonly EntityView[], owners: ReadonlySet<string>, strength: number): void {
    const roots: THREE.Object3D[] = [];
    if (owners.size > 0) {
      for (const e of entities) {
        if (!e.visible || e.inHand || !owners.has(e.ownerNodeId)) continue;
        const root = this.rootOf(this.entries.get(e.id));
        if (root) roots.push(root);
      }
    }
    this.highlight.sync(roots, strength);
  }

  /** Draws the outline over the frame the renderer just finished. */
  renderHighlight(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void {
    this.highlight.render(renderer, this.scene, camera);
  }

  /** How many highlight frames are visible (for tests and checks). */
  get highlightCount(): number {
    return this.highlight.shown;
  }

  private rootOf(entry: Entry | undefined): THREE.Object3D | null {
    if (!entry) return null;
    if (entry.type === 'block') return entry.mesh;
    if (entry.type === 'item') return entry.pose;
    return entry.figure.object;
  }

  /** How many collision frames are visible (for tests and checks). */
  get colliderFrameCount(): number {
    return this.colliderFrames.shown;
  }

  private createEntry(e: EntityView, role: string | null, all: readonly EntityView[]): Entry {
    if (role !== null && this.stage) {
      const figure = this.stage.create(role, e, all, this.mode);
      if (figure) {
        figure.object.traverse((o) => {
          o.userData.ownerNodeId = e.ownerNodeId;
        });
        this.group.add(figure.object);
        return { type: 'stage', figure, role };
      }
    }
    if (e.kind === 'vehicle') {
      const figure = new VehicleFigure(e.vehicle?.model ?? 'car', e.color);
      castShadows(figure.object);
      this.group.add(figure.object);
      return { type: 'vehicle', figure, model: figure.model };
    }
    if (e.kind === 'robot') {
      const look = robotLookOf(e);
      if (look === AGV_LOOK) {
        const figure = new AgvFigure();
        this.group.add(figure.object);
        return { type: 'robot', figure, look };
      }
      const figure = new RobotFigure(e.color);
      castShadows(figure.object);
      this.group.add(figure.object);
      return { type: 'robot', figure, look };
    }
    if (e.kind === 'character') {
      const figure = new Humanoid(e.color, this.mode, e.look);
      if (this.stage) figure.setStageLook(this.stage.characterScale, true);
      castShadows(figure.object);
      this.group.add(figure.object);
      return { type: 'character', figure, look: figure.look };
    }
    if (e.kind === 'item') {
      const shape = e.shape ?? 'box';
      const look = parcelLookOf(e);
      const figure = look ? buildParcel(look, e.color, `${e.ownerNodeId}|${e.id}`) : buildItem(shape, e.color, `${e.ownerNodeId}|${e.id}`);
      figure.object.traverse((o) => {
        o.userData.ownerNodeId = e.ownerNodeId;
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      const pose = new THREE.Group();
      pose.add(figure.object);
      const bounds = new THREE.Box3().setFromObject(figure.object); // before the pose turns it
      const flat = !look && liesFlat(shape);
      if (flat) pose.quaternion.copy(LYING_POSE);
      this.group.add(pose);
      return { type: 'item', figure, pose, flat, bounds, shape, look, color: e.color };
    }
    if (e.kind === 'block' && e.look === PORTAL_LOOK) {
      const figure = new PortalFigure(e.color, this.mode);
      this.group.add(figure.object);
      return { type: 'portal', figure };
    }
    if (e.kind === 'block' && e.look === LINE_TRACK_LOOK && e.track) {
      const figure = new LineTrackFigure(e, this.mode);
      this.group.add(figure.object);
      return { type: 'track', figure };
    }
    if (e.kind === 'block' && e.look === LINE_DOT_LOOK) {
      const figure = new LineDotFigure(e, this.mode);
      this.group.add(figure.object);
      return { type: 'dot', figure };
    }
    const armHint = e.kind === 'block' && !e.zone ? armHintOf(e.ownerNodeId, e.id) : undefined;
    if (armHint) {
      const look = armLookOf(armHint.part, e);
      const figure = look ? new FactoryArmFigure(armHint.part, look) : new ArmPartFigure(armHint.part);
      this.group.add(figure.object);
      return { type: 'arm', figure, part: armHint.part, look };
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
    if (entry.type === 'stage') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'portal' || entry.type === 'track' || entry.type === 'dot') {
      this.group.remove(entry.figure.object);
      entry.figure.dispose();
    } else if (entry.type === 'vehicle' || entry.type === 'robot' || entry.type === 'arm') {
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

  /** Owner of the first thing under the ray; owners in `ignore` (a floor) let the ray carry on to what is behind them. */
  pick(ndc: THREE.Vector2, camera: THREE.Camera, ignore?: ReadonlySet<string>): string | null {
    this.raycaster.setFromCamera(ndc, camera);
    // Recursive: humanoid parts are nested meshes; each carries the owner id in userData.
    const hits = this.raycaster.intersectObjects(this.group.children, true);
    if (!ignore) {
      const owner: unknown = hits[0]?.object.userData.ownerNodeId;
      return typeof owner === 'string' ? owner : null;
    }
    for (const hit of hits) {
      const owner: unknown = hit.object.userData.ownerNodeId;
      if (typeof owner === 'string' && !ignore.has(owner)) return owner;
    }
    return null;
  }

  dispose(): void {
    this.clear();
    this.healthBars.dispose();
    this.colliderFrames.dispose();
    this.loadTags.dispose();
    this.highlight.dispose();
    this.setGrid('3d', false);
    this.geometry.dispose();
  }
}
