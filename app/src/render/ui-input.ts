import * as THREE from 'three';
import type { EntityId, EntityView, UiInput } from '../engine/types';

/**
 * Collects clicks while the browser runs between ticks. `take()` hands them to the runtime once; the held
 * set stays until the pointer is released (a press and release between two ticks still reads as held once).
 */
export class UiInputBuffer {
  private clicked = new Set<string>();
  private picked = new Set<EntityId>();
  private readonly held = new Set<string>();
  private heldSeen = new Set<string>();

  click(key: string): void {
    this.clicked.add(key);
  }

  hold(key: string, down: boolean): void {
    if (down) {
      this.held.add(key);
      this.heldSeen.add(key);
    } else {
      this.held.delete(key);
    }
  }

  pick(ids: Iterable<EntityId>): void {
    for (const id of ids) this.picked.add(id);
  }

  /** Everything gathered since the last call, then forgets the one-shot parts. */
  take(): UiInput {
    const out: UiInput = {
      clicked: this.clicked,
      held: new Set([...this.held, ...this.heldSeen]),
      picked: this.picked,
    };
    this.clicked = new Set();
    this.picked = new Set();
    this.heldSeen = new Set();
    return out;
  }

  /** Held buttons only: for the extra ticks of one frame that follow the one that took the clicks. */
  peekHeld(): UiInput {
    return { clicked: new Set(), held: new Set(this.held), picked: new Set() };
  }

  clear(): void {
    this.clicked.clear();
    this.picked.clear();
    this.held.clear();
    this.heldSeen.clear();
  }
}

const EXCLUDED_FROM_PICK = (e: EntityView): boolean => !e.visible || e.zone === true || e.inHand === true;

/**
 * Entities whose box the pointer ray passes through. The perspective (3D) view only reports the nearest one so
 * a click cannot reach through a wall; the flat views report every box on the ray.
 */
export function pickEntities(
  ndc: THREE.Vector2,
  camera: THREE.Camera,
  entities: readonly EntityView[],
  nearestOnly: boolean,
): EntityId[] {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const hits: { id: EntityId; dist: number }[] = [];
  for (const e of entities) {
    if (EXCLUDED_FROM_PICK(e)) continue;
    box.setFromCenterAndSize(
      new THREE.Vector3(e.position.x, e.position.y, e.position.z),
      new THREE.Vector3(e.size.x, e.size.y, e.size.z),
    );
    if (raycaster.ray.intersectBox(box, point)) hits.push({ id: e.id, dist: point.distanceTo(raycaster.ray.origin) });
  }
  hits.sort((a, b) => a.dist - b.dist);
  return (nearestOnly ? hits.slice(0, 1) : hits).map((h) => h.id);
}

/** A press-and-release that moved less than this many pixels counts as a click, not an orbit drag. */
const CLICK_SLOP_PX = 6;

/** Tells a click from a drag: remember where the pointer went down, compare on release. */
export function createClickTracker(): {
  down(id: number, x: number, y: number): void;
  up(id: number, x: number, y: number): boolean;
  cancel(): void;
} {
  let start: { id: number; x: number; y: number } | null = null;
  return {
    down(id, x, y) {
      start = { id, x, y };
    },
    up(id, x, y) {
      const s = start;
      start = null;
      return s !== null && s.id === id && Math.hypot(x - s.x, y - s.y) <= CLICK_SLOP_PX;
    },
    cancel() {
      start = null;
    },
  };
}
