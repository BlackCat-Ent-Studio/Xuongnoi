import * as THREE from 'three';
import type { EntityView, VehicleModel } from '../engine/types';
import { VEHICLE_DIMS } from '../world/vehicles';
import { shade } from './item-shapes';

/**
 * Vehicles drawn from plain boxes: a body in the entity color, dark trim, and wheels that turn with the
 * distance travelled. Built in real units around the entity center (floor at -height/2, nose toward +x),
 * so the scene only moves and turns the group; it is never scaled.
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const WHEEL_COLOR = '#1f2937';
const HUB_COLOR = '#d1d5db';
const LIGHT_COLOR = '#fde68a';
const GLASS_COLOR = '#bae6fd';

type Tuple = [number, number, number];

export class VehicleFigure {
  readonly object = new THREE.Group();
  readonly model: VehicleModel;

  private readonly mats = new Map<string, THREE.MeshLambertMaterial>();
  private readonly mainMat: THREE.MeshLambertMaterial;
  private readonly darkMat: THREE.MeshLambertMaterial;
  private readonly wheels: THREE.Group[] = [];
  private readonly floor: number;
  private colorHex: string;

  constructor(model: VehicleModel, color: string) {
    this.model = model;
    this.colorHex = color;
    this.mainMat = this.mat(color);
    this.darkMat = this.mat(shade(color));
    this.floor = -VEHICLE_DIMS[model].height / 2;
    if (model === 'car') this.buildCar();
    else if (model === 'bike') this.buildBike();
    else if (model === 'locomotive') this.buildLocomotive();
    else if (model === 'wagon') this.buildWagon();
    else this.buildTruck();
  }

  private mat(color: string): THREE.MeshLambertMaterial {
    const existing = this.mats.get(color);
    if (existing) return existing;
    const m = new THREE.MeshLambertMaterial({ color });
    this.mats.set(color, m);
    return m;
  }

  /** A box of `size` whose center sits at `at` (x forward, y up measured from the floor, z sideways). */
  private part(parent: THREE.Object3D, size: Tuple, at: Tuple, material: THREE.MeshLambertMaterial): THREE.Mesh {
    const mesh = new THREE.Mesh(UNIT_BOX, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(at[0], this.floor + at[1], at[2]);
    parent.add(mesh);
    return mesh;
  }

  /** A wheel: dark tire box with a light bar across it, so its turning shows. */
  private wheel(x: number, z: number, radius: number, width: number): void {
    const group = new THREE.Group();
    group.position.set(x, this.floor + radius, z);
    const tire = new THREE.Mesh(UNIT_BOX, this.mat(WHEEL_COLOR));
    tire.scale.set(radius * 2, radius * 2, width);
    const hub = new THREE.Mesh(UNIT_BOX, this.mat(HUB_COLOR));
    hub.scale.set(radius * 1.5, radius * 0.4, width * 1.15);
    group.add(tire, hub);
    this.object.add(group);
    this.wheels.push(group);
  }

  private buildCar(): void {
    const o = this.object;
    this.part(o, [1.44, 0.3, 0.9], [0, 0.35, 0], this.mainMat);
    this.part(o, [0.45, 0.14, 0.86], [0.45, 0.57, 0], this.mainMat);
    this.part(o, [0.12, 0.3, 0.86], [-0.55, 0.65, 0], this.darkMat);
    for (const z of [-0.3, 0.3]) this.part(o, [0.05, 0.1, 0.18], [0.71, 0.45, z], this.mat(LIGHT_COLOR));
    this.part(o, [0.05, 0.26, 0.8], [0.22, 0.68, 0], this.mat(GLASS_COLOR));
    for (const x of [-0.48, 0.48]) for (const z of [-0.5, 0.5]) this.wheel(x, z, 0.2, 0.16);
  }

  private buildBike(): void {
    const o = this.object;
    this.part(o, [0.7, 0.12, 0.14], [0, 0.36, 0], this.darkMat);
    this.part(o, [0.3, 0.1, 0.22], [-0.12, 0.5, 0], this.darkMat);
    this.part(o, [0.26, 0.17, 0.2], [0.14, 0.5, 0], this.mainMat);
    this.part(o, [0.06, 0.32, 0.06], [0.36, 0.52, 0], this.darkMat);
    this.part(o, [0.06, 0.06, 0.5], [0.36, 0.72, 0], this.darkMat);
    this.part(o, [0.05, 0.1, 0.14], [0.4, 0.62, 0], this.mat(LIGHT_COLOR));
    for (const x of [-0.36, 0.36]) this.wheel(x, 0, 0.24, 0.12);
  }

  private buildTruck(): void {
    const o = this.object;
    this.part(o, [1.9, 0.2, 1], [0, 0.4, 0], this.darkMat);
    this.part(o, [0.55, 0.5, 1], [0.7, 0.75, 0], this.mainMat);
    this.part(o, [0.05, 0.3, 0.84], [0.45, 0.95, 0], this.mat(GLASS_COLOR));
    this.part(o, [0.1, 0.55, 0.9], [-0.18, 0.78, 0], this.darkMat);
    this.part(o, [0.85, 0.4, 1], [-0.55, 0.7, 0], this.mainMat);
    for (const z of [-0.3, 0.3]) this.part(o, [0.05, 0.12, 0.2], [0.97, 0.6, z], this.mat(LIGHT_COLOR));
    for (const x of [-0.65, 0.65]) for (const z of [-0.55, 0.55]) this.wheel(x, z, 0.3, 0.2);
  }

  private buildLocomotive(): void {
    const o = this.object;
    this.part(o, [2.5, 0.2, 1.2], [0, 0.4, 0], this.darkMat);
    this.part(o, [1.3, 0.62, 1], [0.3, 0.82, 0], this.mainMat);
    this.part(o, [0.2, 0.6, 0.9], [0.98, 0.82, 0], this.darkMat);
    this.part(o, [0.85, 0.85, 1.15], [-0.8, 0.92, 0], this.mainMat);
    this.part(o, [1, 0.08, 1.3], [-0.8, 1.34, 0], this.darkMat);
    this.part(o, [0.04, 0.3, 0.7], [-0.37, 1.0, 0], this.mat(GLASS_COLOR));
    this.part(o, [0.22, 0.34, 0.22], [0.85, 1.28, 0], this.darkMat);
    this.part(o, [0.05, 0.16, 0.22], [1.09, 0.84, 0], this.mat(LIGHT_COLOR));
    this.part(o, [0.2, 0.26, 1], [1.2, 0.3, 0], this.darkMat);
    for (const x of [-0.8, 0, 0.8]) for (const z of [-0.6, 0.6]) this.wheel(x, z, 0.32, 0.14);
  }

  private buildWagon(): void {
    const o = this.object;
    this.part(o, [2.3, 0.16, 1.1], [0, 0.36, 0], this.darkMat);
    this.part(o, [2.1, 0.55, 1.1], [0, 0.72, 0], this.mainMat);
    this.part(o, [2.2, 0.06, 1.2], [0, 1.02, 0], this.darkMat);
    for (const x of [-1.1, 1.1]) this.part(o, [0.2, 0.08, 0.12], [x, 0.42, 0], this.darkMat);
    for (const x of [-0.8, 0.8]) for (const z of [-0.54, 0.54]) this.wheel(x, z, 0.25, 0.12);
  }

  setColor(color: string): void {
    if (color === this.colorHex) return;
    this.colorHex = color;
    this.mainMat.color.set(color);
    this.darkMat.color.set(shade(color));
  }

  /** Follow the entity: position, nose direction, wheel turning, color, owner (for clicking in the game view). */
  update(view: EntityView): void {
    const p = view.position;
    this.object.position.set(p.x, p.y, p.z);
    this.object.rotation.y = -(view.vehicle?.heading ?? 0);
    const spin = view.vehicle?.wheelSpin ?? 0;
    for (const w of this.wheels) w.rotation.z = -spin;
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
