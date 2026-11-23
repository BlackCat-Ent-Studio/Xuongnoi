import { describe, expect, it } from 'vitest';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { TICK_DT } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { TRY_DECK_GOAL, TRY_DECK_HOLE, TRY_DECK_TOP } from '../../src/handbook/boards-raised-deck';
import { HANDBOOK_RAISED_DECK } from '../../src/handbook/content-raised-deck';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { RAISED_DECK_LOOK } from '../../src/nodes/raised-deck';
import { COVERS, createCoursePackM } from '../../src/tutorial/course-pack-m';
import { findLesson } from '../../src/tutorial/lessons';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';

registerAllNodes();

const sorted = (a: Iterable<string>): string[] => [...a].sort();

describe('handbook page of the raised deck', () => {
  const entry = HANDBOOK_RAISED_DECK[0]!;

  it('is the page of the kind, explains every port and param, and its try board is a tidy saved 3D board', () => {
    expect(HANDBOOK_RAISED_DECK.map((e) => e.kind)).toEqual(['raised-deck']);
    expect(handbookEntry('raised-deck')).toBe(entry);
    const def = getNodeDef('raised-deck')!;
    expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
    expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
    for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) {
      expect(t.trim().length).toBeGreaterThan(0);
    }
    const board = entry.tryBoard();
    expect(board.mode).toBe('3d');
    expect(board.graph.nodes.some((n) => n.kind === 'raised-deck')).toBe(true);
    expect(parseBoard(serializeBoard(board)).ok).toBe(true);
    // Already clean at the biggest card size: opening it moves nothing.
    expect(relayoutShipped(board)).toBe(board);
    // Plays under the plain rules, like every other handbook board.
    expect(worldOptionsForGraph(board.graph)).toBeUndefined();
  });

  it('the page quotes the defaults the card really has', () => {
    const def = getNodeDef('raised-deck')!;
    const value = (id: string): string => String(def.params.find((p) => p.id === id)!.default).replace('.', ',');
    for (const id of ['top', 'hole', 'pitch', 'margin', 'length', 'width', 'thickness', 'holeCols', 'holeRows']) expect(entry.params[id], id).toContain(`Mặc định ${value(id)}`);
  });

  it('no lesson teaches the deck yet: the course pack names the kind and the page offers no lesson', () => {
    expect(COVERS).toEqual(['raised-deck']);
    expect(createCoursePackM({} as Parameters<typeof createCoursePackM>[0])).toEqual([]);
    expect(findLesson(entry.lessonId)).toBeUndefined();
  });

  it('try board: the robot drives along the deck to the far end and the crate falls through the hole to the ground', () => {
    const board = entry.tryBoard();
    const world = createWorld(board.mode);
    const rt = createRuntime(board.graph, world, board.mode);
    const robot = () => world.entities().find((e) => e.kind === 'robot')!;
    const crate = () => world.entities().find((e) => e.kind === 'item')!;
    expect(world.entities().filter((e) => e.look === RAISED_DECK_LOOK)).toHaveLength(5);
    const startY = robot().position.y;
    expect(crate().position.y).toBeGreaterThan(TRY_DECK_TOP);
    let lowestRobot = Infinity;
    for (let i = 0; i < Math.round(12 / TICK_DT); i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      lowestRobot = Math.min(lowestRobot, robot().position.y);
    }
    expect(Math.hypot(robot().position.x - TRY_DECK_GOAL.x, robot().position.z - TRY_DECK_GOAL.z)).toBeLessThan(0.1);
    expect(lowestRobot).toBeGreaterThan(startY - 0.01);
    // The crate lies on the ground (top of the ground block is y = 0), under the hole it was dropped into.
    expect(crate().position.y).toBeCloseTo(crate().size.y / 2, 2);
    expect(Math.abs(crate().position.x - TRY_DECK_HOLE.x)).toBeLessThan(0.35);
    expect(Math.abs(crate().position.z - TRY_DECK_HOLE.z)).toBeLessThan(0.35);
  });
});
