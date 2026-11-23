import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type GameResult, type Graph, type PortRef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { chapterOf } from '../../src/tutorial/course';
import { ORANGE, CROSS, CROSS_LOSE_TEXT, CROSS_WIN_TEXT, GREEN, cellPlace, crossingSecondRobotY, crossingSolutionNodes } from '../../src/tutorial/grid-lesson-scenes';
import { LESSONS, findLesson } from '../../src/tutorial/lessons';
import { createRunner, type Runner } from '../../src/tutorial/runner';
import { takeSnapshot } from '../../src/tutorial/snapshot';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const ID = 'two-robots-one-cell';
const p = (node: string, port: string): PortRef => ({ node, port });
const lesson = () => findLesson(ID)!;

/** The cards of the two robots on the lesson board, found the way a learner tells them apart: colour, and upper or lower band. */
function cards(g: Graph) {
  const upper = (n: Graph['nodes'][number]): boolean => n.pos.y < crossingSecondRobotY();
  const pick = (kind: string, k: 1 | 2): string => g.nodes.find((n) => n.kind === kind && upper(n) === (k === 1))!.id;
  const body = (color: string): string => g.nodes.find((n) => n.kind === 'robot-body' && n.params.color === color)!.id;
  return {
    body: { 1: body(ORANGE), 2: body(GREEN) },
    route: { 1: pick('grid-route', 1), 2: pick('grid-route', 2) },
    find: { 1: pick('floor-marker-find', 1), 2: pick('floor-marker-find', 2) },
  };
}

interface Run {
  ended: GameResult | null;
  message: string | null;
  seconds: number;
  /** Where the orange and the green chassis are at the end. */
  orange: { x: number; z: number };
  green: { x: number; z: number };
  /** Smallest distance between the two chassis middles over the run (m). */
  nearest: number;
  /** Most robots whose middle was inside the crossing cell on one tick. */
  mostInCrossing: number;
  /** Seconds the hold card said "Robot 2 đang chờ ô". */
  greenWaited: number;
}

/** Plays a graph on the lesson's board the way the app does, until the game ends or the time is up. */
function play(board: Board, graph: Graph, seconds: number): Run {
  const world = createWorld(board.mode);
  const rt = createRuntime(graph, world, board.mode);
  const c = cards(graph);
  const hold = graph.nodes.find((n) => n.kind === 'cell-hold')?.id;
  const chassis = (color: string) => world.entities().find((e) => e.kind === 'robot' && e.color === color)!.position;
  const mid = cellPlace(CROSS.cell);
  const inCrossing = (at: { x: number; z: number }): boolean => Math.abs(at.x - mid.x) < 0.7 && Math.abs(at.z - mid.z) < 0.7;
  let nearest = Infinity;
  let mostInCrossing = 0;
  let waited = 0;
  let ticks = 0;
  expect(c.body[1]).not.toBe(c.body[2]);
  for (; ticks < Math.round(seconds / TICK_DT) && !world.ended; ticks++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const a = chassis(ORANGE);
    const b = chassis(GREEN);
    nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.z - b.z));
    mostInCrossing = Math.max(mostInCrossing, Number(inCrossing(a)) + Number(inCrossing(b)));
    if (hold && rt.getOutput(hold, 'wait2') === true) waited += TICK_DT;
  }
  const xz = (v: { x: number; z: number }) => ({ x: v.x, z: v.z });
  return {
    ended: world.ended?.result ?? null,
    message: world.ended?.message ?? null,
    seconds: ticks * TICK_DT,
    orange: xz(chassis(ORANGE)),
    green: xz(chassis(GREEN)),
    nearest,
    mostInCrossing,
    greenWaited: waited,
  };
}

const off = (at: { x: number; z: number }, cell: number): number => Math.hypot(at.x - cellPlace(cell).x, at.z - cellPlace(cell).z);

/** The six wires of the solution, in the order the lesson asks for them. */
function solutionWires(g: Graph, hold: string): [PortRef, PortRef][] {
  const c = cards(g);
  return ([1, 2] as const).flatMap((k): [PortRef, PortRef][] => [
    [p(c.body[k], 'self'), p(hold, `robot${k}`)],
    [p(c.route[k], 'next'), p(hold, `want${k}`)],
    [p(hold, `cell${k}`), p(c.find[k], 'number')],
  ]);
}

/** The lesson solved by an editor, leaving out the wires whose index is listed. */
function solved(skip: readonly number[] = []): { board: Board; graph: Graph; hold: string } {
  const board = lesson().createBoard();
  const state = createEditorState(board);
  const spot = crossingSolutionNodes()[0]!;
  const hold = state.addNode('cell-hold', { x: spot.x, y: spot.y })!;
  solutionWires(board.graph, hold).forEach(([from, to], i) => {
    if (!skip.includes(i)) expect(state.connect(from, to, { replace: true })).toEqual({ ok: true });
  });
  return { board, graph: state.getGraph(), hold };
}

/** A runner taken through the first run (which is lost) and then shown this graph in a new run that ends with `ended`. */
function runnerOn(graph: Graph, ended: GameResult | null): Runner {
  const start = createEditorState(lesson().createBoard());
  const state = createEditorState({ ...lesson().createBoard(), graph });
  const runner = createRunner(lesson());
  runner.next();
  runner.evaluate({ ...takeSnapshot(start, null), playing: true });
  runner.evaluate({ ...takeSnapshot(start, 'lose'), playing: true });
  expect(runner.step().id).toBe('add-hold');
  runner.evaluate({ ...takeSnapshot(state, null), playing: false });
  runner.evaluate({ ...takeSnapshot(state, null), playing: true });
  runner.evaluate({ ...takeSnapshot(state, ended), playing: true });
  return runner;
}

describe('lesson "Hai robot, một ô"', () => {
  it('is registered once, in the Robot chapter right before sharing jobs, ends on an info step and has unique step ids', () => {
    expect(LESSONS.filter((l) => l.id === ID)).toHaveLength(1);
    expect(chapterOf(ID)?.id).toBe('robots');
    expect(chapterOf(ID)?.lessonIds.slice(-3)).toEqual(['grid-find-way', 'two-robots-one-cell', 'share-jobs']);
    expect(lesson().steps.at(-1)!.check).toBeUndefined();
    expect(new Set(lesson().steps.map((s) => s.id)).size).toBe(lesson().steps.length);
    for (const s of lesson().steps) expect(`${s.title}${s.text}`.trim().length, s.id).toBeGreaterThan(10);
  });

  it('starts with two robots that find their way, no hold card, tidy cards, and the run shows the problem: they meet in the crossing cell', () => {
    const board = lesson().createBoard();
    expect(board.mode).toBe('2d-top');
    expect(board.graph.nodes.some((n) => n.kind === 'cell-hold')).toBe(false);
    expect(board.graph.nodes.filter((n) => n.kind === 'grid-route')).toHaveLength(2);
    expect(board.graph.nodes.filter((n) => n.kind === 'floor-marker').map((n) => n.params.number)).toEqual([2, 4, 5, 6, 8]);
    expect(relayoutShipped(board)).toBe(board);
    const run = play(board, board.graph, 30);
    expect(run.ended).toBe('lose');
    expect(run.message).toBe(CROSS_LOSE_TEXT);
    // Both noses in the crossing cell: the chassis (0.9 m long, 0.7 m wide, at right angles) overlap from 0.8 m on each axis.
    expect(run.nearest).toBeLessThan(Math.hypot(0.8, 0.8));
    expect(run.nearest).toBeGreaterThan(1);
  });

  it('can be solved step by step with one card and six wires, and the run of the finished board completes it', () => {
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
    const c = cards(g());

    look();
    expect(step()).toBe('intro');
    runner.next();
    expect(step()).toBe('play-1');
    look(true);
    expect(step()).toBe('crash');
    // The step waits for what the board itself does: the run of the untouched board is lost.
    ended = play(board, g(), 30).ended;
    expect(ended).toBe('lose');
    look(true);
    expect(step()).toBe('add-hold');
    // Back in the editor.
    ended = null;
    const spot = crossingSolutionNodes()[0]!;
    const hold = state.addNode('cell-hold', { x: spot.x, y: spot.y })!;
    look();
    expect(step()).toBe('wire-robot-1');
    connect(p(c.body[1], 'self'), p(hold, 'robot1'));
    expect(step()).toBe('wire-want-1');
    // The other robot's route finder on this robot's row does not count.
    connect(p(c.route[2], 'next'), p(hold, 'want1'));
    expect(step()).toBe('wire-want-1');
    connect(p(c.route[1], 'next'), p(hold, 'want1'));
    expect(step()).toBe('wire-cell-1');
    // Neither does the permission of another row.
    connect(p(hold, 'cell2'), p(c.find[1], 'number'));
    expect(step()).toBe('wire-cell-1');
    connect(p(hold, 'cell1'), p(c.find[1], 'number'));
    expect(step()).toBe('wire-robot-2');

    const snap = takeSnapshot(state, null);
    for (const st of lesson().steps) if (st.target) expect(st.target(snap).length, st.id).toBeGreaterThan(0);

    connect(p(c.body[2], 'self'), p(hold, 'robot2'));
    expect(step()).toBe('wire-want-2');
    connect(p(c.route[2], 'next'), p(hold, 'want2'));
    expect(step()).toBe('wire-cell-2');
    connect(p(hold, 'cell2'), p(c.find[2], 'number'));
    expect(step()).toBe('play-2');
    look(true);
    expect(step()).toBe('win');
    look(true);
    expect(step()).toBe('win');

    // One card, six wires drawn, two old wires replaced; the cards landed where nothing overlaps.
    expect(g().nodes.length).toBe(board.graph.nodes.length + 1);
    expect(g().wires.length).toBe(board.graph.wires.length + 6 - 2);
    const finished: Board = { ...board, graph: g() };
    expect(relayoutShipped(finished)).toBe(finished);

    const run = play(finished, g(), 60);
    expect(run.ended).toBe('win');
    expect(run.message).toBe(CROSS_WIN_TEXT);
    expect(off(run.orange, CROSS.goal1)).toBeLessThanOrEqual(0.2);
    expect(off(run.green, CROSS.goal2)).toBeLessThanOrEqual(0.2);
    // Only one robot in the crossing cell at a time, and the chassis never came near each other.
    expect(run.mostInCrossing).toBe(1);
    expect(run.nearest).toBeGreaterThan(1.3);
    expect(run.greenWaited).toBeGreaterThan(1);
    ended = run.ended;
    look(true);
    expect(step()).toBe('done');
    expect(runner.isLast()).toBe(true);
  });

  it('is not complete without the wire "Ô robot 2 được đi": the green robot never leaves its cell and the steps stop there', () => {
    const { board, graph } = solved([5]);
    // The old wire into the lookup is still there in this case; taken off as well, nothing tells the robot where to go.
    const c = cards(graph);
    const cut: Graph = { ...graph, wires: graph.wires.filter((w) => !(w.to.node === c.find[2] && w.to.port === 'number')) };
    expect(cut.wires.length).toBe(graph.wires.length - 1);
    const run = play(board, cut, 30);
    expect(run.ended).toBeNull();
    expect(off(run.green, CROSS.start2)).toBe(0);
    expect(off(run.orange, CROSS.goal1)).toBeLessThanOrEqual(0.2);
    expect(runnerOn(cut, run.ended).step().id).toBe('wire-cell-2');
    expect(runnerOn(cut, 'win').step().id).toBe('wire-cell-2');
    // With the old wire left in place the green robot drives without asking: still not complete.
    expect(runnerOn(graph, 'win').step().id).toBe('wire-cell-2');
  });

  it('is not complete without each of the other wires, whatever the run does', () => {
    // The steps count robots, whichever is wired first: with one robot complete, the lesson waits at the step of the
    // second robot that matches the missing wire (wires 0-2 are the orange robot's, 3-4 the green one's).
    const stuck = ['wire-robot-2', 'wire-want-2', 'wire-cell-2', 'wire-robot-2', 'wire-want-2'];
    stuck.forEach((id, i) => {
      const { graph } = solved([i]);
      expect(runnerOn(graph, 'win').step().id, `wire ${i}`).toBe(id);
      expect(runnerOn(graph, 'win').isFinished(), `wire ${i}`).toBe(false);
    });
  });

  it('a robot the hold card does not know is run into: the board itself says the lesson is lost', () => {
    const { board, graph, hold } = solved();
    const c = cards(graph);
    // Robot 2 keeps its own route (old wiring) and is not on the card at all.
    const state = createEditorState({ ...board, graph });
    expect(state.connect(p(c.route[2], 'next'), p(c.find[2], 'number'), { replace: true })).toEqual({ ok: true });
    const g = state.getGraph();
    const unknown: Graph = { ...g, wires: g.wires.filter((w) => !(w.to.node === hold && (w.to.port === 'robot2' || w.to.port === 'want2'))) };
    expect(unknown.wires.length).toBe(g.wires.length - 2);
    const run = play(board, unknown, 30);
    expect(run.ended).toBe('lose');
    expect(runnerOn(unknown, run.ended).step().id).toBe('wire-robot-2');
  });
});
