import * as THREE from 'three';
import type { EntityView, HudItem } from '../engine/types';
import { formatHudValue, type FloatingLabel } from './hud';

/** Gap between the top of the entity and the bottom of its label, in world units. */
const LABEL_LIFT = 0.25;
const DEFAULT_COLOR = '#ffffff';
const DEFAULT_BAR_COLOR = '#e11d48';

/**
 * Screen positions for HUD texts anchored to entities. Skips hidden items, entities that are gone or
 * hidden, and anchors behind the camera.
 */
export function floatingLabels(
  items: readonly HudItem[],
  getEntity: (id: string) => EntityView | undefined,
  camera: THREE.Camera,
  width: number,
  height: number,
): FloatingLabel[] {
  const out: FloatingLabel[] = [];
  const p = new THREE.Vector3();
  for (const item of items) {
    const isBar = item.widget?.type === 'bar';
    if (item.hidden || item.anchor === undefined || (item.text === undefined && !isBar)) continue;
    const e = getEntity(item.anchor);
    if (!e || !e.visible) continue;
    p.set(e.position.x, e.position.y + e.size.y / 2 + LABEL_LIFT, e.position.z).project(camera);
    if (p.z < -1 || p.z > 1) continue;
    out.push({
      key: item.key,
      text: item.widget?.type === 'bar' ? `${item.label}: ${formatHudValue(item.value)}` : (item.text ?? ''),
      color: item.color ?? (isBar ? DEFAULT_BAR_COLOR : DEFAULT_COLOR),
      x: ((p.x + 1) / 2) * width,
      y: ((1 - p.y) / 2) * height,
      ...(item.widget?.type === 'bar' ? { bar: item.widget.fraction } : {}),
    });
  }
  return out;
}
