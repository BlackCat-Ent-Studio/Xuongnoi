import { beforeAll, describe, expect, it } from 'vitest';
import { validateCircuits } from '../../src/circuits/validate';
import { createCircuitFromSelection } from '../../src/editor/circuits/circuit-model';
import type { Board, EntityView, World } from '../../src/engine/types';
import { parseBoard, serializeBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { sampleBoard } from '../circuits/circuit-helpers';
import { runBoard } from './solid-helpers';

/** 600 ticks. */
const SECONDS = 10;

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await loadRapier();
});

interface RunHash {
  /** Every entity exactly as the world lists it, every tick. */
  raw: number;
  /** The same state with the listing order taken out: entities by owner, a robot's wheels by side, no entity serial number. */
  state: number;
  ticks: number;
  moved: number;
}

const fnv = (h: number, text: string): number => {
  let out = h;
  for (let i = 0; i < text.length; i++) {
    out ^= text.charCodeAt(i);
    out = Math.imul(out, 16777619) >>> 0;
  }
  return out;
};

/**
 * Hashes the whole entity state of a run, every tick: positions, sizes, robot state, owner. Owner ids are cut down to their
 * last part, because a card that moved into a circuit runs as `<copy>/<id>`.
 *
 * `state` leaves out only what depends on the order the engine happens to run independent cards in (it runs them by id, and
 * ids inside a copy sort differently): which entity is listed first, its serial number `e1, e2...`, and which wheel of a
 * robot is listed first. Every number of every entity is still in it.
 */
function entityHash(board: Board): RunHash {
  const wanted = worldOptionsForGraph(board.graph);
  const round = (_k: string, v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
  const out: RunHash = { raw: 2166136261, state: 2166136261, ticks: 0, moved: 0 };
  let first: { x: number; z: number } | null = null;
  const onTick = (_tick: number, world: World): void => {
    const all = (world.entities() as readonly EntityView[]).map((e) => ({ ...e, ownerNodeId: e.ownerNodeId.slice(e.ownerNodeId.lastIndexOf('/') + 1) }));
    out.raw = fnv(out.raw, JSON.stringify(all, round));
    const listed = all
      .map(({ id: _serial, ...e }) => {
        const robot = e.robot;
        if (!robot) return e;
        const bySide = robot.wheels.map((_w, i) => i).sort((a, b) => robot.wheels[a]!.side - robot.wheels[b]!.side);
        return { ...e, robot: { ...robot, wheels: bySide.map((i) => robot.wheels[i]!), slip: bySide.map((i) => robot.slip?.[i]) } };
      })
      .sort((a, b) => (a.ownerNodeId < b.ownerNodeId ? -1 : a.ownerNodeId > b.ownerNodeId ? 1 : 0));
    out.state = fnv(out.state, JSON.stringify(listed, round));
    const robot = all.find((e) => e.robot);
    if (robot) {
      first ??= { x: robot.position.x, z: robot.position.z };
      out.moved = Math.max(out.moved, Math.hypot(robot.position.x - first.x, robot.position.z - first.z));
    }
  };
  const res = runBoard(board, wanted?.realPhysics ? { ...wanted, rapier } : wanted, { seconds: SECONDS, onTick });
  res.world?.dispose?.();
  expect(res.error).toBeNull();
  out.ticks = res.ticks;
  return out;
}

/** Selections worth trying on any board: the cards that only compute, the first half of the list, and every card. */
function selections(board: Board): Record<string, Set<string>> {
  const nodes = board.graph.nodes;
  const wired = new Set(board.graph.wires.flatMap((w) => [w.from.node, w.to.node]));
  return {
    'the wired cards that are not the robot': new Set(nodes.filter((n) => n.kind !== 'robot-body' && wired.has(n.id)).map((n) => n.id)),
    'the first half of the cards': new Set(nodes.slice(0, Math.ceil(nodes.length / 2)).map((n) => n.id)),
    'every card': new Set(nodes.map((n) => n.id)),
  };
}

describe('a circuit made from the selected cards leaves the board running as before', () => {
  for (const id of ['robot-square', 'robot-line-follow']) {
    it(`${id}: the same entity-state hash over 600 ticks before and after, for three selections`, { timeout: 300_000 }, () => {
      const before = sampleBoard(id);
      expect(before.graph.settings?.realPhysics).toBe(true);
      const want = entityHash(before);
      expect(want.ticks).toBe(600);
      // The run is a real one: the robot goes somewhere.
      expect(want.moved).toBeGreaterThan(0.5);
      let crossing = 0;
      let sameOrder = 0;
      for (const [name, ids] of Object.entries(selections(before))) {
        const res = createCircuitFromSelection(before, [], ids);
        if (!res.ok) throw new Error(`${name}: ${res.reason}`);
        const made = res.board.circuits![0]!;
        crossing += made.pins.length;
        expect(made.graph.nodes.map((n) => n.id).sort(), name).toEqual([...ids].sort());
        expect(res.board.graph.nodes.length, name).toBe(before.graph.nodes.length - ids.size + 1);
        expect(validateCircuits(res.board), name).toEqual([]);
        const got = entityHash(res.board);
        expect(got.ticks, name).toBe(600);
        expect(got.state, name).toBe(want.state);
        // When the cards still run in the very order they ran in before, even the listing is the same.
        if (!res.orderChanged) {
          sameOrder++;
          expect(got.raw, name).toBe(want.raw);
        }
        // And it still does after a save and a load.
        const loaded = parseBoard(serializeBoard(res.board));
        if (!loaded.ok) throw new Error(`${name}: ${loaded.error}`);
        expect(entityHash(loaded.board).state, name).toBe(want.state);
      }
      expect(sameOrder).toBeGreaterThan(0);
      // At least one of the selections cut through wires, so pins really carried values.
      expect(crossing).toBeGreaterThan(0);
    });
  }
});
