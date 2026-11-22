import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BLOCK_STYLES, BLOCK_STYLE_LABELS } from '../../src/engine/block-styles';
import { PARCEL_LOOKS } from '../../src/engine/factory-looks';
import { codeNeedsUnderline, lookWithCode, parcelCodeOfTag, parcelCodeOfValue, splitLookCode } from '../../src/engine/parcel-code';
import type { EntityView } from '../../src/engine/types';
import { buildBlockLook } from '../../src/render/block-looks';
import { displayScreens } from '../../src/render/factory-blocks';
import { drawCost } from '../../src/render/factory-kit';
import { buildParcel, codeTilePlaces, isParcelLook } from '../../src/render/factory-parcels';
import { SceneView } from '../../src/render/scene-view';

type Size = { x: number; y: number; z: number };

/** What was painted on one picture (the tests run without a browser, so the canvas is a recorder). */
interface Painted {
  texts: string[];
  rects: [number, number, number, number][];
}
const pictures: Painted[] = [];
const realDocument = (globalThis as { document?: unknown }).document;

beforeAll(() => {
  const canvas = (): unknown => {
    const p: Painted = { texts: [], rects: [] };
    pictures.push(p);
    const g = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      beginPath: () => undefined,
      roundRect: () => undefined,
      fill: () => undefined,
      stroke: () => undefined,
      measureText: (t: string) => ({ width: t.length * 100 }),
      fillText: (t: string) => void p.texts.push(t),
      fillRect: (x: number, y: number, w: number, h: number) => void p.rects.push([x, y, w, h]),
    };
    return { width: 0, height: 0, getContext: () => g };
  };
  (globalThis as { document?: unknown }).document = { createElement: canvas };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

const PARCEL: Size = { x: 0.32, y: 0.26, z: 0.28 };

function laid(look: string, size: Size = PARCEL, color = '#ef4444') {
  const fig = buildParcel(look, color, 'seed');
  fig.update!({ size });
  fig.object.scale.set(size.x, size.y, size.z);
  fig.object.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  fig.object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  return { fig, meshes, tiles: meshes.filter((m) => m.userData.parcelCode !== undefined) };
}

describe('the code of a parcel', () => {
  it('is a whole number from 1 to 99 written in the goods type', () => {
    expect(['1', '7', '42', '99', ' 8 ', '07'].map(parcelCodeOfTag)).toEqual([1, 7, 42, 99, 8, 7]);
    expect(['', '0', '00', '100', '-3', '3.5', 'rau', '7a', 'xanh', '1e1'].map(parcelCodeOfTag)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect([1, 99, 3.4, 3.6, 0, -1, 100, Number.NaN, Infinity].map(parcelCodeOfValue)).toEqual([1, 99, 3, 4, 0, 0, 0, 0, 0]);
    expect([true, 'e1', null, undefined].map((v) => parcelCodeOfValue(v as never))).toEqual([0, 0, 0, 0]);
  });

  it('rides on the carton look only, and comes back out of it', () => {
    expect(lookWithCode({ look: 'parcel-carton' }, 7)).toEqual({ look: 'parcel-carton#7' });
    expect(lookWithCode({ look: 'parcel-carton' }, 0)).toEqual({ look: 'parcel-carton' });
    expect(lookWithCode({ look: 'parcel-3' }, 7)).toEqual({ look: 'parcel-3' });
    expect(lookWithCode({}, 7)).toEqual({});
    expect(splitLookCode('parcel-carton#7')).toEqual({ look: 'parcel-carton', code: 7 });
    expect(splitLookCode('parcel-carton#99')).toEqual({ look: 'parcel-carton', code: 99 });
    expect(splitLookCode('parcel-carton')).toEqual({ look: 'parcel-carton', code: 0 });
    for (const odd of ['parcel-carton#0', 'parcel-carton#100', 'parcel-carton#x', 'parcel-3#7', 'agv#7']) expect(splitLookCode(odd), odd).toEqual({ look: odd, code: 0 });
  });

  it('gets a line under it exactly when it reads as another number upside down', () => {
    const underlined = Array.from({ length: 99 }, (_, k) => k + 1).filter(codeNeedsUnderline);
    expect(underlined).toEqual([6, 9, 10, 16, 18, 19, 60, 61, 66, 68, 80, 81, 86, 89, 90, 91, 98, 99]);
  });

  it('a carton with a code is still a parcel look; every look in the list stays known', () => {
    expect(isParcelLook('parcel-carton#7')).toBe(true);
    expect(isParcelLook('parcel-carton#99')).toBe(true);
    expect(isParcelLook('parcel-carton#100')).toBe(false);
    expect(isParcelLook('parcel-3#7')).toBe(false);
    for (const o of PARCEL_LOOKS) expect(isParcelLook(o.value), o.value).toBe(o.value !== 'classic');
  });
});

describe('the number printed on a carton', () => {
  it('a carton without a code is drawn as before: one mesh, the same shared geometry, no picture', () => {
    const before = pictures.length;
    const plain = laid('parcel-carton');
    expect(plain.meshes).toHaveLength(1);
    expect(plain.tiles).toHaveLength(0);
    expect(pictures.length).toBe(before);
    // The body under a number is that very same geometry: the number is only added on top.
    const coded = laid('parcel-carton#7');
    expect(coded.meshes[0]!.geometry).toBe(plain.meshes[0]!.geometry);
    expect(coded.meshes[0]!.material).toBe(plain.meshes[0]!.material);
  });

  it('prints the number on the top and on the two long sides, flat on the faces', () => {
    const { tiles, fig } = laid('parcel-carton#7');
    expect(tiles).toHaveLength(3);
    expect(drawCost(fig.object).meshes).toBe(4);
    const facing = tiles.map((t) => {
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(t.getWorldQuaternion(new THREE.Quaternion()));
      const p = t.getWorldPosition(new THREE.Vector3());
      return { n: [Math.round(n.x) + 0, Math.round(n.y) + 0, Math.round(n.z) + 0], p: [p.x, p.y, p.z] };
    });
    expect(facing.map((f) => f.n)).toEqual([[0, 1, 0], [0, 0, 1], [0, 0, -1]]);
    expect(facing[0]!.p[1]).toBeCloseTo(PARCEL.y / 2 + 0.005, 4);
    expect(facing[1]!.p[2]).toBeCloseTo(PARCEL.z / 2 + 0.003, 4);
    expect(facing[2]!.p[2]).toBeCloseTo(-PARCEL.z / 2 - 0.003, 4);
    // Same sizes as the picture the user picked: 0.2 m on the top and 0.18 m on the sides of a 0.32 x 0.26 x 0.28 carton.
    const places = codeTilePlaces(PARCEL);
    expect(places[0]!.side).toBeCloseTo(0.2, 2);
    expect(places[1]!.side).toBeCloseTo(0.18, 2);
    for (const t of tiles) {
      expect(t.castShadow).toBe(false);
      expect((t.material as THREE.MeshBasicMaterial).isMeshBasicMaterial).toBe(true);
    }
  });

  it('a carton that is longer along z carries the side numbers on its x faces, and every tile fits its face', () => {
    for (const size of [{ x: 0.28, y: 0.26, z: 0.4 }, { x: 0.7, y: 0.7, z: 0.7 }, { x: 0.6, y: 0.12, z: 0.3 }, PARCEL]) {
      const [top, a, b] = codeTilePlaces(size);
      const alongX = size.x >= size.z;
      expect(top!.side).toBeLessThanOrEqual(Math.min(size.x, size.z));
      expect(a!.side).toBeLessThanOrEqual(Math.min(alongX ? size.x : size.z, size.y));
      expect(Math.abs(alongX ? a!.at[2] : a!.at[0])).toBeCloseTo((alongX ? size.z : size.x) / 2 + 0.003, 5);
      expect(alongX ? a!.at[0] : a!.at[2]).toBe(0);
      expect(b!.at.map((v) => -v + 0)).toEqual(a!.at.map((v) => v + 0));
    }
  });

  it('writes the digits of the code, and a line under 6 and 9 but not under 7 or 8', () => {
    const drawn = (code: number): Painted => {
      const before = pictures.length;
      laid(`parcel-carton#${code}`);
      expect(pictures.length, `one picture for code ${code}`).toBe(before + 1);
      return pictures[before]!;
    };
    for (const code of [1, 8, 42]) expect(drawn(code)).toEqual({ texts: [String(code)], rects: [] });
    for (const code of [6, 9, 68]) {
      const p = drawn(code);
      expect(p.texts).toEqual([String(code)]);
      expect(p.rects).toHaveLength(1);
      // The line lies in the bottom quarter of the 256 px tile, centred.
      const [x, y, w] = p.rects[0]!;
      expect(y).toBeGreaterThan(256 * 0.75);
      expect(x + w / 2).toBeCloseTo(128, 5);
    }
    // The same code again reuses its picture.
    const again = pictures.length;
    laid('parcel-carton#8');
    expect(pictures.length).toBe(again);
  });

  it('the scene swaps the figure when the code changes and drops the number when it goes', () => {
    const item = (look: string): EntityView => ({ id: 'i', kind: 'item', ownerNodeId: 'n', position: { x: 0, y: 0.2, z: 0 }, size: { ...PARCEL }, color: '#ef4444', shape: 'crate', visible: true, look });
    const scene = new SceneView();
    scene.setMode('3d');
    const tilesNow = (): number[] => {
      const out: number[] = [];
      scene.scene.traverse((o) => {
        if (o.userData.parcelCode !== undefined) out.push(o.userData.parcelCode as number);
      });
      return out;
    };
    scene.sync([item('parcel-carton#3')]);
    expect(tilesNow()).toEqual([3, 3, 3]);
    scene.sync([item('parcel-carton#5')]);
    expect(tilesNow()).toEqual([5, 5, 5]);
    scene.sync([item('parcel-carton')]);
    expect(tilesNow()).toEqual([]);
    scene.dispose();
  });
});

describe('the code display', () => {
  const size = { x: 0.22, y: 0.18, z: 0.22 };
  const view = (label?: string): EntityView => ({ id: 'd', kind: 'block', ownerNodeId: 'n', position: { x: 0, y: 0, z: 0 }, size, color: '#a3a3a3', visible: true, blockStyle: 'code-display', ...(label ? { label } : {}) });

  it('is a style of its own at the end of the list; the scan gate is listed as before', () => {
    expect(BLOCK_STYLES.at(-1)).toBe('code-display');
    expect(BLOCK_STYLE_LABELS['scan-gate']).toBe('Cổng quét (khung vàng, đèn theo màu)');
    expect(BLOCK_STYLES.indexOf('scan-gate')).toBe(BLOCK_STYLES.indexOf('belt-frame') + 1);
  });

  it('stays inside its block and shows the number on all four upright faces', () => {
    const before = pictures.length;
    const fig = buildBlockLook('code-display', '#a3a3a3', size, '7', 'n');
    fig.update!(view('7'));
    fig.object.scale.set(size.x, size.y, size.z);
    fig.object.updateMatrixWorld(true);
    const got = new THREE.Box3().setFromObject(fig.object).getSize(new THREE.Vector3());
    expect(got.x).toBeLessThanOrEqual(size.x + 0.01);
    expect(got.y).toBeLessThanOrEqual(size.y + 0.001);
    expect(got.z).toBeLessThanOrEqual(size.z + 0.01);
    expect(pictures[before]).toEqual({ texts: ['7'], rects: [] });
    const screens = displayScreens(size);
    expect(screens.map((s) => [Math.round(Math.sin(s.turn)) + 0, Math.round(Math.cos(s.turn)) + 0])).toEqual([[0, 1], [1, 0], [0, -1], [-1, 0]]);
    const pictured: THREE.Mesh[] = [];
    fig.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.MeshBasicMaterial).map) pictured.push(m);
    });
    expect(pictured).toHaveLength(4);
    fig.dispose();
  });

  it('an empty display shows a dash, not a number', () => {
    const before = pictures.length;
    const fig = buildBlockLook('code-display', '#a3a3a3', size, '', 'n');
    fig.update!(view());
    expect(pictures[before]!.texts).toEqual([]);
    expect(pictures[before]!.rects).toHaveLength(1);
    fig.dispose();
  });

  it('the scan gate is still built from its two parts', () => {
    const gate = { x: 0.14, y: 1.17, z: 0.79 };
    const fig = buildBlockLook('scan-gate', '#a3a3a3', gate, '', 'n');
    expect(drawCost(fig.object)).toEqual({ meshes: 2, triangles: expect.any(Number) });
    fig.dispose();
  });
});
