import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { TICK_DT, type Board, type Graph, type PortRef } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { ROBOT_NAV_SOLUTION_WIRES } from '../../src/handbook/boards-robot-nav';
import { HANDBOOK_ROBOT_NAV } from '../../src/handbook/content-robot-nav';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const sorted = (a: Iterable<string>): string[] => [...a].sort();
const one = (g: Graph, kind: string, where: (n: Graph['nodes'][number]) => boolean = () => true): string => g.nodes.find((n) => n.kind === kind && where(n))!.id;

interface Played {
  out: (id: string, port: string) => unknown;
  /** Where the robot chassis is now. */
  robot: () => { x: number; z: number };
  run: (seconds: number, keys?: string[]) => void;
  set: (id: string, params: Record<string, number>) => void;
}

/** Plays a shipped board the way the app does when its switch is off: plain world, no crate engine. */
function play(board: Board, graph: Graph = board.graph): Played {
  const world = createWorld(board.mode);
  const rt = createRuntime(graph, world, board.mode);
  return {
    out: (id, port) => rt.getOutput(id, port),
    robot: () => {
      const e = world.entities().find((v) => v.kind === 'robot')!;
      return { x: e.position.x, z: e.position.z };
    },
    run: (seconds, keys = []) => {
      for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
        rt.tick({ keysDown: new Set(keys) });
        world.step(TICK_DT);
      }
    },
    set: (id, params) => {
      expect(rt.applyNodeParams(id, params)).toBe(true);
    },
  };
}

const off = (p: { x: number; z: number }, x: number, z: number): number => Math.hypot(p.x - x, p.z - z);

describe('handbook pages of the robot navigation pieces', () => {
  it('covers the four kinds', () => {
    expect(sorted(HANDBOOK_ROBOT_NAV.map((e) => e.kind))).toEqual(['floor-marker', 'floor-marker-find', 'floor-marker-sensor', 'robot-goto']);
  });

  for (const entry of HANDBOOK_ROBOT_NAV) {
    it(`${entry.kind}: explains every port and param, points at a lesson, and its try board is a tidy saved board`, () => {
      const def = getNodeDef(entry.kind)!;
      expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
      expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
      for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) {
        expect(t.trim().length).toBeGreaterThan(0);
      }
      expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
      const board = entry.tryBoard();
      expect(board.mode).toBe('2d-top');
      expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
      expect(parseBoard(serializeBoard(board)).ok).toBe(true);
      // Already clean at the biggest card size: opening it moves nothing.
      expect(relayoutShipped(board)).toBe(board);
    });
  }
});

describe('try boards', () => {
  it('Đi tới điểm: the robot turns, drives to marker 1 and stops on it; "Còn cách" falls to almost nothing', () => {
    const board = handbookEntry('robot-goto')!.tryBoard();
    const drive = one(board.graph, 'robot-goto');
    const p = play(board);
    p.run(0.1);
    expect(p.out(drive, 'distance') as number).toBeGreaterThan(9);
    p.run(15);
    expect(p.out(drive, 'arrived')).toBe(true);
    expect(off(p.robot(), 4, 3)).toBeLessThanOrEqual(0.1);
    expect(p.out(drive, 'distance') as number).toBeLessThanOrEqual(0.1);
    const there = p.robot();
    p.run(3);
    expect(p.robot()).toEqual(there);
  });

  it('Đi tới điểm, anti-forced: without the two power wires the robot stays where it is', () => {
    const board = handbookEntry('robot-goto')!.tryBoard();
    const drive = one(board.graph, 'robot-goto');
    const cut: Graph = { ...board.graph, wires: board.graph.wires.filter((w) => !(w.from.node === drive && (w.from.port === 'left' || w.from.port === 'right'))) };
    expect(cut.wires.length).toBe(board.graph.wires.length - 2);
    const p = play(board, cut);
    const from = p.robot();
    p.run(10);
    expect(p.robot()).toEqual(from);
    expect(p.out(drive, 'arrived')).toBe(false);
  });

  it('Mốc sàn: the two numbers on screen are where the robot stops', () => {
    const board = handbookEntry('floor-marker')!.tryBoard();
    const mark = one(board.graph, 'floor-marker');
    const p = play(board);
    p.run(15);
    expect([p.out(mark, 'x'), p.out(mark, 'z'), p.out(mark, 'number')]).toEqual([3, -2, 5]);
    expect(off(p.robot(), 3, -2)).toBeLessThanOrEqual(0.1);
  });

  it('Đọc mốc sàn: driving forward with the up arrow the read-out goes 0, 1, 0', () => {
    const board = handbookEntry('floor-marker-sensor')!.tryBoard();
    const reader = one(board.graph, 'floor-marker-sensor');
    const p = play(board);
    const seen: number[] = [];
    for (let k = 0; k < 6 * 60; k++) {
      p.run(TICK_DT, ['ArrowUp']);
      const n = p.out(reader, 'number') as number;
      if (seen.at(-1) !== n) seen.push(n);
    }
    expect(seen).toEqual([0, 1, 0]);
    expect(p.robot().x).toBeGreaterThan(0);
  });

  it('Tìm mốc sàn: the number card picks the marker; changed while running the robot goes to the new one; an unknown number makes it wait', () => {
    const board = handbookEntry('floor-marker-find')!.tryBoard();
    const wanted = one(board.graph, 'const');
    const find = one(board.graph, 'floor-marker-find');
    const reader = one(board.graph, 'floor-marker-sensor');
    const p = play(board);
    p.run(15);
    expect(off(p.robot(), 5, -3)).toBeLessThanOrEqual(0.1);
    expect(p.out(reader, 'number')).toBe(2);
    p.set(wanted, { value: 1 });
    p.run(12);
    expect(off(p.robot(), 0, 0)).toBeLessThanOrEqual(0.1);
    expect(p.out(reader, 'number')).toBe(1);
    p.set(wanted, { value: 7 });
    p.run(5);
    expect(p.out(find, 'found')).toBe(false);
    expect(off(p.robot(), 0, 0)).toBeLessThanOrEqual(0.1);
    p.set(wanted, { value: 3 });
    p.run(12);
    expect(off(p.robot(), 5, 3)).toBeLessThanOrEqual(0.1);
  });
});

describe('lesson "Robot tự tới mốc" (robot-to-marker)', () => {
  const p = (node: string, port: string): PortRef => ({ node, port });

  it('is registered once, last in the Robot chapter, ends on an info step and has unique step ids', () => {
    const lesson = findLesson('robot-to-marker')!;
    expect(LESSONS.filter((l) => l.id === 'robot-to-marker')).toHaveLength(1);
    expect(chapterOf('robot-to-marker')?.id).toBe('robots');
    expect(chapterOf('robot-to-marker')?.lessonIds.at(-1)).toBe('robot-to-marker');
    expect(lesson.steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson.steps.map((s) => s.id)).size).toBe(lesson.steps.length);
  });

  it('starts without the driver, the lookup and the reader, with tidy cards, and the robot does not move', () => {
    const board = findLesson('robot-to-marker')!.createBoard();
    expect(board.mode).toBe('2d-top');
    expect(board.graph.nodes.some((n) => ['robot-goto', 'floor-marker-find', 'floor-marker-sensor'].includes(n.kind))).toBe(false);
    expect(board.graph.nodes.filter((n) => n.kind === 'floor-marker').map((n) => n.params.number)).toEqual([2, 3]);
    expect(relayoutShipped(board)).toBe(board);
    const run = play(board);
    const from = run.robot();
    run.run(8);
    expect(run.robot()).toEqual(from);
  });

  it('can be solved step by step, and the finished board drives the robot to the marker the number names', () => {
    const lesson = findLesson('robot-to-marker')!;
    const state = createEditorState(lesson.createBoard());
    const runner = createRunner(lesson);
    const look = (playing = false): void => {
      runner.evaluate({ ...takeSnapshot(state, null), playing });
    };
    const step = (): string => runner.step().id;
    const g = (): Graph => state.getGraph();
    const connect = (from: PortRef, to: PortRef): void => {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      look();
    };
    const body = one(g(), 'robot-body');
    const motor = (side: 'left' | 'right'): string => one(g(), 'motor', (n) => (side === 'left' ? (n.params.side as number) < 0 : (n.params.side as number) > 0));

    look();
    expect(step()).toBe('intro');
    runner.next();
    expect(step()).toBe('add-marker');
    state.addNode('floor-marker', { x: 320, y: 640 });
    look();
    expect(step()).toBe('add-find');
    const find = state.addNode('floor-marker-find', { x: 320, y: 300 })!;
    look();
    expect(step()).toBe('wire-number');
    connect(p(one(g(), 'const'), 'value'), p(find, 'number'));
    expect(step()).toBe('add-drive');
    const drive = state.addNode('robot-goto', { x: 620, y: 20 })!;
    look();
    expect(step()).toBe('wire-robot');
    connect(p(body, 'self'), p(drive, 'robot'));
    expect(step()).toBe('wire-target');
    connect(p(find, 'marker'), p(drive, 'target'));
    expect(step()).toBe('wire-go');
    connect(p(one(g(), 'on-start'), 'started'), p(drive, 'go'));
    expect(step()).toBe('wire-left');
    // The left output on the right motor does not count.
    connect(p(drive, 'left'), p(motor('right'), 'power'));
    expect(step()).toBe('wire-left');
    connect(p(drive, 'left'), p(motor('left'), 'power'));
    expect(step()).toBe('wire-right');
    connect(p(drive, 'right'), p(motor('right'), 'power'));
    expect(step()).toBe('play-1');
    look(true);
    expect(step()).toBe('add-reader');
    const reader = state.addNode('floor-marker-sensor', { x: 920, y: 480 })!;
    look();
    expect(step()).toBe('wire-who');
    connect(p(body, 'self'), p(reader, 'who'));
    expect(step()).toBe('wire-show');

    const snap = takeSnapshot(state, null);
    for (const st of lesson.steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);

    connect(p(reader, 'number'), p(one(g(), 'show-number'), 'value'));
    expect(step()).toBe('play-2');
    look(true);
    expect(step()).toBe('done');

    // The learner drew exactly the wires the handbook board adds, and the cards landed where nothing overlaps.
    expect(g().wires.length).toBe(lesson.createBoard().graph.wires.length + ROBOT_NAV_SOLUTION_WIRES.length);
    const finished: Board = { ...lesson.createBoard(), graph: g() };
    expect(relayoutShipped(finished)).toBe(finished);
    const run = play(finished);
    run.run(15);
    expect(off(run.robot(), 5, -3)).toBeLessThanOrEqual(0.1);
    expect(run.out(reader, 'number')).toBe(2);
    // The marker the learner added is number 1, in the middle of the floor.
    run.set(one(g(), 'const'), { value: 1 });
    run.run(12);
    expect(off(run.robot(), 0, 0)).toBeLessThanOrEqual(0.1);
    expect(run.out(reader, 'number')).toBe(1);
  });
});
