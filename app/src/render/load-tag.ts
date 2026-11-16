import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { damagedView } from './damaged-look';

/**
 * A small "N kg" tag on crates that carry an explicit mass, so the weight a joint has to hold can be read off the load.
 * One flat label per face the cameras can see (front, back, top), drawn just off the face; the textures and the plane
 * geometry are shared. Draw only: it follows the entity and never touches the world.
 */

const TAG_BG = '#ffd23f';
const TAG_INK = '#23252b';

const textures = new Map<string, THREE.MeshBasicMaterial>();
const PLANE = new THREE.PlaneGeometry(1, 1);

/** "2 kg", "0.5 kg", "12.3 kg": at most one decimal. */
export function massLabel(kg: number): string {
  const r = Math.round(kg * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} kg`;
}

function tagMaterial(label: string): THREE.MeshBasicMaterial {
  let m = textures.get(label);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 96;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = TAG_INK;
      g.beginPath();
      g.roundRect(4, 4, 184, 88, 22);
      g.fill();
      g.fillStyle = TAG_BG;
      g.beginPath();
      g.roundRect(12, 12, 168, 72, 16);
      g.fill();
      g.fillStyle = TAG_INK;
      g.font = '800 54px "Segoe UI",Arial,sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, 96, 50);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    m = new THREE.MeshBasicMaterial({ map: t, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    textures.set(label, m);
  }
  return m;
}

/** Whether this entity gets a tag: a box or crate item with a mass the user set. */
function wantsTag(e: EntityView): boolean {
  const shape = e.shape ?? 'box';
  return e.kind === 'item' && (shape === 'box' || shape === 'crate') && e.mass !== undefined && e.visible && !e.inHand;
}

interface Tag {
  group: THREE.Group;
  label: string;
}

export class LoadTagLayer {
  private readonly tags = new Map<string, Tag>();

  constructor(private readonly parent: THREE.Object3D) {}

  sync(entities: readonly EntityView[], mode: ViewMode): void {
    const seen = new Set<string>();
    for (const original of entities) {
      if (!wantsTag(original)) continue;
      const e = damagedView(original);
      const label = massLabel(original.mass ?? 0);
      seen.add(e.id);
      let tag = this.tags.get(e.id);
      if (tag && tag.label !== label) {
        this.parent.remove(tag.group);
        tag = undefined;
      }
      if (!tag) {
        const group = new THREE.Group();
        const mat = tagMaterial(label);
        const front = new THREE.Mesh(PLANE, mat);
        const back = new THREE.Mesh(PLANE, mat);
        back.rotation.y = Math.PI;
        const top = new THREE.Mesh(PLANE, mat);
        top.rotation.x = -Math.PI / 2;
        group.add(front, back, top);
        this.parent.add(group);
        tag = { group, label };
        this.tags.set(e.id, tag);
      }
      const { size, position } = e;
      const w = Math.max(0.05, Math.min(size.x * 0.72, size.y * 1.44, size.z * 1.44));
      const h = w / 2;
      const [front, back, top] = tag.group.children as THREE.Mesh[];
      tag.group.position.set(position.x, position.y, position.z);
      front!.position.set(0, 0, size.z / 2 + 0.012);
      front!.scale.set(w, h, 1);
      back!.position.set(0, 0, -size.z / 2 - 0.012);
      back!.scale.set(w, h, 1);
      top!.position.set(0, size.y / 2 + 0.012, 0);
      top!.scale.set(w, h, 1);
      // The top view reads the label from above; the side and 3D views read it on the front and back faces.
      front!.visible = back!.visible = mode !== '2d-top';
      top!.visible = mode === '2d-top';
    }
    for (const [id, tag] of this.tags) {
      if (seen.has(id)) continue;
      this.parent.remove(tag.group);
      this.tags.delete(id);
    }
  }

  dispose(): void {
    for (const tag of this.tags.values()) this.parent.remove(tag.group);
    this.tags.clear();
  }
}
