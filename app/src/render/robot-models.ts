import * as THREE from 'three';
import type { EntityView } from '../engine/types';
import { shade } from './item-shapes';

/**
 * A robot chassis drawn from boxes: a body in the entity colour, a darker top plate, a light "eye" strip on the nose so
 * the heading can be read from above, and one wheel per mounted motor (a dark tyre with a light hub bar, so the turning
 * shows). Built in real units around the entity centre (floor at -height/2, nose toward +x, right-hand side toward +z).
 * The scene only moves and turns the group; it is never scaled.
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const WHEEL_COLOR = '#1f2937';
const HUB_COLOR = '#d1d5db';
const EYE_COLOR = '#fde68a';
/** Wheel thickness across the chassis, metres. */
const WHEEL_WIDTH = 0.1;
/** The chassis is lifted this far off the ground so the wheels carry it, metres. */
const GROUND_GAP = 0.04;

interface WheelMesh {
  group: THREE.Group;
}

export class RobotFigure {
  readonly object = new THREE.Group();

  private readonly body = new THREE.Group();
  private readonly wheelGroup = new THREE.Group();
  private readonly mats = new Map<string, THREE.MeshLambertMaterial>();
  private readonly mainMat: THREE.MeshLambertMaterial;
  private readonly darkMat: THREE.MeshLambertMaterial;
  private wheels: WheelMesh[] = [];
  private wheelKey = '';
  private sizeKey = '';
  private colorHex: string;

  constructor(color: string) {
    this.colorHex = color;
    this.mainMat = this.mat(color);
    this.darkMat = this.mat(shade(color));
    this.object.add(this.body, this.wheelGroup);
  }

  private mat(color: string): THREE.MeshLambertMaterial {
    const existing = this.mats.get(color);
    if (existing) return existing;
    const m = new THREE.MeshLambertMaterial({ color });
    this.mats.set(color, m);
    return m;
  }

  private box(parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], material: THREE.MeshLambertMaterial): void {
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.castShadow = true;
    parent.add(mesh);
  }

  /** Rebuilds the chassis boxes when its size changes. `floor` is the y of the chassis bottom relative to the centre. */
  private buildBody(length: number, width: number, height: number): void {
    for (const c of [...this.body.children]) this.body.remove(c);
    const floor = -height / 2 + GROUND_GAP;
    const slab = Math.max(0.05, height * 0.6 - GROUND_GAP);
    this.box(this.body, [length, slab, width], [0, floor + slab / 2, 0], this.mainMat);
    const plate = Math.max(0.03, height * 0.25);
    this.box(this.body, [length * 0.6, plate, width * 0.7], [-length * 0.05, floor + slab + plate / 2, 0], this.darkMat);
    this.box(this.body, [0.06, Math.max(0.04, slab * 0.35), width * 0.6], [length / 2 - 0.02, floor + slab * 0.6, 0], this.mat(EYE_COLOR));
  }

  private buildWheels(view: EntityView): void {
    for (const w of this.wheels) this.wheelGroup.remove(w.group);
    this.wheels = [];
    const floor = -view.size.y / 2;
    for (const w of view.robot?.wheels ?? []) {
      const group = new THREE.Group();
      group.position.set(w.forward, floor + w.radius, w.side);
      const tire = new THREE.Mesh(UNIT_BOX, this.mat(WHEEL_COLOR));
      tire.scale.set(w.radius * 2, w.radius * 2, WHEEL_WIDTH);
      const hub = new THREE.Mesh(UNIT_BOX, this.mat(HUB_COLOR));
      hub.scale.set(w.radius * 1.5, w.radius * 0.4, WHEEL_WIDTH * 1.15);
      tire.castShadow = true;
      hub.castShadow = true;
      group.add(tire, hub);
      this.wheelGroup.add(group);
      this.wheels.push({ group });
    }
  }

  setColor(color: string): void {
    if (color === this.colorHex) return;
    this.colorHex = color;
    this.mainMat.color.set(color);
    this.darkMat.color.set(shade(color));
  }

  /** Follow the entity: position, nose direction, wheel mounts and turning, colour, owner (for clicking in the game view). */
  update(view: EntityView): void {
    const r = view.robot;
    const p = view.position;
    this.object.position.set(p.x, p.y, p.z);
    this.object.rotation.y = -(r?.heading ?? 0);
    const sizeKey = `${r?.length}|${r?.width}|${view.size.y}`;
    if (sizeKey !== this.sizeKey) {
      this.sizeKey = sizeKey;
      this.buildBody(r?.length ?? 1, r?.width ?? 0.7, view.size.y);
    }
    // Wheels are rebuilt only when a motor is plugged, unplugged or re-tuned (their mounts are the key).
    const key = (r?.wheels ?? []).map((w) => `${w.side}|${w.forward}|${w.radius}`).join(';');
    if (key !== this.wheelKey) {
      this.wheelKey = key;
      this.buildWheels(view);
    }
    (r?.wheels ?? []).forEach((w, i) => {
      const mesh = this.wheels[i];
      if (mesh) mesh.group.rotation.z = -w.spin;
    });
    this.setColor(view.color);
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });
    this.object.updateMatrixWorld(true);
  }

  dispose(): void {
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }
}
