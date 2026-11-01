import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { smoothValue } from './cameras';
import {
  AIRBORNE_SPEED_MIN,
  TELEPORT_DISTANCE,
  defaultYaw,
  facingTarget,
  motionOf,
  smoothAngle,
  swingAngle,
  swingLunge,
  walkPhaseRate,
} from './character-motion';
import { applyHitFlash } from './hit-flash';
import { buildItem, handGrip, IN_HAND_SCALE, type ItemFigure } from './item-shapes';
import { PartKit, type StyleRig, localYRange, resolveLook, styleFor } from './character-styles';

/** Lowest point of the figure sits on the collision box's floor (figure space: y -0.5 .. 0.5). */
const FLOOR = -0.5;
const FIGURE_HEIGHT = 1;

/**
 * Blocky character built from boxes in one of the selectable looks, fitted inside the entity's collision
 * box with its base on the box floor. Animation is driven only by the entity's per-frame movement.
 */
export class Humanoid {
  readonly object = new THREE.Group();
  /** Normalized look id actually in use (unknown ids fall back to the default). */
  readonly look: string;

  private readonly yawGroup = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly kit: PartKit;
  private readonly rig: StyleRig;

  /** Tool currently drawn on the figure (rebuilt when the shape or color changes). */
  private tool: { key: string; figure: ItemFigure; holder: THREE.Group } | null = null;
  private colorHex: string;
  /** Sitting in a vehicle: the legs and arms rest while the body still turns with the ride. */
  private seated = false;
  private mode: ViewMode;
  private yaw: number;
  private phase = 0;
  private time = 0;
  private prev: { x: number; y: number; z: number } | null = null;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private flash = 0;
  /** Visual size factor (the puzzle stage draws characters bigger than their collision box); 1 = exactly the box. */
  private visualScale = 1;
  /** Feet stay on the box floor when the figure is drawn larger. */
  private lift = 0;
  /** The scene wants the arms-forward carry pose while an item is carried. */
  private carryPose = false;
  private carrying = false;

  constructor(color: string, mode: ViewMode, look?: string) {
    this.colorHex = color;
    this.mode = mode;
    this.yaw = defaultYaw(mode);
    this.look = resolveLook(look);
    this.kit = new PartKit(color);
    this.rig = styleFor(this.look).build(this.kit);

    // Figure is 1 unit tall, centered on the origin, facing +X.
    this.object.add(this.yawGroup);
    this.yawGroup.add(this.body);
    this.body.add(this.rig.root);
    this.applyYaw();
    this.fitToFloor();
  }

  setSeated(seated: boolean): void {
    this.seated = seated;
  }

  /** Stage look: draw the figure `scale` times its box size (feet on the floor) and, optionally, with the carry pose. */
  setStageLook(scale: number, carryPose: boolean): void {
    this.visualScale = scale;
    this.carryPose = carryPose;
  }

  setMode(mode: ViewMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.yaw = defaultYaw(mode);
    this.applyYaw();
  }

  /** Sync transform, main color and owner, then advance the animation by `dt` seconds. */
  update(view: EntityView, dt: number): void {
    if (view.color !== this.colorHex) {
      this.kit.setMainColor(view.color);
      this.colorHex = view.color;
    }
    const p = view.position;
    this.object.position.set(p.x, p.y, p.z);
    // Uniform horizontal scale keeps the figure inside the box under any yaw.
    const h = Math.min(view.size.x, view.size.z);
    const k = this.visualScale;
    this.body.scale.set(h * k, view.size.y * k, h * k);
    this.lift = ((k - 1) * view.size.y) / 2;
    this.carrying = this.carryPose && view.carriedHeight !== undefined;
    this.syncTool(view.tool);
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });

    if (dt > 0) this.animate(p, dt);
    this.applySwing(view.swing);
    this.applyHurt(view.hurt ?? 0);
    this.applyFall(view.fallen);
    this.fitToFloor();
    this.object.updateMatrixWorld(true);
  }

  private animate(p: { x: number; y: number; z: number }, dt: number): void {
    const prev = this.prev;
    this.prev = { x: p.x, y: p.y, z: p.z };
    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dz = p.z - prev.z;
      if (Math.hypot(dx, dy, dz) > TELEPORT_DISTANCE) {
        this.vx = this.vy = this.vz = 0;
      } else {
        this.vx = smoothValue(this.vx, dx / dt, dt, 20);
        this.vy = smoothValue(this.vy, dy / dt, dt, 20);
        this.vz = smoothValue(this.vz, dz / dt, dt, 20);
      }
    }
    const moving = this.mode === '2d-side' ? Math.abs(this.vx) : Math.hypot(this.vx, this.vz);
    const speed = this.seated ? 0 : moving;
    const airborne = !this.seated && Math.abs(this.vy) > AIRBORNE_SPEED_MIN;
    this.time += dt;
    this.phase += dt * walkPhaseRate(speed);
    this.yaw = smoothAngle(this.yaw, facingTarget(this.mode, this.vx, this.vz, this.yaw), dt);
    const motion = motionOf(speed, airborne, this.phase, this.time, this.seated ? 0 : this.vy);
    if (this.carrying) motion.carrying = true;
    this.rig.update(motion, dt);
    this.applyYaw();
  }

  /** Show, replace or remove the tool in hand. Looks without a hand mount never show tools. */
  private syncTool(tool: EntityView['tool']): void {
    const mount = this.rig.hand;
    if (!mount) return;
    const key = tool ? `${tool.shape}|${tool.color}` : '';
    if ((this.tool?.key ?? '') === key) return;
    if (this.tool) {
      mount.swing.remove(this.tool.holder);
      this.tool.figure.dispose();
      this.tool = null;
    }
    if (!tool) return;
    const figure = buildItem(tool.shape, tool.color);
    const grip = handGrip(tool.shape);
    const holder = new THREE.Group();
    holder.userData.noFit = true;
    holder.position.set(mount.at[0], mount.at[1], mount.at[2]);
    holder.rotation.z = grip.tilt;
    holder.scale.setScalar(mount.length * grip.scale * IN_HAND_SCALE);
    figure.object.position.y = grip.dy;
    holder.add(figure.object);
    mount.swing.add(holder);
    this.tool = { key, figure, holder };
  }

  /** Swing pose for a swing in progress (`progress` 0..1), rest otherwise; also a small lunge forward. */
  private applySwing(progress: number | undefined): void {
    const mount = this.rig.hand;
    if (!mount) return;
    const active = progress !== undefined;
    mount.swing.rotation.z = active ? swingAngle(progress) * mount.swingShare : 0;
    this.body.position.x = active ? swingLunge(progress) : 0;
  }

  /** Red flash after a hit; only touches the materials when the strength changes. */
  private applyHurt(strength: number): void {
    if (strength === this.flash) return;
    this.flash = strength;
    applyHitFlash(this.object, strength);
  }

  /** Tips the whole figure over backward (`progress` 0..1) and sinks it to lie on the floor. */
  private applyFall(progress: number | undefined): void {
    const p = progress ?? 0;
    this.body.rotation.z = p * (Math.PI / 2);
    this.body.position.y = this.lift - p * 0.32 * this.body.scale.y;
  }

  private applyYaw(): void {
    this.yawGroup.rotation.y = this.yaw;
  }

  /**
   * Keep the pose inside the figure's 1-unit height with its lowest point on the floor. Swinging limbs can
   * dip below the base, so the figure is lifted by the dip; if that pushes the top past the box, the pose is
   * compressed vertically (about the floor) by the few percent needed.
   */
  private fitToFloor(): void {
    const root = this.rig.root;
    if (this.rig.selfFitting) return;
    const { min, max } = localYRange(root);
    const lift = Math.max(0, FLOOR - min);
    const k = Math.min(1, FIGURE_HEIGHT / (max - FLOOR + lift));
    root.scale.y = k;
    root.position.y = FLOOR * (1 - k) + k * lift;
  }

  dispose(): void {
    this.tool?.figure.dispose();
    this.tool = null;
    this.kit.dispose();
  }
}
