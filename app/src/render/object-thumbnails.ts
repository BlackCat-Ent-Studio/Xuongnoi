import * as THREE from 'three';
import type { EntityView, Graph, ViewMode } from '../engine/types';
import { createRuntime } from '../engine/runtime';
import { registerAllNodes } from '../nodes';
import { createWorld } from '../world/world';
import { worldOptionsForGraph } from '../world/graph-world-options';
import { SceneView } from './scene-view';
import type { StageTheme } from './stage-theme';

/** Side of the picture in px (shown at about half that, so it stays sharp on phones). */
const SIZE = 88;
const CACHE_LIMIT = 160;
/** Floors and other very long things are shown by their middle part only. */
const MAX_RADIUS = 2.6;
const cache = new Map<string, string>();

function keyOf(mode: ViewMode, e: EntityView): string {
  const s = e.size;
  return [mode, e.kind, e.look ?? '', e.shape ?? '', e.blockStyle ?? '', e.color.toLowerCase(), e.zone ? 'z' : '', [s.x, s.y, s.z].map((v) => v.toFixed(2)).join('x')].join('|');
}

function remember(k: string, url: string): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(k, url);
}

/**
 * Small picture (PNG data URL) of each graph node that owns a visible object, drawn with the same stage look and
 * the same figure code as the real stage (so a flag is the stage's flag, a robot the stage's robot), seen from the
 * front-right. Rendered once with a throwaway offscreen renderer and cached per look + colour (+ size).
 * Nodes without a visible object, or any failure (no WebGL), simply have no entry.
 */
export function renderObjectThumbnails(graph: Graph, mode: ViewMode, stage: StageTheme, ownerIds: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  let renderer: THREE.WebGLRenderer | null = null;
  let view: SceneView | null = null;
  try {
    registerAllNodes();
    const world = createWorld(mode, stage.worldOptions?.(mode) ?? worldOptionsForGraph(graph));
    createRuntime(graph, world, mode);
    const all = world.entities().filter((e) => e.visible);
    for (const id of ownerIds) {
      const owned = all.filter((e) => e.ownerNodeId === id && !e.zone);
      const main = owned[0];
      if (!main) continue;
      const k = keyOf(mode, main);
      const hit = cache.get(k);
      if (hit) {
        out.set(id, hit);
        continue;
      }
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1);
        renderer.setSize(SIZE, SIZE, false);
        renderer.setClearColor(0x000000, 0);
        view = new SceneView(stage);
        view.setBackdrop(null);
        view.setMode(mode);
      }
      if (!view) continue;
      view.clear();
      view.sync(owned.slice(0, 1), 0);
      view.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(view.scene, false);
      if (box.isEmpty()) continue;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const radius = Math.min(MAX_RADIUS, Math.max(sphere.radius, 0.4));
      const fov = 30;
      const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 400);
      const dist = (radius / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.02;
      // Front-right, a little above: the stage figures face +X and stand in front of the z = 0 plane.
      const dir = new THREE.Vector3(0.55, 0.45, 1).normalize();
      camera.position.copy(sphere.center).addScaledVector(dir, dist);
      camera.lookAt(sphere.center);
      renderer.render(view.scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      remember(k, url);
      out.set(id, url);
    }
  } catch (err) {
    console.error(err);
  } finally {
    view?.dispose();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
  return out;
}
