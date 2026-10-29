import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';

/** `look` value that marks a block entity as a portal. */
export const PORTAL_LOOK = 'portal';

/**
 * A glowing ring with a swirling disc. The side view stands it up like a doorway; the top and 3d views
 * lay it down as a pad with a faint light column, so it reads from every angle.
 */
export class PortalFigure {
  readonly object = new THREE.Group();
  private readonly ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshLambertMaterial>;
  private readonly disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly swirl: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly column: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private readonly pose = new THREE.Group();
  private color = '';
  private spin = 0;

  constructor(
    color: string,
    private readonly mode: ViewMode,
  ) {
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 10, 40), new THREE.MeshLambertMaterial({ color }));
    this.disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.swirl = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.4, 5, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.pose.add(this.ring, this.disc, this.swirl);
    this.object.add(this.pose);
    if (mode !== '2d-side') {
      this.pose.rotation.x = -Math.PI / 2;
      this.object.add(this.column);
    }
    this.setColor(color);
  }

  private setColor(color: string): void {
    this.color = color;
    this.ring.material.color.set(color);
    this.disc.material.color.set(color);
    this.column.material.color.set(color);
  }

  update(e: EntityView, dt: number): void {
    if (e.color !== this.color) this.setColor(e.color);
    this.spin += dt * 2.2;
    this.swirl.rotation.z = this.spin;
    const { x, y, z } = e.size;
    this.object.position.set(e.position.x, e.position.y, e.position.z);
    if (this.mode === '2d-side') {
      const d = Math.min(x, y);
      this.pose.scale.set(d, d, 1);
      this.pose.position.set(0, 0, 0);
    } else {
      // Lying pad on the floor of the entity box, light column up to its top.
      const d = Math.min(x, z);
      this.pose.scale.set(d, d, d);
      this.pose.position.set(0, -y / 2 + 0.06, 0);
      this.column.scale.set(d, y, d);
      this.column.position.set(0, 0, 0);
    }
    this.object.userData.ownerNodeId = e.ownerNodeId;
    this.object.traverse((o) => {
      o.userData.ownerNodeId = e.ownerNodeId;
    });
    this.object.updateMatrixWorld(true);
  }

  dispose(): void {
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
