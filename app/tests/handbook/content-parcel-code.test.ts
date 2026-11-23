import { beforeAll, describe, expect, it } from 'vitest';
import { runnableGraph } from '../../src/circuits/runnable';
import { buildClip, pasteClip } from '../../src/editor/clipboard';
import { relayoutShipped } from '../../src/editor/graph/shipped-layout';
import { activeInputs, getNodeDef, knownInputs, knownOutputs } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type Graph, type GraphNode, type HudItem, type PlayCameraCommand } from '../../src/engine/types';
import { handbookEntry } from '../../src/handbook';
import { CODE_ALIVE_LABEL, CODE_LINE, CODE_LINE_WIRES, CODE_NOW_LABEL, CODE_READS_LABEL, tryCodeReader } from '../../src/handbook/boards-parcel-code';
import { HANDBOOK_PARCEL_CODE } from '../../src/handbook/content-parcel-code';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { LESSONS } from '../../src/tutorial/lessons';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { wrapped } from '../circuits/circuit-helpers';
import { firstCardOverlap } from '../helpers/cell-run';

registerAllNodes();

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const sorted = (a: Iterable<string>): string[] => [...a].sort();

/** Ids of the cards of one copy of the try-board machine (`prefix` = the circuit copy it sits in, '' on a flat board). */
function cards(graph: Graph, prefix = '') {
  const mine = graph.nodes.filter((n) => n.id.startsWith(prefix));
  const one = (kind: string, where: (n: GraphNode) => boolean = () => true): string => {
    const found = mine.filter((n) => n.kind === kind && where(n));
    if (found.length !== 1) throw new Error(`${found.length} cards of kind ${kind}`);
    return found[0]!.id;
  };
  return {
    start: one('on-start'),
    beat: one('timer'),
    dice: one('random'),
    maker: one('spawner'),
    belt: one('block', (n) => n.params.style === 'belt-frame'),
    'at-gate': one('zone', (n) => n.params.color === '#facc15'),
    'at-end': one('zone', (n) => n.params.color === '#ef4444'),
    reader: one('code-reader'),
    reads: one('counter'),
    now: one('show-number', (n) => n.params.label === CODE_NOW_LABEL),
    'read-count': one('show-number', (n) => n.params.label === CODE_READS_LABEL),
    alive: one('show-number', (n) => n.params.label === CODE_ALIVE_LABEL),
    cam: one('camera'),
  };
}
type Alias = keyof ReturnType<typeof cards>;

interface Seen {
  /** Codes of the cartons, in the order they were made (0 = no code). */
  made: number[];
  /** Codes the reader gave, one per carton that passed with a code, in order. */
  reads: number[];
  /** What was printed on each carton made (the code its look carries; 0 = none). */
  printed: number[];
  counter: number;
  maxAlive: number;
  /** Biggest value each read-out showed. */
  hud: Record<string, number>;
  /** Text on the display at the end ('' = empty screen, null = no display). */
  display: string | null;
  /** Furthest any carton got along the belt (smallest x). */
  minX: number;
  /** What the board's "Máy quay" asks of the view at the end (null = nothing: the app frames the whole scene). */
  camera: PlayCameraCommand | null;
}

/** Plays `graph` for `seconds`, in the plain world a try-board opens in or with "Vật lý thật" on. */
function watch(graph: Graph, seconds: number, real: boolean, prefix = ''): Seen {
  const world = createWorld('3d', real ? { realPhysics: true, rapier } : undefined);
  const rt = createRuntime(graph, world, '3d');
  const id = cards(graph, prefix);
  const seen: Seen = { made: [], reads: [], printed: [], counter: 0, maxAlive: 0, hud: {}, display: null, minX: Infinity, camera: null };
  let reading: unknown = null;
  for (let n = 0; n < Math.round(seconds / TICK_DT); n++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    if (rt.getOutput(id.maker, 'spawned') === true) {
      const made = String(rt.getOutput(id.maker, 'lastSpawned'));
      seen.made.push(Number(world.tagOf(made)) || 0);
      seen.printed.push(Number(/#(\d+)$/.exec(world.getEntity(made)?.look ?? '')?.[1] ?? 0));
    }
    const has = rt.getOutput(id.reader, 'has') === true;
    const first = rt.getOutput(id['at-gate'], 'first');
    if (has && first !== reading) seen.reads.push(Number(rt.getOutput(id.reader, 'code')));
    reading = has ? first : null;
    seen.maxAlive = Math.max(seen.maxAlive, Number(rt.getOutput(id.maker, 'count')));
    for (const h of world.hudItems() as readonly HudItem[]) seen.hud[h.label] = Math.max(seen.hud[h.label] ?? 0, h.value);
    for (const e of world.entities()) if (e.kind === 'item' && e.visible && e.ownerNodeId === id.maker) seen.minX = Math.min(seen.minX, e.position.x);
  }
  seen.counter = Number(rt.getOutput(id.reads, 'value'));
  seen.camera = world.cameraCommand();
  const screens = world.entities().filter((e) => e.blockStyle === 'code-display' && e.visible && e.ownerNodeId === id.reader);
  seen.display = screens.length === 0 ? null : screens.map((s) => s.label ?? '').join('+');
  world.dispose?.();
  return seen;
}

function cut(board: Board, [fa, fp, ta, tp]: readonly [string, string, string, string]): Graph {
  const id = cards(board.graph);
  const from = id[fa as Alias];
  const to = id[ta as Alias];
  const wires = board.graph.wires.filter((w) => !(w.from.node === from && w.from.port === fp && w.to.node === to && w.to.port === tp));
  if (wires.length !== board.graph.wires.length - 1) throw new Error(`wire not found: ${fa}.${fp} -> ${ta}.${tp}`);
  return { ...board.graph, wires };
}

describe('handbook page of "Đọc mã"', () => {
  it('covers the one new kind', () => {
    expect(HANDBOOK_PARCEL_CODE.map((e) => e.kind)).toEqual(['code-reader']);
  });

  it('explains every port and param, points at a lesson, and its try board is a tidy saved board', () => {
    const entry = handbookEntry('code-reader')!;
    const def = getNodeDef('code-reader')!;
    expect(sorted(Object.keys(entry.ports))).toEqual(sorted(new Set([...knownInputs(def), ...knownOutputs(def)].map((p) => p.id))));
    expect(sorted(Object.keys(entry.params))).toEqual(sorted(def.params.map((p) => p.id)));
    for (const t of [entry.purpose, entry.whenToUse, entry.example, ...entry.tips, ...Object.values(entry.ports), ...Object.values(entry.params)]) expect(t.trim().length).toBeGreaterThan(0);
    expect(LESSONS.some((l) => l.id === entry.lessonId)).toBe(true);
    const board = entry.tryBoard();
    expect(board.mode).toBe('3d');
    expect(board.graph.settings?.realPhysics).not.toBe(true);
    expect(parseBoard(serializeBoard(board)).ok).toBe(true);
    expect(relayoutShipped(board)).toBe(board);
    expect(firstCardOverlap(board)).toBeNull();
    // Exactly the wires listed: nothing was added behind the learner's back.
    expect(board.graph.wires).toHaveLength(CODE_LINE_WIRES.length);
  });

  it('the page of "Tạo đối tượng" explains the new inputs and switches, and says 200', () => {
    const entry = handbookEntry('spawner')!;
    for (const id of ['code', 'recallThing', 'recall']) expect(entry.ports[id]?.length, id).toBeGreaterThan(20);
    for (const id of ['wireCode', 'recallPorts']) expect(entry.params[id]?.length, id).toBeGreaterThan(20);
    expect(entry.tips.some((t) => t.includes('200'))).toBe(true);
    expect(entry.tips.some((t) => t.includes(' 50 '))).toBe(false);
  });
});

describe.each([
  ['as it opens (plain world)', false],
  ['with "Vật lý thật" on', true],
] as const)('try board of "Đọc mã" %s', (_name, real) => {
  it('every carton gets a code from 1 to 9, printed on it; the gate reads them in order; the end zone takes them back', { timeout: 60_000 }, () => {
    const board = tryCodeReader();
    const seen = watch(board.graph, 40, real);
    expect(seen.made.length).toBeGreaterThanOrEqual(25);
    for (const code of seen.made) expect(code >= 1 && code <= 9, String(code)).toBe(true);
    expect(new Set(seen.made).size).toBeGreaterThan(4);
    expect(seen.printed).toEqual(seen.made);
    expect(seen.reads.length).toBeGreaterThanOrEqual(seen.made.length - 4);
    expect(seen.reads).toEqual(seen.made.slice(0, seen.reads.length));
    expect(seen.counter).toBe(seen.reads.length);
    expect(seen.hud[CODE_READS_LABEL]).toBe(seen.reads.length);
    expect(seen.hud[CODE_NOW_LABEL]).toBe(Math.max(...seen.reads));
    expect(seen.display).toBe(String(seen.reads.at(-1)));
    // Taken back at the end: never near the limit, and no carton gets past the end zone.
    expect(seen.maxAlive).toBeLessThan(CODE_LINE.maxAlive);
    expect(seen.hud[CODE_ALIVE_LABEL]).toBe(seen.maxAlive);
    expect(seen.minX).toBeGreaterThan(CODE_LINE.endX - 0.2);
  });

  it('opens close to the scan gate: a "Máy quay" stands still on the gate, zoomed in, and leaves the angle to the learner', () => {
    const board = tryCodeReader();
    const seen = watch(board.graph, 1, real);
    expect(seen.camera).toMatchObject({ mode: 'fixed', target: null, shake: 0 });
    const { point, zoom, pitch } = seen.camera!;
    // Aimed between the belt top and the display on the gate, at the gate.
    expect(Math.abs(point.x - CODE_LINE.gateX)).toBeLessThan(0.5);
    expect(Math.abs(point.z)).toBeLessThan(0.3);
    expect(point.y).toBeGreaterThan(CODE_LINE.belt.topY);
    expect(point.y).toBeLessThan(CODE_LINE.belt.topY + 0.8);
    expect(zoom).toBeGreaterThanOrEqual(2);
    expect(pitch).toBeUndefined();
    // From the very first tick: the board never shows the far view first.
    const first = createWorld('3d');
    const rt = createRuntime(board.graph, first, '3d');
    rt.tick({ keysDown: new Set() });
    expect(first.cameraCommand()).not.toBeNull();
  });

  const none = (v: number | undefined): boolean => v === undefined || v === 0;
  const full = (s: Seen): void => {
    expect(s.maxAlive).toBe(CODE_LINE.maxAlive);
    expect(s.made.length).toBe(CODE_LINE.maxAlive);
  };
  /** What breaks when each wire is cut. Every wire of the board is listed. */
  const CUTS: [wire: readonly [string, string, string, string], breaks: string, check: (s: Seen) => void][] = [
    [['start', 'started', 'beat', 'run'], 'no carton is ever made', (s) => expect(s.made).toEqual([])],
    [['start', 'started', 'belt', 'run'], 'the belt stands still: nothing reaches the gate', (s) => {
      expect(s.made.length).toBeGreaterThan(0);
      expect(s.reads).toEqual([]);
      expect(s.minX).toBeGreaterThan(1.5);
    }],
    [['beat', 'done', 'dice', 'roll'], 'no number is drawn: cartons carry no code', (s) => {
      expect(s.made.length).toBeGreaterThan(10);
      expect(s.made.every((c) => c === 0)).toBe(true);
      expect(s.reads).toEqual([]);
    }],
    [['beat', 'done', 'maker', 'spawn'], 'no carton is ever made', (s) => expect(s.made).toEqual([])],
    [['dice', 'value', 'maker', 'code'], 'cartons carry no code and no number is printed', (s) => {
      expect(s.made.length).toBeGreaterThan(10);
      expect(s.printed.every((c) => c === 0)).toBe(true);
      expect(s.reads).toEqual([]);
      expect(s.counter).toBe(0);
      expect(s.display).toBe('');
    }],
    [['at-gate', 'first', 'reader', 'thing'], 'the reader has nothing to read', (s) => {
      expect(s.made.some((c) => c > 0)).toBe(true);
      expect(s.reads).toEqual([]);
      expect(s.display).toBe('');
    }],
    [['reader', 'code', 'now', 'value'], '"Mã đang đọc" shows nothing', (s) => {
      expect(s.reads.length).toBeGreaterThan(10);
      expect(none(s.hud[CODE_NOW_LABEL])).toBe(true);
    }],
    [['reader', 'has', 'reads', 'up'], 'reads are not counted', (s) => {
      expect(s.reads.length).toBeGreaterThan(10);
      expect(s.counter).toBe(0);
    }],
    [['reads', 'value', 'read-count', 'value'], '"Số thùng đã đọc" shows nothing', (s) => {
      expect(s.counter).toBeGreaterThan(10);
      expect(none(s.hud[CODE_READS_LABEL])).toBe(true);
    }],
    [['at-end', 'first', 'maker', 'recallThing'], 'nothing is taken back: the line fills up and stops', full],
    [['at-end', 'entered', 'maker', 'recall'], 'nothing is taken back: the line fills up and stops', full],
    [['start', 'started', 'cam', 'on'], 'no camera takes over: the view stays far, on the whole line', (s) => {
      expect(s.camera).toBeNull();
      expect(s.reads.length).toBeGreaterThan(10);
    }],
    [['maker', 'count', 'alive', 'value'], '"Số thùng đang có" shows nothing', (s) => {
      expect(s.maxAlive).toBeGreaterThan(2);
      expect(none(s.hud[CODE_ALIVE_LABEL])).toBe(true);
    }],
  ];

  it('the cut table lists every wire of the board', () => {
    expect(CUTS.map(([w]) => w.join('>')).sort()).toEqual(CODE_LINE_WIRES.map((w) => w.join('>')).sort());
  });

  it.each(CUTS)('anti-forced: without %j %s', { timeout: 60_000 }, (wire, _breaks, check) => {
    const board = tryCodeReader();
    check(watch(cut(board, wire), 30, real));
  });
});

describe('codes survive saving, copying and circuits', () => {
  it('a saved and reloaded board makes and reads the same codes', { timeout: 60_000 }, () => {
    const board = tryCodeReader();
    const loaded = parseBoard(serializeBoard(board));
    if (!loaded.ok) throw new Error('board did not load');
    const again = watch(loaded.board.graph, 20, true);
    expect(again.reads.length).toBeGreaterThan(8);
    expect(again).toEqual(watch(board.graph, 20, true));
    const maker = loaded.board.graph.nodes.find((n) => n.kind === 'spawner')!;
    expect([maker.params.wireCode, maker.params.recallPorts, maker.params.maxAlive]).toEqual(['yes', 'yes', CODE_LINE.maxAlive]);
    expect(loaded.board.graph.nodes.find((n) => n.kind === 'code-reader')!.params.display).toBe('yes');
  });

  it('a copied spawner keeps its code input, its recall inputs and the wires between the copied cards', () => {
    const board = tryCodeReader();
    const id = cards(board.graph);
    const clip = buildClip(board, new Set([id.beat, id.dice, id.maker]))!;
    const pasted = pasteClip(board.graph, [], clip, { x: 40, y: 40 });
    const copy = pasted.graph.nodes.find((n) => n.kind === 'spawner' && pasted.newIds.includes(n.id))!;
    expect([copy.params.wireCode, copy.params.recallPorts]).toEqual(['yes', 'yes']);
    expect(activeInputs(getNodeDef('spawner')!, copy.params).map((p) => p.id)).toEqual(['spawn', 'at', 'toucher', 'code', 'recallThing', 'recall']);
    const into = pasted.graph.wires.filter((w) => w.to.node === copy.id).map((w) => w.to.port);
    expect(sorted(into)).toEqual(['code', 'spawn']);
  });

  it('two copies of the machine as a circuit: each copy codes, reads and takes back its own cartons', { timeout: 120_000 }, () => {
    const flat = tryCodeReader();
    const board = wrapped({ ...flat, graph: { ...flat.graph, settings: { ...flat.graph.settings, realPhysics: true } } }, { a: { x: 0, z: -2 }, b: { x: 0, z: 2 } });
    const loaded = parseBoard(serializeBoard(board));
    if (!loaded.ok) throw new Error('board did not load');
    const graph = runnableGraph(loaded.board);
    expect(graph.nodes.filter((n) => n.kind === 'spawner').map((n) => n.id).sort()).toEqual([`a/${cards(flat.graph).maker}`, `b/${cards(flat.graph).maker}`]);
    for (const copy of ['a/', 'b/']) {
      const seen = watch(graph, 25, true, copy);
      expect(seen.reads.length, copy).toBeGreaterThan(10);
      expect(seen.reads, copy).toEqual(seen.made.slice(0, seen.reads.length));
      expect(seen.printed, copy).toEqual(seen.made);
      expect(seen.maxAlive, copy).toBeLessThan(CODE_LINE.maxAlive);
      expect(seen.display, copy).toBe(String(seen.reads.at(-1)));
    }
  });

  it('a board saved before codes existed loads and plays without a code', () => {
    const board = tryCodeReader();
    const old: Board = structuredClone(board);
    const maker = old.graph.nodes.find((n) => n.kind === 'spawner')!;
    delete maker.params.wireCode;
    delete maker.params.recallPorts;
    old.graph.nodes = old.graph.nodes.filter((n) => n.kind !== 'code-reader');
    old.graph.wires = old.graph.wires.filter((w) => !['code', 'recallThing', 'recall', 'thing'].includes(w.to.port) && old.graph.nodes.some((n) => n.id === w.from.node) && old.graph.nodes.some((n) => n.id === w.to.node));
    const loaded = parseBoard(serializeBoard(old));
    if (!loaded.ok) throw new Error('board did not load');
    const again = loaded.board.graph.nodes.find((n) => n.kind === 'spawner')!;
    expect(activeInputs(getNodeDef('spawner')!, again.params).map((p) => p.id)).toEqual(['spawn', 'at', 'toucher']);
    const world = createWorld('3d');
    const rt = createRuntime(loaded.board.graph, world, '3d');
    for (let n = 0; n < 600; n++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const cartons = world.entities().filter((e) => e.kind === 'item');
    expect(cartons.length).toBeGreaterThan(3);
    for (const c of cartons) expect([world.tagOf(c.id), c.look]).toEqual(['', 'parcel-carton']);
  });
});
