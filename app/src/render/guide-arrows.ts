import * as THREE from 'three';
import type { EntityView, HudItem } from '../engine/types';

/** Height of the arrow above the top of the "from" entity, in world units. */
const ARROW_LIFT = 0.8;
/** Length of the ground step used to find which way the arrow points on screen. */
const PROBE = 1;
const DEFAULT_COLOR = '#f59e0b';

/** One arrow ready to draw: its center in pixels, rotation (0 = pointing up, clockwise), and label. */
export interface GuideArrowShape {
  key: string;
  x: number;
  y: number;
  /** Radians, clockwise from screen-up. */
  angle: number;
  text: string;
  color: string;
}

/**
 * Screen shapes for the guide-arrow HUD items. Skips hidden items, missing or hidden entities, targets on top
 * of the source, and anything behind the camera. The direction is the ground-plane direction projected
 * through the camera, so it is right in 3D, top-down and side views alike.
 */
export function guideArrowShapes(
  items: readonly HudItem[],
  getEntity: (id: string) => EntityView | undefined,
  camera: THREE.Camera,
  width: number,
  height: number,
): GuideArrowShape[] {
  const out: GuideArrowShape[] = [];
  const base = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  for (const item of items) {
    if (item.hidden || item.guide === undefined || item.anchor === undefined) continue;
    const from = getEntity(item.anchor);
    const to = getEntity(item.guide.to);
    if (!from || !from.visible || !to || !to.visible) continue;
    const dx = to.position.x - from.position.x;
    const dz = to.position.z - from.position.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const y = from.position.y + from.size.y / 2 + ARROW_LIFT;
    base.set(from.position.x, y, from.position.z).project(camera);
    ahead.set(from.position.x + (dx / len) * PROBE, y, from.position.z + (dz / len) * PROBE).project(camera);
    if (base.z < -1 || base.z > 1) continue;
    const sx = (ahead.x - base.x) * width;
    const sy = (base.y - ahead.y) * height; // screen y grows downwards
    if (Math.hypot(sx, sy) < 1e-6) continue;
    out.push({
      key: item.key,
      x: ((base.x + 1) / 2) * width,
      y: ((1 - base.y) / 2) * height,
      angle: Math.atan2(sx, -sy),
      text: item.guide.showDistance ? String(Math.round(item.value)) : '',
      color: item.color ?? DEFAULT_COLOR,
    });
  }
  return out;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** DOM layer that draws the arrows over the game view. Arrows not in the latest list are removed. */
export class GuideArrowLayer {
  private readonly layer = document.createElement('div');
  private readonly arrows = new Map<string, { root: HTMLElement; icon: HTMLElement; path: SVGPathElement; label: HTMLElement }>();

  constructor(parent: HTMLElement) {
    this.layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    parent.insertBefore(this.layer, parent.firstChild);
  }

  sync(shapes: readonly GuideArrowShape[]): void {
    const seen = new Set<string>();
    for (const s of shapes) {
      seen.add(s.key);
      let a = this.arrows.get(s.key);
      if (!a) {
        a = this.create();
        this.arrows.set(s.key, a);
        this.layer.appendChild(a.root);
      }
      a.path.setAttribute('fill', s.color);
      a.icon.style.transform = `rotate(${s.angle}rad)`;
      a.root.style.transform = `translate(${Math.round(s.x)}px,${Math.round(s.y)}px) translate(-50%,-50%)`;
      if (a.label.textContent !== s.text) a.label.textContent = s.text;
      a.label.style.display = s.text === '' ? 'none' : 'block';
    }
    for (const [key, a] of this.arrows) {
      if (seen.has(key)) continue;
      a.root.remove();
      this.arrows.delete(key);
    }
  }

  clear(): void {
    this.sync([]);
  }

  private create(): { root: HTMLElement; icon: HTMLElement; path: SVGPathElement; label: HTMLElement } {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:2px;';
    const icon = document.createElement('div');
    icon.style.cssText = 'width:44px;height:44px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6));';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 44 44');
    svg.setAttribute('width', '44');
    svg.setAttribute('height', '44');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M22 3 L38 27 L27 27 L27 41 L17 41 L17 27 L6 27 Z');
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    icon.appendChild(svg);
    const label = document.createElement('div');
    label.style.cssText =
      'padding:1px 8px;border-radius:10px;background:rgba(15,23,42,0.78);color:#fff;font:700 13px system-ui,sans-serif;white-space:nowrap;';
    root.append(icon, label);
    return { root, icon, path, label };
  }
}
