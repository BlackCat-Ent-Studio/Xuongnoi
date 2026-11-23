import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOCK_STYLES, BLOCK_STYLE_LABELS, TRAFFIC_COLORS, blockStyleOf, type BlockStyle } from '../../src/engine/block-styles';
import { AGV_LOOK, TUG_TEAL } from '../../src/engine/factory-looks';
import type { EntityView } from '../../src/engine/types';
import { buildBlockLook, trafficLampIndex } from '../../src/render/block-looks';
import { AgvFigure } from '../../src/render/factory-agv';
import { CAGE_FRAME, dockDoorOpening, isFactoryBlockStyle, lightSheetBox, rollCageDims, rollCageParts, scanLineY, signalTowerLamp, truckBed, warehouseDoors } from '../../src/render/factory-blocks';
import { bake, drawCost } from '../../src/render/factory-kit';
import { robotBodyColor } from '../../src/render/robot-models';
import { SceneView } from '../../src/render/scene-view';
import { rig } from '../helpers/arm-rig';

const MM = 0.001;
const GREY = '#a3a3a3';
type Size = { x: number; y: number; z: number };

const OLD_STYLES = ['box', 'house', 'shop', 'stall', 'factory', 'tree', 'lamppost', 'trafficlight', 'road', 'sidewalk', 'field', 'rock', 'fence', 'sign', 'conveyor', 'rail', 'belt-frame', 'scan-gate', 'chute', 'arm-base', 'code-display'];
const NEW_STYLES: BlockStyle[] = ['roll-cage', 'signal-tower', 'hole-cover', 'truck-flatbed', 'dock-door', 'dock-door-open', 'scan-gate-sheet', 'warehouse', 'floor-lane', 'floor-frame'];

/** A look built for a block of `size` and scaled as the scene scales it, so every number below is in metres. */
function real(style: BlockStyle, size: Size, color = GREY, label = '') {
  const fig = buildBlockLook(style, color, size, label, 'n');
  fig.object.scale.set(size.x, size.y, size.z);
  fig.object.updateMatrixWorld(true);
  return fig;
}

const boxOf = (o: THREE.Object3D): THREE.Box3 => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};

function meshes(o: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  o.updateMatrixWorld(true);
  o.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) out.push(n as THREE.Mesh);
  });
  return out;
}

/** Every vertex of the figure, in metres, with its colour when the mesh is a baked one. */
function vertices(o: THREE.Object3D): { p: THREE.Vector3; color: string }[] {
  const out: { p: THREE.Vector3; color: string }[] = [];
  for (const m of meshes(o)) {
    const pos = m.geometry.getAttribute('position');
    const col = m.geometry.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      out.push({ p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld), color: col ? `#${new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString()}` : '' });
    }
  }
  return out;
}

/** True when the figure stays in the block's box, give or take `slack`; `above` lets it rise over the top. */
function inside(o: THREE.Object3D, size: Size, slack = MM, above = 0): boolean {
  const b = boxOf(o);
  return b.min.x >= -size.x / 2 - slack && b.max.x <= size.x / 2 + slack && b.min.z >= -size.z / 2 - slack && b.max.z <= size.z / 2 + slack && b.min.y >= -size.y / 2 - slack && b.max.y <= size.y / 2 + above + slack;
}

const glowOf = (o: THREE.Object3D): THREE.Mesh[] => meshes(o).filter((m) => m.visible && m.material instanceof THREE.MeshBasicMaterial);
const hex = (m: THREE.Mesh): string => `#${(m.material as THREE.MeshBasicMaterial).color.getHexString()}`;

describe('the warehouse styles in the list', () => {
  it('come after the styles that were there, which keep their order and their names', () => {
    expect(BLOCK_STYLES.slice(0, OLD_STYLES.length)).toEqual(OLD_STYLES);
    expect(BLOCK_STYLES.slice(OLD_STYLES.length)).toEqual(NEW_STYLES);
    for (const style of NEW_STYLES) {
      expect(BLOCK_STYLE_LABELS[style].length, style).toBeGreaterThan(5);
      expect(blockStyleOf(style)).toBe(style);
      expect(isFactoryBlockStyle(style), style).toBe(true);
    }
  });

  it('a block that sets none of them is still the plain box', () => {
    expect(blockStyleOf(undefined)).toBe('box');
    expect(blockStyleOf('roll-cage-2')).toBe('box');
  });
});

describe('the roll cage', () => {
  const size = { x: 1.06, y: 1.4, z: 1.06 };

  it('a 1.06 x 1.4 x 1.06 block is a cage 1.0 x 1.0 m inside with 1.0 m walls and 0.35 m free under its floor', () => {
    const d = rollCageDims(size);
    expect(d.insideX).toBeCloseTo(1.0, 6);
    expect(d.insideZ).toBeCloseTo(1.0, 6);
    expect(d.wall).toBeCloseTo(1.0, 6);
    expect(d.clearance).toBeCloseTo(0.35, 6);
    expect(CAGE_FRAME).toBe(0.03);
  });

  it('is one mesh under 3000 triangles that stays in its block', () => {
    const fig = real('roll-cage', size);
    const cost = drawCost(fig.object);
    expect(cost.meshes).toBe(1);
    expect(cost.triangles).toBeLessThan(3000);
    expect(inside(fig.object, size)).toBe(true);
    const b = boxOf(fig.object);
    // the castors are round: their lowest drawn point is within 2 mm of the floor
    expect(b.min.y).toBeCloseTo(-size.y / 2, 2);
    expect(b.max.y).toBeCloseTo(size.y / 2, 3);
    expect(b.max.x - b.min.x).toBeCloseTo(size.x, 3);
    expect(b.max.z - b.min.z).toBeCloseTo(size.z, 3);
  });

  it('leaves the room inside empty, keeps posts and wire in the 3 cm frame, and leaves 0.85 m free between the castors', () => {
    const d = rollCageDims(size);
    const geo = bake(rollCageParts(d));
    const pos = geo.getAttribute('position');
    let insideRoom = 0;
    let underFloor = 0;
    let widest = 0;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      if (Math.abs(x) < 0.5 - 1e-6 && Math.abs(z) < 0.5 - 1e-6 && y > d.clearance + 0.05 + 1e-6) insideRoom++;
      // a carrier 0.85 m wide passes under the floor plate along x and along z
      if ((Math.abs(x) < 0.425 - 1e-6 || Math.abs(z) < 0.425 - 1e-6) && y < d.clearance - 1e-6) underFloor++;
      widest = Math.max(widest, Math.abs(x), Math.abs(z));
    }
    expect(insideRoom).toBe(0);
    expect(underFloor).toBe(0);
    expect(widest).toBeLessThanOrEqual(0.5 + CAGE_FRAME + 1e-6);
    geo.dispose();
  });

  it('takes a colour for its wire and shares its geometry between cages of one size', () => {
    const a = real('roll-cage', size);
    const b = real('roll-cage', size);
    expect(meshes(a.object)[0]!.geometry).toBe(meshes(b.object)[0]!.geometry);
    const wire = (fig: ReturnType<typeof real>): boolean => vertices(fig.object).some((v) => v.color === '#ef4444');
    expect(wire(a)).toBe(false);
    a.setColor('#ef4444');
    a.object.updateMatrixWorld(true);
    expect(wire(a)).toBe(true);
  });
});

describe('the signal tower', () => {
  const size = { x: 0.14, y: 0.865, z: 0.14 };
  const litY = (fig: ReturnType<typeof real>): number => boxOf(glowOf(fig.object)[0]!).getCenter(new THREE.Vector3()).y;

  it('"Đặt màu" 1 / 2 / 3 light red, yellow, green, like the traffic light; a block with no colour of its own lights none', () => {
    expect(TRAFFIC_COLORS.map((c) => signalTowerLamp(c))).toEqual([0, 1, 2]);
    for (const c of TRAFFIC_COLORS) expect(signalTowerLamp(c)).toBe(trafficLampIndex(c));
    expect(signalTowerLamp(GREY)).toBe(-1);
    expect(signalTowerLamp('#ffffff')).toBe(-1);
  });

  it('is dark in the default colour: one mesh, nothing glowing', () => {
    const fig = real('signal-tower', size);
    expect(drawCost(fig.object).meshes).toBe(1);
    expect(glowOf(fig.object)).toHaveLength(0);
    expect(inside(fig.object, size)).toBe(true);
    expect(boxOf(fig.object).max.y).toBeCloseTo(size.y / 2, 3);
    expect(boxOf(fig.object).min.y).toBeCloseTo(-size.y / 2, 3);
  });

  it('lights exactly one lens in the colour set: red on top, yellow in the middle, green at the bottom', () => {
    const fig = real('signal-tower', size);
    const heights: number[] = [];
    for (const c of TRAFFIC_COLORS) {
      fig.setColor(c);
      fig.object.updateMatrixWorld(true);
      const lit = glowOf(fig.object);
      expect(lit).toHaveLength(1);
      expect(hex(lit[0]!)).toBe(c);
      expect(drawCost(fig.object).meshes).toBe(2);
      expect(inside(fig.object, size)).toBe(true);
      heights.push(litY(fig));
    }
    expect(heights[0]! - heights[1]!).toBeCloseTo(0.13, 3);
    expect(heights[1]! - heights[2]!).toBeCloseTo(0.13, 3);
    // the lit lens covers the unlit one of its tier: 12 cm tall, 4 mm proud all round
    const lit = boxOf(glowOf(fig.object)[0]!);
    expect(lit.max.y - lit.min.y).toBeCloseTo(0.118, 3);
    fig.setColor(GREY);
    expect(glowOf(fig.object)).toHaveLength(0);
  });

  it('the three unlit lenses are dim green, yellow, red from the bottom up, and a recolour does not rebuild the tower', () => {
    const fig = real('signal-tower', size);
    const post = meshes(fig.object)[0]!.geometry;
    const dim = (c: string): string => `#${new THREE.Color(c).multiplyScalar(0.28).getHexString()}`;
    const mean = (color: string): number => {
      const ys = vertices(fig.object).filter((v) => v.color === color).map((v) => v.p.y);
      return ys.reduce((a, b) => a + b, 0) / ys.length;
    };
    expect(mean(dim(TRAFFIC_COLORS[2]))).toBeLessThan(mean(dim(TRAFFIC_COLORS[1])));
    expect(mean(dim(TRAFFIC_COLORS[1]))).toBeLessThan(mean(dim(TRAFFIC_COLORS[0])));
    fig.setColor(TRAFFIC_COLORS[1]);
    expect(meshes(fig.object)[0]!.geometry).toBe(post);
  });

  it('a taller block only lengthens the pole', () => {
    const tall = { x: 0.14, y: 1.5, z: 0.14 };
    const fig = real('signal-tower', tall, TRAFFIC_COLORS[0]);
    expect(inside(fig.object, tall)).toBe(true);
    const lit = boxOf(glowOf(fig.object)[0]!);
    expect(lit.max.x - lit.min.x).toBeCloseTo(0.094, 3);
    expect(tall.y / 2 - lit.max.y).toBeCloseTo(0.865 / 2 - boxOf(glowOf(real('signal-tower', size, TRAFFIC_COLORS[0]).object)[0]!).max.y, 3);
  });
});

describe('the hole cover', () => {
  const size = { x: 1.0, y: 0.03, z: 1.0 };

  it('is a plate on two rails inside its block: two meshes, its top the block top', () => {
    const fig = real('hole-cover', size);
    expect(drawCost(fig.object).meshes).toBe(2);
    expect(inside(fig.object, size)).toBe(true);
    const plate = meshes(fig.object).find((m) => m.geometry instanceof THREE.BoxGeometry)!;
    const b = boxOf(plate);
    expect(b.max.y).toBeCloseTo(size.y / 2, 6);
    expect(b.max.x - b.min.x).toBeCloseTo(1.0, 6);
    expect(b.max.z - b.min.z).toBeCloseTo(0.92, 6);
    const rails = boxOf(meshes(fig.object).find((m) => m !== plate)!);
    expect(rails.max.z - rails.min.z).toBeCloseTo(1.0, 6);
    expect(rails.max.y).toBeLessThan(b.max.y);
  });

  it('is red (striped where there is a canvas) unless the block has a colour of its own; the rails run along the longer side', () => {
    const plateOf = (fig: ReturnType<typeof real>): THREE.Mesh => meshes(fig.object).find((m) => m.geometry instanceof THREE.BoxGeometry)!;
    expect(`#${(plateOf(real('hole-cover', size)).material as THREE.MeshToonMaterial).color.getHexString()}`).toBe('#d92b2b');
    expect(`#${(plateOf(real('hole-cover', size, '#2f7fe0')).material as THREE.MeshToonMaterial).color.getHexString()}`).toBe('#2f7fe0');
    const long = { x: 0.9, y: 0.03, z: 1.4 };
    const fig = real('hole-cover', long);
    expect(inside(fig.object, long)).toBe(true);
    const b = boxOf(plateOf(fig));
    expect(b.max.z - b.min.z).toBeCloseTo(1.4, 6);
    expect(b.max.x - b.min.x).toBeCloseTo(0.82, 6);
  });
});

describe('the tug colour', () => {
  const robot = (color: string): EntityView =>
    ({
      id: 'r',
      kind: 'robot',
      ownerNodeId: 'body',
      position: { x: 0, y: 0.12, z: 0 },
      size: { x: 0.9, y: 0.24, z: 0.9 },
      color,
      look: AGV_LOOK,
      visible: true,
      robot: { length: 0.9, width: 0.7, speed: 0, heading: 0, turnRate: 0, wheels: [1, -1].flatMap((f) => [1, -1].map((s) => ({ forward: f * 0.261, side: s * 0.385, radius: 0.085, spin: 0 }))) },
    }) as EntityView;
  const drawn = (color: string): AgvFigure => {
    const fig = new AgvFigure();
    fig.update(robot(color));
    return fig;
  };

  it('is a plain colour value: a robot left alone is still the orange one', () => {
    expect(robotBodyColor('#3b82f6')).toBe('#ff9f2e');
    expect(robotBodyColor(TUG_TEAL)).toBe(TUG_TEAL);
    expect(TUG_TEAL).toBe('#12a594');
  });

  it('draws the same AGV, vertex for vertex, with a teal body instead of the orange one', () => {
    const orange = drawn('#3b82f6');
    const teal = drawn(TUG_TEAL);
    expect(drawCost(teal.object)).toEqual(drawCost(orange.object));
    const a = vertices(orange.object);
    const b = vertices(teal.object);
    expect(b.map((v) => v.p.toArray())).toEqual(a.map((v) => v.p.toArray()));
    expect(a.some((v) => v.color === '#ff9f2e')).toBe(true);
    expect(b.some((v) => v.color === '#ff9f2e')).toBe(false);
    expect(b.some((v) => v.color === TUG_TEAL)).toBe(true);
    // only the body changes: every vertex that changed colour was orange (the body or its darker shade) and is now teal
    const hue = (c: string): number => new THREE.Color(c).getHSL({ h: 0, s: 0, l: 0 }).h * 360;
    const changed = a.map((v, i) => [v.color, b[i]!.color] as const).filter(([was, is]) => was !== is);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(a.length);
    for (const [was, is] of changed) {
      expect(Math.abs(hue(was) - hue('#ff9f2e'))).toBeLessThan(6);
      expect(Math.abs(hue(is) - hue(TUG_TEAL))).toBeLessThan(6);
    }
  });
});

describe('the flatbed truck', () => {
  const size = { x: 2.4, y: 0.95, z: 4.35 };

  it('keeps its footprint in the block; only cab, board and rails rise above the bed, which is the block top', () => {
    const fig = real('truck-flatbed', size);
    const cost = drawCost(fig.object);
    expect(cost.meshes).toBe(2);
    expect(cost.triangles).toBeLessThan(1500);
    expect(inside(fig.object, size, MM, 1.56)).toBe(true);
    const b = boxOf(fig.object);
    // the tyres are round: their lowest drawn point is within 1 cm of the road
    expect(b.min.y).toBeLessThan(-size.y / 2 + 0.01);
    expect(b.max.z - b.min.z).toBeCloseTo(size.z, 2);
    expect(b.max.x - b.min.x).toBeCloseTo(size.x, 2);
  });

  it('holds four cages of 1.1 m side by side in two rows, with nothing drawn where they stand', () => {
    const bed = truckBed(size);
    expect(bed.along).toBe('z');
    expect(bed.top).toBeCloseTo(size.y / 2, 6);
    expect(bed.width).toBeGreaterThanOrEqual(2 * 1.1 + 0.05);
    expect(bed.to - bed.from).toBeGreaterThanOrEqual(2 * 1.1 + 0.05);
    const fig = real('truck-flatbed', size);
    const blocking = vertices(fig.object).filter((v) => Math.abs(v.p.x) < bed.width / 2 - MM && v.p.z > bed.from + MM && v.p.y > bed.top + 0.02);
    expect(blocking).toHaveLength(0);
  });

  it('has the cab at the low end of the longer side, low rails along the bed and an open back', () => {
    const fig = real('truck-flatbed', size);
    const bed = truckBed(size);
    const vs = vertices(fig.object);
    const top = (keep: (p: THREE.Vector3) => boolean): number => Math.max(...vs.filter((v) => keep(v.p)).map((v) => v.p.y)) - bed.top;
    expect(top((p) => p.z < bed.from - 0.2)).toBeGreaterThan(1.3);
    expect(top((p) => p.z > bed.from + 0.2 && Math.abs(p.x) > bed.width / 2)).toBeCloseTo(0.6, 2);
    // across the back end nothing stands higher than the yellow line, between the two corner posts
    expect(top((p) => p.z > bed.to - 0.2 && Math.abs(p.x) < bed.width / 2 - 0.05)).toBeLessThan(0.02);
    const turned = { x: 4.35, y: 0.95, z: 2.4 };
    expect(truckBed(turned).along).toBe('x');
    expect(inside(real('truck-flatbed', turned).object, turned, MM, 1.56)).toBe(true);
  });

  it('is blue unless the block has a colour of its own', () => {
    expect(vertices(real('truck-flatbed', size).object).some((v) => v.color === '#2f7fe0')).toBe(true);
    const red = vertices(real('truck-flatbed', size, '#ef4444').object);
    expect(red.some((v) => v.color === '#ef4444')).toBe(true);
    expect(red.some((v) => v.color === '#2f7fe0')).toBe(false);
  });
});

describe('the dock door', () => {
  const size = { x: 3.5, y: 4.32, z: 0.5 };
  /** Height of the shutter's lower edge above the floor. */
  const shutterFoot = (style: BlockStyle): number => Math.min(...vertices(real(style, size).object).filter((v) => v.color === '#39404b').map((v) => v.p.y)) + size.y / 2;

  it('frames an opening 3.0 m wide and 3.6 m high in a 3.5 x 4.32 m block', () => {
    const o = dockDoorOpening(size);
    expect(o.width).toBeCloseTo(3.0, 6);
    expect(o.height).toBeCloseTo(3.6, 6);
  });

  it('closed: the shutter reaches the floor; open: only a short length hangs under the lintel', () => {
    expect(shutterFoot('dock-door')).toBeCloseTo(0, 3);
    expect(shutterFoot('dock-door-open')).toBeCloseTo(3.6 - 0.45, 3);
  });

  it('both states are one mesh inside the block, with the same frame and drum box', () => {
    for (const style of ['dock-door', 'dock-door-open'] as const) {
      const fig = real(style, size);
      expect(drawCost(fig.object).meshes).toBe(1);
      expect(drawCost(fig.object).triangles).toBeLessThan(400);
      expect(inside(fig.object, size)).toBe(true);
      const b = boxOf(fig.object);
      expect(b.max.y).toBeCloseTo(size.y / 2, 3);
      expect(b.min.y).toBeCloseTo(-size.y / 2, 3);
      expect(b.max.x - b.min.x).toBeCloseTo(size.x, 3);
    }
    const frame = (style: BlockStyle): number[][] => vertices(real(style, size).object).filter((v) => v.color === '#ffc21a' && v.p.y > -size.y / 2 + 3.5 || v.color === '#4a515c').map((v) => v.p.toArray());
    expect(frame('dock-door-open')).toEqual(frame('dock-door'));
  });
});

describe('the scan gate with a light sheet', () => {
  const size = { x: 0.14, y: 1.17, z: 0.79 };
  const part = (fig: ReturnType<typeof real>, name: string): THREE.Mesh => meshes(fig.object).find((m) => m.userData.sheetPart === name)!;
  afterEach(() => vi.restoreAllMocks());

  it('the plain scan gate is untouched: its two meshes, the very geometry the sheet gate uses for frame and lamp', () => {
    const plain = real('scan-gate', size);
    const sheet = real('scan-gate-sheet', size);
    expect(drawCost(plain.object).meshes).toBe(2);
    const shared = meshes(sheet.object).filter((m) => meshes(plain.object).some((p) => p.geometry === m.geometry));
    expect(shared).toHaveLength(2);
    expect(meshes(plain.object).some((m) => m.userData.sheetPart)).toBe(false);
  });

  it('adds the bars, the sheet and the scan line (and a glow trail where there is a canvas), all inside the block', () => {
    const fig = real('scan-gate-sheet', size);
    expect(drawCost(fig.object).meshes).toBe(5);
    expect(inside(fig.object, size)).toBe(true);
    const box = lightSheetBox(size);
    expect(box.height).toBeCloseTo(0.5, 6);
    expect(box.width).toBeCloseTo(0.79 - 0.12 - 0.01, 6);
    const sheet = boxOf(part(fig, 'sheet'));
    expect(sheet.max.z - sheet.min.z).toBeCloseTo(box.width, 6);
    expect(sheet.max.x - sheet.min.x).toBeCloseTo(0, 6);
    expect(sheet.min.y).toBeCloseTo(box.bottom, 6);
  });

  it('waits faint and cyan while the block has its default colour, and turns bright with a white line once a colour is set', () => {
    const fig = real('scan-gate-sheet', size);
    const look = (): { sheet: number; line: string; bars: string } => ({
      sheet: (part(fig, 'sheet').material as THREE.MeshBasicMaterial).opacity,
      line: hex(part(fig, 'line')),
      bars: hex(part(fig, 'bars')),
    });
    expect(look()).toEqual({ sheet: 0.1, line: '#4fdcff', bars: '#58bcd6' });
    fig.setColor('#22c55e');
    expect(look()).toEqual({ sheet: 0.3, line: '#ffffff', bars: '#d8f8ff' });
    // the lamp on the beam takes the colour, as on the plain gate
    expect(glowOf(fig.object).map(hex)).toContain('#22c55e');
    fig.setColor(GREY);
    expect(look()).toEqual({ sheet: 0.1, line: '#4fdcff', bars: '#58bcd6' });
    expect(real('scan-gate-sheet', size, '#ef4444').object && (part(real('scan-gate-sheet', size, '#ef4444'), 'sheet').material as THREE.MeshBasicMaterial).opacity).toBe(0.3);
  });

  it('the scan line runs up and down the sheet with the clock: a slow sweep waiting, a fast one after a read', () => {
    const fig = real('scan-gate-sheet', size);
    const view: EntityView = { id: 'g', kind: 'block', ownerNodeId: 'n', position: { x: 0, y: 0, z: 0 }, size, color: GREY, visible: true, blockStyle: 'scan-gate-sheet' };
    const box = lightSheetBox(size);
    const clock = vi.spyOn(performance, 'now');
    const at = (seconds: number): number => {
      clock.mockReturnValue(seconds * 1000);
      fig.update!(view);
      return part(fig, 'line').position.y;
    };
    expect(at(0)).toBeCloseTo(box.bottom + 0.03, 6);
    expect(at(1.6)).toBeCloseTo(box.bottom + box.height - 0.03, 6);
    expect(at(3.2)).toBeCloseTo(box.bottom + 0.03, 6);
    expect(at(0.8)).toBeCloseTo(box.bottom + box.height / 2, 6);
    fig.setColor('#22c55e');
    expect(at(0.35)).toBeCloseTo(box.bottom + box.height - 0.03, 6);
    for (let t = 0; t < 4; t += 0.137) {
      const y = scanLineY(box, t, 0.7);
      expect(y).toBeGreaterThanOrEqual(box.bottom + 0.03 - 1e-9);
      expect(y).toBeLessThanOrEqual(box.bottom + box.height - 0.03 + 1e-9);
    }
  });
});

describe('the floor paint', () => {
  it('a lane is one flat mesh on the block floor: a line along the longer side with an arrow about every 4 m', () => {
    const size = { x: 8.4, y: 0.02, z: 0.4 };
    const fig = real('floor-lane', size);
    expect(drawCost(fig.object)).toEqual({ meshes: 1, triangles: 12 + 2 * 12 });
    expect(inside(fig.object, size)).toBe(true);
    const b = boxOf(fig.object);
    expect(b.min.y).toBeCloseTo(-0.01, 6);
    expect(b.max.y).toBeCloseTo(0.002, 6);
    expect(vertices(fig.object).every((v) => v.color === '#0f8f80')).toBe(true);
  });

  it('the arrows point up the longer side, and down it when "Chữ trên biển" starts with a minus', () => {
    const size = { x: 8.4, y: 0.02, z: 0.4 };
    /** x of the arrow tip nearest the middle: the one vertex of a head that lies on the lane's centre line, off the line's own ends. */
    const tips = (label: string): number[] => [...new Set(vertices(real('floor-lane', size, GREY, label).object).filter((v) => Math.abs(v.p.z) < 1e-6 && Math.abs(Math.abs(v.p.x) - 4.2) > 0.01 && Math.abs(Math.abs(v.p.x) - 2.1) > 0.01).map((v) => Number(v.p.x.toFixed(3))))].sort((a, b) => a - b);
    expect(tips('')).toEqual([-1.9, 2.3]);
    expect(tips('-')).toEqual([-2.3, 1.9]);
    const along = { x: 0.4, y: 0.02, z: 8.4 };
    expect(inside(real('floor-lane', along).object, along)).toBe(true);
  });

  it('a frame is one mesh: a yellow outline along the edges of the footprint, or the block colour', () => {
    const size = { x: 1.2, y: 0.02, z: 1.2 };
    const fig = real('floor-frame', size);
    expect(drawCost(fig.object)).toEqual({ meshes: 1, triangles: 48 });
    expect(inside(fig.object, size)).toBe(true);
    const vs = vertices(fig.object);
    expect(vs.every((v) => v.color === '#ffc21a')).toBe(true);
    expect(vs.every((v) => Math.max(Math.abs(v.p.x), Math.abs(v.p.z)) >= 0.6 - 0.06 - 1e-6)).toBe(true);
    expect(vertices(real('floor-frame', size, '#0f8f80').object).every((v) => v.color === '#0f8f80')).toBe(true);
  });
});

describe('the warehouse scenery', () => {
  const size = { x: 34, y: 11.05, z: 25.8 };

  it('is two meshes (the building and its lamps) under 8000 triangles, all inside the block', () => {
    const fig = real('warehouse', size);
    const cost = drawCost(fig.object);
    expect(cost.meshes).toBe(2);
    expect(cost.triangles).toBeLessThan(8000);
    expect(inside(fig.object, size, 2 * MM)).toBe(true);
    const lamps = glowOf(fig.object);
    expect(lamps).toHaveLength(1);
    // six lamps of twelve sides: a disc each
    expect(lamps[0]!.geometry.getAttribute('position').count).toBe(6 * 12 * 4 * 3);
  });

  it('has a dock wall with three doors along the low-z side and a high wall along the low-x side; the other two sides are open', () => {
    const vs = vertices(real('warehouse', size).object);
    const wall = vs.filter((v) => v.color === '#e3e6ea');
    expect(Math.min(...wall.map((v) => v.p.z))).toBeCloseTo(-size.z / 2, 3);
    expect(Math.min(...wall.map((v) => v.p.x))).toBeCloseTo(-size.x / 2, 3);
    // no wall on the two near sides: wall-coloured vertices keep to the two far strips
    expect(wall.every((v) => v.p.z < -size.z / 2 + 0.31 || v.p.x < -size.x / 2 + 0.31)).toBe(true);
    const doors = warehouseDoors(size);
    expect(doors).toHaveLength(3);
    expect(doors[1]!.position.x - doors[0]!.position.x).toBeCloseTo(4.8, 6);
    for (const d of doors) {
      expect(d.size).toEqual({ x: 3.5, y: 4.32, z: 0.5 });
      expect(d.position.y - d.size.y / 2).toBeCloseTo(-size.y / 2, 6);
      expect(d.position.z - d.size.z / 2).toBeCloseTo(-size.z / 2, 6);
      // the opening is clear of wall, from the floor to the lintel
      const o = dockDoorOpening(d.size);
      expect(wall.some((v) => Math.abs(v.p.x - d.position.x) < o.width / 2 - 0.01 && v.p.y < -size.y / 2 + o.height - 0.01 && v.p.z < -size.z / 2 + 0.31)).toBe(false);
    }
  });

  it('each door is drawn open exactly as an open door block there, so a closed door block in the same place shuts it', () => {
    const hall = vertices(real('warehouse', size).object);
    const d = warehouseDoors(size)[0]!;
    const open = real('dock-door-open', d.size);
    open.object.position.set(d.position.x, d.position.y, d.position.z);
    const key = (v: { p: THREE.Vector3; color: string }): string => `${v.p.x.toFixed(3)},${v.p.y.toFixed(3)},${v.p.z.toFixed(3)},${v.color}`;
    const drawn = new Set(hall.map(key));
    const door = vertices(open.object);
    expect(door.length).toBeGreaterThan(100);
    expect(door.every((v) => drawn.has(key(v)))).toBe(true);
    const shut = real('dock-door', d.size);
    shut.object.position.set(d.position.x, d.position.y, d.position.z);
    expect(inside(shut.object, { x: size.x, y: size.y, z: size.z }, 2 * MM)).toBe(true);
  });

  it('carries roof trusses over every row of columns but the one nearest the open side, with lamps under them', () => {
    const fig = real('warehouse', size);
    const vs = vertices(fig.object);
    // the yellow guards at the feet of the far line of columns: one row each 6.8 m from the dock wall
    const guards = vs.filter((v) => v.color === '#ffc21a' && Math.abs(v.p.x - (size.x / 2 - 2)) < 0.3 && v.p.y > -size.y / 2 + 0.5 && v.p.y < -size.y / 2 + 1.2).map((v) => v.p.z);
    const columnRows = [1, 2, 3, 4].map((k) => -size.z / 2 + 0.15 + 6.8 * k).filter((z) => guards.some((g) => Math.abs(g - z) < 0.3));
    expect(guards.every((g) => columnRows.some((z) => Math.abs(g - z) < 0.3))).toBe(true);
    expect(columnRows.length).toBe(3);
    const eaves = -size.y / 2 + 9;
    const roof = vs.filter((v) => v.color === '#4a515c' && v.p.y > eaves + 0.3);
    expect(roof.length).toBeGreaterThan(0);
    const nearest = columnRows.at(-1)!;
    expect(Math.max(...roof.map((v) => v.p.z))).toBeLessThan(nearest - 6);
    expect(roof.some((v) => Math.abs(v.p.z - columnRows[0]!) < 0.6)).toBe(true);
    expect(roof.some((v) => Math.abs(v.p.z - columnRows[1]!) < 0.6)).toBe(true);
    // the roof ridge is the block top, give or take the purlins
    expect(boxOf(fig.object).max.y).toBeGreaterThan(size.y / 2 - 0.3);
    const lamps = boxOf(glowOf(fig.object)[0]!);
    expect(lamps.max.y).toBeLessThan(eaves - 2);
    expect(lamps.max.z).toBeLessThan(nearest - 6);
  });

  it('has pallet racks along the high wall and paints the dock line and the walkway on its floor', () => {
    const vs = vertices(real('warehouse', size).object);
    const racks = vs.filter((v) => v.color === '#2a5fb0');
    expect(racks.length).toBeGreaterThan(0);
    expect(Math.max(...racks.map((v) => v.p.x))).toBeLessThan(-size.x / 2 + 5);
    const floor = -size.y / 2;
    const paint = vs.filter((v) => v.p.y < floor + 0.02 && v.p.y > floor + 0.001 && ['#ffc21a', '#f1f3f6', '#8fc79a'].includes(v.color));
    expect(new Set(paint.map((v) => v.color)).size).toBe(3);
  });

  it('a small hall is still two meshes at most and never leaves its block', () => {
    for (const s of [{ x: 12, y: 6, z: 9 }, { x: 20, y: 8, z: 16 }, { x: 3, y: 3, z: 3 }]) {
      const fig = real('warehouse', s);
      expect(drawCost(fig.object).meshes, JSON.stringify(s)).toBeLessThanOrEqual(2);
      expect(inside(fig.object, s, 2 * MM), JSON.stringify(s)).toBe(true);
    }
    expect(warehouseDoors({ x: 12, y: 6, z: 9 })).toHaveLength(1);
    expect(warehouseDoors({ x: 3, y: 3, z: 3 })).toHaveLength(0);
  });

  it('takes the block colour for its stripe, and the scene draws it as one figure of one entity', () => {
    expect(vertices(real('warehouse', size, '#ef4444').object).some((v) => v.color === '#ef4444')).toBe(true);
    const scene = new SceneView();
    scene.setMode('3d');
    scene.sync([{ id: 'h', kind: 'block', ownerNodeId: 'hall', position: { x: 0, y: size.y / 2, z: 0 }, size, color: GREY, visible: true, blockStyle: 'warehouse' }]);
    const owned = meshes(scene.scene).filter((m) => m.userData.ownerNodeId === 'hall');
    expect(owned).toHaveLength(2);
    expect(boxOf(owned[0]!).min.y).toBeCloseTo(0, 2);
    scene.dispose();
  });
});

describe('the warehouse looks in a played board', () => {
  const HALL = { x: 34, y: 11.05, z: 25.8 };
  const base: Parameters<typeof rig>[0] = [
    ['floor', 'block', { position: { x: 0, y: -0.25, z: 0 }, size: { x: 30, y: 0.5, z: 30 } }],
    ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 } }],
    ['crate', 'item', { shape: 'crate', position: { x: 2, y: 3, z: 1 } }],
    ['wall', 'block', { position: { x: 5, y: 0.5, z: 0 }, size: { x: 0.2, y: 1, z: 4 } }],
  ];
  const decor: Parameters<typeof rig>[0] = [
    ['hall', 'block', { position: { x: 0, y: HALL.y / 2, z: 0 }, size: HALL, type: 'pickup', style: 'warehouse' }],
    ['lane', 'block', { position: { x: 0, y: 0.01, z: 0 }, size: { x: 8, y: 0.02, z: 0.4 }, type: 'pickup', style: 'floor-lane', signText: '-' }],
    ['frame', 'block', { position: { x: 2, y: 0.01, z: 1 }, size: { x: 1.2, y: 0.02, z: 1.2 }, type: 'pickup', style: 'floor-frame' }],
    ['door', 'block', { position: { x: 2, y: 2.16, z: 0.5 }, size: { x: 3.5, y: 4.32, z: 0.5 }, type: 'pickup', style: 'dock-door-open' }],
    ['tower', 'block', { position: { x: 2, y: 0.4325, z: 1 }, size: { x: 0.14, y: 0.865, z: 0.14 }, type: 'pickup', style: 'signal-tower' }],
  ];

  it('each scenery card is one entity with its style, and nothing else in the world notices: the same board without them plays the same', () => {
    const plain = rig(base, [], '3d');
    const dressed = rig([...base, ...decor], [], '3d');
    plain.tick(90);
    dressed.tick(90);
    const others = (es: readonly EntityView[]): unknown => es.filter((e) => !decor.some(([id]) => id === e.ownerNodeId)).map(({ id: _id, ...rest }) => rest);
    const added = dressed.world.entities().filter((e) => decor.some(([id]) => id === e.ownerNodeId));
    expect(added.map((e) => e.blockStyle).sort()).toEqual(['dock-door-open', 'floor-frame', 'floor-lane', 'signal-tower', 'warehouse']);
    expect(dressed.world.entities()).toHaveLength(plain.world.entities().length + decor.length);
    expect(others(dressed.world.entities())).toEqual(others(plain.world.entities()));
    // the crate fell through the hall, the door and the paint to the floor
    const crate = dressed.world.entities().find((e) => e.ownerNodeId === 'crate')!;
    expect(crate.position.y).toBeLessThan(1);
  });

  it('"Đặt màu" on a tower card lights the lens of that number in the drawn scene', () => {
    const r = rig(
      [
        ['n', 'const', { value: 3 }],
        ['tower', 'block', { position: { x: 0, y: 0.4325, z: 0 }, size: { x: 0.14, y: 0.865, z: 0.14 }, type: 'pickup', style: 'signal-tower' }],
      ],
      [['n', 'value', 'tower', 'pick']],
      '3d',
    );
    const scene = new SceneView();
    scene.setMode('3d');
    scene.sync(r.world.entities());
    expect(glowOf(scene.scene).filter((m) => m.userData.ownerNodeId === 'tower')).toHaveLength(0);
    r.tick(2);
    scene.sync(r.world.entities());
    const lit = glowOf(scene.scene).filter((m) => m.userData.ownerNodeId === 'tower');
    expect(lit).toHaveLength(1);
    expect(hex(lit[0]!)).toBe(TRAFFIC_COLORS[2]);
    // green is the bottom lens: its middle is 0.45 + 0.06 m above the floor
    expect(boxOf(lit[0]!).getCenter(new THREE.Vector3()).y).toBeCloseTo(0.51, 3);
    scene.dispose();
  });
});
