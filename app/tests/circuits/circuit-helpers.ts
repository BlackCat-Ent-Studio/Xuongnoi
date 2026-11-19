import { instanceParams } from '../../src/circuits/instance';
import { CIRCUIT_KIND, type Board, type Circuit, type Graph, type GraphNode, type ParamValue, type Vec3, type Wire } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';

export interface Place {
  x: number;
  z: number;
  /** Degrees; 90 turns +x onto +z. */
  heading?: number;
}

export const sampleBoard = (id: string): Board => structuredClone(listAllSamples().find((s) => s.id === id)!.board);

export const node = (id: string, kind: string, params: Record<string, ParamValue> = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });
export const wire = (id: string, from: string, to: string): Wire => {
  const [fn, fp] = from.split('.') as [string, string];
  const [tn, tp] = to.split('.') as [string, string];
  return { id, from: { node: fn, port: fp }, to: { node: tn, port: tp } };
};

export function circuit(id: string, graph: Graph, extra: Partial<Circuit> = {}): Circuit {
  return { id, name: id, graph, pins: [], exposed: [], benchIds: [], ...extra };
}

/** A copy of circuit `circuitId` as a node of a board. */
export function copyOf(id: string, circuitId: string, place: Place = { x: 0, z: 0 }, values: Record<string, ParamValue> = {}): GraphNode {
  return { id, kind: CIRCUIT_KIND, params: instanceParams(circuitId, { values, place: { position: { x: place.x, y: 0, z: place.z }, heading: place.heading ?? 0 } }), pos: { x: 0, y: 0 } };
}

/** The whole machine of `board` turned into one circuit, and a main board that holds one copy of it per entry of `copies`. */
export function wrapped(board: Board, copies: Record<string, Place>): Board {
  const machine = circuit('machine', { nodes: board.graph.nodes, wires: board.graph.wires });
  return {
    name: board.name,
    mode: board.mode,
    graph: { nodes: Object.entries(copies).map(([id, place]) => copyOf(id, 'machine', place)), wires: [], settings: board.graph.settings },
    circuits: [machine],
  };
}

// ---------- the same thing done by hand, with no circuit anywhere ----------

/** World points of the pieces these tests use, written out by hand (deliberately not read from the node definitions). */
const WORLD_POINTS: Record<string, string[]> = {
  'robot-body': ['position'],
  block: ['position'],
  item: ['position'],
  'line-track': ['center', ...Array.from({ length: 16 }, (_, i) => `p${i + 1}`)],
};

function movedPoint(p: Vec3, place: Place): Vec3 {
  const rad = ((place.heading ?? 0) * Math.PI) / 180;
  const quarter = (place.heading ?? 0) % 90 === 0;
  const c = quarter ? Math.round(Math.cos(rad)) : Math.cos(rad);
  const s = quarter ? Math.round(Math.sin(rad)) : Math.sin(rad);
  return { x: p.x * c - p.z * s + place.x, y: p.y, z: p.x * s + p.z * c + place.z };
}

/** The machine of `board` copied by hand: ids get `prefix/` in front, world points are moved and turned, a robot's heading is turned. */
export function handCopy(board: Board, prefix: string, place: Place, defaults: Record<string, Record<string, ParamValue>> = {}): Graph {
  const nodes = board.graph.nodes.map((n): GraphNode => {
    const params = { ...n.params };
    for (const key of WORLD_POINTS[n.kind] ?? []) {
      const value = params[key] ?? defaults[n.kind]?.[key];
      if (typeof value === 'object') params[key] = movedPoint(value, place);
    }
    if (n.kind === 'robot-body') params.heading = Number(params.heading ?? 0) + (place.heading ?? 0);
    return { ...n, id: `${prefix}/${n.id}`, params };
  });
  const wires = board.graph.wires.map((w): Wire => ({ id: `${prefix}/${w.id}`, from: { node: `${prefix}/${w.from.node}`, port: w.from.port }, to: { node: `${prefix}/${w.to.node}`, port: w.to.port } }));
  return { nodes, wires };
}

/** A flat board made of hand copies, one per entry of `copies`. */
export function handBuilt(board: Board, copies: Record<string, Place>, defaults: Record<string, Record<string, ParamValue>> = {}): Board {
  const parts = Object.entries(copies).map(([id, place]) => handCopy(board, id, place, defaults));
  return {
    name: board.name,
    mode: board.mode,
    graph: { nodes: parts.flatMap((p) => p.nodes), wires: parts.flatMap((p) => p.wires), settings: board.graph.settings },
  };
}
