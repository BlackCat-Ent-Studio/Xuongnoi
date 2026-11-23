import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type GameResult, type Graph, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { FIND_WAY_SOLUTION_WIRES, WAY_GOAL, WAY_PATH, WAY_START, WAY_WIN_TEXT, cellPlace, findWaySolutionNodes } from '../../src/tutorial/grid-lesson-scenes';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner, type Runner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const ID = 'grid-find-way';
const p = (node: string, port: string): PortRef => ({ node, port });
const one = (g: Graph, kind: string): string => g.nodes.find((n) => n.kind === kind)!.id;
const lesson = () => findLesson(ID)!;

interface Run {
  ended: GameResult | null;
  message: string | null;
  seconds: number;
  /** The cells the marker reader saw the robot on, in order, without repeats and without the gaps between cells. */
  cells: number[];
  robot: { x: number; z: number };
  /** Largest change of heading from the start (degrees). */
  turned: number;
}

/** Plays a graph on the lesson's board the way the app does, until the game ends or the time is up. */
function play(board: Board, graph: Graph, seconds: number): Run {
  const world = createWorld(board.mode);
  const rt = createRuntime(graph, world, board.mode);
  const reader = graph.nodes.find((n) => n.kind === 'floor-marker-sensor')?.id;
  const cells: number[] = [];
  const robot = () => world.entities().find((e) => e.kind === 'robot')!;
  let first: number | null = null;
  let turned = 0;
  let ticks = 0;
  for (; ticks < Math.round(seconds / TICK_DT) && !world.ended; ticks++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const cell = reader ? (rt.getOutput(reader, 'number') as number) : 0;
    if (cell > 0 && cells.at(-1) !== cell) cells.push(cell);
    const heading = robot().robot!.heading;
    first ??= heading;
    turned = Math.max(turned, (Math.abs(heading - first) * 180) / Math.PI);
  }
  const at = robot().position;
  return { ended: world.ended?.result ?? null, message: world.ended?.message ?? null, seconds: ticks * TICK_DT, cells, robot: { x: at.x, z: at.z }, turned };
}

/** A runner taken past the intro and shown this graph while the game runs and ends with `ended`. */
function runnerOn(graph: Graph, ended: GameResult | null): Runner {
  const state = createEditorState({ ...lesson().createBoard(), graph });
  const runner = createRunner(lesson());
  runner.next();
  runner.evaluate({ ...takeSnapshot(state, null), playing: true });
  runner.evaluate({ ...takeSnapshot(state, ended), playing: true });
  return runner;
}

/** The lesson solved by an editor: every card the learner adds and every wire the learner draws. */
function solved(): { board: Board; graph: Graph } {
  const board = lesson().createBoard();
  const state = createEditorState(board);
  const ids = new Map<string, string>([
    ['body', one(board.graph, 'robot-body')],
    ['goal', one(board.graph, 'const')],
    ['drive', one(board.graph, 'robot-goto')],
  ]);
  for (const n of findWaySolutionNodes()) ids.set(n.alias, state.addNode(n.kind, { x: n.x, y: n.y })!);
  for (const [fa, fp, ta, tp] of FIND_WAY_SOLUTION_WIRES) expect(state.connect(p(ids.get(fa)!, fp), p(ids.get(ta)!, tp), { replace: true })).toEqual({ ok: true });
  return { board, graph: state.getGraph() };
}

const without = (g: Graph, fromKind: string, fromPort: string, toKind: string, toPort: string): Graph => {
  const kind = (id: string) => g.nodes.find((n) => n.id === id)!.kind;
  const wires = g.wires.filter((w) => !(kind(w.from.node) === fromKind && w.from.port === fromPort && kind(w.to.node) === toKind && w.to.port === toPort));
  expect(wires.length).toBe(g.wires.length - 1);
  return { ...g, wires };
};

describe('lesson "Robot tự tìm đường trên lưới"', () => {
  it('is registered once, in the Robot chapter after the marker lesson and before sharing jobs, ends on an info step and has unique step ids', () => {
    expect(LESSONS.filter((l) => l.id === ID)).toHaveLength(1);
    expect(chapterOf(ID)?.id).toBe('robots');
    expect(chapterOf(ID)?.lessonIds.slice(-4)).toEqual(['robot-to-marker', 'grid-find-way', 'two-robots-one-cell', 'share-jobs']);
    expect(lesson().steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson().steps.map((s) => s.id)).size).toBe(lesson().steps.length);
    for (const s of lesson().steps) expect(`${s.title}${s.text}`.trim().length, s.id).toBeGreaterThan(10);
  });

  it('starts with the floor, a robot whose driver has no goal, tidy cards, and nothing moves or ends', () => {
    const board = lesson().createBoard();
    expect(board.mode).toBe('2d-top');
    const kinds = board.graph.nodes.map((n) => n.kind);
    for (const k of ['grid-route', 'floor-marker-find', 'floor-marker-sensor', 'cell-hold']) expect(kinds).not.toContain(k);
    expect(board.graph.nodes.filter((n) => n.kind === 'floor-marker').map((n) => n.params.number)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
    expect(board.graph.nodes.filter((n) => n.kind === 'floor-marker').every((n) => n.params.exits !== 'none')).toBe(true);
    expect(relayoutShipped(board)).toBe(board);
    const run = play(board, board.graph, 8);
    expect(run.ended).toBeNull();
    expect(run.robot).toEqual({ x: cellPlace(WAY_START).x, z: cellPlace(WAY_START).z });
  });

  it('can be solved step by step with cards and wires only, and the run of the finished board completes it', () => {
    const board = lesson().createBoard();
    const state = createEditorState(board);
    const runner = createRunner(lesson());
    let ended: GameResult | null = null;
    const look = (playing = false): void => {
      runner.evaluate({ ...takeSnapshot(state, ended), playing });
    };
    const step = (): string => runner.step().id;
    const g = (): Graph => state.getGraph();
    const connect = (from: PortRef, to: PortRef): void => {
      expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
      look();
    };
    const spot = new Map(findWaySolutionNodes().map((n) => [n.alias, { x: n.x, y: n.y }]));
    const add = (alias: string, kind: string): string => {
      const id = state.addNode(kind, spot.get(alias)!)!;
      look();
      return id;
    };
    const body = one(g(), 'robot-body');
    const goal = one(g(), 'const');
    const drive = one(g(), 'robot-goto');

    look();
    expect(step()).toBe('intro');
    // Pressing play on the untouched board passes nothing.
    look(true);
    expect(step()).toBe('intro');
    runner.next();
    expect(step()).toBe('add-reader');
    const reader = add('reader', 'floor-marker-sensor');
    expect(step()).toBe('wire-who');
    connect(p(body, 'self'), p(reader, 'who'));
    expect(step()).toBe('add-route');
    const route = add('route', 'grid-route');
    expect(step()).toBe('wire-at');
    connect(p(reader, 'number'), p(route, 'at'));
    expect(step()).toBe('wire-goal');
    connect(p(goal, 'value'), p(route, 'goal'));
    expect(step()).toBe('add-find');
    const find = add('find', 'floor-marker-find');
    expect(step()).toBe('wire-next');
    // The goal number straight into the lookup would send the robot across the floor, ignoring the arrows: it does not count.
    connect(p(goal, 'value'), p(find, 'number'));
    expect(step()).toBe('wire-next');
    connect(p(route, 'next'), p(find, 'number'));
    expect(step()).toBe('wire-target');

    const snap = takeSnapshot(state, null);
    for (const st of lesson().steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);

    connect(p(find, 'marker'), p(drive, 'target'));
    expect(step()).toBe('play');
    look(true);
    expect(step()).toBe('win');
    // Running alone is not enough: the step waits for the win that the cards on the board give.
    look(true);
    expect(step()).toBe('win');

    // The learner drew exactly the solution wires, and the cards landed where nothing overlaps.
    expect(g().wires.length).toBe(board.graph.wires.length + FIND_WAY_SOLUTION_WIRES.length);
    const finished: Board = { ...board, graph: g() };
    expect(relayoutShipped(finished)).toBe(finished);

    const run = play(finished, g(), 30);
    expect(run.ended).toBe('win');
    expect(run.message).toBe(WAY_WIN_TEXT);
    // It went along the arrows, through the short cut, and had to turn to get there.
    expect(run.cells).toEqual([WAY_START, ...WAY_PATH]);
    expect(run.turned).toBeGreaterThan(60);
    expect(Math.hypot(run.robot.x - cellPlace(WAY_GOAL).x, run.robot.z - cellPlace(WAY_GOAL).z)).toBeLessThanOrEqual(0.2);
    ended = run.ended;
    look(true);
    expect(step()).toBe('done');
    expect(runner.isLast()).toBe(true);
  });

  it('is not complete without the wire from "Ô kế tiếp": the robot never reaches the goal and the steps stop there', () => {
    const { board, graph } = solved();
    const cut = without(graph, 'grid-route', 'next', 'floor-marker-find', 'number');
    const run = play(board, cut, 30);
    expect(run.ended).toBeNull();
    expect(run.robot).toEqual({ x: cellPlace(WAY_START).x, z: cellPlace(WAY_START).z });
    expect(runnerOn(cut, run.ended).step().id).toBe('wire-next');
    // Even told the game was won, the lesson does not move on without that wire.
    expect(runnerOn(cut, 'win').step().id).toBe('wire-next');
  });

  it('is not complete when the goal number bypasses the route finder, even though the robot then reaches the goal cell', () => {
    const { board, graph } = solved();
    const state = createEditorState({ ...board, graph });
    expect(state.connect(p(one(graph, 'const'), 'value'), p(one(graph, 'floor-marker-find'), 'number'), { replace: true })).toEqual({ ok: true });
    const cheat = state.getGraph();
    const run = play(board, cheat, 30);
    expect(run.ended).toBe('win');
    // Straight across the floor: it never stood on the cells the arrows lead through.
    expect(run.cells).not.toEqual([WAY_START, ...WAY_PATH]);
    expect(runnerOn(cheat, run.ended).step().id).toBe('wire-next');
  });

  it('is not complete without each of the other wires the learner draws', () => {
    const { board, graph } = solved();
    const cuts: [string, string, string, string, string][] = [
      ['robot-body', 'self', 'floor-marker-sensor', 'who', 'wire-who'],
      ['floor-marker-sensor', 'number', 'grid-route', 'at', 'wire-at'],
      ['const', 'value', 'grid-route', 'goal', 'wire-goal'],
      ['floor-marker-find', 'marker', 'robot-goto', 'target', 'wire-target'],
    ];
    for (const [fk, fp, tk, tp, stuck] of cuts) {
      const cut = without(graph, fk, fp, tk, tp);
      const run = play(board, cut, 30);
      expect(run.ended, stuck).toBeNull();
      expect(runnerOn(cut, 'win').step().id).toBe(stuck);
    }
  });
});
