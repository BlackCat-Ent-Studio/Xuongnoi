import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEditorState, readPosition } from '../../src/editor/editor-state';
import { buildSceneModel } from '../../src/editor/scene/scene-model';
import { getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import type { Board, EntityView, ParamValue, ViewMode, World } from '../../src/engine/types';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { RAISED_DECK_LOOK, deckPlates, deckShape, deckSize, frameLabel, frameOfLabel } from '../../src/nodes/raised-deck';
import { EDGE_BEAM, RaisedDeckFigure, deckLegSpots } from '../../src/render/raised-deck-figure';
import { SceneView } from '../../src/render/scene-view';
import { createWorld } from '../../src/world/world';
import { rig } from '../helpers/arm-rig';

registerAllNodes();

type DeckParams = Record<string, ParamValue>;

function plates(params: DeckParams = {}, mode: ViewMode = '3d'): EntityView[] {
  const r = rig([['deck', 'raised-deck', params]], [], mode);
  return r.world.entities().filter((e) => e.ownerNodeId === 'deck');
}

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
function expectTiling(list: readonly EntityView[], at: { x: number; z: number }, cols: number, rows: number, hole: number, pitch: number, margin: number): void {
  const rects = list.map(rectOf);
  const sizeX = (cols - 1) * pitch + hole + 2 * margin;
  const sizeZ = (rows - 1) * pitch + hole + 2 * margin;
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

describe('raised deck: in the editor', () => {
  const emptyBoard = (): Board => ({ name: 't', mode: '3d', graph: { nodes: [], wires: [] } });
  const deckBlocks = (board: Board): EntityView[] => {
    const world = createWorld(board.mode);
    createRuntime(board.graph, world, board.mode);
    return world.entities().filter((e) => e.look === RAISED_DECK_LOOK);
  };

  it('is offered under "Vật thể" in every view with Vietnamese names', () => {
    const def = getNodeDef('raised-deck')!;
    expect(def.label).toBe('Sàn nâng có lỗ');
    expect(def.category).toBe('object');
    expect(def.modes).toBeUndefined();
    expect(def.outputs.map((p) => [p.id, p.label])).toEqual([['self', 'Đối tượng']]);
    expect(def.inputs).toEqual([]);
    expect(def.params.map((p) => p.id)).toEqual(['position', 'top', 'holeCols', 'holeRows', 'hole', 'pitch', 'margin', 'thickness', 'color', 'legs']);
    for (const p of def.params) expect(p.label, p.id).toMatch(/[À-ỹ]/);
  });

  it('the card is placed, selected and edited; the scene tree names it; removing the card removes its plates', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNode('raised-deck', { x: 40, y: 40 })!;
    expect(id).toBeTruthy();
    expect(s.getSelection()).toEqual({ kind: 'node', id });
    expect(deckBlocks(s.getBoard())).toHaveLength(4);
    expect(readPosition(s.getGraph(), id)).toEqual({ x: 0, y: 0.5, z: 0 });

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

  it('legs stand round the outer edge only, never further apart than 3 m, and none under a hole', () => {
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
    // 5 plates + the trim of the deck.
    expect(owners.get('deck')).toBe(6);
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
