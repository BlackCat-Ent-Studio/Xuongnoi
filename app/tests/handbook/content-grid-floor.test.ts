import { beforeAll, describe, expect, it } from 'vitest';
import { runnableGraph } from '../../src/circuits/runnable';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { TICK_DT, type Board, type EntityView, type Runtime, type World } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { FLEET, FLEET_BOT, FLEET_BOT_EXTRA_WIRES, FLEET_GOALS, GRID_BOT_WIRES, HELD_COUNT_LABEL, RING_CELLS, RING_PITCH, WAITING_GOAL, fleetLinks, ringPlace, type Link } from '../../src/handbook/boards-grid-floor';
import { HANDBOOK_GRID_FLOOR } from '../../src/handbook/content-grid-floor';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { markerExits } from '../../src/nodes/floor-marker';
import { COVERS, createCoursePackN } from '../../src/tutorial/course-pack-n';
import { findLesson } from '../../src/tutorial/lessons';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { overlapDepth } from '../helpers/chassis-metrics';

registerAllNodes();

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const sorted = (a: Iterable<string>): string[] => [...a].sort();

interface Played {
  world: World;
  rt: Runtime;
  run(seconds: number, each?: () => void): void;
  out(id: string, port: string): unknown;
  robots(): EntityView[];
  of(owner: string): EntityView;
  set(id: string, value: number): void;
}

/** Plays a board the way the app does: plain rules unless it is saved with "Vật lý thật" on; circuits expanded. */
function play(board: Board): Played {
  const options = worldOptionsForGraph(board.graph);
  const world = createWorld(board.mode, options ? { ...options, rapier } : undefined);
  const rt = createRuntime(runnableGraph(board), world, board.mode);
  const robots = (): EntityView[] => world.entities().filter((e) => e.kind === 'robot');
  return {
    world,
    rt,
    run(seconds, each) {
      for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
        rt.tick({ keysDown: new Set<string>() });
        world.step(TICK_DT);
        each?.();
      }
    },
    out: (id, port) => rt.getOutput(id, port),
    robots,
    of: (owner) => world.entities().find((e) => e.ownerNodeId === owner)!,
    set: (id, value) => {
      expect(rt.applyNodeParams(id, { value })).toBe(true);
    },
  };
}

const isLink = (w: Board['graph']['wires'][number], [from, to]: Link): boolean => `${w.from.node}.${w.from.port}` === from && `${w.to.node}.${w.to.port}` === to;
/** The same board without one wire of its main board. */
function cut(board: Board, link: Link): Board {
  const wires = board.graph.wires.filter((w) => !isLink(w, link));
  expect(wires.length, `${link[0]} -> ${link[1]}`).toBe(board.graph.wires.length - 1);
  return { ...board, graph: { ...board.graph, wires } };
}
/** The same board without one inner wire of one of its circuits. */
function cutInside(board: Board, circuitId: string, link: Link): Board {
  const b = structuredClone(board);
  const g = b.circuits!.find((c) => c.id === circuitId)!.graph;
  const before = g.wires.length;
  g.wires = g.wires.filter((w) => !isLink(w, link));
  expect(g.wires.length, `${link[0]} -> ${link[1]}`).toBe(before - 1);
  return b;
}

const off = (v: EntityView, cell: number): number => Math.hypot(v.position.x - ringPlace(cell).x, v.position.z - ringPlace(cell).z);
/** The ring cell a point lies on (0 = none: the hole in the middle or off the floor). */
function ringCellAt(v: EntityView): number {
  const c = RING_CELLS.find((r) => Math.abs(v.position.x - (r.col - 1) * RING_PITCH) <= RING_PITCH / 2 && Math.abs(v.position.z - (r.row - 1) * RING_PITCH) <= RING_PITCH / 2);
  return c?.number ?? 0;
}

describe('handbook pages of the grid floor pieces', () => {
  it('covers the two kinds, and "Mốc sàn" explains its arrows', () => {
    expect(HANDBOOK_GRID_FLOOR.map((e) => e.kind)).toEqual(['grid-route', 'cell-hold']);
    expect(handbookEntry('floor-marker')!.params.exits).toContain('Mũi tên');
    expect(handbookEntry('floor-marker')!.params.number).toContain('999');
  });

  for (const entry of HANDBOOK_GRID_FLOOR) {
    it(`${entry.kind}: explains every port and param, and its try board is a tidy saved board that plays under the plain rules`, () => {
      expect(handbookEntry(entry.kind)).toBe(entry);
      const def = getNodeDef(entry.kind)!;
      expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
      expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
      for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) expect(t.trim().length).toBeGreaterThan(0);
      const board = entry.tryBoard();
      expect(board.mode).toBe('2d-top');
      expect(board.graph.nodes.some((n) => n.kind === entry.kind)).toBe(true);
      expect(parseBoard(serializeBoard(board)).ok).toBe(true);
      expect(relayoutShipped(board)).toBe(board);
      expect(worldOptionsForGraph(board.graph)).toBeUndefined();
    });
  }

  it('the pages quote the defaults the cards really have', () => {
    const value = (kind: string, id: string): string => String(getNodeDef(kind)!.params.find((p) => p.id === id)!.default).replace('.', ',');
    expect(handbookEntry('grid-route')!.params.detourAfter).toContain(`Mặc định ${value('grid-route', 'detourAfter')}`);
    expect(handbookEntry('cell-hold')!.params.arriveWithin).toContain(`Mặc định ${value('cell-hold', 'arriveWithin')}`);
    expect(handbookEntry('cell-hold')!.params.robots).toContain(`Mặc định ${value('cell-hold', 'robots')}`);
  });

  it('no lesson teaches the two pieces yet: the course pack names the kinds and the pages offer no lesson', () => {
    expect(COVERS).toEqual(['grid-route', 'cell-hold']);
    expect(createCoursePackN({} as Parameters<typeof createCoursePackN>[0])).toEqual([]);
    for (const entry of HANDBOOK_GRID_FLOOR) expect(findLesson(entry.lessonId)).toBeUndefined();
  });
});

describe('try board of "Tìm đường trên lưới"', () => {
  const board = (): Board => handbookEntry('grid-route')!.tryBoard();

  it('paints the eight ring cells with one arrow each', () => {
    const p = play(board());
    p.run(0.1);
    expect(RING_CELLS.map((c) => markerExits(p.of(`moc-${c.number}`)))).toEqual(RING_CELLS.map((c) => c.exits));
  });

  it('the robot is sent to the cell behind it and goes all the way round along the arrows, never across the hole', () => {
    const p = play(board());
    const seen: number[] = [];
    p.run(60, () => {
      const cell = ringCellAt(p.robots()[0]!);
      expect(cell).not.toBe(0);
      if (seen.at(-1) !== cell) seen.push(cell);
    });
    expect(seen).toEqual([1, 2, 3, 6, 9, 8, 7, 4]);
    expect(off(p.robots()[0]!, 4)).toBeLessThanOrEqual(0.1);
    expect(p.out('tim-duong-1', 'hasNext')).toBe(false);
    expect(p.out('tim-duong-1', 'steps')).toBe(0);
    // A new goal while it runs: on it goes, still along the arrows.
    p.set('o-dich', 2);
    p.run(20);
    expect(off(p.robots()[0]!, 2)).toBeLessThanOrEqual(0.1);
  });

  it.each([['tim-duong-1.next', 'tim-moc-1.number'], ['doc-moc-1.number', 'tim-duong-1.at'], ['o-dich.value', 'tim-duong-1.goal']] as Link[])('anti-forced: without %s -> %s the robot never leaves cell 1', (from, to) => {
    const whole = board();
    const p = play(cut(whole, [from, to]));
    p.run(30);
    expect(off(p.robots()[0]!, 1)).toBeLessThanOrEqual(0.1);
  });
});

describe('try board of "Bảng giữ ô"', () => {
  const board = (): Board => handbookEntry('cell-hold')!.tryBoard();
  const gap = (p: Played): number => -overlapDepth(p.of('than-1'), p.of('than-2'));

  it('robot 1 waits one cell short of robot 2, the held tiles are red; when robot 2 is given a goal both arrive', () => {
    const p = play(board());
    let smallest = Infinity;
    const watch = (): void => {
      smallest = Math.min(smallest, gap(p));
    };
    p.run(20, watch);
    expect(off(p.of('than-1'), 2)).toBeLessThanOrEqual(0.06);
    expect(off(p.of('than-2'), 3)).toBeLessThanOrEqual(0.06);
    expect([p.out('giu-o', 'cell1'), p.out('giu-o', 'wait1'), p.out('giu-o', 'cell2'), p.out('giu-o', 'wait2')]).toEqual([2, true, 3, false]);
    expect(p.out('giu-o', 'held')).toBe(2);
    expect(RING_CELLS.filter((c) => p.of(`moc-${c.number}`).color === '#ef4444').map((c) => c.number)).toEqual([2, 3]);
    p.set(WAITING_GOAL, 7);
    p.run(40, watch);
    expect(off(p.of('than-1'), 9)).toBeLessThanOrEqual(0.06);
    expect(off(p.of('than-2'), 7)).toBeLessThanOrEqual(0.06);
    expect(p.out('giu-o', 'stood1')).toBe(true);
    expect(RING_CELLS.filter((c) => p.of(`moc-${c.number}`).color === '#ef4444').map((c) => c.number).sort()).toEqual([7, 9]);
    expect(smallest).toBeGreaterThan(0.3);
    expect(board().graph.nodes.find((n) => n.kind === 'show-number')!.params.label).toBe(HELD_COUNT_LABEL);
  });

  it.each([['than-1.self', 'giu-o.robot1'], ['tim-duong-1.next', 'giu-o.want1'], ['giu-o.cell1', 'tim-moc-1.number']] as Link[])('anti-forced: without %s -> %s robot 1 never leaves cell 1', (from, to) => {
    const p = play(cut(board(), [from, to]));
    p.set(WAITING_GOAL, 7);
    p.run(40);
    expect(off(p.of('than-1'), 1)).toBeLessThanOrEqual(0.1);
  });

  it('anti-forced: without the hold card\'s answer to robot 2 it never leaves, and robot 1 waits behind it for good', () => {
    const p = play(cut(board(), ['giu-o.cell2', 'tim-moc-2.number']));
    p.set(WAITING_GOAL, 7);
    p.run(40);
    expect(off(p.of('than-2'), 3)).toBeLessThanOrEqual(0.1);
    expect(off(p.of('than-1'), 2)).toBeLessThanOrEqual(0.1);
    expect(p.out('giu-o', 'wait1')).toBe(true);
  });
});

describe('extra try board: four robots on the floor with nine holes', () => {
  const board = (): Board => handbookEntry('cell-hold')!.extraTries![0]!.board();
  const ids = [1, 2, 3, 4];

  interface Outcome {
    /** Goals each robot reached: times its die was rolled while it stood on another cell than at the roll before (or at the start). */
    stops: number[];
    /** Times a die was rolled while its robot had a goal and did not stand on it. */
    earlyRolls: number;
    minGap: number;
    inHole: number;
    held: number[];
  }
  function watch(b: Board, seconds: number): Outcome {
    const p = play(b);
    const stops = ids.map(() => 0);
    const cellOf = (v: EntityView): number => Math.round(v.position.z / FLEET.pitch) * FLEET.cols + Math.round(v.position.x / FLEET.pitch) + 1;
    const last = ids.map((k) => cellOf(p.of(`xe-${k}/than`)));
    const goal = ids.map(() => 0);
    let earlyRolls = 0;
    let minGap = Infinity;
    let inHole = 0;
    const held = new Set<number>();
    p.run(seconds, () => {
      const views = ids.map((k) => p.of(`xe-${k}/than`));
      ids.forEach((k, i) => {
        if (p.out(`xe-${k}/xuc-xac`, 'rolled') === true) {
          if (goal[i] !== 0 && cellOf(views[i]!) !== goal[i]) earlyRolls += 1;
          if (cellOf(views[i]!) !== last[i]) {
            stops[i]! += 1;
            last[i] = cellOf(views[i]!);
          }
        }
        goal[i] = Number(p.out(`xe-${k}/bang-dich`, 'value'));
        const row = Math.round(views[i]!.position.z / FLEET.pitch);
        const col = Math.round(views[i]!.position.x / FLEET.pitch);
        if (row % 2 !== 0 && col % 2 !== 0) inHole += 1;
      });
      for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) minGap = Math.min(minGap, -overlapDepth(views[i]!, views[j]!));
      held.add(Number(p.out('giu-o', 'held')));
    });
    p.world.dispose?.();
    return { stops, earlyRolls, minGap, inHole, held: [...held].sort((a, b) => a - b) };
  }

  it('is a saved 3D board with "Vật lý thật" on: one floor circuit, one hold card, four copies of one robot circuit', () => {
    const b = board();
    expect(b.name.startsWith('Thử: ')).toBe(true);
    expect(b.mode).toBe('3d');
    expect(b.graph.settings?.realPhysics).toBe(true);
    expect(parseBoard(serializeBoard(b)).ok).toBe(true);
    expect(relayoutShipped(b)).toBe(b);
    expect(b.graph.nodes.filter((n) => n.params.circuit === FLEET_BOT)).toHaveLength(4);
    expect(b.graph.nodes.filter((n) => n.kind === 'cell-hold')).toHaveLength(1);
    expect(b.graph.nodes.some((n) => n.kind === 'floor-marker')).toBe(false);
    expect(b.circuits!.find((c) => c.id !== FLEET_BOT)!.graph.nodes).toHaveLength(40);
    expect(FLEET_GOALS).toHaveLength(12);
  });

  it('120 s: every robot keeps reaching new goals, nobody comes near anybody, nobody is ever in a hole cell', () => {
    const o = watch(board(), 120);
    expect(Math.min(...o.stops)).toBeGreaterThanOrEqual(4);
    // A robot picks its next goal only while it stands on the one it had.
    expect(o.earlyRolls).toBe(0);
    expect(o.minGap).toBeGreaterThan(0.3);
    expect(o.inHole).toBe(0);
    // A robot holds its own cell at least, and at most the two its body lies across plus the one it is cleared for.
    expect(o.held[0]).toBeGreaterThanOrEqual(4);
    expect(o.held.at(-1)).toBeLessThanOrEqual(12);
  });

  it.each([1, 2, 3, 4, 5].map((n) => [n, ...fleetLinks(1)[n - 1]!] as [number, string, string]).filter(([n]) => n !== 4))('anti-forced, main board wire %s (%s -> %s): robot 1 reaches no goal', (_n, from, to) => {
    const o = watch(cut(board(), [from, to]), 40);
    expect(o.stops[0]).toBe(0);
  });

  const AT_GOAL: Link = ['tim-duong.hasNext', 'da-o-dich.in'];
  it.each([...GRID_BOT_WIRES, ...FLEET_BOT_EXTRA_WIRES].filter((w) => w !== AT_GOAL && w[0] !== AT_GOAL[0]).map(([from, to]) => [from, to]))('anti-forced, robot circuit wire %s -> %s: no robot reaches a goal', (from, to) => {
    const o = watch(cutInside(board(), FLEET_BOT, [from!, to!]), 40);
    expect(o.stops).toEqual([0, 0, 0, 0]);
  });

  it('anti-forced, robot circuit wire "Còn phải đi" -> "Đảo ngược": robots pick a new goal wherever they happen to stand still, before reaching the one they had', () => {
    const o = watch(cutInside(board(), FLEET_BOT, AT_GOAL), 60);
    expect(o.earlyRolls).toBeGreaterThan(0);
  });
});
