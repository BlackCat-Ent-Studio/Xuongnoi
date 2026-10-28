import * as THREE from 'three';
import type { EntityView } from '../engine/types';

const BAR_WIDTH = 0.9;
const BAR_HEIGHT = 0.12;
const BORDER = 0.04;
/** Gap between the top of the character and the bar. */
const LIFT = 0.3;
const MIN_FILL = 0.001;

interface Bar {
  group: THREE.Group;
  back: THREE.Sprite;
  fill: THREE.Sprite;
  /** Last fraction shown, to skip redundant color / pivot updates. */
  shown: number;
}

function sprite(color: number, order: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, depthWrite: false }));
  s.renderOrder = order;
  return s;
}

/** Green when healthy, through yellow, to red when nearly out. */
export function barColor(fraction: number): THREE.Color {
  const f = Math.min(1, Math.max(0, fraction));
  return new THREE.Color().setHSL((f * 120) / 360, 0.8, 0.45);
}

/**
 * Health bars floating above characters that carry a `health` snapshot. Sprites always face the camera, so one
 * layer serves every view mode. A bar disappears with its character (hidden, dead, or bar turned off).
 */
export class HealthBarLayer {
  private readonly bars = new Map<string, Bar>();

  constructor(private readonly parent: THREE.Object3D) {}

  sync(entities: readonly EntityView[]): void {
    const seen = new Set<string>();
    for (const e of entities) {
      const h = e.health;
      if (!e.visible || e.kind !== 'character' || !h || !h.bar || e.fallen !== undefined) continue;
      seen.add(e.id);
      let bar = this.bars.get(e.id);
      if (!bar) {
        bar = this.create();
        this.bars.set(e.id, bar);
      }
      this.update(bar, e, h.hp / h.max);
    }
    for (const [id, bar] of this.bars) {
      if (!seen.has(id)) this.remove(id, bar);
    }
  }

  private create(): Bar {
    const group = new THREE.Group();
    const back = sprite(0x1f2937, 20);
    back.scale.set(BAR_WIDTH + BORDER * 2, BAR_HEIGHT + BORDER * 2, 1);
    const fill = sprite(0x22c55e, 21);
    group.add(back, fill);
    this.parent.add(group);
    return { group, back, fill, shown: -1 };
  }

  private update(bar: Bar, e: EntityView, fraction: number): void {
    const f = Math.min(1, Math.max(0, fraction));
    bar.group.position.set(e.position.x, e.position.y + e.size.y / 2 + LIFT, e.position.z);
    bar.fill.visible = f > MIN_FILL;
    if (bar.shown === f) return;
    bar.shown = f;
    const w = Math.max(MIN_FILL, f) * BAR_WIDTH;
    bar.fill.scale.set(w, BAR_HEIGHT, 1);
    // The sprite's pivot is placed so its left edge stays on the bar's left edge, whatever way the camera faces.
    bar.fill.center.set(BAR_WIDTH / 2 / w, 0.5);
    (bar.fill.material as THREE.SpriteMaterial).color.copy(barColor(f));
  }

  private remove(id: string, bar: Bar): void {
    this.parent.remove(bar.group);
    (bar.back.material as THREE.Material).dispose();
    (bar.fill.material as THREE.Material).dispose();
    this.bars.delete(id);
  }

  dispose(): void {
    for (const [id, bar] of this.bars) this.remove(id, bar);
  }
}
