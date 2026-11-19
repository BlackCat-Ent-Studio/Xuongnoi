import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { TICK_DT, type Board, type Graph, type PortRef } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { SECOND_MACHINE_Y, SHARE_JOBS_SOLUTION_WIRES, spawnerClassBoard } from '../../src/handbook/boards-memory-dispatch';
import { HANDBOOK_MEMORY_DISPATCH } from '../../src/handbook/content-memory-dispatch';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';
import { firstCardOverlap } from '../helpers/cell-run';

registerAllNodes();

const sorted = (a: Iterable<string>): string[] => [...a].sort();
const one = (g: Graph, kind: string, where: (n: Graph['nodes'][number]) => boolean = () => true): string => g.nodes.find((n) => n.kind === kind && where(n))!.id;

/** Plays a graph and calls `each` after every tick with a reader of card outputs. */
function play(board: Board, graph: Graph, seconds: number, keys: (tick: number) => string[], each: (out: (id: string, port: string) => unknown, tick: number) => void): ReturnType<typeof createWorld> {
  const world = createWorld(board.mode);
  const rt = createRuntime(graph, world, board.mode);
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set(keys(i)) });
    world.step(TICK_DT);
    each((id, port) => rt.getOutput(id, port), i);
  }
  return world;
}

describe('handbook pages of Nhớ số and Bộ điều phối', () => {
  it('covers the two kinds', () => {
    expect(sorted(HANDBOOK_MEMORY_DISPATCH.map((e) => e.kind))).toEqual(['dispatcher', 'sample-hold']);
  });

  for (const entry of HANDBOOK_MEMORY_DISPATCH) {
    it(`${entry.kind}: explains every port and param, points at a lesson, and its try board is a tidy saved board`, () => {
      const def = getNodeDef(entry.kind)!;
      expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
      expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
      for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) {
        expect(t.trim().length).toBeGreaterThan(0);
      }
      expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      const board = entry.tryBoard();
      expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
      expect(parseBoard(serializeBoard(board)).ok).toBe(true);
      expect(firstCardOverlap({ ...board, notes: [] })).toBeNull();
    });
  }

  it('the spawner page explains its class settings and outputs', () => {
    const entry = handbookEntry('spawner')!;
    const def = getNodeDef('spawner')!;
    expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
    for (const id of ['lastClass', 'lastMass']) expect(entry.ports[id]?.length, id).toBeGreaterThan(0);
  });
});

describe('try board of Nhớ số', () => {
  it('E stores the seconds left at that moment, the clock runs on, Q clears', () => {
    const board = handbookEntry('sample-hold')!.tryBoard();
    const g = board.graph;
    const memory = one(g, 'sample-hold');
    const clock = one(g, 'timer');
    const held: number[] = [];
    const left: number[] = [];
    play(board, g, 6, (t) => (t === 120 ? ['KeyE'] : t === 300 ? ['KeyQ'] : []), (out) => {
      held.push(out(memory, 'held') as number);
      left.push(out(clock, 'left') as number);
    });
    expect(held[119]).toBe(0);
    expect(held[120]).toBeCloseTo(left[120]!, 9);
    expect(held[120]).toBeCloseTo(10 - 121 / 60, 6);
    expect(held[299]).toBe(held[120]);
    expect(left[299]).toBeLessThan(held[299]! - 2);
    expect(held[300]).toBe(0);
  });
});

interface Shared {
  /** Machine (1 or 2) of each hand-over, in order. */
  order: number[];
  /** Ticks on which a machine got a job while its latch was still on. */
  doubled: number;
  jobs: number;
  /** Per hand-over to machine 1: the door number of the newest job at that tick and the remembered one. */
  doors: { fresh: number; kept: number }[];
  /** Ticks on which the memory differed from the newest door number. */
  heldApart: number;
  waited: boolean;
}

function shareJobs(board: Board, graph: Graph, seconds = 20): Shared {
  const disp = one(graph, 'dispatcher');
  const memory = graph.nodes.find((n) => n.kind === 'sample-hold')?.id;
  const door = one(graph, 'random');
  const clock = one(graph, 'timer', (n) => n.params.repeat === 'yes');
  const latch = [1, 2].map((k) => one(graph, 'latch', (n) => (k === 1 ? n.pos.y < SECOND_MACHINE_Y : n.pos.y >= SECOND_MACHINE_Y)));
  const r: Shared = { order: [], doubled: 0, jobs: 0, doors: [], heldApart: 0, waited: false };
  let busyBefore = [false, false];
  play(board, graph, seconds, () => [], (out) => {
    if (out(clock, 'done') === true) r.jobs += 1;
    for (const k of [1, 2]) {
      if (out(disp, `give${k}`) !== true) continue;
      r.order.push(k);
      if (busyBefore[k - 1]) r.doubled += 1;
      if (k === 1 && memory) r.doors.push({ fresh: out(door, 'value') as number, kept: out(memory, 'held') as number });
    }
    if (memory && out(memory, 'held') !== out(door, 'value')) r.heldApart += 1;
    if (out(disp, 'waiting') === true) r.waited = true;
    busyBefore = latch.map((id) => out(id, 'on') === true);
  });
  return r;
}

describe('try board of Bộ điều phối', () => {
  const board = handbookEntry('dispatcher')!.tryBoard();

  it('hands every job to machine 1 and 2 in turn, never to a working machine, and machine 1 remembers its own door', () => {
    const r = shareJobs(board, board.graph);
    expect(r.jobs).toBe(10);
    expect(r.order).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
    expect(r.doubled).toBe(0);
    expect(r.waited).toBe(false);
    for (const d of r.doors) expect(d.kept).toBe(d.fresh);
    // The memory really holds: for a good part of the run the newest door number is another one.
    expect(r.heldApart).toBeGreaterThan(120);
    expect(new Set(r.doors.map((d) => d.kept)).size).toBeGreaterThan(1);
  });

  it('with slow machines the jobs wait instead of getting lost, and "Máy rảnh đầu tiên" prefers machine 1', () => {
    const slow: Graph = { ...board.graph, nodes: board.graph.nodes.map((n) => (n.kind === 'timer' && n.params.repeat !== 'yes' ? { ...n, params: { ...n.params, seconds: 6 } } : n)) };
    const r = shareJobs(board, slow, 30);
    expect(r.waited).toBe(true);
    expect(r.doubled).toBe(0);
    // Two machines, 6 s per job: the first two at 2 s and 4 s, then one every 3 s on average.
    expect(r.order).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);

    const first: Graph = { ...board.graph, nodes: board.graph.nodes.map((n) => (n.kind === 'dispatcher' ? { ...n, params: { ...n.params, mode: 'first' } } : n.kind === 'timer' && n.params.repeat !== 'yes' ? { ...n, params: { ...n.params, seconds: 1 } } : n)) };
    const f = shareJobs(board, first);
    // Machine 1 is done after 1 s, before the next job: it takes them all.
    expect(f.order).toEqual(Array.from({ length: 10 }, () => 1));
    expect(f.doubled).toBe(0);
  });

  it('anti-forced: without the dispatcher wires no machine ever works', () => {
    const disp = one(board.graph, 'dispatcher');
    const cut: Graph = { ...board.graph, wires: board.graph.wires.filter((w) => !(w.from.node === disp && /^give\d$/.test(w.from.port))) };
    const latches = cut.nodes.filter((n) => n.kind === 'latch').map((n) => n.id);
    let worked = false;
    play(board, cut, 10, () => [], (out) => {
      if (latches.some((id) => out(id, 'on') === true)) worked = true;
    });
    expect(worked).toBe(false);
  });
});

describe('extra try board of Tạo đối tượng: random classes', () => {
  it('drops crates of three classes; the scale shows the mass of the class that was drawn, the same on every run', () => {
    const run = (): { cls: number; kg: number }[] => {
      const board = spawnerClassBoard();
      const maker = one(board.graph, 'spawner');
      const sensor = one(board.graph, 'force-sensor');
      const seen: { cls: number; kg: number }[] = [];
      play(board, board.graph, 20, () => [], (out, tick) => {
        // 1.5 s after each drop the crate rests on the scale.
        if (tick % 120 === 90 && tick > 120) seen.push({ cls: out(maker, 'lastClass') as number, kg: out(sensor, 'mass') as number });
      });
      return seen;
    };
    const seen = run();
    const masses = [1, 3, 6];
    expect(seen.length).toBeGreaterThanOrEqual(8);
    for (const s of seen) expect(s.kg).toBe(masses[s.cls - 1]);
    expect(new Set(seen.map((s) => s.cls)).size).toBe(3);
    expect(run()).toEqual(seen);
  });
});

describe('lesson "Chia việc cho hai máy" (share-jobs)', () => {
  const p = (node: string, port: string): PortRef => ({ node, port });

  it('is registered once, last in the Robot chapter, ends on an info step and has unique step ids', () => {
    const lesson = findLesson('share-jobs')!;
    expect(LESSONS.filter((l) => l.id === 'share-jobs')).toHaveLength(1);
    expect(chapterOf('share-jobs')?.id).toBe('robots');
    expect(chapterOf('share-jobs')?.lessonIds.at(-1)).toBe('share-jobs');
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((s) => s.id)).size).toBe(lesson.steps.length);
  });

  it('starts without the two new cards, with tidy cards, and nothing works yet', () => {
    const board = findLesson('share-jobs')!.createBoard();
    expect(board.graph.nodes.some((n) => n.kind === 'dispatcher' || n.kind === 'sample-hold')).toBe(false);
    expect(firstCardOverlap(board)).toBeNull();
    const latches = board.graph.nodes.filter((n) => n.kind === 'latch').map((n) => n.id);
    let worked = false;
    play(board, board.graph, 8, () => [], (out) => {
      if (latches.some((id) => out(id, 'on') === true)) worked = true;
    });
    expect(worked).toBe(false);
  });

  it('can be solved step by step, and the finished board shares the jobs', () => {
    const lesson = findLesson('share-jobs')!;
    const state = createEditorState(lesson.createBoard());
    const runner = createRunner(lesson);
    const look = (playing = false): void => {
      runner.evaluate({ ...takeSnapshot(state, null), playing });
    };
    const step = (): string => runner.step().id;
    const g = (): Graph => state.getGraph();
    const machine = (k: number) => (n: Graph['nodes'][number]) => (k === 1 ? n.pos.y < SECOND_MACHINE_Y : n.pos.y >= SECOND_MACHINE_Y);
    const connect = (from: PortRef, to: PortRef): void => {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      look();
    };

    look();
    expect(step()).toBe('intro');
    runner.next();
    expect(step()).toBe('add-dispatcher');
    const disp = state.addNode('dispatcher', { x: 300, y: 20 })!;
    look();
    expect(step()).toBe('wire-job');
    connect(p(one(g(), 'timer', (n) => n.params.repeat === 'yes'), 'done'), p(disp, 'job'));
    for (const k of [1, 2]) {
      const latch = one(g(), 'latch', machine(k));
      expect(step()).toBe(`wire-give-${k}`);
      connect(p(disp, `give${k}`), p(latch, 'set'));
      expect(step()).toBe(`wire-busy-${k}`);
      // The busy wire of the other machine does not count for this one.
      connect(p(one(g(), 'latch', machine(3 - k)), 'on'), p(disp, `busy${k}`));
      expect(step()).toBe(`wire-busy-${k}`);
      connect(p(latch, 'on'), p(disp, `busy${k}`));
    }
    expect(step()).toBe('play-1');
    look(true);
    expect(step()).toBe('add-memory');
    const memory = state.addNode('sample-hold', { x: 300, y: SECOND_MACHINE_Y })!;
    look();
    expect(step()).toBe('wire-value');
    connect(p(one(g(), 'random'), 'value'), p(memory, 'value'));
    expect(step()).toBe('wire-store');
    connect(p(disp, 'give1'), p(memory, 'store'));
    expect(step()).toBe('wire-show');

    const snap = takeSnapshot(state, null);
    for (const st of lesson.steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);

    connect(p(memory, 'held'), p(one(g(), 'show-number', (n) => n.params.label === 'Máy 1 chở tới cửa'), 'value'));
    expect(step()).toBe('play-2');
    look(true);
    expect(step()).toBe('done');

    // The learner drew exactly the wires the handbook board adds.
    expect(g().wires.length).toBe(lesson.createBoard().graph.wires.length + SHARE_JOBS_SOLUTION_WIRES.length);
    const r = shareJobs(lesson.createBoard(), g());
    expect(r.order).toEqual([1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
    expect(r.doubled).toBe(0);
    for (const d of r.doors) expect(d.kept).toBe(d.fresh);
  });
});
