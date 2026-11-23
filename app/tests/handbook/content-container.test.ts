import { beforeAll, describe, expect, it } from 'vitest';
import { boardIssues } from '../../src/editor/circuits/circuit-issues';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { TRAFFIC_COLORS } from '../../src/engine/block-styles';
import { getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Graph, type PlayCameraCommand } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { CAGE_CAMERA, CAGE_IN_LABEL, CAGE_LINE, CAGE_LINE_CARDS, CAGE_LINE_WIRES, CAGE_SWAP_TEXT, CAGE_TOTAL_LABEL, tryContainer } from '../../src/handbook/boards-container';
import { HANDBOOK_CONTAINER } from '../../src/handbook/content-container';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { CONTAINER_LOOK } from '../../src/nodes/container';
import { COVERS, createCoursePackP } from '../../src/tutorial/course-pack-p';
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
const [RED, AMBER, GREEN] = TRAFFIC_COLORS;
/** A lamp nobody has lit yet keeps the grey every block starts with. */
const UNLIT = '#a3a3a3';

/** Id of the card the board file calls `alias`. */
const card = (graph: Graph, alias: string): string => {
  const k = CAGE_LINE_CARDS.indexOf(alias);
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

/** When the learner holds the swap button in every run below, and when the run ends (s). */
const HOLD = { from: 21, to: 24 } as const;
const END = 31;

interface Seen {
  /** Cartons ever made. */
  made: number;
  /** Cartons whose middle is in the cage, from the entity views: just before the button is held, the fewest while and after it is held, and at the end. */
  inCage: { beforeHold: number; fewestAfterHold: number; atEnd: number; most: number };
  /** The colours the lamp showed, in order, each once per change. */
  lamp: string[];
  /** The lamp just before the button is held. */
  lampBeforeHold: string;
  /** The two numbers on screen just before the button is held. */
  shown: { inCage: number | undefined; total: number | undefined };
  /** Cartons alive just before the button is held and 2.4 s earlier (the same = the maker has stopped). */
  aliveBeforeHold: [number, number];
  /** The button is on screen. */
  button: boolean;
  /** Where the play camera was told to look just before the button is held (null = nobody told it). */
  camera: PlayCameraCommand | null;
}

/** Plays the board for `END` seconds; the swap button is held from 21 s to 24 s. */
function watch(graph: Graph, real: boolean): Seen {
  const world = createWorld('3d', real ? { realPhysics: true, rapier } : undefined);
  const rt = createRuntime(graph, world, '3d');
  const swap = card(graph, 'swap');
  const lampOwner = card(graph, 'lamp');
  const cageOwner = card(graph, 'cage');
  const ids = new Set<string>();
  const seen: Seen = { made: 0, inCage: { beforeHold: 0, fewestAfterHold: Infinity, atEnd: 0, most: 0 }, lamp: [], lampBeforeHold: '', shown: { inCage: undefined, total: undefined }, aliveBeforeHold: [0, 0], button: false, camera: null };
  const tickOf = (s: number): number => Math.round(s / TICK_DT);
  const inCage = (): number => {
    const floor = world.entities().find((e) => e.ownerNodeId === cageOwner && e.look === CONTAINER_LOOK)!;
    const { inside, wall } = CAGE_LINE.cage;
    return world.entities().filter((e) => e.kind === 'item' && e.visible && Math.abs(e.position.x - floor.position.x) < inside / 2 && Math.abs(e.position.z - floor.position.z) < inside / 2 && e.position.y > floor.position.y && e.position.y < floor.position.y + wall).length;
  };
  const alive = (): number => world.entities().filter((e) => e.kind === 'item' && e.visible).length;
  for (let t = 0; t < tickOf(END); t++) {
    const held = t >= tickOf(HOLD.from) && t < tickOf(HOLD.to);
    rt.tick({ keysDown: new Set(), ui: { clicked: new Set(), held: new Set(held ? [swap] : []), picked: new Set() } });
    world.step(TICK_DT);
    for (const e of world.entities()) if (e.kind === 'item') ids.add(e.id);
    const lamp = world.entities().find((e) => e.ownerNodeId === lampOwner)!.color;
    if (seen.lamp.at(-1) !== lamp) seen.lamp.push(lamp);
    const n = inCage();
    seen.inCage.most = Math.max(seen.inCage.most, n);
    if (t === tickOf(HOLD.from - 2.4)) seen.aliveBeforeHold[1] = alive();
    if (t === tickOf(HOLD.from) - 1) {
      seen.inCage.beforeHold = n;
      seen.lampBeforeHold = lamp;
      seen.aliveBeforeHold[0] = alive();
      const hud = world.hudItems();
      seen.shown = { inCage: hud.find((h) => h.label === CAGE_IN_LABEL)?.value, total: hud.find((h) => h.label === CAGE_TOTAL_LABEL)?.value };
      seen.camera = world.cameraCommand();
      seen.button = hud.some((h) => h.widget?.type === 'button' && h.widget.text === CAGE_SWAP_TEXT && !h.hidden);
    }
    if (t >= tickOf(HOLD.from)) seen.inCage.fewestAfterHold = Math.min(seen.inCage.fewestAfterHold, n);
  }
  seen.inCage.atEnd = inCage();
  seen.made = ids.size;
  world.dispose?.();
  return seen;
}

describe('handbook page of "Lồng chứa"', () => {
  const entry = HANDBOOK_CONTAINER[0]!;
  const def = getNodeDef('container')!;

  it('is the page of the kind, explains every port and param, and its try board is a tidy saved 3D board', () => {
    expect(HANDBOOK_CONTAINER.map((e) => e.kind)).toEqual(['container']);
    expect(handbookEntry('container')).toBe(entry);
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
    expect(board.graph.wires).toHaveLength(CAGE_LINE_WIRES.length);
    expect(board.graph.nodes).toHaveLength(CAGE_LINE_CARDS.length);
    // Cartons pile up as real bodies: the board opens with "Vật lý thật" on.
    expect(board.graph.settings?.realPhysics).toBe(true);
  });

  it('the page quotes the defaults the card really has', () => {
    const value = (id: string): string => String(def.params.find((p) => p.id === id)!.default).replace('.', ',');
    for (const id of ['inside', 'wall', 'capacity', 'clearance', 'mass']) expect(entry.params[id], id).toContain(`Mặc định ${value(id)}`);
  });

  it('the try board uses the cage as the card comes out of the palette', () => {
    const cage = entry.tryBoard().graph.nodes.find((n) => n.kind === 'container')!;
    for (const id of ['inside', 'wall', 'capacity', 'clearance', 'mass', 'look', 'color']) expect(cage.params[id], id).toEqual(def.params.find((p) => p.id === id)!.default);
  });

  it('no lesson teaches the cage yet: the course pack names the kind and the page offers no lesson', () => {
    expect(COVERS).toEqual(['container']);
    expect(createCoursePackP({} as Parameters<typeof createCoursePackP>[0])).toEqual([]);
    expect(findLesson(entry.lessonId)).toBeUndefined();
  });
});

describe.each([
  ['as it opens ("Vật lý thật" on)', true],
  ['with the switch turned off (plain item rules)', false],
] as const)('try board of "Lồng chứa" %s', (_name, real) => {
  it('the belt fills the cage; the lamp goes green, amber at 5, red at 6; the maker stops; holding the button empties the cage and the line starts again', { timeout: 120_000 }, () => {
    const s = watch(tryContainer().graph, real);
    expect(s.button).toBe(true);
    // The camera stands still close to the cage and leaves the angle to the learner.
    expect(s.camera).toMatchObject({ mode: 'fixed', target: null, point: CAGE_CAMERA.point, zoom: CAGE_CAMERA.zoom });
    expect(s.camera!.pitch).toBeUndefined();
    // Full before the button is held: six in the cage, six made, nothing more coming.
    expect(s.inCage.beforeHold).toBe(CAGE_LINE.cage.capacity);
    expect(s.shown).toEqual({ inCage: 6, total: 6 });
    expect(s.lampBeforeHold).toBe(RED);
    expect(s.aliveBeforeHold).toEqual([6, 6]);
    // The lamp on the way there, then green again once the cage is emptied.
    expect(s.lamp.slice(0, 3)).toEqual([GREEN, AMBER, RED]);
    expect(s.lamp.slice(3)).toContain(GREEN);
    expect(s.inCage.fewestAfterHold).toBe(0);
    // Never more than the capacity: the maker stops in time.
    expect(s.inCage.most).toBe(6);
    // The line runs again: new cartons were made and are in the cage at the end.
    expect(s.made).toBeGreaterThan(6);
    expect(s.inCage.atEnd).toBeGreaterThan(0);
  });
});

describe('try board of "Lồng chứa": every wire does something the learner can see', () => {
  const nothingMade = (s: Seen): void => {
    expect(s.made).toBe(0);
    expect(s.lamp).toEqual([GREEN]);
  };
  const filled = (s: Seen): void => expect(s.inCage.beforeHold).toBe(6);
  const neverRed = (s: Seen): void => {
    filled(s);
    expect(s.lamp).not.toContain(RED);
    expect(s.lampBeforeHold).toBe(AMBER);
  };
  const buttonDoesNothing = (s: Seen): void => {
    filled(s);
    expect(s.inCage.fewestAfterHold).toBe(6);
    expect(s.inCage.atEnd).toBe(6);
    expect(s.made).toBe(6);
    expect(s.lamp).toEqual([GREEN, AMBER, RED]);
  };
  /** What breaks when each wire is cut. Every wire of the board is listed. */
  const CUTS: [wire: readonly [string, string, string, string], breaks: string, check: (s: Seen) => void][] = [
    [['start', 'started', 'beat', 'run'], 'no carton is ever made', nothingMade],
    [['start', 'started', 'belt', 'run'], 'the belt stands still: cartons are made but none reaches the cage', (s) => {
      expect(s.made).toBeGreaterThan(6);
      expect(s.inCage.most).toBe(0);
      expect(s.lamp).toEqual([GREEN]);
    }],
    [['start', 'started', 'cam', 'on'], 'the view stays far away: no camera comes close to the cage', (s) => {
      filled(s);
      expect(s.camera).toBeNull();
    }],
    [['start', 'started', 'belt-end', 'run'], 'the last stretch stands still: cartons jam there and the cage is not full in time', (s) => {
      expect(s.made).toBeGreaterThan(0);
      expect(s.inCage.beforeHold).toBeLessThan(6);
      expect(s.lampBeforeHold).not.toBe(RED);
    }],
    [['beat', 'done', 'feed', 'a'], 'no carton is ever made', nothingMade],
    [['cage', 'full', 'not-full', 'in'], 'the maker never stops: a seventh carton comes and is counted', (s) => {
      expect(s.inCage.most).toBeGreaterThan(6);
      expect(s.shown.inCage).toBeGreaterThan(6);
      expect(s.aliveBeforeHold[0]).toBeGreaterThan(6);
    }],
    [['not-full', 'out', 'feed', 'b'], 'no carton is ever made', nothingMade],
    [['feed', 'out', 'maker', 'spawn'], 'no carton is ever made', nothingMade],
    [['cage', 'count', 'in-cage', 'value'], 'the number in the cage stays 0 on screen', (s) => {
      filled(s);
      expect(s.shown).toEqual({ inCage: 0, total: 6 });
    }],
    [['cage', 'took', 'total', 'up'], 'the total stays 0', (s) => {
      filled(s);
      expect(s.shown).toEqual({ inCage: 6, total: 0 });
    }],
    [['total', 'value', 'total-shown', 'value'], 'the total stays 0 on screen', (s) => {
      filled(s);
      expect(s.shown).toEqual({ inCage: 6, total: 0 });
    }],
    [['cage', 'count', 'almost', 'a'], 'no amber at 5, and a full cage shows amber instead of red', (s) => {
      neverRed(s);
      expect(s.lamp.slice(0, 2)).toEqual([GREEN, AMBER]);
    }],
    [['limit', 'value', 'almost', 'b'], 'amber from the start: the lamp is never green', (s) => {
      filled(s);
      expect(s.lamp).not.toContain(GREEN);
      expect(s.lamp.slice(0, 2)).toEqual([AMBER, RED]);
    }],
    [['almost', 'out', 'room-colour', 'on'], 'no amber at 5, and a full cage shows amber instead of red', neverRed],
    [['cage', 'full', 'full-step', 'on'], 'the lamp never turns red: it stays amber on a full cage', neverRed],
    [['room-colour', 'value', 'colour', 'a'], 'the lamp is never lit', (s) => {
      filled(s);
      expect(s.lamp).toEqual([UNLIT]);
    }],
    [['full-step', 'value', 'colour', 'b'], 'the lamp never turns red: it stays amber on a full cage', neverRed],
    [['colour', 'out', 'lamp', 'pick'], 'the lamp is never lit', (s) => {
      filled(s);
      expect(s.lamp).toEqual([UNLIT]);
    }],
    [['start', 'started', 'swap', 'show'], 'the button is not on screen, so the cage is never emptied', (s) => {
      expect(s.button).toBe(false);
      buttonDoesNothing(s);
    }],
    [['swap', 'held', 'take', 'run'], 'holding the button empties nothing', buttonDoesNothing],
    [['take', 'done', 'maker', 'recall'], 'holding the button empties nothing', buttonDoesNothing],
    [['cage', 'first', 'maker', 'recallThing'], 'holding the button empties nothing', buttonDoesNothing],
  ];

  it('lists every wire of the board', () => {
    expect(sorted(CUTS.map(([w]) => w.join('>')))).toEqual(sorted(CAGE_LINE_WIRES.map((w) => w.join('>'))));
  });

  for (const [wire, breaks, check] of CUTS) {
    it(`cut ${wire[0]}.${wire[1]} -> ${wire[2]}.${wire[3]}: ${breaks}`, { timeout: 120_000 }, () => {
      check(watch(cut(tryContainer(), wire), true));
    });
  }
});
