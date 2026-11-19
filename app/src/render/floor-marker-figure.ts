import * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';
import { canvasTexture } from './factory-kit';

/** The tile floats this far above the floor so it never fights with it (or with a painted line) for the same pixels. */
const TILE_LIFT = 0.015;
/** Half the height of the strip drawn in the side view, where the floor is seen edge-on. */
const SIDE_HALF_HEIGHT = 0.04;
/** Share of the strip's length and height the coloured band takes in the side view. */
const SIDE_BAND = 0.84;
/** Side of the number, as a share of the tile, and where its middle sits from the tile's middle (toward the front right). */
const NUMBER_SHARE = 0.36;
const NUMBER_AT = 0.27;
const TEXTURE_SIZE = 256;
/** The dark floor tile the marks are painted on, and the light dashes that run to the four neighbours. */
const TILE_DARK = '#2c3038';
const DASH_LIGHT = 'rgba(235,240,246,.55)';
const NUMBER_LIGHT = '#f4f5f7';

/** Dark tile with dashed lines from the four edges toward the middle, leaving room for the ring. */
function tileTexture(): THREE.Texture | null {
  return canvasTexture('floor-marker-tile', TEXTURE_SIZE, TEXTURE_SIZE, (g, W) => {
    g.fillStyle = TILE_DARK;
    g.fillRect(0, 0, W, W);
    g.strokeStyle = DASH_LIGHT;
    g.lineWidth = 5;
    g.setLineDash([16, 14]);
    g.beginPath();
    g.moveTo(0, W / 2);
    g.lineTo(W / 2 - 34, W / 2);
    g.moveTo(W, W / 2);
    g.lineTo(W / 2 + 34, W / 2);
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, W / 2 - 34);
    g.moveTo(W / 2, W);
    g.lineTo(W / 2, W / 2 + 34);
    g.stroke();
  });
}

/** The ring and its centre dot in white; the material tints them with the marker's colour. */
function ringTexture(): THREE.Texture | null {
  return canvasTexture('floor-marker-ring', TEXTURE_SIZE, TEXTURE_SIZE, (g, W) => {
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(W / 2, W / 2, 24, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(W / 2, W / 2, 6, 0, Math.PI * 2);
    g.fill();
  });
}

/** The marker's number as a picture; null where there is no canvas (headless runs) or no number. */
function numberTexture(text: string): THREE.Texture | null {
  if (!text) return null;
  return canvasTexture(`floor-marker-number|${text}`, 128, 128, (g, W) => {
    const px = W * (text.length > 1 ? 0.56 : 0.74);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${px}px "Segoe UI",Arial,sans-serif`;
    g.lineJoin = 'round';
    g.lineWidth = px * 0.16;
    g.strokeStyle = '#15171c';
    g.strokeText(text, W / 2, W / 2 + px * 0.04);
    g.fillStyle = NUMBER_LIGHT;
    g.fillText(text, W / 2, W / 2 + px * 0.04);
  });
}

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

/**
 * A floor marker: a dark floor tile exactly as wide and deep as the marker, with a ring and centre dot in the marker's
 * colour on the grid node, dashed light lines running to the four neighbours and the marker's number in the front-right
 * corner. In the side view, where the floor is seen edge-on, it is a short dark strip with a band in the marker's colour
 * and the number standing above it. Drawn only; nothing collides with it. Three flat meshes.
 */
export class FloorMarkerFigure {
  readonly object = new THREE.Group();
  /** The dark tile (with the dashes painted on it). */
  private readonly rim: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  /** Ring and dot in the marker's colour (the coloured band in the side view). */
  private readonly face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly digits: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private color = '';

  constructor(view: EntityView, private readonly mode: ViewMode) {
    const side = mode === '2d-side';
    const tile = side ? null : tileTexture();
    // With its picture the tile is drawn as painted; without one (side view, headless) it is the plain dark floor colour.
    this.rim = new THREE.Mesh(UNIT_PLANE, new THREE.MeshLambertMaterial({ map: tile, color: tile ? '#ffffff' : TILE_DARK, side: THREE.DoubleSide }));
    this.rim.receiveShadow = true;
    const ring = side ? null : ringTexture();
    this.face = new THREE.Mesh(UNIT_PLANE, new THREE.MeshBasicMaterial({ map: ring, transparent: ring !== null, depthWrite: ring === null, side: THREE.DoubleSide }));
    this.face.position.z = 0.002;
    const flat = new THREE.Group();
    flat.add(this.rim, this.face);
    const texture = numberTexture(view.label ?? '');
    if (texture) {
      this.digits = new THREE.Mesh(UNIT_PLANE, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      this.digits.scale.set(NUMBER_SHARE, NUMBER_SHARE, 1);
      this.digits.position.set(NUMBER_AT, -NUMBER_AT, 0.004);
      flat.add(this.digits);
    }
    // The planes are built upright (facing +z); on the floor they lie down facing up, with the number readable from the front (+z).
    if (!side) flat.rotation.x = -Math.PI / 2;
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
      this.face.scale.set(view.size.x * SIDE_BAND, SIDE_HALF_HEIGHT, 1);
      if (this.digits) {
        const s = Math.min(view.size.x, 0.6);
        this.digits.scale.set(s, s, 1);
        this.digits.position.set(0, SIDE_HALF_HEIGHT + s / 2, 0.004);
      }
    } else {
      this.object.position.set(view.position.x, view.position.y + TILE_LIFT, view.position.z);
      this.object.scale.set(view.size.x, 1, view.size.z);
    }
    if (view.color !== this.color) {
      this.color = view.color;
      this.face.material.color.set(view.color);
    }
  }

  /** The pictures are shared by every marker; only the per-marker materials are freed. */
  dispose(): void {
    this.rim.material.dispose();
    this.face.material.dispose();
    this.digits?.material.dispose();
  }
}
