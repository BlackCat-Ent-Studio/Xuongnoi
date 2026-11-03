import { describe, expect, it } from 'vitest';
import { createNode } from '../../src/editor/editor-state';
import { createRuntime } from '../../src/engine/runtime';
import { listNodeDefs } from '../../src/engine/registry';
import { addWire } from '../../src/engine/wiring';
import { registerAllNodes } from '../../src/nodes';
import { TICK_DT, type Graph, type GraphNode, type ViewMode, type World } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';
import { wireStarts } from '../helpers/wire-starts';

/**
 * The client rule: every action needs its own wire; nothing acts without one.
 * For every node kind: put the piece on a board with default settings, wire only OBJECTS into it (who, what, where to),
 * never a signal or a number, play a few seconds with no keys, and require that the world sees no action at all
 * (nobody walks, grabs, drops, hides, shows, spawns, teleports or boards; nothing wins, loses or moves the camera;
 * no HUD widget appears). Pure sensors, constants and logic are expected to pass trivially; they are not skipped.
 */

// Registered at load, not in beforeAll: the kind list below is read while the tests are being collected.
registerAllNodes();

/** World calls that are an action whatever their arguments. */
const ALWAYS_ACTION = new Set([
  'spawn',
  'hide',
  'show',
  'grab',
  'drop',
  'throwHeld',
  'interact',
  'equip',
  'unequip',
  'useTool',
  'enterVehicle',
  'exitVehicle',
  'loadCargo',
  'unloadCargo',
  'endGame',
  'teleport',
  'shoot',
  'heal',
  'setVehicleTrack',
]);

type Args = readonly unknown[];

/** Calls whose arguments decide whether they act. */
const ACTION_BY_ARGS: Record<string, (a: Args) => boolean> = {
  setCharacterIntent: (a) => {
    const it = a[1] as { moveX: number; moveY: number; jump: boolean };
    return it.moveX !== 0 || it.moveY !== 0 || it.jump;
  },
  setVehicleInput: (a) => a[1] !== 0 || a[2] !== 0,
  setVehicleTow: (a) => a[1] !== null,
  setCamera: (a) => a[1] !== null,
};

/** Kinds allowed to make a world call without a wire, each with the reason. Keep this list short and honest. */
const ALLOWED_CALLS: Record<string, { calls: string[]; why: string }> = {
  zone: { calls: ['hide'], why: 'hides its own editor marker box on the first tick (never a thing the game shows)' },
};

/** Kinds allowed to show a HUD item with no wire. */
const ALLOWED_HUD: Record<string, string> = {
  'show-number': 'prints a number that is wired in; display only, no world action',
  'ui-start': 'the game\'s own title page: it is the start of the game, with its own button',
};

/** Object inputs that are themselves the order to act, so the test leaves them empty. */
const ORDER_BY_OBJECT: Record<string, string> = {
  'vehicle.leader': 'wiring a leader IS the order to follow it',
};

interface Probe {
  calls: string[];
  hud: string[];
  moved: string[];
}

function support(): GraphNode[] {
  const base: Graph = { nodes: [], wires: [] };
  const mk = (kind: string, id: string, params: GraphNode['params']): GraphNode => {
    const fresh = createNode(base, kind, { x: 0, y: 0 })!;
    return { ...fresh, id, params: { ...fresh.params, ...params } };
  };
  return [
    mk('block', 'floor', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 10 }, type: 'solid' }),
    mk('character', 'c', { position: { x: 0, y: 1, z: 0 }, role: 'bot' }),
    mk('item', 'it', { position: { x: 0.9, y: 0.5, z: 0 } }),
    mk('block', 'blk', { position: { x: 3, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, type: 'pickup' }),
    mk('vehicle', 'veh', { position: { x: -2, y: 0.5, z: 0 } }),
  ];
}

/** Which support piece feeds the n-th object input of the piece under test, per wiring variant. */
const VARIANTS: readonly ((n: number) => string)[] = [
  (n) => ['c', 'it', 'blk', 'veh'][n % 4]!,
  () => 'c',
  () => 'veh',
  (n) => ['it', 'c', 'blk', 'veh'][n % 4]!,
];

function build(kind: string, variant: number): Graph | null {
  let graph: Graph = { nodes: support(), wires: [] };
  const sut = createNode(graph, kind, { x: 0, y: 0 });
  if (!sut) return null;
  graph = { ...graph, nodes: [...graph.nodes, { ...sut, id: 'sut' }] };
  const def = listNodeDefs().find((d) => d.kind === kind)!;
  let n = 0;
  for (const p of def.inputs.filter((x) => x.type === 'object' && !ORDER_BY_OBJECT[`${kind}.${x.id}`])) {
    const res = addWire(graph, { node: VARIANTS[variant]!(n++), port: 'self' }, { node: 'sut', port: p.id });
    if ('nodes' in res) graph = res;
    else {
      // The support piece has no "self" of that kind (e.g. a vehicle's own output is named differently): try the usual ones.
      for (const alt of ['vehicle', 'item', 'self']) {
        const again = addWire(graph, { node: VARIANTS[variant]!(n - 1), port: alt }, { node: 'sut', port: p.id });
        if ('nodes' in again) {
          graph = again;
          break;
        }
      }
    }
  }
  // The stick wires that would carry a walking order into the people and vehicles (a brain at rest must send nothing).
  for (const out of def.outputs) {
    for (const target of ['c', 'veh']) {
      const res = addWire(graph, { node: 'sut', port: out.id }, { node: target, port: out.id });
      if ('nodes' in res) graph = res;
    }
  }
  return graph;
}

function snapshot(world: World): string {
  return JSON.stringify(world.entities(), (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));
}

function probe(kind: string, mode: ViewMode, variant: number, withStart = false): Probe | null {
  const built = build(kind, variant);
  if (!built) return null;
  const graph = withStart ? wireStarts(built, mode) : built;
  const real = createWorld(mode);
  let recording = false;
  const out: Probe = { calls: [], hud: [], moved: [] };
  const spy = new Proxy(real, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v !== 'function' || typeof prop !== 'string') return v;
      return (...args: unknown[]) => {
        if (recording) {
          const decide = ACTION_BY_ARGS[prop];
          if (ALWAYS_ACTION.has(prop) || (decide && decide(args))) out.calls.push(prop);
        }
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  const rt = createRuntime(graph, spy, mode);
  recording = true;
  const run = (ticks: number): void => {
    for (let i = 0; i < ticks; i++) {
      rt.tick({ keysDown: new Set<string>() });
      real.step(TICK_DT);
    }
  };
  run(90);
  const settled = snapshot(real);
  run(210);
  if (snapshot(real) !== settled) out.moved.push('an entity moved, turned, changed or appeared');
  for (const h of real.hudItems()) if (h.hidden !== true) out.hud.push(h.key);
  if (real.ended) out.calls.push('endGame');
  return out;
}

const kinds = (): string[] => listNodeDefs().map((d) => d.kind);

describe('no action without its wire', () => {
  it('covers every registered node kind', () => {
    expect(kinds().length).toBeGreaterThanOrEqual(57);
  });

  for (const kind of kinds()) {
    it(`${kind}: with only objects wired and default settings, nothing happens`, () => {
      const def = listNodeDefs().find((d) => d.kind === kind)!;
      const mode: ViewMode = def.modes && !def.modes.includes('2d-side') ? def.modes[0]! : '2d-side';
      const allowed = ALLOWED_CALLS[kind]?.calls ?? [];
      for (let v = 0; v < VARIANTS.length; v++) {
        const res = probe(kind, mode, v);
        expect(res, kind).not.toBeNull();
        expect(res!.calls.filter((c) => !allowed.includes(c)), `${kind} variant ${v}: world calls`).toEqual([]);
        expect(res!.moved, `${kind} variant ${v}`).toEqual([]);
        if (!ALLOWED_HUD[kind]) expect(res!.hud, `${kind} variant ${v}: HUD`).toEqual([]);
      }
    });
  }

  it('the probe does see the action once the start wire is there (so a pass above means something)', () => {
    for (const kind of ['patrol', 'moving-platform']) {
      const res = probe(kind, '2d-side', 1, true);
      expect(res!.calls.length + res!.moved.length, kind).toBeGreaterThan(0);
    }
  });

  it('the allow-lists name real kinds and give a reason', () => {
    for (const [k, v] of Object.entries(ALLOWED_CALLS)) {
      expect(kinds(), k).toContain(k);
      expect(v.why.length).toBeGreaterThan(10);
    }
    for (const [k, why] of Object.entries(ALLOWED_HUD)) {
      expect(kinds(), k).toContain(k);
      expect(why.length).toBeGreaterThan(10);
    }
  });
});
