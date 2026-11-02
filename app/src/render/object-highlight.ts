import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/** Warm yellow that reads on the wooden floors and on the mint 3D floor alike; the dark rim keeps it readable on bright ground. */
const FILL_COLOR = 0xffd23f;
const LINE_COLOR = 0xfff7c2;
const RIM_COLOR = 0x3a2410;
/** Outline widths in screen px. */
const LINE_PX = 3.5;
const RIM_PX = 7;
/** The frame stands a little off the object so it never hides inside it. */
const PAD = 0.08;
const MIN_SIDE = 0.25;
/** The pulse breathes this long, then holds steady. */
export const PULSE_SECONDS = 4;
const PULSE_HZ = 1.6;
const SETTLED = 0.55;

interface Marker {
  root: THREE.Group;
  fill: THREE.Mesh;
}

/**
 * Pulsing "this one" frame around objects: a translucent yellow shell with a thick light outline on a dark rim.
 * It is drawn over everything (no depth test) so an object behind a wall or a crate stack is still found.
 * It never takes clicks and never touches the objects themselves.
 */
export class ObjectHighlight {
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(this.unitBox));
  private readonly fillMaterial = new THREE.MeshBasicMaterial({ color: FILL_COLOR, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false });
  private readonly lineMaterial = new LineMaterial({ color: LINE_COLOR, linewidth: LINE_PX, depthTest: false, transparent: true });
  private readonly rimMaterial = new LineMaterial({ color: RIM_COLOR, linewidth: RIM_PX, depthTest: false, transparent: true });
  private readonly pool: Marker[] = [];

  constructor(private readonly parent: THREE.Object3D) {}

  /**
   * Shows one marker per box and hides the rest. `strength` 0..1 is the pulse (1 = brightest); `width`/`height` are the canvas size in px, which the thick lines need.
   */
  sync(boxes: readonly THREE.Box3[], strength: number, width: number, height: number): void {
    this.lineMaterial.resolution.set(width, height);
    this.rimMaterial.resolution.set(width, height);
    this.fillMaterial.opacity = 0.14 + 0.3 * strength;
    const grow = 1 + 0.035 * strength;
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    let used = 0;
    for (const box of boxes) {
      if (box.isEmpty()) continue;
      const m = this.marker(used++);
      box.getSize(size);
      box.getCenter(centre);
      m.root.position.copy(centre);
      m.root.scale.set(Math.max(size.x + PAD * 2, MIN_SIDE) * grow, Math.max(size.y + PAD * 2, MIN_SIDE) * grow, Math.max(size.z + PAD * 2, MIN_SIDE) * grow);
      m.root.visible = true;
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.root.visible = false;
  }

  /** Number of markers currently shown (for tests and checks). */
  get shown(): number {
    return this.pool.filter((m) => m.root.visible).length;
  }

  private marker(i: number): Marker {
    let m = this.pool[i];
    if (!m) {
      const root = new THREE.Group();
      const fill = new THREE.Mesh(this.unitBox, this.fillMaterial);
      const rim = new LineSegments2(this.edges, this.rimMaterial);
      const line = new LineSegments2(this.edges, this.lineMaterial);
      fill.renderOrder = 997;
      rim.renderOrder = 998;
      line.renderOrder = 999;
      for (const part of [fill, rim, line]) part.raycast = () => undefined; // never steals a tap from the object it frames
      root.add(fill, rim, line);
      this.parent.add(root);
      m = { root, fill };
      this.pool.push(m);
    }
    return m;
  }

  dispose(): void {
    for (const m of this.pool) this.parent.remove(m.root);
    this.pool.length = 0;
    this.unitBox.dispose();
    this.edges.dispose();
    this.fillMaterial.dispose();
    this.lineMaterial.dispose();
    this.rimMaterial.dispose();
  }
}

/** Pulse strength 0.3..1 `seconds` after the highlight was set: breathes for a while, then holds at a calmer level. */
export function pulseStrength(seconds: number): number {
  if (seconds >= PULSE_SECONDS) return SETTLED;
  return 0.65 + 0.35 * Math.sin(seconds * Math.PI * 2 * PULSE_HZ - Math.PI / 2);
}
