import { beforeAll, describe, expect, it } from 'vitest';
import { benchKey, benchPlan } from '../../src/circuits/bench';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Graph, type InputSnapshot, type Runtime, type World } from '../../src/engine/types';
import { importCircuitFile, parseCircuitFile, serializeCircuitFile } from '../../src/io/circuit-file';
import { createEmptyBoard, parseBoard, serializeBoard } from '../../src/io/save-format';
import { listStarterCircuits } from '../../src/io/starter-circuits';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { copyOf, node, wire } from './circuit-helpers';

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await loadRapier();
});

const starter = (id: string) => listStarterCircuits().find((s) => s.id === id)!;

/** An empty new game ("Va chạm thật" on, as the editor makes it) with one starter circuit added; `real` also switches "Vật lý thật" on. */
function boardWith(id: string, real = false): { board: Board; circuitId: string } {
  const empty = createEmptyBoard('3d');
  const base: Board = real ? { ...empty, graph: { ...empty.graph, settings: { ...empty.graph.settings, realPhysics: true } } } : empty;
  const res = importCircuitFile(base, starter(id).file);
  if (!res.ok) throw new Error(res.reason);
  return { board: res.board, circuitId: res.circuitId };
}

interface Run {
  rt: Runtime;
  world: World;
  /** Plays `seconds` with these keys held, calling `each` after every tick. */
  play(seconds: number, keys: string[], each?: (tick: number) => void): void;
}

function start(graph: Graph, mode: Board['mode']): Run {
  const wanted = worldOptionsForGraph(graph);
  const world = createWorld(mode, wanted?.realPhysics ? { ...wanted, rapier } : wanted);
  const rt = createRuntime(graph, world, mode);
  let tick = 0;
  return {
    rt,
    world,
    play(seconds, keys, each) {
      const input: InputSnapshot = { keysDown: new Set(keys) };
      for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
        rt.tick(input);
        world.step(TICK_DT);
        each?.(tick++);
      }
    },
  };
}

describe('starter circuits', () => {
  it('are plain data made of general pieces only, pass every check, and survive being saved as a circuit file', () => {
    const all = listStarterCircuits();
    expect(all.map((s) => s.file.circuits[0]!.name)).toEqual(['Đèn nháy', 'Xe hai bánh tới mốc']);
    for (const s of all) {
      for (const c of s.file.circuits) for (const n of c.graph.nodes) expect(getNodeDef(n.kind), `${s.id}: ${n.kind}`).toBeDefined();
      const { board, circuitId } = boardWith(s.id);
      expect(validateCircuits(board), s.id).toEqual([]);
      const text = serializeCircuitFile(board, circuitId)!;
      const back = parseCircuitFile(text);
      expect(back.ok && back.file.circuits.map((c) => ({ ...c, id: s.id })), s.id).toEqual(s.file.circuits);
      const saved = parseBoard(serializeBoard(board));
      expect(saved.ok && saved.board.circuits, s.id).toEqual(board.circuits);
    }
  });

  it('adding the same starter twice keeps both, the second under a numbered name', () => {
    const { board } = boardWith('den-nhay');
    const again = importCircuitFile(board, starter('den-nhay').file);
    expect(again.ok && again.board.circuits!.map((c) => c.name)).toEqual(['Đèn nháy', 'Đèn nháy 2']);
  });

  it('"Đèn nháy" on the bench: stays off while "Bật" is off, flips once per 0.5 s beat while it is on', () => {
    const { board, circuitId } = boardWith('den-nhay');
    const plan = benchPlan(board, circuitId);
    const lit = plan.outputs.find((o) => o.pin.label === 'Đang sáng')!.port!;
    const run = start(plan.graph, board.mode);
    const seen: boolean[] = [];
    const watch = (): void => void seen.push(run.rt.getOutput(lit.node, lit.port) === true);
    run.play(2, [], watch);
    expect(seen.some(Boolean)).toBe(false);
    seen.length = 0;
    run.play(3, [benchKey('p1')], watch);
    const flips = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length;
    // One flip per 0.5 s beat (30 ticks): 6 in three seconds, the last one on the very last tick.
    expect(flips).toBe(6);
    expect(seen.filter(Boolean).length).toBeGreaterThan(60);
    expect(seen.filter((v) => !v).length).toBeGreaterThan(60);
    run.world.dispose?.();
  });

  it('"Đèn nháy" as copies on a board: each copy blinks at its own opened beat', () => {
    const { board, circuitId } = boardWith('den-nhay');
    const main: Board = {
      ...board,
      graph: {
        ...board.graph,
        nodes: [node('batdau', 'on-start'), copyOf('nhanh', circuitId), copyOf('cham', circuitId, { x: 0, z: 0 }, { e1: 1 })],
        wires: [wire('w1', 'batdau.started', 'nhanh.p1'), wire('w2', 'batdau.started', 'cham.p1')],
      },
    };
    expect(validateCircuits(main)).toEqual([]);
    const run = start(runnableGraph(main), main.mode);
    const flips = { nhanh: 0, cham: 0 };
    const last = { nhanh: false, cham: false };
    run.play(4, [], () => {
      for (const id of ['nhanh', 'cham'] as const) {
        const on = run.rt.getOutput(`${id}/den`, 'on') === true;
        if (on !== last[id]) flips[id]++;
        last[id] = on;
      }
    });
    // Four seconds: 8 beats of 0.5 s, 4 beats of 1 s.
    expect(flips).toEqual({ nhanh: 8, cham: 4 });
    run.world.dispose?.();
  });

  for (const real of [true, false]) {
    it(`"Xe hai bánh tới mốc" on the bench (${real ? 'Vật lý thật' : 'vật lý thường'}): stands still until "Chạy" is on, then drives to the bench marker and reports "Đã tới"`, { timeout: 120_000 }, () => {
      const { board, circuitId } = boardWith('xe-toi-moc', real);
      const plan = benchPlan(board, circuitId);
      expect(plan.inputs.map((i) => [i.pin.label, i.drive.by])).toEqual([
        ['Mốc đích', 'card'],
        ['Chạy', 'switch'],
      ]);
      const out = (label: string) => {
        const port = plan.outputs.find((o) => o.pin.label === label)!.port!;
        return run.rt.getOutput(port.node, port.port);
      };
      const run = start(plan.graph, board.mode);
      const cart = () => run.world.entities().find((e) => e.ownerNodeId === 'than')!;
      run.play(1, []);
      expect(Math.hypot(cart().position.x, cart().position.z)).toBeLessThan(0.05);
      expect(out('Đã tới')).toBe(false);
      expect(Number(out('Còn cách'))).toBeCloseTo(5, 1);
      let arrivedAt = -1;
      run.play(30, [benchKey('p2')], (tick) => {
        if (arrivedAt < 0 && out('Đã tới') === true) arrivedAt = tick;
      });
      expect(arrivedAt).toBeGreaterThan(0);
      expect(Math.hypot(cart().position.x - 4, cart().position.z - 3)).toBeLessThan(0.15);
      expect(out('Thân xe')).toBe(cart().id);
      run.world.dispose?.();
    });
  }

  it('"Xe hai bánh tới mốc" as two copies on a real board: each starts where its copy says and drives to the marker wired to it; the bench floor and marker are not there', { timeout: 120_000 }, () => {
    const { board, circuitId } = boardWith('xe-toi-moc', true);
    const main: Board = {
      ...board,
      graph: {
        ...board.graph,
        nodes: [
          node('san', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 } }),
          node('batdau', 'on-start'),
          node('moc1', 'floor-marker', { number: 1, position: { x: -5, y: 0, z: 2 } }),
          node('moc2', 'floor-marker', { number: 2, position: { x: 6, y: 0, z: -4 } }),
          copyOf('xe1', circuitId, { x: 0, z: 0 }, { e1: { x: 2, y: 0.15, z: 1 } }),
          copyOf('xe2', circuitId, { x: 0, z: 0 }, { e1: { x: -2, y: 0.15, z: -6 }, e2: '#ff7f7f' }),
        ],
        wires: [wire('w1', 'moc1.self', 'xe1.p1'), wire('w2', 'batdau.started', 'xe1.p2'), wire('w3', 'moc2.self', 'xe2.p1'), wire('w4', 'batdau.started', 'xe2.p2')],
      },
    };
    expect(validateCircuits(main)).toEqual([]);
    const flat = runnableGraph(main);
    expect(flat.nodes.some((n) => n.id.includes('san-thu') || n.id.includes('moc-thu'))).toBe(false);
    const run = start(flat, main.mode);
    const cart = (id: string) => run.world.entities().find((e) => e.ownerNodeId === `${id}/than`)!;
    run.play(0.1, []);
    expect(Math.hypot(cart('xe1').position.x - 2, cart('xe1').position.z - 1)).toBeLessThan(0.05);
    expect(cart('xe2').color).toBe('#ff7f7f');
    run.play(40, []);
    expect(Math.hypot(cart('xe1').position.x + 5, cart('xe1').position.z - 2)).toBeLessThan(0.15);
    expect(Math.hypot(cart('xe2').position.x - 6, cart('xe2').position.z + 4)).toBeLessThan(0.15);
    expect(run.rt.getOutput('xe1/lai', 'arrived')).toBe(true);
    expect(run.rt.getOutput('xe2/lai', 'arrived')).toBe(true);
    run.world.dispose?.();
  });
});
