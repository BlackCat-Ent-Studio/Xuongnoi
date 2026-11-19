import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';

/** The tile floats this far above the floor so it never fights with it (or with a painted line) for the same pixels. */
const TILE_LIFT = 0.015;
/** Share of the tile side the inner face takes; the rest is the darker rim. */
const FACE_SHARE = 0.84;
/** Half the height of the strip drawn in the side view, where the floor is seen edge-on. */
const SIDE_HALF_HEIGHT = 0.04;
const TEXTURE_SIZE = 128;

const numberTextures = new Map<string, THREE.Texture | null>();

/** The marker's number as a picture; null where there is no canvas (headless runs), the tile is then plain. */
function numberTexture(text: string): THREE.Texture | null {
  if (numberTextures.has(text)) return numberTextures.get(text) ?? null;
  let texture: THREE.Texture | null = null;
  if (text && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const g = canvas.getContext('2d');
    if (g) {
      const px = TEXTURE_SIZE * (text.length > 1 ? 0.56 : 0.7);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold ${px}px sans-serif`;
      g.lineJoin = 'round';
      g.lineWidth = px * 0.14;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.strokeText(text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 + px * 0.04);
      g.fillStyle = '#1f2937';
      g.fillText(text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 + px * 0.04);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }
  numberTextures.set(text, texture);
  return texture;
}

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

/**
 * A floor marker: a flat square tile in the marker's colour with a darker rim and its number on top, lying on the floor
 * (a short strip along the floor with the number above it in the side view). Drawn only; nothing collides with it.
 */
export class FloorMarkerFigure {
  readonly object = new THREE.Group();
  private readonly rim: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly digits: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private color = '';

  constructor(view: EntityView, private readonly mode: ViewMode) {
    this.rim = new THREE.Mesh(UNIT_PLANE, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.face = new THREE.Mesh(UNIT_PLANE, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.face.scale.set(FACE_SHARE, FACE_SHARE, 1);
    this.face.position.z = 0.002;
    const flat = new THREE.Group();
    flat.add(this.rim, this.face);
    const texture = numberTexture(view.label ?? '');
    if (texture) {
      this.digits = new THREE.Mesh(UNIT_PLANE, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      this.digits.scale.set(FACE_SHARE, FACE_SHARE, 1);
      this.digits.position.z = 0.004;
      flat.add(this.digits);
    }
    // The planes are built upright (facing +z); on the floor they lie down facing up, with the number readable from the front (+z).
    if (mode !== '2d-side') flat.rotation.x = -Math.PI / 2;
    this.object.add(flat);
    this.object.traverse((o) => {
      o.userData.ownerNodeId = view.ownerNodeId;
    });
    this.update(view);
  }

  update(view: EntityView): void {
    const side = this.mode === '2d-side';
    if (side) {
      // Seen edge-on: a strip on the floor as long as the tile, the number standing just above it.
      this.object.position.set(view.position.x, view.position.y + SIDE_HALF_HEIGHT, 0.03);
      this.rim.scale.set(view.size.x, SIDE_HALF_HEIGHT * 2, 1);
      this.face.scale.set(view.size.x * FACE_SHARE, SIDE_HALF_HEIGHT, 1);
      if (this.digits) {
        const s = Math.min(view.size.x, 0.6);
        this.digits.scale.set(s, s, 1);
        this.digits.position.y = SIDE_HALF_HEIGHT + s / 2;
      }
    } else {
      this.object.position.set(view.position.x, view.position.y + TILE_LIFT, view.position.z);
      this.object.scale.set(view.size.x, 1, view.size.z);
    }
    if (view.color !== this.color) {
      this.color = view.color;
      this.face.material.color.set(view.color);
      this.rim.material.color.set(view.color).multiplyScalar(0.55);
    }
  }

  dispose(): void {
    this.rim.material.dispose();
    this.face.material.dispose();
    this.digits?.material.dispose();
  }
}
