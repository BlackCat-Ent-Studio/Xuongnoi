import { beforeAll, describe, expect, it } from 'vitest';
import { benchKey, benchPlan } from '../../src/circuits/bench';
import type { Graph } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { FACTORY, FACTORY_IDS } from '../../src/samples/sorting-factory-stations';
import { loadRapier } from '../../src/world/rapier-loader';
import { factoryBoard, start } from '../helpers/factory-run';

/**
 * "Thu hồi" while an arm holds the carton, under "Vật lý thật": the feeding station of the sorting sample, with its
 * spawner's recall inputs switched on. "Vật đang giữ" of the gripper names the carton and a key gives the edge.
 */
beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

function stationWithRecall(): Graph {
  const board = factoryBoard();
  const plan = benchPlan(board, FACTORY_IDS.station);
  const graph: Graph = structuredClone({ ...plan.graph, settings: board.graph.settings });
  graph.nodes.find((n) => n.id === 'tao-kien')!.params.recallPorts = 'yes';
  graph.nodes.push({ id: 'phim-thu', kind: 'key', params: { key: 'KeyR' }, pos: { x: 0, y: 0 } });
  graph.wires.push(
    { id: 'thu-1', from: { node: 'tay-kep', port: 'held' }, to: { node: 'tao-kien', port: 'recallThing' } },
    { id: 'thu-2', from: { node: 'phim-thu', port: 'held' }, to: { node: 'tao-kien', port: 'recall' } },
  );
  return graph;
}

describe('recalling a carton out of a closed gripper (Vật lý thật)', () => {
  it('the hand is empty on the next tick, the carton is gone, and the station goes on to pick the next one', { timeout: 120_000 }, () => {
    const graph = stationWithRecall();
    expect(graph.settings?.realPhysics).toBe(true);
    const run = start(graph);
    const allow = benchKey('cho-nap');
    const out = (node: string, port: string) => run.rt.getOutput(node, port);

    // Until the arm has lifted a carton clear of the belt.
    let held: string | null = null;
    for (let n = 0; n < 60 * 60 && held === null; n++) {
      run.tick([allow]);
      const id = out('tay-kep', 'held') as string | null;
      if (id !== null && run.world.getEntity(id)!.position.y > FACTORY.belt.topY + FACTORY.parcel.y / 2 + 0.1) held = id;
    }
    expect(held, 'the arm never lifted a carton').not.toBeNull();
    expect(out('tay-kep', 'holding')).toBe(true);
    const before = Number(out('tao-kien', 'count'));
    const others = run.items().filter((e) => e.id !== held).map((e) => e.id);

    run.tick([allow, 'KeyR']);
    expect(out('tao-kien', 'count')).toBe(before - 1);
    expect(run.world.getEntity(held!)).toBeUndefined();
    run.tick([allow]);
    expect(out('tay-kep', 'holding')).toBe(false);
    expect(out('tay-kep', 'held')).toBeNull();
    expect(run.items().some((e) => e.id === held)).toBe(false);
    // Nothing else was touched.
    for (const id of others) expect(run.world.getEntity(id)?.visible, id).toBe(true);

    // The station carries on: the gripper closes on a later carton, a different one.
    let next: string | null = null;
    for (let n = 0; n < 60 * 90 && next === null; n++) {
      run.tick([allow]);
      const id = out('tay-kep', 'held') as string | null;
      if (id !== null) next = id;
    }
    expect(next, 'the arm never picked another carton').not.toBeNull();
    expect(next).not.toBe(held);
    run.dispose();
  });

  it('with the inputs wired but "Thu hồi" never pressed, the station plays tick for tick as without them', { timeout: 120_000 }, () => {
    const board = factoryBoard();
    const plain = start({ ...benchPlan(board, FACTORY_IDS.station).graph, settings: board.graph.settings });
    const wired = start(stationWithRecall());
    const allow = benchKey('cho-nap');
    const state = (r: ReturnType<typeof start>): string => JSON.stringify(r.world.entities().map((e) => [e.id, e.position, e.visible]));
    for (let n = 0; n < 60 * 30; n++) {
      plain.tick([allow]);
      wired.tick([allow]);
      if (n % 30 === 0) expect(state(wired), `tick ${n}`).toBe(state(plain));
    }
    expect(state(wired)).toBe(state(plain));
    plain.dispose();
    wired.dispose();
  });
});
