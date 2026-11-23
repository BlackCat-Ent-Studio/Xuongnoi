import { beforeAll, describe, expect, it } from 'vitest';
import { boardIssues } from '../../src/editor/circuits/circuit-issues';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Graph, type PlayCameraCommand, type Vec3 } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { HITCH_CAMERA, HITCH_PAYLOAD_LABEL, HITCH_ROUTE, HITCH_YARD, HITCH_YARD_CARDS, HITCH_YARD_WIRES, tryHitch } from '../../src/handbook/boards-hitch';
import { HANDBOOK_HITCH } from '../../src/handbook/content-hitch';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { CONTAINER_LOOK, containerOfLabel } from '../../src/nodes/container';
import { HITCH_DEFAULT_REACH, HITCH_PULL_SPEED } from '../../src/nodes/hitch';
import { COVERS, createCoursePackQ } from '../../src/tutorial/course-pack-q';
import { findLesson } from '../../src/tutorial/lessons';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { firstCardOverlap } from '../helpers/cell-run';

registerAllNodes();

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const sorted = (a: Iterable<string>): string[] => [...a].sort();
const [UNDER, DROP, PARK] = HITCH_YARD.marks;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Id of the card the board file calls `alias`. */
const card = (graph: Graph, alias: string): string => {
  const k = HITCH_YARD_CARDS.indexOf(alias);
  if (k < 0) throw new Error(`no card ${alias}`);
  return graph.nodes[k]!.id;
};

function cut(board: Board, [fa, fp, ta, tp]: readonly [string, string, string, string]): Graph {
  const from = card(board.graph, fa);
  const to = card(board.graph, ta);
  const wires = board.graph.wires.filter((w) => !(w.from.node === from && w.from.port === fp && w.to.node === to && w.to.port === tp));
  if (wires.length !== board.graph.wires.length - 1) throw new Error(`wire not found: ${fa}.${fp} -> ${ta}.${tp}`);
  return { ...board.graph, wires };
}

/** How long every run below is watched (s): the whole trip takes about 20 s. */
const END = 32;

interface Seen {
  /** Where the robot and the middle of the cage are at the end. */
  robot: Vec3;
  cage: Vec3;
  /** How far the cage ever got from where it started, and the robot from where it started (m). */
  cageMoved: number;
  robotMoved: number;
  /** The steps the "Chuỗi bước" card was in, in order, each once per change (0 = finished). */
  steps: number[];
  /** Ticks on which "Đang gài" was on, and how often "Khi gài" / "Khi nhả" came on. */
  holdingTicks: number;
  took: number;
  released: number;
  /** While "Đang gài" was on and the cage had been drawn in: furthest the cage was from the middle of the robot (m). */
  worstOffset: number;
  /** Most the robot turned from its first heading (degrees). */
  turned: number;
  /** Width and depth of the floor plate of the cage on every tick: a cage that turned would swap them. */
  plateSizes: Set<string>;
  /** Cartons whose middle is in the cage at the end. */
  cartonsInCage: number;
  /** The biggest number the screen showed for the load, the number at the end, and whether it is on screen at all. */
  mostShown: number;
  shownAtEnd: number | undefined;
  /** Where the play camera was told to look (null = nobody told it). */
  camera: PlayCameraCommand | null;
}

function watch(graph: Graph, real: boolean): Seen {
  const world = createWorld('3d', real ? { realPhysics: true, rapier } : undefined);
  const rt = createRuntime(graph, world, '3d');
  const bodyOwner = card(graph, 'body');
  const cageOwner = card(graph, 'cage');
  const steps = card(graph, 'steps');
  const hitch = card(graph, 'hitch');
  const robotView = () => world.entities().find((e) => e.ownerNodeId === bodyOwner)!;
  const plate = () => world.entities().find((e) => e.ownerNodeId === cageOwner && e.look === CONTAINER_LOOK && containerOfLabel(e.label) !== null)!;
  const seen: Seen = { robot: { x: 0, y: 0, z: 0 }, cage: { x: 0, y: 0, z: 0 }, cageMoved: 0, robotMoved: 0, steps: [], holdingTicks: 0, took: 0, released: 0, worstOffset: 0, turned: 0, plateSizes: new Set(), cartonsInCage: 0, mostShown: 0, shownAtEnd: undefined, camera: null };
  let cageFrom: Vec3 | null = null;
  let robotFrom: Vec3 | null = null;
  let headingFrom = 0;
  let heldFor = 0;
  for (let t = 0; t < Math.round(END / TICK_DT); t++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    const r = robotView();
    const c = plate();
    cageFrom ??= { ...c.position };
    robotFrom ??= { ...r.position };
    if (t === 0) headingFrom = r.robot!.heading;
    seen.cageMoved = Math.max(seen.cageMoved, flat(c.position, cageFrom));
    seen.robotMoved = Math.max(seen.robotMoved, flat(r.position, robotFrom));
    const step = rt.getOutput(steps, 'index') as number;
    if (seen.steps.at(-1) !== step) seen.steps.push(step);
    const holding = rt.getOutput(hitch, 'holding') === true;
    heldFor = holding ? heldFor + 1 : 0;
    if (holding) seen.holdingTicks++;
    if (rt.getOutput(hitch, 'took') === true) seen.took++;
    if (rt.getOutput(hitch, 'released') === true) seen.released++;
    // The cage is drawn to the middle of the robot from at most the reach away, at up to the pull speed.
    if (heldFor > Math.round((HITCH_DEFAULT_REACH / HITCH_PULL_SPEED + 1) / TICK_DT)) seen.worstOffset = Math.max(seen.worstOffset, flat(c.position, r.position));
    const d = ((((r.robot!.heading - headingFrom) * 180) / Math.PI) % 360 + 360) % 360;
    seen.turned = Math.max(seen.turned, d > 180 ? 360 - d : d);
    seen.plateSizes.add(`${c.size.x}x${c.size.z}`);
    const shown = world.hudItems().find((h) => h.label === HITCH_PAYLOAD_LABEL)?.value;
    if (typeof shown === 'number') seen.mostShown = Math.max(seen.mostShown, shown);
    seen.shownAtEnd = typeof shown === 'number' ? shown : undefined;
    seen.robot = { ...r.position };
    seen.cage = { ...c.position };
  }
  seen.camera = world.cameraCommand();
  const c = plate();
  seen.cartonsInCage = world.entities().filter((e) => e.kind === 'item' && e.visible && Math.abs(e.position.x - c.position.x) < 0.5 && Math.abs(e.position.z - c.position.z) < 0.5 && e.position.y > c.position.y && e.position.y < c.position.y + 1).length;
  world.dispose?.();
  return seen;
}

describe('handbook page of "Chốt gài"', () => {
  const entry = HANDBOOK_HITCH[0]!;
  const def = getNodeDef('hitch')!;

  it('is the page of the kind, explains every port and param, and its try board is a tidy saved 3D board', () => {
    expect(HANDBOOK_HITCH.map((e) => e.kind)).toEqual(['hitch']);
    expect(handbookEntry('hitch')).toBe(entry);
    expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
    expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
    for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) expect(t.trim().length).toBeGreaterThan(0);
    const board = entry.tryBoard();
    expect(board.mode).toBe('3d');
    expect(parseBoard(serializeBoard(board)).ok).toBe(true);
    // Already clean at the biggest card size: opening it moves nothing.
    expect(relayoutShipped(board)).toBe(board);
    expect(firstCardOverlap(board)).toBeNull();
    expect(boardIssues(board, board.mode)).toEqual([]);
    // Exactly the wires listed: nothing was added behind the learner's back.
    expect(board.graph.wires).toHaveLength(HITCH_YARD_WIRES.length);
    expect(board.graph.nodes).toHaveLength(HITCH_YARD_CARDS.length);
    // What is held weighs on the robot only with real physics: the board opens with "Vật lý thật" on.
    expect(board.graph.settings?.realPhysics).toBe(true);
  });

  it('the page quotes the defaults the card really has, and the pull speed the piece really uses', () => {
    expect(entry.params.reach).toContain(`Mặc định ${String(HITCH_DEFAULT_REACH).replace('.', ',')}`);
    expect(entry.params.maxMass).toContain('Mặc định 0');
    expect(entry.params.offset).toContain('Mặc định 0, 0, 0');
    expect(entry.params.offset).toContain(`${String(HITCH_PULL_SPEED).replace('.', ',')} m mỗi giây`);
    expect(def.params.find((p) => p.id === 'offset')!.default).toEqual({ x: 0, y: 0, z: 0 });
    expect(def.params.find((p) => p.id === 'what')!.default).toBe('container');
  });

  it('the try board uses the hitch and the cage as the cards come out of the palette', () => {
    const graph = entry.tryBoard().graph;
    const hitch = graph.nodes.find((n) => n.kind === 'hitch')!;
    for (const p of def.params) expect(hitch.params[p.id], p.id).toEqual(p.default);
    const cageDef = getNodeDef('container')!;
    const cage = graph.nodes.find((n) => n.kind === 'container')!;
    for (const id of ['inside', 'wall', 'capacity', 'clearance', 'mass', 'look', 'color']) expect(cage.params[id], id).toEqual(cageDef.params.find((p) => p.id === id)!.default);
  });

  it('no lesson teaches the hitch yet: the course pack names the kind and the page offers no lesson', () => {
    expect(COVERS).toEqual(['hitch']);
    expect(createCoursePackQ({} as Parameters<typeof createCoursePackQ>[0])).toEqual([]);
    expect(findLesson(entry.lessonId)).toBeUndefined();
  });
});

describe.each([
  ['as it opens ("Vật lý thật" on)', true],
  ['with the switch turned off (plain rules)', false],
] as const)('try board of "Chốt gài" %s', (_name, real) => {
  it('the robot drives under the cage, takes it, carries it to marker 2 without turning it, lets go and parks on marker 3', { timeout: 120_000 }, () => {
    const s = watch(tryHitch().graph, real);
    expect(s.steps).toEqual([1, 2, 3, 4, 0]);
    expect(s.took).toBe(1);
    expect(s.released).toBe(1);
    // The cage stands on marker 2 with both cartons in it, the robot on marker 3.
    expect(flat(s.cage, DROP)).toBeLessThan(0.15);
    expect(flat(s.robot, PARK)).toBeLessThan(0.15);
    expect(s.cartonsInCage).toBe(HITCH_YARD.carton.count);
    // While it was carried it stayed over the middle of the robot, and it never turned though the robot did.
    expect(s.worstOffset).toBeLessThan(0.001);
    expect(s.turned).toBeGreaterThan(20);
    expect([...s.plateSizes]).toEqual(['1.1x1.1']);
    // The number on screen: the cage and its two cartons while it is carried, nothing at the end.
    expect(s.mostShown).toBeCloseTo(real ? HITCH_YARD.cage.mass + HITCH_YARD.carton.count * HITCH_YARD.carton.mass : 0, 6);
    expect(s.shownAtEnd).toBe(0);
    // The camera stands still near the trip and leaves the angle free.
    expect(s.camera).toMatchObject({ mode: 'fixed', target: null, point: HITCH_CAMERA.point, zoom: HITCH_CAMERA.zoom });
    expect(s.camera!.pitch).toBeUndefined();
  });
});

describe('try board of "Chốt gài": every wire does something the learner can see', () => {
  const robotNeverMoves = (s: Seen): void => {
    expect(s.robotMoved).toBeLessThan(0.05);
    expect(s.cageMoved).toBe(0);
    expect(s.steps).toEqual([1]);
  };
  const doesNotGetThere = (s: Seen): void => {
    expect(flat(s.robot, UNDER)).toBeGreaterThan(0.5);
    expect(s.cageMoved).toBe(0);
    expect(s.steps).toEqual([1]);
    expect(s.took).toBe(0);
  };
  /** The robot gets under the cage and waits there for ever: the hitch never takes the cage. */
  const cageNeverMoves = (s: Seen): void => {
    expect(flat(s.robot, UNDER)).toBeLessThan(0.15);
    expect(s.cageMoved).toBe(0);
    expect(s.took).toBe(0);
    expect(s.holdingTicks).toBe(0);
    expect(s.steps).toEqual([1, 2]);
  };
  /** What breaks when each wire is cut. Every wire of the board is listed. */
  const CUTS: [wire: readonly [string, string, string, string], breaks: string, check: (s: Seen) => void][] = [
    [['body', 'self', 'left', 'body'], 'the left wheel is not on the robot: it turns on the spot and never gets under the cage', doesNotGetThere],
    [['body', 'self', 'right', 'body'], 'the right wheel is not on the robot: it turns on the spot and never gets under the cage', doesNotGetThere],
    [['body', 'self', 'drive', 'robot'], 'the driver has no robot: nothing moves', robotNeverMoves],
    [['drive', 'left', 'left', 'power'], 'the left motor gets no power: the robot never gets under the cage', doesNotGetThere],
    [['drive', 'right', 'right', 'power'], 'the right motor gets no power: the robot never gets under the cage', doesNotGetThere],
    [['steps', 'index', 'route', 'index'], 'every step drives to marker 1: the robot takes the cage and then stands under it for ever', (s) => {
      expect(s.took).toBe(1);
      expect(s.steps).toEqual([1, 2, 3]);
      expect(flat(s.cage, UNDER)).toBeLessThan(0.15);
      expect(flat(s.robot, UNDER)).toBeLessThan(0.15);
    }],
    [['route', 'value', 'find', 'number'], 'no marker is looked up: the robot has nowhere to go', robotNeverMoves],
    [['find', 'marker', 'drive', 'target'], 'the driver has no target: the robot never moves', robotNeverMoves],
    [['steps', 'finished', 'still-going', 'in'], 'the robot never stops driving: after the last step it goes back to marker 1 instead of parking on marker 3', (s) => {
      expect(s.steps).toEqual([1, 2, 3, 4, 0]);
      expect(flat(s.cage, DROP)).toBeLessThan(0.15);
      expect(flat(s.robot, PARK)).toBeGreaterThan(2);
    }],
    [['still-going', 'out', 'drive', 'go'], 'the driver is never switched on: the robot never moves', robotNeverMoves],
    [['body', 'self', 'hitch', 'carrier'], 'the hitch has no carrier: the cage never moves', cageNeverMoves],
    [['steps', 'step2', 'hold', 'a'], '"Gài" is off in step 2: the cage is never taken', cageNeverMoves],
    [['steps', 'step3', 'hold', 'b'], '"Gài" goes off as step 3 begins: the cage is let go at once and the robot does the trip alone', (s) => {
      expect(s.took).toBe(1);
      expect(s.released).toBe(1);
      expect(s.steps).toEqual([1, 2, 3, 4, 0]);
      expect(flat(s.cage, UNDER)).toBeLessThan(0.15);
      expect(flat(s.robot, PARK)).toBeLessThan(0.15);
      expect(s.mostShown).toBeGreaterThan(0);
    }],
    [['hold', 'out', 'hitch', 'on'], '"Gài" never comes on: the robot waits under the cage and the cage never moves', cageNeverMoves],
    [['drive', 'arrivedPulse', 'steps', 'next'], 'arriving ends no step: the robot stops under the cage in step 1 and never takes it', (s) => {
      expect(flat(s.robot, UNDER)).toBeLessThan(0.15);
      expect(s.steps).toEqual([1]);
      expect(s.took).toBe(0);
      expect(s.cageMoved).toBe(0);
    }],
    [['hitch', 'holding', 'steps', 'done2'], 'holding the cage ends no step: the robot holds it under marker 1 for ever', (s) => {
      expect(s.took).toBe(1);
      expect(s.released).toBe(0);
      expect(s.steps).toEqual([1, 2]);
      expect(flat(s.cage, UNDER)).toBeLessThan(0.15);
      expect(s.shownAtEnd).toBeCloseTo(22, 6);
    }],
    [['body', 'payload', 'carried', 'value'], 'the trip is made, but the number on screen stays 0', (s) => {
      expect(flat(s.cage, DROP)).toBeLessThan(0.15);
      expect(s.mostShown).toBe(0);
    }],
    [['start', 'started', 'cam', 'on'], 'the trip is made, but the view stays far away: no camera comes close', (s) => {
      expect(flat(s.cage, DROP)).toBeLessThan(0.15);
      expect(s.camera).toBeNull();
    }],
  ];

  it('lists every wire of the board, and the route table sends the four steps to markers 1, 1, 2, 3', () => {
    expect(sorted(CUTS.map(([w]) => w.join('>')))).toEqual(sorted(HITCH_YARD_WIRES.map((w) => w.join('>'))));
    expect([...HITCH_ROUTE]).toEqual([1, 1, 2, 3]);
  });

  for (const [wire, breaks, check] of CUTS) {
    it(`cut ${wire[0]}.${wire[1]} -> ${wire[2]}.${wire[3]}: ${breaks}`, { timeout: 120_000 }, () => {
      check(watch(cut(tryHitch(), wire), true));
    });
  }
});
