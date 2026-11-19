import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { AGV_LOOK, ARM_LOOKS, CLASSIC_LOOK, FACTORY_ARM_LOOK, HINGE_LOOK, JOINT_LOOKS, PARCEL_LOOKS, ROBOT_LOOKS, lookSpec } from '../../src/engine/factory-looks';
import { getNodeDef } from '../../src/engine/registry';
import { TICK_DT, type EntityView, type ViewMode } from '../../src/engine/types';
import { createRuntime } from '../../src/engine/runtime';
import { createWorld } from '../../src/world/world';
import { ArmPartFigure } from '../../src/render/arm-part-models';
import { buildBlockLook } from '../../src/render/block-looks';
import { AGV_STRIP, AgvFigure } from '../../src/render/factory-agv';
import { FactoryArmFigure, TRAY_RIM, TRAY_STAND, hasFactoryArmFigure } from '../../src/render/factory-arm';
import { drawCost } from '../../src/render/factory-kit';
import { buildParcel, fillPlacement, isParcelLook, parcelModelOf } from '../../src/render/factory-parcels';
import { setPackTemplateForTests } from '../../src/render/pack-models';
import { RobotFigure } from '../../src/render/robot-models';
import { SceneView } from '../../src/render/scene-view';
import { createFactoryShowcase } from '../showcase/factory-showcase-board';
import { rig } from '../helpers/arm-rig';

const MM = 0.001;
type Size = { x: number; y: number; z: number };

function block(size: Size, extra: Partial<EntityView> = {}): EntityView {
  return { id: 'e', kind: 'block', ownerNodeId: 'n', position: { x: 0, y: 0, z: 0 }, size, color: '#a3a3a3', visible: true, ...extra };
}

function boxOf(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

/** Bounds of the meshes whose material passes `keep` (e.g. only the tilting part of a tray). */
function boxWhere(o: THREE.Object3D, keep: (m: THREE.Mesh) => boolean): THREE.Box3 {
  o.updateMatrixWorld(true);
  const out = new THREE.Box3();
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.isMesh && keep(m)) out.union(new THREE.Box3().setFromObject(m));
  });
  return out;
}

function robot(over: Partial<NonNullable<EntityView['robot']>> = {}, height = 0.24, color = '#3b82f6'): EntityView {
  const length = over.length ?? 0.9;
  const width = over.width ?? 0.7;
  return {
    id: 'r',
    kind: 'robot',
    ownerNodeId: 'body',
    position: { x: 0, y: height / 2, z: 0 },
    size: { x: Math.max(length, width), y: height, z: Math.max(length, width) },
    color,
    look: AGV_LOOK,
    visible: true,
    robot: {
      length,
      width,
      speed: 0,
      heading: 0,
      turnRate: 0,
      wheels: [1, -1].flatMap((f) => [1, -1].map((s) => ({ forward: f * length * 0.29, side: s * (width / 2 + 0.035), radius: 0.085, spin: 0 }))),
      ...over,
    },
  };
}

describe('look options', () => {
  it('every piece starts on its classic look, and the classic look writes nothing on the entity', () => {
    for (const [kind, options] of [['robot-body', ROBOT_LOOKS], ['link', ARM_LOOKS], ['joint', JOINT_LOOKS], ['gripper', ARM_LOOKS], ['item', PARCEL_LOOKS], ['spawner', PARCEL_LOOKS]] as const) {
      const p = getNodeDef(kind)!.params.find((x) => x.id === 'look')!;
      expect(p.default, kind).toBe(CLASSIC_LOOK);
      expect(p.options?.map((o) => o.value), kind).toEqual(options.map((o) => o.value));
      expect(lookSpec(p.default, options)).toEqual({});
    }
    expect(lookSpec(undefined, ROBOT_LOOKS)).toEqual({});
    expect(lookSpec('nonsense', ROBOT_LOOKS)).toEqual({});
    expect(lookSpec(AGV_LOOK, ROBOT_LOOKS)).toEqual({ look: AGV_LOOK });
  });

  it('a board that never mentions a look spawns entities without one; a chosen look reaches the entity and changes nothing else', () => {
    const nodes = (look: boolean): Parameters<typeof rig>[0] => [
      ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, ...(look ? { look: AGV_LOOK } : {}) }],
      ['j', 'joint', { solid: 'no', ...(look ? { look: HINGE_LOOK } : {}) }],
      ['l', 'link', { width: 0.6, thickness: 0.05, solid: 'no', ...(look ? { look: FACTORY_ARM_LOOK } : {}) }],
      ['g', 'gripper', look ? { look: FACTORY_ARM_LOOK } : {}],
      ['it', 'item', { shape: 'crate', ...(look ? { look: 'parcel-carton' } : {}) }],
    ];
    const wires: Parameters<typeof rig>[1] = [['body', 'self', 'j', 'base'], ['j', 'tip', 'l', 'base'], ['l', 'tip', 'g', 'base']];
    const plain = rig(nodes(false), wires, '3d');
    const dressed = rig(nodes(true), wires, '3d');
    plain.tick(5);
    dressed.tick(5);
    expect(plain.world.entities().every((e) => e.look === undefined)).toBe(true);
    expect(dressed.world.entities().filter((e) => e.look !== undefined).map((e) => e.look).sort()).toEqual([AGV_LOOK, FACTORY_ARM_LOOK, FACTORY_ARM_LOOK, FACTORY_ARM_LOOK, FACTORY_ARM_LOOK, HINGE_LOOK, 'parcel-carton'].sort());
    const bare = (es: readonly EntityView[]): unknown => es.map(({ look: _look, ...rest }) => rest);
    expect(bare(dressed.world.entities())).toEqual(bare(plain.world.entities()));
  });
});

describe('the scene picks a figure by the look', () => {
  const kinds = (scene: SceneView): string[] => {
    const out: string[] = [];
    scene.scene.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) out.push(g.uuid);
    });
    return out.sort();
  };

  it('an entity without a look is drawn exactly as before: same meshes as the classic figures built directly', () => {
    const plain = { ...robot(), look: undefined };
    const scene = new SceneView();
    scene.setMode('3d');
    scene.sync([plain]);
    const direct = new RobotFigure(plain.color);
    direct.update(plain);
    const direct3: string[] = [];
    direct.object.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) direct3.push(g.uuid);
    });
    expect(kinds(scene)).toEqual(direct3.sort());
    scene.sync([robot()]);
    expect(kinds(scene)).not.toEqual(direct3.sort());
    scene.dispose();
  });

  it('only the parts the factory arm look knows are switched; a piston part keeps its classic figure', () => {
    expect(hasFactoryArmFigure('link', FACTORY_ARM_LOOK)).toBe(true);
    expect(hasFactoryArmFigure('finger', FACTORY_ARM_LOOK)).toBe(true);
    expect(hasFactoryArmFigure('housing', FACTORY_ARM_LOOK)).toBe(false);
    expect(hasFactoryArmFigure('link', HINGE_LOOK)).toBe(false);
    expect(hasFactoryArmFigure('joint', HINGE_LOOK)).toBe(true);
    expect(hasFactoryArmFigure('link', undefined)).toBe(false);
    expect(hasFactoryArmFigure('link', 'portal')).toBe(false);
  });
});

describe('the drawn AGV', () => {
  it('the body is the chassis box (length x width x height) to within 7 mm; only wheels and fenders stand outside it', () => {
    for (const [L, W, H] of [[0.9, 0.7, 0.24], [1, 0.7, 0.3], [2.4, 1.2, 0.5], [0.3, 0.3, 0.1]] as const) {
      const fig = new AgvFigure();
      const view = robot({ length: L, width: W, wheels: [] }, H);
      fig.update(view);
      const b = boxOf(fig.object);
      // the light strip stands 6 mm proud all round, the eye lights 14 mm on the nose
      expect(b.max.x - b.min.x, `${L}`).toBeGreaterThan(L);
      expect(b.max.x - b.min.x, `${L}`).toBeLessThan(L + 0.03);
      expect(Math.abs(b.max.z - b.min.z - W), `${W}`).toBeLessThan(0.013);
      // the deck's top is the chassis top; the underside clears the floor
      expect(Math.abs(b.max.y - H), `${H}`).toBeLessThan(MM);
      expect(b.min.y).toBeGreaterThan(0.015);
    }
  });

  it('draws one wheel per motor mount, on the floor, turned by the motor', () => {
    const fig = new AgvFigure();
    const view = robot();
    fig.update(view);
    const b = boxOf(fig.object);
    expect(b.min.y).toBeCloseTo(0, 3);
    // wheels stand outside the body: mount + half the hub
    expect(b.max.z).toBeCloseTo(0.35 + 0.035 + 0.042, 2);
    const spun = { ...view, robot: { ...view.robot!, wheels: view.robot!.wheels.map((w) => ({ ...w, spin: 1.2 })) } };
    fig.update(spun);
    const wheels: THREE.Object3D[] = [];
    fig.object.traverse((o) => {
      if (Math.abs(o.rotation.z + 1.2) < 1e-9) wheels.push(o);
    });
    expect(wheels.length).toBe(4);
  });

  it('costs 7 draw calls and under 3000 triangles, and eight of them share every geometry', () => {
    const a = new AgvFigure();
    const b = new AgvFigure();
    a.update(robot());
    b.update({ ...robot(), id: 'r2' });
    const cost = drawCost(a.object);
    expect(cost.meshes).toBe(7);
    expect(cost.triangles).toBeLessThan(3000);
    const geos = (o: THREE.Object3D): Set<string> => {
      const s = new Set<string>();
      o.traverse((n) => {
        const g = (n as THREE.Mesh).geometry;
        if (g) s.add(g.uuid);
      });
      return s;
    };
    expect([...geos(a.object)].sort()).toEqual([...geos(b.object)].sort());
    // four wheels, one geometry
    expect(geos(a.object).size).toBe(4);
  });

  it('the strip is blue on an empty chassis and green while it carries a load', () => {
    const fig = new AgvFigure();
    const strip = (): string => {
      let hex = '';
      fig.object.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m instanceof THREE.MeshBasicMaterial && !m.vertexColors) hex = `#${m.color.getHexString()}`;
      });
      return hex;
    };
    fig.update(robot());
    expect(strip()).toBe(AGV_STRIP.idle);
    fig.update(robot({ payload: 2 }));
    expect(strip()).toBe(AGV_STRIP.loaded);
  });

  it('keeps the old default colour as the look orange and any other colour as the user chose it', () => {
    const colours = (c: string): Set<string> => {
      const fig = new AgvFigure();
      fig.update(robot({ wheels: [] }, 0.24, c));
      const out = new Set<string>();
      fig.object.traverse((o) => {
        const col = (o as THREE.Mesh).geometry?.getAttribute('color');
        if (col) for (let i = 0; i < col.count; i += 3) out.add(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
      });
      return out;
    };
    expect(colours('#3b82f6').has('ff9f2e')).toBe(true);
    expect(colours('#2f7fe0').has('2f7fe0')).toBe(true);
    expect(colours('#2f7fe0').has('ff9f2e')).toBe(false);
  });
});

describe('the drawn factory arm', () => {
  const figure = (part: 'link' | 'joint' | 'palm' | 'finger', view: EntityView, mode: ViewMode = '3d', look = FACTORY_ARM_LOOK, hint = {}): FactoryArmFigure => {
    const fig = new FactoryArmFigure(part, look);
    fig.update(view, mode, { part, ...hint }, 0);
    return fig;
  };

  it('a tray (a link with a width) is drawn at its real length and width to 1 mm; its mat top is the real top and the rim stands 3 cm above it', () => {
    for (const size of [{ x: 0.74, y: 0.05, z: 0.62 }, { x: 0.6, y: 0.05, z: 0.6 }, { x: 1.4, y: 0.1, z: 2 }]) {
      const fig = figure('link', block(size));
      // The first mesh is the tilting plate with its mat and rim; the stand, hinge and rod under it belong to the chassis.
      const top = new THREE.Box3().setFromObject(fig.object.children[0]!.children[0]!);
      expect(top.max.x - top.min.x).toBeCloseTo(size.x, 3);
      expect(top.max.z - top.min.z).toBeCloseTo(size.z, 3);
      expect(top.min.y).toBeCloseTo(-size.y / 2, 3);
      expect(top.max.y).toBeCloseTo(size.y / 2 + TRAY_RIM, 3);
      const whole = boxOf(fig.object);
      expect(whole.min.y).toBeCloseTo(-size.y / 2 - TRAY_STAND - 0.006, 3);
      expect(whole.max.x - whole.min.x).toBeCloseTo(size.x, 3);
    }
  });

  it("the mat is the plate's real top face: flat at +thickness/2, never above it", () => {
    const size = { x: 0.74, y: 0.05, z: 0.62 };
    const fig = figure('link', block(size));
    const geo = (fig.object.children[0]!.children[0] as THREE.Mesh).geometry;
    const pos = geo.getAttribute('position');
    const col = geo.getAttribute('color');
    const mat = new THREE.Color('#3a3f47');
    let top = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(col.getX(i) - mat.r) < 1e-4 && Math.abs(col.getY(i) - mat.g) < 1e-4 && Math.abs(col.getZ(i) - mat.b) < 1e-4) top = Math.max(top, pos.getY(i));
    }
    expect(top).toBeCloseTo(size.y / 2, 6);
  });

  it('the tray follows the joint angle; its stand stays level and the lifting rod reaches from the stand to the plate', () => {
    const size = { x: 0.74, y: 0.05, z: 0.62 };
    const fig = new FactoryArmFigure('link', FACTORY_ARM_LOOK);
    const rodLength = (tilt: number): number => {
      fig.update(block(size, { tilt }), '3d', { part: 'link' }, 0);
      let rod: THREE.Mesh | null = null;
      fig.object.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.scale.y !== 1) rod = o as THREE.Mesh;
      });
      const base = fig.object.children[0]!.children[1]!;
      // the base group undoes the tilt exactly
      expect(base.rotation.z).toBeCloseTo(-tilt, 9);
      expect(fig.object.rotation.z).toBeCloseTo(tilt, 9);
      return rod!.scale.y;
    };
    expect(rodLength(0)).toBeCloseTo(TRAY_STAND, 6);
    const lifted = rodLength(0.5);
    // the point 3/4 along the underside rose by about 0.75 L sin(0.5)
    expect(lifted).toBeGreaterThan(0.74 * 0.75 * Math.sin(0.5));
    expect(lifted).toBeLessThan(0.74 * 0.75 * Math.sin(0.5) + TRAY_STAND + 0.05);
  });

  it('a bar link runs pivot to pivot with round ends inside the joints: at most 0.625 x thickness longer at each end, 1.25 x thickness high, 80 % deep plus the stripe', () => {
    for (const [L, t] of [[0.8, 0.13], [0.2, 0.1], [3, 0.5]] as const) {
      const fig = figure('link', block({ x: L, y: t, z: t }));
      const b = boxOf(fig.object);
      expect(b.min.x).toBeCloseTo(-L / 2 - t * 0.625, 3);
      expect(b.max.x).toBeCloseTo(L / 2 + t * 0.425, 3);
      expect(b.max.y - b.min.y).toBeCloseTo(t * 1.25, 3);
      expect(b.max.z - b.min.z).toBeCloseTo(t * 0.8 + 0.012, 3);
      expect(drawCost(fig.object).meshes).toBe(1);
    }
  });

  it('a joint collar has the same radius as the classic one and is slimmer along its axis', () => {
    const size = { x: 0.3, y: 0.3, z: 0.3 };
    const fig = figure('joint', block(size, { color: '#8b5cf6' }), '3d', FACTORY_ARM_LOOK, { axis: 'pitch' });
    const classic = new ArmPartFigure('joint');
    classic.update(block(size, { color: '#8b5cf6' }), '3d', { part: 'joint', axis: 'pitch' }, 0);
    const a = boxOf(fig.object);
    const c = boxOf(classic.object);
    // 20-sided cylinders: the two looks may be turned differently, so the radius is compared to 2 %
    expect((a.max.y - a.min.y) / (c.max.y - c.min.y)).toBeCloseTo(1, 1);
    expect(a.max.y - a.min.y).toBeCloseTo(2 * 0.3 * 0.56, 2);
    expect(a.max.z - a.min.z).toBeLessThan(c.max.z - c.min.z);
    expect(a.max.z - a.min.z).toBeGreaterThan(size.z);
    expect(drawCost(fig.object).meshes).toBe(1);
    expect(drawCost(classic.object).meshes).toBe(17);
    // a yaw joint stands upright
    const yaw = figure('joint', block(size), '3d', FACTORY_ARM_LOOK, { axis: 'yaw' });
    const y = boxOf(yaw.object);
    expect(y.max.y - y.min.y).toBeCloseTo(a.max.z - a.min.z, 3);
  });

  it('the hinge look is a slim pin inside the hub box, and the overload cue still shows on it', () => {
    const size = { x: 0.3, y: 0.3, z: 0.3 };
    const fig = figure('joint', block(size), '3d', HINGE_LOOK, { axis: 'pitch' });
    const b = boxOf(fig.object);
    expect(b.max.z - b.min.z).toBeLessThanOrEqual(size.z);
    expect(b.max.y - b.min.y).toBeLessThan(0.07);
    const before = drawCost(fig.object).meshes;
    fig.update(block(size), '3d', { part: 'joint', axis: 'pitch', overloaded: true }, 0);
    expect(drawCost(fig.object).meshes).toBe(before + 2);
  });

  it('palm and fingers are drawn at their real boxes: the finger exactly, its pad 5 mm proud on the inner face only', () => {
    const f = { x: 0.3, y: 0.12, z: 0.12 };
    for (const side of [1, -1] as const) {
      const fig = figure('finger', block(f), '3d', FACTORY_ARM_LOOK, { side });
      const b = boxOf(fig.object);
      expect(b.max.x - b.min.x).toBeCloseTo(f.x, 3);
      expect(b.max.y - b.min.y).toBeCloseTo(f.y, 3);
      // the pad looks at the middle of the gripper: toward -z for the finger on the +z side
      expect(side > 0 ? b.max.z : -b.min.z).toBeCloseTo(f.z / 2, 3);
      expect(side > 0 ? -b.min.z : b.max.z).toBeCloseTo(f.z / 2 + 0.005, 3);
    }
    // side view: the fingers close along y, so the pad is on that face
    const flat = boxOf(figure('finger', block(f), '2d-side', FACTORY_ARM_LOOK, { side: 1 }).object);
    expect(-flat.min.y).toBeCloseTo(f.y / 2 + 0.005, 3);
    expect(flat.max.z - flat.min.z).toBeCloseTo(f.z, 3);

    const p = { x: 0.15, y: 0.25, z: 0.51 };
    const palm = boxOf(figure('palm', block(p)).object);
    expect(palm.max.z - palm.min.z).toBeCloseTo(p.z, 3);
    expect(palm.max.x).toBeCloseTo(p.x / 2, 3);
    // the wrist collar reaches 5 cm back over the link's end; the yellow strip stands 6 mm above the top
    expect(palm.min.x).toBeCloseTo(-p.x / 2 - 0.05, 3);
    expect(palm.max.y).toBeCloseTo(p.y / 2 + 0.006, 3);
  });

  it('the fingers of a real gripper open and close in the drawn scene', () => {
    const spread = (closed: boolean): number => {
      const r = rig(
        [
          ['mount', 'block', { position: { x: 0, y: 2, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 } }],
          ['go', 'on-start', {}],
          ['g', 'gripper', { width: 0.3, look: FACTORY_ARM_LOOK }],
        ],
        [['mount', 'self', 'g', 'base'], ...(closed ? ([['go', 'started', 'g', 'close']] as [string, string, string, string][]) : [])],
        '3d',
      );
      r.tick(90);
      const scene = new SceneView();
      scene.setMode('3d');
      scene.sync(r.world.entities());
      const fingers = r.world.entities().filter((e) => e.look === FACTORY_ARM_LOOK && e.size.x === 0.3);
      expect(fingers.length).toBe(2);
      const gap = Math.abs(fingers[0]!.position.z - fingers[1]!.position.z);
      // the drawn figures stand where the entities are
      const drawn: number[] = [];
      scene.scene.traverse((o) => {
        if (o.parent?.parent === scene.scene && o.userData.ownerNodeId === 'g' && o.children.length === 1) drawn.push(o.position.z);
      });
      for (const f of fingers) expect(drawn.some((z) => Math.abs(z - f.position.z) < 1e-9)).toBe(true);
      scene.dispose();
      return gap;
    };
    const open = spread(false);
    const shut = spread(true);
    expect(open).toBeCloseTo(0.3 + 0.12, 2);
    expect(shut).toBeLessThan(0.2);
  });
});

describe('the drawn parcels', () => {
  afterEach(() => setPackTemplateForTests(null));

  const laid = (look: string, size: Size, color = '#ef4444'): { fig: ReturnType<typeof buildParcel>; box: THREE.Box3 } => {
    const fig = buildParcel(look, color, 'seed');
    fig.update!({ size });
    // what the scene does: stretch the figure to the item's size
    fig.object.scale.set(size.x, size.y, size.z);
    return { fig, box: boxOf(fig.object) };
  };

  it('knows its looks', () => {
    for (const o of PARCEL_LOOKS) expect(isParcelLook(o.value), o.value).toBe(o.value !== CLASSIC_LOOK);
    expect(isParcelLook(undefined)).toBe(false);
    expect(isParcelLook('robot')).toBe(false);
    expect(parcelModelOf('parcel-carton', 's')).toBeNull();
    expect(parcelModelOf('parcel-3', 's')).toContain('Parcel_3');
    expect(parcelModelOf('parcel-box', 's')).toContain('Box_1');
    const mix = new Set(Array.from({ length: 60 }, (_, i) => parcelModelOf('parcel-mix', `spawner|${i}`)));
    expect(mix.size).toBe(6);
    expect([...mix].every((m) => m !== null && !m.includes('Package'))).toBe(true);
    expect(parcelModelOf('parcel-mix', 'a')).toBe(parcelModelOf('parcel-mix', 'a'));
  });

  it('a carton is its real box to 2 mm (the tape band stands 2 mm proud), one draw call, with the tape in the item colour', () => {
    for (const size of [{ x: 0.3, y: 0.22, z: 0.26 }, { x: 0.7, y: 0.7, z: 0.7 }, { x: 0.24, y: 0.18, z: 0.22 }]) {
      const { fig, box } = laid('parcel-carton', size, '#22c55e');
      expect(box.max.x - box.min.x).toBeCloseTo(size.x + 0.004, 3);
      expect(box.max.y - box.min.y).toBeCloseTo(size.y + 0.004, 3);
      expect(box.max.z - box.min.z).toBeCloseTo(size.z, 3);
      expect(drawCost(fig.object)).toEqual({ meshes: 1, triangles: expect.any(Number) });
      expect(drawCost(fig.object).triangles).toBeLessThanOrEqual(120);
      const col = (fig.object.children[0]!.children[0] as THREE.Mesh).geometry.getAttribute('color');
      const seen = new Set<string>();
      for (let i = 0; i < col.count; i++) seen.add(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
      expect(seen).toEqual(new Set(['cf9f62', '22c55e']));
    }
  });

  it('thirty cartons of one size and colour share one geometry; a new colour only swaps it', () => {
    const size = { x: 0.3, y: 0.22, z: 0.26 };
    const geo = (f: ReturnType<typeof buildParcel>): THREE.BufferGeometry => (f.object.children[0]!.children[0] as THREE.Mesh).geometry;
    const a = laid('parcel-carton', size).fig;
    const b = laid('parcel-carton', size).fig;
    expect(geo(a)).toBe(geo(b));
    b.setColor('#3b82f6');
    expect(geo(b)).not.toBe(geo(a));
    b.setColor('#ef4444');
    expect(geo(b)).toBe(geo(a));
  });

  it('a pack model is stretched to fill the real box exactly, its long side along the box, with a sticker in the item colour', () => {
    // a model 2 x 1 x 0.5, off centre, standing on y = 0.3
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5), new THREE.MeshLambertMaterial());
    mesh.position.set(5, 0.8, -3);
    model.add(mesh);
    setPackTemplateForTests(parcelModelOf('parcel-2', 's')!, model);
    for (const size of [{ x: 0.4, y: 0.3, z: 0.2 }, { x: 0.2, y: 0.3, z: 0.6 }]) {
      const { fig } = laid('parcel-2', size, '#3b82f6');
      const body = boxWhere(fig.object, (m) => m.material instanceof THREE.MeshLambertMaterial);
      expect(body.min.x).toBeCloseTo(-size.x / 2, 6);
      expect(body.max.x).toBeCloseTo(size.x / 2, 6);
      expect(body.min.y).toBeCloseTo(-size.y / 2, 6);
      expect(body.max.y).toBeCloseTo(size.y / 2, 6);
      expect(body.min.z).toBeCloseTo(-size.z / 2, 6);
      expect(body.max.z).toBeCloseTo(size.z / 2, 6);
      // the stickers stand 7 mm off the top and the two ends
      const all = boxOf(fig.object);
      expect(all.max.y).toBeCloseTo(size.y / 2 + 0.007, 3);
      expect(all.max.x).toBeCloseTo(size.x / 2 + 0.007, 3);
      expect(all.max.z).toBeCloseTo(size.z / 2, 3);
      expect(drawCost(fig.object).meshes).toBe(2);
    }
    // the quarter turn is taken when the long sides differ
    expect(fillPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } }, { x: 1, y: 1, z: 3 }).rotationY).toBeCloseTo(Math.PI / 2, 9);
    expect(fillPlacement({ min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } }, { x: 3, y: 1, z: 1 }).rotationY).toBe(0);
  });

  it('shows the carton until the model has loaded, then the model', () => {
    const size = { x: 0.4, y: 0.4, z: 0.4 };
    const { fig } = laid('parcel-5', size);
    expect(drawCost(fig.object).meshes).toBe(1);
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial()));
    setPackTemplateForTests(parcelModelOf('parcel-5', 's')!, model);
    expect(drawCost(fig.object).meshes).toBe(2);
    fig.dispose();
  });

  it('the scene draws an item with a parcel look as a parcel, and an item without one as before', () => {
    const item = (look?: string): EntityView => ({ id: 'i', kind: 'item', ownerNodeId: 'n', position: { x: 0, y: 0.2, z: 0 }, size: { x: 0.3, y: 0.4, z: 0.5 }, color: '#ef4444', shape: 'box', visible: true, ...(look ? { look } : {}) });
    const scene = new SceneView();
    scene.setMode('3d');
    scene.sync([item('parcel-carton')]);
    const b = boxWhere(scene.scene, (m) => m.geometry.getAttribute('color') !== undefined);
    expect(b.max.z - b.min.z).toBeCloseTo(0.5, 3);
    expect(b.max.y - b.min.y).toBeCloseTo(0.404, 3);
    expect(b.max.x - b.min.x).toBeCloseTo(0.304, 3);
    // switching the look off rebuilds the plain item
    scene.sync([item()]);
    expect(boxWhere(scene.scene, (m) => m.geometry.getAttribute('color') !== undefined).isEmpty()).toBe(true);
    scene.dispose();
  });
});

describe('the drawn factory blocks', () => {
  const real = (style: 'belt-frame' | 'scan-gate' | 'chute' | 'arm-base', size: Size, label = ''): { fig: ReturnType<typeof buildBlockLook>; box: THREE.Box3 } => {
    const fig = buildBlockLook(style, '#a3a3a3', size, label, 'n');
    fig.object.scale.set(size.x, size.y, size.z);
    return { fig, box: boxOf(fig.object) };
  };

  it('the belt fills its block: the moving surface is the block top, the rails stand 1 cm above it, the legs reach the floor', () => {
    for (const size of [{ x: 2.4, y: 0.5, z: 0.6 }, { x: 0.6, y: 0.5, z: 4 }, { x: 6, y: 1, z: 2 }]) {
      const { fig, box } = real('belt-frame', size);
      fig.update!(block(size, { blockStyle: 'belt-frame', belt: { axis: size.x >= size.z ? 'x' : 'z', speed: 1, phase: 0 } }));
      expect(box.max.x - box.min.x).toBeCloseTo(size.x, 3);
      expect(box.max.z - box.min.z).toBeCloseTo(size.z, 3);
      expect(box.min.y).toBeCloseTo(-size.y / 2, 3);
      expect(box.max.y).toBeCloseTo(size.y / 2 + 0.01, 3);
      const surface = boxWhere(fig.object, (m) => m.geometry instanceof THREE.PlaneGeometry);
      expect(surface.max.y).toBeCloseTo(size.y / 2, 6);
      expect(surface.min.y).toBeCloseTo(size.y / 2, 6);
      expect(drawCost(fig.object).meshes).toBe(2);
    }
  });

  it('the scan gate and the arm base stay inside their blocks; the gate lamp takes the block colour', () => {
    const g = { x: 0.14, y: 0.72, z: 0.79 };
    const gate = real('scan-gate', g);
    expect(gate.box.max.z - gate.box.min.z).toBeCloseTo(g.z, 3);
    expect(gate.box.max.y).toBeCloseTo(g.y / 2, 3);
    expect(gate.box.min.y).toBeCloseTo(-g.y / 2, 3);
    expect(gate.box.max.x - gate.box.min.x).toBeLessThanOrEqual(g.x + MM);
    const lamp = (): string => {
      let hex = '';
      gate.fig.object.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m instanceof THREE.MeshBasicMaterial) hex = `#${m.color.getHexString()}`;
      });
      return hex;
    };
    expect(lamp()).toBe('#2b6f86');
    gate.fig.setColor('#45e07a');
    expect(lamp()).toBe('#45e07a');
    expect(drawCost(gate.fig.object).meshes).toBe(2);

    const a = { x: 0.48, y: 0.3, z: 0.48 };
    const base = real('arm-base', a);
    expect(base.box.max.y - base.box.min.y).toBeCloseTo(a.y, 3);
    expect(base.box.max.x - base.box.min.x).toBeCloseTo(a.x, 2);
    expect(drawCost(base.fig.object).meshes).toBe(1);
  });

  it('the chute keeps its kerb on the block footprint and its bag inside the block; only the kerb (5 cm) and the number board rise above', () => {
    const c = { x: 0.94, y: 0.75, z: 0.94 };
    const { fig, box } = real('chute', c, '1');
    expect(box.max.x - box.min.x).toBeCloseTo(c.x, 3);
    expect(box.max.z - box.min.z).toBeCloseTo(c.z, 3);
    expect(box.min.y).toBeCloseTo(-c.y / 2, 2);
    expect(box.max.y).toBeCloseTo(c.y / 2 + 1.1 + 0.16, 3);
    // both shells and the solid parts; the number needs a canvas, which this run does not have
    expect(drawCost(fig.object).meshes).toBe(2);
  });

  it('a block is rebuilt, not stretched, when its size changes', () => {
    const fig = buildBlockLook('arm-base', '#a3a3a3', { x: 0.5, y: 0.3, z: 0.5 }, '', 'n');
    const before = (fig.object.children[0]!.children[0] as THREE.Mesh).geometry;
    fig.update!(block({ x: 1, y: 0.6, z: 1 }));
    fig.object.scale.set(1, 0.6, 1);
    const after = (fig.object.children[0]!.children[0] as THREE.Mesh).geometry;
    expect(after).not.toBe(before);
    const b = boxOf(fig.object);
    expect(b.max.y - b.min.y).toBeCloseTo(0.6, 3);
  });
});

describe('the showcase board', () => {
  it('plays, and the scene draws it with fewer meshes than the same board in the classic looks', () => {
    const meshes = (classic: boolean): number => {
      const board = createFactoryShowcase({ classic });
      const world = createWorld('3d');
      const rt = createRuntime(board.graph, world, '3d');
      for (let i = 0; i < 30; i++) {
        rt.tick({ keysDown: new Set<string>() });
        world.step(TICK_DT);
      }
      const scene = new SceneView();
      scene.setMode('3d');
      // kg tags are drawn on a canvas, which this run does not have: the masses are left out of what is drawn
      scene.sync(world.entities().map(({ mass: _mass, ...e }) => e));
      const n = drawCost(scene.scene).meshes;
      scene.dispose();
      return n;
    };
    const factory = meshes(false);
    const classic = meshes(true);
    expect(factory).toBeGreaterThan(20);
    expect(factory).toBeLessThan(classic * 0.6);
  });
});
