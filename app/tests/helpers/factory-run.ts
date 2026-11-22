import { benchKey, benchPlan } from '../../src/circuits/bench';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Circuit, type EntityView, type Graph, type Runtime, type World } from '../../src/engine/types';
import { PALETTE_COLORS } from '../../src/nodes/color-palette';
import { FACTORY, FACTORY_IDS, createFactoryStationsBoard } from '../../src/samples/sorting-factory-stations';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadedRapier } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';

/**
 * Test-only runners for the sorting factory stations: one circuit on the bench, or a whole board, with "Vật lý thật" on.
 * On the bench the helper that takes a carton off the hand-over table (`takeAfterS`) stands in for whatever collects it;
 * it is test code and no board contains it. The whole board is run as shipped, with nothing added.
 */

export type Link = readonly [from: string, to: string];

/** The colour number "Đọc màu" gives a carton of spawner class k (class 6 has the tape of class 1). */
export const colourOfClass = (k: number): number => PALETTE_COLORS.findIndex((c) => c === FACTORY.classColors[k - 1]) + 1;

/** The chute the rule sends a carton of spawner class k to. */
export const chuteOfClass = (k: number): number => (FACTORY.classMasses[k - 1]! >= FACTORY.heavyFromKg ? FACTORY.heavyChute : colourOfClass(k));

export const circuitOf = (board: Board, id: string): Circuit => board.circuits!.find((c) => c.id === id)!;

/** The same board with one wire of one circuit taken out; throws when the wire is not there. */
export function cutInside(board: Board, circuitId: string, [from, to]: Link): Board {
  const b = structuredClone(board);
  const g = circuitOf(b, circuitId).graph;
  const before = g.wires.length;
  g.wires = g.wires.filter((w) => !(`${w.from.node}.${w.from.port}` === from && `${w.to.node}.${w.to.port}` === to));
  if (g.wires.length !== before - 1) throw new Error(`wire not found in ${circuitId}: ${from} -> ${to}`);
  return b;
}

/** The same board with one wire of the main board taken out. */
export function cutOutside(board: Board, [from, to]: Link): Board {
  const b = structuredClone(board);
  const before = b.graph.wires.length;
  b.graph.wires = b.graph.wires.filter((w) => !(`${w.from.node}.${w.from.port}` === from && `${w.to.node}.${w.to.port}` === to));
  if (b.graph.wires.length !== before - 1) throw new Error(`wire not found on the main board: ${from} -> ${to}`);
  return b;
}

export interface Started {
  world: World;
  rt: Runtime;
  /** One tick with these keys held. */
  tick(keys?: readonly string[]): void;
  items(): EntityView[];
  dispose(): void;
}

export function start(graph: Graph, mode: Board['mode'] = '3d'): Started {
  const rapier = loadedRapier();
  if (!rapier) throw new Error('call loadRapier() in beforeAll first');
  const world = createWorld(mode, { ...(worldOptionsForGraph(graph) ?? {}), rapier });
  const rt = createRuntime(graph, world, mode);
  return {
    world,
    rt,
    tick(keys = []) {
      rt.tick({ keysDown: new Set(keys) });
      world.step(TICK_DT);
    },
    items: () => world.entities().filter((e) => e.kind === 'item' && e.visible),
    dispose: () => world.dispose?.(),
  };
}

export interface StationOptions {
  seconds: number;
  /** Seconds a carton lies on the hand-over table with "Có kiện chờ" on before the test takes it away; `null` = never taken. */
  takeAfterS?: number | null | ((t: number) => number | null);
  /** Whether the pin "Cho nạp tiếp" is held on (default yes). */
  allow?: boolean | ((t: number) => boolean);
  each?: (t: number, run: Started) => void;
}

export interface StationResult {
  /** Cartons made, in order: spawner class, the mass it reported and the entity. */
  made: { id: string; cls: number; kg: number }[];
  /** Scans at the gate, in order: the colour number remembered. */
  scans: number[];
  /** Cartons taken off the table by the test, in order: what the pins said at that moment, and which carton it was. */
  taken: { id: string; loai: number; kg: number; t: number }[];
  /** Times "Có kiện chờ" went on, and the step of the cycle at each of those moments. */
  offered: number;
  offeredAtSteps: number[];
  /** Cartons that lay lower than the table top at some moment (on the floor). */
  dropped: number;
  slips: number;
  maxOnTable: number;
  maxOnBelt: number;
  /** Seconds the cycle spent in each step (index 1..9). */
  stepSeconds: number[];
  lastStep: number;
  /** The pins at the end. */
  pins: { coKien: boolean; loai: number; kg: number };
  overloaded: boolean;
  msPerTick: number;
}

/** Plays "Trạm nạp" alone on the bench (`board` holds the circuit, possibly with a wire cut). */
export function runStation(board: Board, o: StationOptions): StationResult {
  const plan = benchPlan(board, FACTORY_IDS.station);
  const run = start({ ...plan.graph, settings: board.graph.settings });
  const out = (label: string) => {
    const port = plan.outputs.find((p) => p.pin.label === label)?.port;
    return port ? run.rt.getOutput(port.node, port.port) : undefined;
  };
  const { handOver, belt, parcel } = FACTORY;
  const onTable = (e: EntityView): boolean => Math.abs(e.position.x - handOver.x) < 0.3 && Math.abs(e.position.z - handOver.z) < 0.3 && e.position.y > handOver.topY && e.position.y < handOver.topY + parcel.y * 2.5;
  const onBelt = (e: EntityView): boolean => e.position.x > belt.fromX - 0.05 && e.position.x < belt.fromX + belt.length + 0.05 && Math.abs(e.position.z) < belt.width / 2 && e.position.y > belt.topY && e.position.y < belt.topY + parcel.y;
  const res: StationResult = { made: [], scans: [], taken: [], offered: 0, offeredAtSteps: [], dropped: 0, slips: 0, maxOnTable: 0, maxOnBelt: 0, stepSeconds: Array(10).fill(0), lastStep: 0, pins: { coKien: false, loai: 0, kg: 0 }, overloaded: false, msPerTick: 0 };
  const droppedIds = new Set<string>();
  let waited = 0;
  let wasOffered = false;
  const ticks = Math.round(o.seconds / TICK_DT);
  const t0 = performance.now();
  for (let i = 0; i < ticks; i++) {
    const t = i * TICK_DT;
    const allow = typeof o.allow === 'function' ? o.allow(t) : o.allow !== false;
    run.tick(allow ? [benchKey('cho-nap')] : []);
    if (run.rt.getOutput('tao-kien', 'spawned') === true) {
      res.made.push({ id: String(run.rt.getOutput('tao-kien', 'lastSpawned')), cls: Number(run.rt.getOutput('tao-kien', 'lastClass')), kg: Number(run.rt.getOutput('tao-kien', 'lastMass')) });
    }
    if (run.rt.getOutput('nho-mau', 'stored') === true) res.scans.push(Number(run.rt.getOutput('nho-mau', 'held')));
    if (run.rt.getOutput('tay-kep', 'slipped') === true) res.slips++;
    for (const j of ['xoay', 'vai', 'khuyu']) if (run.rt.getOutput(j, 'overloaded') === true) res.overloaded = true;
    const step = Number(run.rt.getOutput('buoc', 'index'));
    res.stepSeconds[step] = (res.stepSeconds[step] ?? 0) + TICK_DT;
    res.lastStep = step;
    const items = run.items();
    let table = 0;
    let onTheBelt = 0;
    for (const e of items) {
      if (onTable(e)) table++;
      if (onBelt(e)) onTheBelt++;
      if (e.position.y < handOver.topY - 0.05) droppedIds.add(e.id);
    }
    res.maxOnTable = Math.max(res.maxOnTable, table);
    res.maxOnBelt = Math.max(res.maxOnBelt, onTheBelt);
    const offered = out('Có kiện chờ') === true;
    if (offered && !wasOffered) {
      res.offered++;
      res.offeredAtSteps.push(step);
    }
    const takeAfter = o.takeAfterS === undefined ? 1 : typeof o.takeAfterS === 'function' ? o.takeAfterS(t) : o.takeAfterS;
    wasOffered = offered;
    waited = offered ? waited + TICK_DT : 0;
    if (takeAfter !== null && offered && waited >= takeAfter) {
      const carton = items.find(onTable);
      if (carton) {
        res.taken.push({ id: carton.id, loai: Number(out('Loại kiện')), kg: Number(out('Khối lượng')), t });
        run.world.hide(carton.id);
      }
      waited = 0;
    }
    o.each?.(t, run);
  }
  res.msPerTick = (performance.now() - t0) / ticks;
  res.dropped = droppedIds.size;
  res.pins = { coKien: out('Có kiện chờ') === true, loai: Number(out('Loại kiện')), kg: Number(out('Khối lượng')) };
  run.dispose();
  return res;
}

/** A fresh main board of the sample. */
export const factoryBoard = (): Board => createFactoryStationsBoard();
