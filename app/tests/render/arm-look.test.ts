import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { EntityView } from '../../src/engine/types';
import { setArmHint, setArmOverload, armHintOf } from '../../src/engine/render-hints';
import { ArmPartFigure, armPartColor, adjustColor } from '../../src/render/arm-part-models';
import { damagedView } from '../../src/render/damaged-look';
import { massLabel } from '../../src/render/load-tag';
import { RobotFigure, robotBodyColor } from '../../src/render/robot-models';
import { createWorld } from '../../src/world/world';

function view(size: { x: number; y: number; z: number }, color = '#a3a3a3'): EntityView {
  return { id: 'e1', kind: 'block', ownerNodeId: 'n1', position: { x: 0, y: 1, z: 0 }, size, color, visible: true };
}

function triangles(o: THREE.Object3D): number {
  let t = 0;
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh) t += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count) / 3;
  });
  return t;
}

describe('arm look colours', () => {
  it('uses the look colour while the param still holds the old default, the user colour otherwise', () => {
    expect(armPartColor('link', '#a3a3a3')).toBe('#ff9f2e');
    expect(armPartColor('link', '#A3A3A3')).toBe('#ff9f2e');
    expect(armPartColor('link', '#112233')).toBe('#112233');
    expect(armPartColor('joint', '#8b5cf6')).toBe('#4a4f58');
    expect(armPartColor('finger', '#f59e0b')).toBe('#2a2d34');
    expect(armPartColor('housing', '#0ea5e9')).toBe('#ff9f2e');
    expect(robotBodyColor('#3b82f6')).toBe('#ff9f2e');
    expect(robotBodyColor('#00ff00')).toBe('#00ff00');
  });

  it('derives lighter and darker shades of the same hue', () => {
    const light = new THREE.Color(adjustColor('#ff9f2e', 0.2));
    const base = new THREE.Color('#ff9f2e');
    const l = { h: 0, s: 0, l: 0 };
    const b = { h: 0, s: 0, l: 0 };
    light.getHSL(l);
    base.getHSL(b);
    expect(l.l).toBeGreaterThan(b.l);
    expect(Math.abs(l.h - b.h)).toBeLessThan(0.02);
  });
});

describe('arm part figures', () => {
  it('draws any link length and thickness with a few hundred triangles at most', () => {
    for (const [len, t] of [[0.2, 0.1], [1.8, 0.22], [3, 0.5]] as const) {
      const f = new ArmPartFigure('link');
      f.update(view({ x: len, y: t, z: t }), '2d-side', { part: 'link' }, 0);
      expect(triangles(f.object)).toBeGreaterThan(0);
      expect(triangles(f.object)).toBeLessThan(300);
      const box = new THREE.Box3().setFromObject(f.object);
      expect(box.max.x - box.min.x).toBeGreaterThan(len * 0.95);
    }
  });

  it('keeps joint, palm, finger and piston parts cheap and shows the warning only while overloaded', () => {
    const joint = new ArmPartFigure('joint');
    joint.update(view({ x: 0.3, y: 0.3, z: 0.3 }), '3d', { part: 'joint', axis: 'pitch' }, 0);
    const calm = triangles(joint.object);
    expect(calm).toBeLessThan(700);
    joint.update(view({ x: 0.3, y: 0.3, z: 0.3 }), '3d', { part: 'joint', axis: 'pitch', overloaded: true }, 0);
    expect(triangles(joint.object)).toBeGreaterThan(calm);
    joint.update(view({ x: 0.3, y: 0.3, z: 0.3 }), '3d', { part: 'joint', axis: 'pitch', overloaded: false }, 0);
    expect(triangles(joint.object)).toBe(calm);

    const parts: [ArmPartFigure['part'], { x: number; y: number; z: number }][] = [
      ['palm', { x: 0.15, y: 1.24, z: 0.25 }],
      ['finger', { x: 0.3, y: 0.12, z: 0.12 }],
      ['housing', { x: 2.2, y: 0.4, z: 0.4 }],
      ['rod', { x: 2, y: 0.16, z: 0.16 }],
      ['head', { x: 0.6, y: 0.6, z: 0.6 }],
    ];
    for (const [part, size] of parts) {
      const f = new ArmPartFigure(part);
      f.update(view(size), '2d-side', { part, side: 1 }, 0);
      expect(triangles(f.object), part).toBeGreaterThan(0);
      expect(triangles(f.object), part).toBeLessThan(400);
    }
  });

  it('turns like a plain block and shares geometry between instances of the same size', () => {
    const a = new ArmPartFigure('link');
    const b = new ArmPartFigure('link');
    const v = { ...view({ x: 1, y: 0.2, z: 0.2 }), angle: 0.5 };
    a.update(v, '2d-side', { part: 'link' }, 0);
    b.update(v, '2d-side', { part: 'link' }, 0);
    expect(a.object.rotation.z).toBeCloseTo(0.5);
    const ga = (a.object.children[0]!.children[0]!.children[0]!.children[0] as THREE.Mesh).geometry;
    const gb = (b.object.children[0]!.children[0]!.children[0]!.children[0] as THREE.Mesh).geometry;
    expect(ga).toBe(gb);
  });
});

describe('render hints', () => {
  it('are kept per owner and entity and can flag an overload without replacing the hint', () => {
    setArmHint('nodeA', 'e7', { part: 'joint', axis: 'yaw' });
    expect(armHintOf('nodeA', 'e7')?.part).toBe('joint');
    expect(armHintOf('nodeB', 'e7')).toBeUndefined();
    setArmOverload('nodeA', 'e7', true);
    expect(armHintOf('nodeA', 'e7')).toEqual({ part: 'joint', axis: 'yaw', overloaded: true });
    setArmOverload('nodeZ', 'e7', true); // unknown: no-op
  });
});

describe('load tag text', () => {
  it('shows whole numbers plainly and at most one decimal', () => {
    expect(massLabel(2)).toBe('2 kg');
    expect(massLabel(0.5)).toBe('0.5 kg');
    expect(massLabel(12.34)).toBe('12.3 kg');
  });
});

describe('squeeze direction', () => {
  const crate = (): EntityView => ({ ...view({ x: 0.6, y: 0.6, z: 0.6 }), kind: 'item', damaged: true });

  it('flattens a body along the axis the fingers pressed, and in height without one', () => {
    const along = damagedView({ ...crate(), squeezeAxis: 'x' });
    expect(along.size.x).toBeCloseTo(0.36);
    expect(along.size.z).toBeGreaterThan(0.6);
    const sideways = damagedView({ ...crate(), squeezeAxis: 'z' });
    expect(sideways.size.z).toBeCloseTo(0.36);
    const height = damagedView(crate());
    expect(height.size.y).toBeCloseTo(0.36);
    expect(height.size.x).toBeGreaterThan(0.6);
  });

  it('stores the axis on the world entity only when the squeeze was sideways, and only once it breaks', () => {
    const w = createWorld('3d');
    const mk = () => w.spawn({ kind: 'item', ownerNodeId: 'o', position: { x: 0, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: false, crushLimit: 50 });
    const side = mk();
    expect(w.applySqueeze(side, 10, { x: 0, y: 0, z: 1 })).toBe(false);
    expect(w.getEntity(side)?.squeezeAxis).toBeUndefined();
    expect(w.applySqueeze(side, 99, { x: 0.2, y: 0, z: -1 })).toBe(true);
    expect(w.getEntity(side)?.squeezeAxis).toBe('z');
    const vertical = mk();
    expect(w.applySqueeze(vertical, 99, { x: 0.1, y: 1, z: 0 })).toBe(true);
    expect(w.getEntity(vertical)?.squeezeAxis).toBeUndefined();
    const plain = mk();
    expect(w.applySqueeze(plain, 99)).toBe(true);
    expect(w.getEntity(plain)?.squeezeAxis).toBeUndefined();
    expect(w.getEntity(plain)?.damaged).toBe(true);
  });
});

describe('robot chassis look', () => {
  it('builds body and one wheel per mount from shared geometry', () => {
    const f = new RobotFigure('#3b82f6');
    const v: EntityView = {
      ...view({ x: 1, y: 0.3, z: 0.7 }),
      kind: 'robot',
      robot: { length: 1, width: 0.7, speed: 0, heading: 0, turnRate: 0, wheels: [{ side: -0.4, forward: 0, radius: 0.15, spin: 0 }, { side: 0.4, forward: 0, radius: 0.15, spin: 0 }] },
    };
    f.update(v);
    expect(triangles(f.object)).toBeLessThan(1000);
    const tires = f.object.children[1]!.children.length;
    expect(tires).toBe(2);
  });
});
