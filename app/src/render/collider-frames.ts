import * as THREE from 'three';
import type { EntityView } from '../engine/types';

const FRAME_COLOR = 0x22c55e;

/** Thin green wireframes of the collision boxes of the selected objects (edit mode only; the caller passes none while playing). */
export class ColliderFrames {
  private readonly edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  private readonly material = new THREE.LineBasicMaterial({ color: FRAME_COLOR, depthTest: false, transparent: true });
  private readonly pool: THREE.LineSegments[] = [];

  constructor(private readonly parent: THREE.Object3D) {}

  /** Shows one frame per visible entity whose owner node is in `owners`; frames of anything else are hidden. */
  sync(entities: readonly EntityView[], owners: ReadonlySet<string>): void {
    let used = 0;
    if (owners.size > 0) {
      for (const e of entities) {
        if (!e.visible || e.inHand || !owners.has(e.ownerNodeId)) continue;
        const box = e.collider ?? { position: e.position, size: e.size };
        const frame = this.frame(used++);
        frame.position.set(box.position.x, box.position.y, box.position.z);
        frame.scale.set(Math.max(box.size.x, 1e-3), Math.max(box.size.y, 1e-3), Math.max(box.size.z, 1e-3));
        frame.visible = true;
      }
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.visible = false;
  }

  /** Number of frames currently shown. */
  get shown(): number {
    return this.pool.filter((f) => f.visible).length;
  }

  private frame(i: number): THREE.LineSegments {
    let f = this.pool[i];
    if (!f) {
      f = new THREE.LineSegments(this.edges, this.material);
      f.renderOrder = 999;
      f.raycast = () => undefined; // never steals clicks from the object it outlines
      this.parent.add(f);
      this.pool.push(f);
    }
    return f;
  }

  dispose(): void {
    for (const f of this.pool) this.parent.remove(f);
    this.pool.length = 0;
    this.edges.dispose();
    this.material.dispose();
  }
}
