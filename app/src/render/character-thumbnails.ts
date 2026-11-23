import * as THREE from 'three';
import { Humanoid } from './humanoid-model';

const SIZE = 144;
const CACHE_LIMIT = 120;
const cache = new Map<string, string>();

function key(look: string, color: string): string {
  return `${look}|${color.toLowerCase()}`;
}

function remember(k: string, url: string): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(k, url);
}

/**
 * Small preview image (PNG data URL) of each look in the given main color, rendered once with a throwaway
 * offscreen renderer and cached per look+color. Returns an empty map when WebGL is unavailable, so callers
 * should treat a missing entry as "no picture".
 */
export function lookThumbnails(looks: readonly string[], color: string): Map<string, string> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const look of looks) {
    const hit = cache.get(key(look, color));
    if (hit) out.set(look, hit);
    else missing.push(look);
  }
  if (missing.length === 0) return out;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    // Three-quarter view from the front-right of a figure that faces +X.
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(1.7, 0.55, 3.1);
    camera.lookAt(0, 0.02, 0);

    for (const look of missing) {
      const figure = new Humanoid(color, '2d-side', look);
      figure.update(
        {
          id: 'preview',
          kind: 'character',
          ownerNodeId: '',
          position: { x: 0, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          color,
          look,
          visible: true,
        },
        0,
      );
      scene.add(figure.object);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(figure.object);
      figure.dispose();
      remember(key(look, color), url);
      out.set(look, url);
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
  return out;
}
