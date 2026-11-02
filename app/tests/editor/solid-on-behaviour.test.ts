import { describe, expect, it } from 'vitest';
import { createNode } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type Graph, type InputSnapshot, type Params, type ViewMode } from '../../src/engine/types';
import { addWire } from '../../src/engine/wiring';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';

registerAllNodes();

type Spec = { alias: string; kind: string; params?: Params };

function board(mode: ViewMode, solid: boolean, specs: Spec[], wires: [string, string, string, string][]): Board {
  let graph: Graph = solid ? { nodes: [], wires: [], settings: { solidBodies: true } } : { nodes: [], wires: [] };
  const ids = new Map<string, string>();
  specs.forEach((s, i) => {
    const node = createNode(graph, s.kind, { x: 20 + i * 220, y: 20 });
    if (!node) throw new Error(`unknown kind ${s.kind}`);
    node.params = { ...node.params, ...s.params };
    ids.set(s.alias, node.id);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  });
  for (const [fa, fp, ta, tp] of wires) {
    const res = addWire(graph, { node: ids.get(fa)!, port: fp }, { node: ids.get(ta)!, port: tp });
    if (!('nodes' in res)) throw new Error(`cannot wire ${fa}.${fp} -> ${ta}.${tp}`);
    graph = res;
  }
  return { name: 't', mode, graph };
}

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

function session(b: Board) {
  const world = createWorld(b.mode, worldOptionsForGraph(b.graph));
  const rt = createRuntime(b.graph, world, b.mode);
  const step = (input: InputSnapshot, n = 1): void => {
    for (let i = 0; i < n; i++) {
      rt.tick(input);
      world.step(TICK_DT);
    }
  };
  const hero = (): EntityView => world.entities().find((e) => e.kind === 'character')!;
  const crate = (): EntityView => world.entities().find((e) => e.kind === 'item')!;
  return { world, step, hero, crate };
}

const pos = (x: number): Params => ({ position: { x, y: 0.5, z: 0 } });
const floorFor = (mode: ViewMode): Spec[] =>
  mode === '2d-top' ? [] : [{ alias: 'floor', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 }, color: '#888888' } }];

/** A hero on a stick and a loose crate lying ahead on the walking line. */
function walkBoard(mode: ViewMode, solid: boolean): Board {
  return board(
    mode,
    solid,
    [
      ...floorFor(mode),
      { alias: 'stick', kind: 'stick', params: { scheme: 'wasd' } },
      { alias: 'hero', kind: 'character', params: pos(-3) },
      { alias: 'crate', kind: 'item', params: { ...pos(0), carryable: 'yes' } },
    ],
    [
      ['stick', 'x', 'hero', 'moveX'],
      ['stick', 'y', 'hero', 'moveY'],
    ],
  );
}

describe('Va chạm thật in the editor runtime', () => {
  for (const mode of ['2d-side', '2d-top', '3d'] as const) {
    it(`${mode}: off walks through a loose crate, on is stopped by it`, () => {
      const off = session(walkBoard(mode, false));
      off.step(keys('KeyD'), 360);
      expect(off.hero().position.x, 'off: hero walks through').toBeGreaterThan(1);

      const on = session(walkBoard(mode, true));
      on.step(keys('KeyD'), 360);
      expect(on.hero().position.x, 'on: hero stays behind the crate').toBeLessThan(on.crate().position.x);
      expect(on.crate().position.x, 'the crate is not shoved').toBeCloseTo(0, 1);
    });
  }

  it('the editor keeps its own character size: collision box equals the figure', () => {
    const s = session(walkBoard('3d', true));
    const body = s.world.debugBodies?.().find((x) => x.id === s.hero().id);
    expect(body?.box.size).toEqual(s.hero().size);
  });
});

/** 3D: the hero grabs the crate in front of it, then lets go. */
describe('carry and drop with Va chạm thật (3D)', () => {
  const carryBoard = (solid: boolean, withStack: boolean): Board =>
    board(
      '3d',
      solid,
      [
        ...floorFor('3d'),
        { alias: 'hero', kind: 'character', params: pos(0) },
        { alias: 'crate', kind: 'item', params: { position: { x: 0.9, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, carryable: 'yes' } },
        { alias: 'carry', kind: 'carry' },
        { alias: 'grab', kind: 'key', params: { key: 'KeyE' } },
        { alias: 'drop', kind: 'key', params: { key: 'KeyQ' } },
        { alias: 'stick', kind: 'stick', params: { scheme: 'wasd' } },
        // Another crate lying further ahead, to set the first one down on.
        ...(withStack ? [{ alias: 'low', kind: 'item', params: { position: { x: 2.4, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, carryable: 'yes' } }] : []),
      ],
      [
        ['stick', 'x', 'hero', 'moveX'],
        ['stick', 'y', 'hero', 'moveY'],
        ['hero', 'self', 'carry', 'character'],
        ['grab', 'pressed', 'carry', 'grab'],
        ['drop', 'pressed', 'carry', 'drop'],
      ],
    );

  it('on: grab lifts the crate to the hands, drop lets it fall straight down from there', () => {
    const s = session(carryBoard(true, false));
    s.step(keys(), 30);
    const start = { ...s.crate().position };
    s.step(keys('KeyE'), 2);
    s.step(keys(), 40);
    const held = { ...s.crate().position };
    expect(held.y, 'crate rose').toBeGreaterThan(start.y + 0.25);
    s.step(keys('KeyQ'), 2);
    const released = { ...s.crate().position };
    s.step(keys(), 120);
    const end = s.crate().position;
    expect(Math.hypot(end.x - released.x, end.z - released.z), 'falls straight down').toBeLessThan(0.05);
    expect(end.y, 'ends below where it was held').toBeLessThan(held.y - 0.25);
  });

  it('on: a crate carried over another one is lifted clear and set down on top of it', () => {
    const s = session(carryBoard(true, true));
    s.step(keys(), 30);
    s.step(keys('KeyE'), 2);
    s.step(keys(), 20);
    const carried = s.crate();
    const low = s.world.entities().find((e) => e.kind === 'item' && e.id !== carried.id)!;
    s.step(keys('KeyD'), 150);
    s.step(keys('KeyQ'), 2);
    s.step(keys(), 120);
    const top = s.world.entities().find((e) => e.id === carried.id)!;
    const bottom = s.world.entities().find((e) => e.id === low.id)!;
    expect(Math.abs(top.position.x - bottom.position.x), 'set down over the other crate').toBeLessThan(0.35);
    expect(top.position.y, 'resting on top of it').toBeGreaterThan(bottom.position.y + 0.55);
  });

  it('off: the old behaviour is unchanged (crate teleports to the hold point, drop lands beside the hero)', () => {
    const s = session(carryBoard(false, false));
    s.step(keys(), 30);
    s.step(keys('KeyE'), 2);
    s.step(keys(), 10);
    const heldY = s.crate().position.y;
    expect(heldY).toBeGreaterThan(0.9);
    s.step(keys('KeyQ'), 2);
    s.step(keys(), 60);
    expect(s.crate().position.y).toBeLessThan(heldY - 0.2);
  });
});
