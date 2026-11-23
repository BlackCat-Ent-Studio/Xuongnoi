import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEditorState, readPosition } from '../../src/editor/editor-state';
import { buildSceneModel } from '../../src/editor/scene/scene-model';
import { getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import type { Board, EntityView, ParamValue, ViewMode, World } from '../../src/engine/types';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { DECK_LEG, RAISED_DECK_LOOK, deckLegSpots, deckPlates, deckShape, deckSize, frameLabel, frameOfLabel, isDeckLeg, leastDeckSide } from '../../src/nodes/raised-deck';
import { EDGE_BEAM, RaisedDeckFigure } from '../../src/render/raised-deck-figure';
import { SceneView } from '../../src/render/scene-view';
import { createWorld } from '../../src/world/world';
import { rig } from '../helpers/arm-rig';

registerAllNodes();

type DeckParams = Record<string, ParamValue>;

/** Everything the card made: the plates, then its solid legs if it has any. */
function parts(params: DeckParams = {}, mode: ViewMode = '3d'): EntityView[] {
  const r = rig([['deck', 'raised-deck', params]], [], mode);
  return r.world.entities().filter((e) => e.ownerNodeId === 'deck');
}
const plates = (params: DeckParams = {}, mode: ViewMode = '3d'): EntityView[] => parts(params, mode).filter((e) => !isDeckLeg(e));
const legsOf = (params: DeckParams = {}, mode: ViewMode = '3d'): EntityView[] => parts(params, mode).filter(isDeckLeg);

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
/** Whether each body of the world blocks movement, in the order the cards made them. */
const solidFlags = (world: World): boolean[] => (world.debugBodies?.() ?? []).map((b) => b.solid);
const rectOf = (e: EntityView): Rect => ({ x0: e.position.x - e.size.x / 2, x1: e.position.x + e.size.x / 2, z0: e.position.z - e.size.z / 2, z1: e.position.z + e.size.z / 2 });
const area = (r: Rect): number => (r.x1 - r.x0) * (r.z1 - r.z0);
const overlap = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
const covers = (rects: readonly Rect[], x: number, z: number): boolean => rects.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

/** The plates tile the deck exactly: no two overlap, together they are the deck minus the holes, and every hole is open. */
function expectTiling(list: readonly EntityView[], at: { x: number; z: number }, cols: number, rows: number, hole: number, pitch: number, margin: number, typed: { x?: number; z?: number } = {}): void {
  const rects = list.map(rectOf);
  const sizeX = typed.x ?? (cols - 1) * pitch + hole + 2 * margin;
  const sizeZ = typed.z ?? (rows - 1) * pitch + hole + 2 * margin;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i]!, rects[j]!), `${i} x ${j}`).toBeLessThan(1e-9);
  expect(rects.reduce((sum, r) => sum + area(r), 0)).toBeCloseTo(sizeX * sizeZ - cols * rows * hole * hole, 9);
  expect(Math.min(...rects.map((r) => r.x0))).toBeCloseTo(at.x - sizeX / 2, 9);
  expect(Math.max(...rects.map((r) => r.x1))).toBeCloseTo(at.x + sizeX / 2, 9);
  expect(Math.min(...rects.map((r) => r.z0))).toBeCloseTo(at.z - sizeZ / 2, 9);
  expect(Math.max(...rects.map((r) => r.z1))).toBeCloseTo(at.z + sizeZ / 2, 9);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const hx = at.x + (c - (cols - 1) / 2) * pitch;
      const hz = at.z + (r - (rows - 1) / 2) * pitch;
      // The middle and just inside each corner of the hole are open; just outside each side there is floor.
      for (const [dx, dz] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) expect(covers(rects, hx + dx * (hole / 2 - 0.01), hz + dz * (hole / 2 - 0.01)), `hole ${c},${r}`).toBe(false);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(covers(rects, hx + dx * (hole / 2 + 0.01), hz + dz * (hole / 2 + 0.01)), `rim ${c},${r}`).toBe(true);
    }
  }
}

describe('raised deck: the plates it lays', () => {
  it('the default card is a small deck with one hole: 4 solid plates, top 2.6 m above the ground it stands on', () => {
    const list = plates();
    expect(list).toHaveLength(4);
    for (const e of list) {
      expect(e.kind).toBe('block');
      expect(e.look).toBe(RAISED_DECK_LOOK);
      expect(e.zone).toBeUndefined();
      expect(e.position.y + e.size.y / 2).toBeCloseTo(0.5 + 2.6, 9);
      expect(e.size.y).toBeCloseTo(0.2, 9);
    }
    expectTiling(list, { x: 0, z: 0 }, 1, 1, 0.7, 2, 1.3);
    expect(deckSize(deckShape({}))).toEqual({ x: 0.7 + 2.6, z: 0.7 + 2.6 });
  });

  it('3 x 3 holes are 16 plates, 5 x 3 are 22, and the plates are solid ground', () => {
    const nine = plates({ holeCols: 3, holeRows: 3, position: { x: 4, y: 0, z: -2 } });
    expect(nine).toHaveLength(16);
    expectTiling(nine, { x: 4, z: -2 }, 3, 3, 0.7, 2, 1.3);
    const wide = plates({ holeCols: 5, holeRows: 3, hole: 0.8, pitch: 1.6, margin: 0.9 });
    expect(wide).toHaveLength(22);
    expectTiling(wide, { x: 0, z: 0 }, 5, 3, 0.8, 1.6, 0.9);
    const w = rig([['deck', 'raised-deck', { holeCols: 3, holeRows: 3 }]], [], '3d').world;
    expect(solidFlags(w)).toEqual(Array(16).fill(true));
  });

  it('every setting moves or resizes the plates', () => {
    const base = plates({ holeCols: 3, holeRows: 3 });
    const key = (list: readonly EntityView[]): string => list.map((e) => [e.position.x, e.position.y, e.position.z, e.size.x, e.size.y, e.size.z].map((v) => v.toFixed(4)).join(',')).join(';');
    const changes: DeckParams[] = [{ position: { x: 1, y: 0.5, z: 0 } }, { top: 3 }, { hole: 0.8 }, { pitch: 2.4 }, { margin: 1 }, { thickness: 0.3 }, { holeCols: 2 }, { holeRows: 2 }];
    for (const change of changes) expect(key(plates({ holeCols: 3, holeRows: 3, ...change })), JSON.stringify(change)).not.toBe(key(base));
    const high = plates({ top: 4, thickness: 0.4, position: { x: 0, y: 1, z: 0 } });
    for (const e of high) {
      expect(e.position.y + e.size.y / 2).toBeCloseTo(5, 9);
      expect(e.size.y).toBeCloseTo(0.4, 9);
    }
    expectTiling(plates({ hole: 1.2, pitch: 2.5, margin: 0.5, holeCols: 2, holeRows: 4 }), { x: 0, z: 0 }, 2, 4, 1.2, 2.5, 0.5);
  });

  it('out-of-range settings are brought back into range instead of making a broken deck', () => {
    // A pitch smaller than the hole would overlap the holes: at least 10 cm of floor stays between two holes.
    expectTiling(plates({ holeCols: 3, holeRows: 2, hole: 1, pitch: 0.4 }), { x: 0, z: 0 }, 3, 2, 1, 1.1, 1.3);
    expect(plates({ holeCols: 99, holeRows: 0 })).toHaveLength(2 + 6);
    expect(deckShape({ holeCols: 2.6, holeRows: Number.NaN, hole: -4, margin: 0 })).toEqual({ cols: 3, rows: 1, hole: 0.3, pitch: 2, margin: 0.1 });
    // A floor thicker than its height sits on the ground, never under it.
    for (const e of plates({ top: 0.1, thickness: 0.5, position: { x: 0, y: 0, z: 0 } })) expect(e.position.y - e.size.y / 2).toBeCloseTo(0, 9);
  });

  it('the first plate is the output and carries the shape of the whole deck; the others carry nothing', () => {
    const r = rig([['deck', 'raised-deck', { holeCols: 3, holeRows: 2, top: 2.6, thickness: 0.2 }]], [], '3d');
    r.tick(2);
    const list = r.world.entities().filter((e) => e.ownerNodeId === 'deck');
    expect(r.out('deck', 'self')).toBe(list[0]!.id);
    expect(frameOfLabel(list[0]!.label)).toEqual({ cols: 3, rows: 2, hole: 0.7, pitch: 2, margin: 1.3, thickness: 0.2, legs: 2.4 });
    for (const e of list.slice(1)) expect(e.label).toBeUndefined();
    expect(frameOfLabel(r.world.entities().find((e) => e.ownerNodeId === 'deck')!.label)!.legs).toBeGreaterThan(0);
    const bare = plates({ legs: 'no' });
    expect(frameOfLabel(bare[0]!.label)!.legs).toBe(0);
  });

  it('the shape text reads back exactly and anything else is refused', () => {
    const frame = { cols: 3, rows: 5, hole: 0.65, pitch: 1.85, margin: 1.15, thickness: 0.25, legs: 2.35 };
    expect(frameOfLabel(frameLabel(frame))).toEqual(frame);
    for (const bad of [undefined, '', '7', 'Cửa 3', '3|3|0.7|2|1.3|0.2', '0|3|0.7|2|1.3|0.2|2.4', '3|9|0.7|2|1.3|0.2|2.4', '3|3|0.7|0.5|1.3|0.2|2.4', '3|3|x|2|1.3|0.2|2.4']) expect(frameOfLabel(bad), String(bad)).toBeNull();
  });

  it('the colour changes while the game runs; the shape needs a restart', () => {
    const r = rig([['deck', 'raised-deck', { holeCols: 2 }]], [], '3d');
    r.tick(2);
    expect(r.set('deck', { color: '#112233' })).toBe(true);
    expect(r.world.entities().filter((e) => e.ownerNodeId === 'deck').map((e) => e.color)).toEqual(Array(5).fill('#112233'));
    expect(r.set('deck', { hole: 1 })).toBe(false);
  });

  it('side view: a cut through the middle row of holes; top-down view: paint that blocks nothing', () => {
    const side = plates({ holeCols: 3, holeRows: 3, position: { x: 0, y: 0, z: 5 } }, '2d-side');
    expect(side).toHaveLength(4);
    for (const e of side) expect(e.position.z).toBe(0);
    const spans = side.map(rectOf).sort((a, b) => a.x0 - b.x0);
    expect(spans.map((s) => [s.x0, s.x1].map((v) => Math.round(v * 100) / 100))).toEqual([[-3.65, -2.35], [-1.65, -0.35], [0.35, 1.65], [2.35, 3.65]]);
    const sideWorld = rig([['deck', 'raised-deck', {}]], [], '2d-side').world;
    expect(solidFlags(sideWorld)).toEqual(Array(2).fill(true));

    const flat = rig([['deck', 'raised-deck', { holeCols: 3, holeRows: 3 }]], [], '2d-top').world;
    expect(solidFlags(flat)).toEqual(Array(16).fill(false));
    expect(flat.entities().every((e) => e.zone === true && e.look === RAISED_DECK_LOOK)).toBe(true);
    // It lies on the floor the card names (y = 0.5 by default), 2 cm thick, so what drives there is drawn on top of it.
    for (const e of flat.entities()) expect([e.position.y - e.size.y / 2, e.position.y + e.size.y / 2]).toEqual([expect.closeTo(0.5, 9), expect.closeTo(0.52, 9)]);
    expect(frameOfLabel(flat.entities()[0]!.label)!.legs).toBe(0);
  });

  it('the plate list of the pure layout is what the world gets, strips first', () => {
    const shape = deckShape({ holeCols: 3, holeRows: 3 });
    const pure = deckPlates(shape);
    const list = plates({ holeCols: 3, holeRows: 3, position: { x: 0, y: 0, z: 0 } }).map(rectOf);
    expect(pure).toHaveLength(list.length);
    pure.forEach((p, i) => {
      expect(list[i]!.x0).toBeCloseTo(p.x0, 9);
      expect(list[i]!.x1).toBeCloseTo(p.x1, 9);
      expect(list[i]!.z0).toBeCloseTo(p.z0, 9);
      expect(list[i]!.z1).toBeCloseTo(p.z1, 9);
    });
    // The first rows + 1 are the full-length strips.
    for (const p of pure.slice(0, 4)) expect(p.x1 - p.x0).toBeCloseTo(deckSize(shape).x, 9);
  });
});

describe('raised deck: a typed length and width', () => {
  const key = (list: readonly EntityView[]): string => list.map((e) => [e.position.x, e.position.y, e.position.z, e.size.x, e.size.y, e.size.z, e.label ?? ''].join(',')).join(';');
  const sizeOut = (params: DeckParams): [unknown, unknown] => {
    const r = rig([['deck', 'raised-deck', params]], [], '3d');
    r.tick(1);
    return [r.out('deck', 'sizeX'), r.out('deck', 'sizeZ')];
  };

  it('the deck is as long (x) and as wide (z) as typed, the holes stay centred at their pitch', () => {
    const one = plates({ length: 6, width: 4, position: { x: 1, y: 0, z: -3 } });
    expect(one).toHaveLength(4);
    expectTiling(one, { x: 1, z: -3 }, 1, 1, 0.7, 2, 0, { x: 6, z: 4 });
    const nine = plates({ holeCols: 3, holeRows: 3, hole: 0.8, pitch: 1.5, length: 12, width: 5 });
    expect(nine).toHaveLength(16);
    expectTiling(nine, { x: 0, z: 0 }, 3, 3, 0.8, 1.5, 0, { x: 12, z: 5 });
    expect(deckSize(deckShape({ holeCols: 3, holeRows: 3, hole: 0.8, pitch: 1.5, length: 12, width: 5 }))).toEqual({ x: 12, z: 5 });
    expect(sizeOut({ length: 6, width: 4 })).toEqual([6, 4]);
  });

  it('a typed side too short for the holes grows to the least that fits them (10 cm of floor outside the outer holes), and the card says so', () => {
    // 3 holes of 0.7 m at 2 m need 4.7 m from the first hole edge to the last, plus 2 x 0.1 m.
    const small = plates({ holeCols: 3, holeRows: 2, length: 1, width: 0.5 });
    expectTiling(small, { x: 0, z: 0 }, 3, 2, 0.7, 2, 0.1);
    expect(leastDeckSide(3, { hole: 0.7, pitch: 2 })).toBeCloseTo(4.9, 9);
    const [x, z] = sizeOut({ holeCols: 3, holeRows: 2, length: 1, width: 0.5 }) as [number, number];
    expect(x).toBeCloseTo(4.9, 9);
    expect(z).toBeCloseTo(2.9, 9);
    // Just enough is taken as typed.
    expect(deckSize(deckShape({ holeCols: 3, length: 4.9, width: 0.9 }))).toEqual({ x: expect.closeTo(4.9, 9), z: expect.closeTo(0.9, 9) });
    expect(deckSize(deckShape({ length: 5000 })).x).toBe(100);
  });

  it('one side typed, the other still follows "Lề quanh lỗ ngoài cùng"', () => {
    expectTiling(plates({ holeCols: 2, margin: 0.5, length: 8 }), { x: 0, z: 0 }, 2, 1, 0.7, 2, 0.5, { x: 8 });
    expectTiling(plates({ holeRows: 2, margin: 0.5, width: 8 }), { x: 0, z: 0 }, 1, 2, 0.7, 2, 0.5, { z: 8 });
    expect(sizeOut({ holeCols: 2, margin: 0.5, length: 8 })).toEqual([8, expect.closeTo(1.7, 9)]);
  });

  it('a card saved before the size could be typed keeps exactly its plates and its trim text; 0 means the same as absent', () => {
    for (const old of [{}, { holeCols: 2, top: 2.6 }, { holeCols: 3, holeRows: 3, hole: 0.8, pitch: 1.6, margin: 0.9 }, { holeCols: 5, holeRows: 2, margin: 0.1, legs: 'no' }] as DeckParams[]) {
      const shape = deckShape(old);
      expect(shape.length).toBeUndefined();
      expect(shape.width).toBeUndefined();
      const list = plates(old);
      expectTiling(list, { x: 0, z: 0 }, shape.cols, shape.rows, shape.hole, shape.pitch, shape.margin);
      // The trim text is the seven numbers it always was.
      expect(list[0]!.label!.split('|')).toHaveLength(7);
      expect(key(plates({ ...old, length: 0, width: 0 }))).toBe(key(list));
      expect(key(plates({ ...old, length: -3, width: Number.NaN }))).toBe(key(list));
    }
    expect(plates({ holeCols: 2, top: 2.6 })[0]!.label).toBe('2|1|0.7|2|1.3|0.2|2.4');
    expect(sizeOut({})).toEqual([expect.closeTo(3.3, 9), expect.closeTo(3.3, 9)]);
  });

  it('typing the size the margin already gives lays the same plates', () => {
    const rects = (list: readonly EntityView[]): string => list.map((e) => [e.position.x, e.position.z, e.size.x, e.size.z].map((v) => v.toFixed(9)).join(',')).join(';');
    expect(rects(plates({ holeCols: 3, holeRows: 2, length: 7.3, width: 5.3 }))).toBe(rects(plates({ holeCols: 3, holeRows: 2 })));
  });

  it('the trim text of a typed deck reads back with its size, and the trim is drawn round the typed deck', () => {
    const list = plates({ holeCols: 2, length: 9, width: 3, position: { x: 0, y: 0, z: 0 } });
    const frame = frameOfLabel(list[0]!.label)!;
    expect(frame).toMatchObject({ cols: 2, rows: 1, length: 9, width: 3 });
    expect(deckSize(frame)).toEqual({ x: 9, z: 3 });
    expect(frameOfLabel(frameLabel(frame))).toEqual(frame);
    const onlyWidth = frameOfLabel(plates({ width: 6 })[0]!.label)!;
    expect(onlyWidth.length).toBeUndefined();
    expect(deckSize(onlyWidth)).toEqual({ x: expect.closeTo(3.3, 9), z: 6 });
    // A text naming a side shorter than its holes is not a deck.
    expect(frameOfLabel('3|1|0.7|2|1.3|0.2|2.4|4|0')).toBeNull();
    expect(frameOfLabel('3|1|0.7|2|1.3|0.2|2.4|4.9')).toBeNull();

    const fig = new RaisedDeckFigure(list[0]!);
    fig.object.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(fig.object);
    expect([b.min.x, b.max.x, b.min.z, b.max.z]).toEqual([-4.5 - EDGE_BEAM, 4.5 + EDGE_BEAM, -1.5 - EDGE_BEAM, 1.5 + EDGE_BEAM].map((v) => expect.closeTo(v, 6)));
  });

  it('the size needs a restart like the rest of the shape', () => {
    const r = rig([['deck', 'raised-deck', {}]], [], '3d');
    r.tick(2);
    expect(r.set('deck', { length: 5 })).toBe(false);
    expect(r.set('deck', { width: 5 })).toBe(false);
  });
});

describe('raised deck: legs', () => {
  const SHAPES: DeckParams[] = [{}, { holeCols: 3, holeRows: 3 }, { holeCols: 5, holeRows: 2 }, { holeCols: 3, holeRows: 3, margin: 0.1 }, { holeCols: 2, length: 1, width: 1 }, { holeCols: 2, holeRows: 2, margin: 0.14, width: 9 }, { length: 20, width: 0.9 }];

  it('"Chân trụ": a new card has solid legs, a card saved before the choice existed keeps drawn ones', () => {
    const legs = getNodeDef('raised-deck')!.params.find((p) => p.id === 'legs')!;
    expect(legs.label).toBe('Chân trụ');
    expect(legs.options!.map((o) => o.value)).toEqual(['solid', 'yes', 'no']);
    expect(legs.default).toBe('solid');
    expect(legs.legacyDefault).toBe('yes');
    // No setting at all (an old saved card), "Chỉ vẽ" and "Không": no solid leg; the trim draws the legs of the first two.
    for (const [old, drawn] of [[{}, 2.4], [{ legs: 'yes' }, 2.4], [{ legs: 'no' }, 0]] as [DeckParams, number][]) {
      expect(legsOf(old)).toEqual([]);
      expect(parts(old)).toHaveLength(4);
      expect(frameOfLabel(plates(old)[0]!.label)!.legs).toBe(drawn);
    }
  });

  it('solid legs are plain solid posts from the ground to the underside of the floor, one per leg spot; the plates and the output stay as they were', () => {
    for (const shape of SHAPES) {
      const at = { x: 3, y: 0.5, z: -2 };
      const r = rig([['deck', 'raised-deck', { ...shape, legs: 'solid', position: at }]], [], '3d');
      r.tick(1);
      const all = r.world.entities().filter((e) => e.ownerNodeId === 'deck');
      const posts = all.filter(isDeckLeg);
      const floor = all.filter((e) => !isDeckLeg(e));
      const spots = deckLegSpots(deckShape(shape));
      expect(posts.length, JSON.stringify(shape)).toBe(spots.length);
      posts.forEach((p, i) => {
        expect(p.kind).toBe('block');
        expect(p.look).toBe(RAISED_DECK_LOOK);
        expect([p.size.x, p.size.z]).toEqual([DECK_LEG, DECK_LEG]);
        expect(p.position.x).toBeCloseTo(at.x + spots[i]!.x, 9);
        expect(p.position.z).toBeCloseTo(at.z + spots[i]!.z, 9);
        expect(p.position.y - p.size.y / 2).toBeCloseTo(at.y, 9);
        expect(p.position.y + p.size.y / 2).toBeCloseTo(at.y + 2.6 - 0.2, 9);
      });
      // Same plates, in the same order with the same ids, as the deck with drawn legs; the plates come first.
      const drawn = rig([['deck', 'raised-deck', { ...shape, legs: 'yes', position: at }]], [], '3d').world.entities();
      expect(floor.map((e) => [e.id, e.position, e.size])).toEqual(drawn.map((e) => [e.id, e.position, e.size]));
      expect(all.slice(0, floor.length)).toEqual(floor);
      expect(r.out('deck', 'self')).toBe(floor[0]!.id);
      // The trim no longer draws legs: each post draws itself.
      expect(frameOfLabel(floor[0]!.label)!.legs).toBe(0);
      expect((r.world.debugBodies?.() ?? []).every((b) => b.solid)).toBe(true);
    }
  });

  it('the spacing rule: a ring just inside the edge, a leg at every corner, never more than 3 m between neighbours, none under the inside of the deck', () => {
    for (const shape of SHAPES) {
      const s = deckShape(shape);
      const size = deckSize(s);
      const spots = deckLegSpots(s);
      const tag = JSON.stringify(shape);
      expect(new Set(spots.map((p) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`)).size, tag).toBe(spots.length);
      const maxX = Math.max(...spots.map((p) => p.x));
      const maxZ = Math.max(...spots.map((p) => p.z));
      // The ring sits at most 12 cm inside the edge.
      expect(size.x / 2 - maxX, tag).toBeLessThanOrEqual(0.12 + 1e-9);
      expect(size.z / 2 - maxZ, tag).toBeLessThanOrEqual(0.12 + 1e-9);
      for (const p of spots) expect(Math.abs(Math.abs(p.x) - maxX) < 1e-9 || Math.abs(Math.abs(p.z) - maxZ) < 1e-9, tag).toBe(true);
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) expect(spots.some((p) => Math.abs(p.x - cx * maxX) < 1e-9 && Math.abs(p.z - cz * maxZ) < 1e-9), tag).toBe(true);
      for (const axis of ['x', 'z'] as const) {
        const along = [...new Set(spots.map((p) => Number(p[axis].toFixed(9))))].sort((a, b) => a - b);
        for (let i = 1; i < along.length; i++) expect(along[i]! - along[i - 1]!, tag).toBeLessThanOrEqual(3 + 1e-9);
      }
    }
    // A 3 x 3 deck (7.3 m a side): four legs per edge, 2.35 m apart, twelve in all.
    expect(deckLegSpots(deckShape({ holeCols: 3, holeRows: 3 }))).toHaveLength(12);
  });

  it('no leg stands under a hole: every post lies wholly under floor, also where the rim outside the holes is only 10 cm', () => {
    for (const shape of SHAPES) {
      const all = parts({ ...shape, legs: 'solid', position: { x: 0, y: 0, z: 0 } });
      const floor = all.filter((e) => !isDeckLeg(e)).map(rectOf);
      for (const post of all.filter(isDeckLeg)) {
        const r = rectOf(post);
        // The four corners of the post, pulled in a hair, are each under some plate.
        for (const [x, z] of [[r.x0, r.z0], [r.x0, r.z1], [r.x1, r.z0], [r.x1, r.z1]] as const) {
          const inX = x + Math.sign(post.position.x - x) * 1e-6;
          const inZ = z + Math.sign(post.position.z - z) * 1e-6;
          expect(covers(floor, inX, inZ), `${JSON.stringify(shape)} @ ${x},${z}`).toBe(true);
        }
      }
    }
  });

  it('a leg shorter than 5 cm is not made; the flat views have no solid legs; a repaint leaves the legs steel', () => {
    expect(legsOf({ legs: 'solid', top: 0.24, thickness: 0.2 })).toEqual([]);
    expect(legsOf({ legs: 'solid', top: 0.3, thickness: 0.2 })).toHaveLength(8);
    expect(legsOf({ legs: 'solid', holeCols: 3 }, '2d-top')).toEqual([]);
    expect(legsOf({ legs: 'solid', holeCols: 3 }, '2d-side')).toEqual([]);
    const r = rig([['deck', 'raised-deck', { legs: 'solid' }]], [], '3d');
    r.tick(2);
    const before = r.world.entities().filter(isDeckLeg).map((e) => e.color);
    expect(r.set('deck', { color: '#112233' })).toBe(true);
    expect(r.world.entities().filter(isDeckLeg).map((e) => e.color)).toEqual(before);
    expect(r.world.entities().filter((e) => !isDeckLeg(e)).every((e) => e.color === '#112233')).toBe(true);
    expect(r.set('deck', { legs: 'no' })).toBe(false);
  });

  it('a solid leg is drawn as the post it is, on a foot, standing on the ground: the same leg the trim used to draw', () => {
    const at = { x: 0, y: 0.5, z: 0 };
    const post = legsOf({ legs: 'solid', position: at })[0]!;
    const fig = new RaisedDeckFigure(post);
    expect(fig.hasTrim).toBe(false);
    fig.object.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(fig.object);
    expect(b.min.y).toBeCloseTo(0.5, 6);
    expect(b.max.y).toBeCloseTo(0.5 + 2.4, 6);
    // The foot is twice as wide as the post.
    expect(b.max.x - b.min.x).toBeCloseTo(2 * DECK_LEG, 6);
    expect((b.max.x + b.min.x) / 2).toBeCloseTo(post.position.x, 6);
    fig.object.traverse((o) => expect(o.userData.ownerNodeId).toBe('deck'));
    // Drawn legs and solid legs fill the same space on screen.
    const whole = (params: DeckParams): THREE.Box3 => {
      const group = new THREE.Group();
      for (const e of parts({ ...params, position: at })) group.add(new RaisedDeckFigure(e).object);
      group.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(group);
    };
    const solid = whole({ legs: 'solid', holeCols: 2 });
    const drawn = whole({ legs: 'yes', holeCols: 2 });
    for (const k of ['x', 'y', 'z'] as const) {
      expect(solid.min[k]).toBeCloseTo(drawn.min[k], 6);
      expect(solid.max[k]).toBeCloseTo(drawn.max[k], 6);
    }
  });
});

describe('raised deck: in the editor', () => {
  const emptyBoard = (): Board => ({ name: 't', mode: '3d', graph: { nodes: [], wires: [] } });
  const deckParts = (board: Board): EntityView[] => {
    const world = createWorld(board.mode);
    createRuntime(board.graph, world, board.mode);
    return world.entities().filter((e) => e.look === RAISED_DECK_LOOK);
  };
  const deckBlocks = (board: Board): EntityView[] => deckParts(board).filter((e) => !isDeckLeg(e));

  it('is offered under "Vật thể" in every view with Vietnamese names', () => {
    const def = getNodeDef('raised-deck')!;
    expect(def.label).toBe('Sàn nâng có lỗ');
    expect(def.category).toBe('object');
    expect(def.modes).toBeUndefined();
    expect(def.outputs.map((p) => [p.id, p.label])).toEqual([['self', 'Đối tượng'], ['sizeX', 'Chiều dài thật (m)'], ['sizeZ', 'Chiều rộng thật (m)']]);
    expect(def.inputs).toEqual([]);
    expect(def.params.map((p) => p.id)).toEqual(['position', 'top', 'holeCols', 'holeRows', 'hole', 'pitch', 'margin', 'length', 'width', 'thickness', 'color', 'legs']);
    // A new card starts with no typed size, exactly like a card saved before the setting existed.
    expect(def.params.filter((p) => p.id === 'length' || p.id === 'width').map((p) => [p.default, p.legacyDefault])).toEqual([[0, undefined], [0, undefined]]);
    for (const p of def.params) expect(p.label, p.id).toMatch(/[À-ỹ]/);
  });

  it('the card is placed, selected and edited; the scene tree names it; removing the card removes its plates', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNode('raised-deck', { x: 40, y: 40 })!;
    expect(id).toBeTruthy();
    expect(s.getSelection()).toEqual({ kind: 'node', id });
    expect(deckBlocks(s.getBoard())).toHaveLength(4);
    expect(readPosition(s.getGraph(), id)).toEqual({ x: 0, y: 0.5, z: 0 });
    // A card placed now has solid legs, and says so in its saved settings.
    expect(s.getGraph().nodes[0]!.params.legs).toBe('solid');
    expect(deckParts(s.getBoard()).filter(isDeckLeg)).toHaveLength(8);

    s.setParam(id, 'holeCols', 3);
    s.setParam(id, 'holeRows', 3);
    s.setParam(id, 'hole', 0.7);
    s.setParam(id, 'position', { x: 2, y: 0, z: 1 });
    expect(s.getGraph().nodes[0]!.params.holeCols).toBe(3);
    const nine = deckBlocks(s.getBoard());
    expect(nine).toHaveLength(16);
    expectTiling(nine, { x: 2, z: 1 }, 3, 3, 0.7, 2, 1.3);

    const other = s.addNode('raised-deck', { x: 400, y: 40 })!;
    const objects = (): string[] => buildSceneModel(s.getGraph(), getNodeDef).flatMap((r) => r.groups).find((g) => g.id === 'objects')?.items.map((i) => `${i.nodeId}:${i.label}`) ?? [];
    expect(objects()).toEqual([`${id}:Sàn nâng có lỗ #1`, `${other}:Sàn nâng có lỗ #2`]);

    const saved = parseBoard(serializeBoard(s.getBoard()));
    expect(saved.ok && deckBlocks(saved.board).length).toBe(20);

    s.select({ kind: 'node', id });
    expect(s.deleteSelection()).toBe(true);
    expect(objects()).toEqual([`${other}:Sàn nâng có lỗ`]);
    expect(deckBlocks(s.getBoard())).toHaveLength(4);
    s.select({ kind: 'node', id: other });
    s.deleteSelection();
    expect(deckBlocks(s.getBoard())).toHaveLength(0);
  });
});

describe('raised deck: how it is drawn', () => {
  const boxOf = (o: THREE.Object3D): THREE.Box3 => {
    o.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(o);
  };

  it('a plain plate is drawn exactly as big as its solid box', () => {
    const [, second] = plates({ holeCols: 3, holeRows: 3 });
    const fig = new RaisedDeckFigure(second!);
    expect(fig.hasTrim).toBe(false);
    const b = boxOf(fig.object);
    const r = rectOf(second!);
    expect([b.min.x, b.max.x, b.min.z, b.max.z]).toEqual([r.x0, r.x1, r.z0, r.z1].map((v) => expect.closeTo(v, 6)));
    expect(b.max.y).toBeCloseTo(second!.position.y + second!.size.y / 2, 6);
    expect(b.min.y).toBeCloseTo(second!.position.y - second!.size.y / 2, 6);
  });

  it('the first plate also draws the trim of the whole deck: it reaches the outer edge and its legs stand on the ground', () => {
    const list = plates({ holeCols: 3, holeRows: 3, position: { x: 4, y: 0.5, z: -2 } });
    const fig = new RaisedDeckFigure(list[0]!);
    expect(fig.hasTrim).toBe(true);
    const b = boxOf(fig.object);
    const size = deckSize(deckShape({ holeCols: 3, holeRows: 3 }));
    expect(b.min.x).toBeCloseTo(4 - size.x / 2 - EDGE_BEAM, 6);
    expect(b.max.x).toBeCloseTo(4 + size.x / 2 + EDGE_BEAM, 6);
    expect(b.min.z).toBeCloseTo(-2 - size.z / 2 - EDGE_BEAM, 6);
    expect(b.max.z).toBeCloseTo(-2 + size.z / 2 + EDGE_BEAM, 6);
    expect(b.min.y).toBeCloseTo(0.5, 6);
    // Nothing drawn stands more than 2 cm above the floor a robot drives on.
    expect(b.max.y).toBeLessThan(0.5 + 2.6 + 0.02);
    fig.object.traverse((o) => expect(o.userData.ownerNodeId).toBe('deck'));

    const legless = new RaisedDeckFigure(plates({ legs: 'no' })[0]!);
    expect(boxOf(legless.object).min.y).toBeGreaterThan(0.5 + 2.6 - 0.2 - 0.02);
  });

  it('drawn legs stand round the outer edge only, never further apart than 3 m, and none under a hole', () => {
    for (const [cols, rows] of [[1, 1], [3, 3], [5, 2]] as const) {
      const frame = { ...deckShape({ holeCols: cols, holeRows: rows }), thickness: 0.2, legs: 2.4 };
      const size = deckSize(frame);
      const spots = deckLegSpots(frame);
      expect(new Set(spots.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`)).size).toBe(spots.length);
      for (const s of spots) {
        const onEdge = Math.abs(Math.abs(s.x) - (size.x / 2 - 0.12)) < 1e-9 || Math.abs(Math.abs(s.z) - (size.z / 2 - 0.12)) < 1e-9;
        expect(onEdge).toBe(true);
      }
      const alongX = [...new Set(spots.map((s) => s.x))].sort((a, b) => a - b);
      for (let i = 1; i < alongX.length; i++) expect(alongX[i]! - alongX[i - 1]!).toBeLessThanOrEqual(3 + 1e-9);
      expect(spots.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('the scene draws deck plates with the deck figure and leaves every other block as it was', () => {
    const view = new SceneView();
    view.setMode('3d');
    const deck = plates({ holeCols: 2 });
    const plain: EntityView = { id: 'p1', kind: 'block', ownerNodeId: 'other', position: { x: 9, y: 0, z: 9 }, size: { x: 1, y: 1, z: 1 }, color: '#a3a3a3', visible: true };
    view.sync([...deck, plain], 0);
    const owners = new Map<string, number>();
    view.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && typeof o.userData.ownerNodeId === 'string') owners.set(o.userData.ownerNodeId, (owners.get(o.userData.ownerNodeId) ?? 0) + 1);
    });
    // 5 plates (a top layer and a body each) + the trim of the deck.
    expect(owners.get('deck')).toBe(11);
    // A changed colour redraws the plates in place; a removed deck leaves nothing behind.
    view.sync([...deck.map((e) => ({ ...e, color: '#445566' })), plain], 0);
    view.sync([plain], 0);
    let left = 0;
    view.scene.traverse((o) => {
      if (o.userData.ownerNodeId === 'deck') left++;
    });
    expect(left).toBe(0);
    view.dispose();
  });
});
