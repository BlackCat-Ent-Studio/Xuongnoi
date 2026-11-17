import { compileGraph } from './compile';
import { activeInputs, activeOutputs, getNodeDef, knownOutputs } from './registry';
import {
  PORT_DEFAULTS,
  TICK_DT,
  type EvalCtx,
  type Graph,
  type InputSnapshot,
  type NodeDef,
  type ParamValue,
  type Params,
  type PortDef,
  type PortValue,
  type PortValues,
  type Runtime,
  type ViewMode,
  type Wire,
  type WorldApi,
} from './types';

interface NodeRuntime {
  def: NodeDef<any>;
  params: Params;
  state: unknown;
  /** Incoming wire per input port id. */
  wires: Map<string, Wire>;
}

const portDefault = (p: PortDef): PortValue => p.default ?? PORT_DEFAULTS[p.type];

function defaultOutputs(def: NodeDef<any>): PortValues {
  const out: PortValues = {};
  for (const p of knownOutputs(def)) out[p.id] = portDefault(p);
  return out;
}

/** A live value must have the same shape as the param's default (finite number, string or vec3). */
function sameParamShape(def: ParamValue, v: unknown): v is ParamValue {
  if (typeof def === 'number') return typeof v === 'number' && Number.isFinite(v);
  if (typeof def === 'string') return typeof v === 'string';
  const o = v as Record<string, unknown> | null;
  return typeof o === 'object' && o !== null && ['x', 'y', 'z'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

/** Builds a runtime: compiles the graph and calls create() on every node in topo order. */
export function createRuntime(graph: Graph, world: WorldApi, mode: ViewMode): Runtime {
  const { order, backEdges } = compileGraph(graph);
  const nodes = new Map<string, NodeRuntime>();
  for (const gn of graph.nodes) {
    const def = getNodeDef(gn.kind);
    if (!def) throw new Error(`Unknown node kind: ${gn.kind}`);
    const params: Params = {};
    for (const p of def.params) params[p.id] = p.legacyDefault ?? p.default;
    Object.assign(params, gn.params);
    nodes.set(gn.id, { def, params, state: undefined, wires: new Map() });
  }
  for (const w of graph.wires) nodes.get(w.to.node)?.wires.set(w.to.port, w);

  // `curr` holds this tick's outputs (so far); `prev` holds the last completed tick's.
  let prev = new Map<string, PortValues>();
  let curr = new Map<string, PortValues>();
  for (const [id, n] of nodes) {
    prev.set(id, defaultOutputs(n.def));
    curr.set(id, defaultOutputs(n.def));
  }

  const makeCtx = (nodeId: string, tick: number, input: InputSnapshot): EvalCtx => ({
    dt: TICK_DT,
    tick,
    mode,
    input,
    world,
    nodeId,
  });

  const emptyInput: InputSnapshot = { keysDown: new Set<string>() };
  for (const id of order) {
    const n = nodes.get(id)!;
    if (n.def.create) n.state = n.def.create(makeCtx(id, 0, emptyInput), n.params);
  }

  let risen = new Set<string>();
  /** Bool outputs that rose during the most recent tick only. */
  let tickRisen = new Set<string>();
  let tickIndex = 0;
  let lastInput: InputSnapshot = emptyInput;

  const rt: Runtime = {
    get tickIndex() {
      return tickIndex;
    },
    tick(input) {
      lastInput = input;
      tickRisen = new Set<string>();
      [prev, curr] = [curr, prev];
      for (const id of order) {
        const n = nodes.get(id)!;
        const inputs: PortValues = {};
        for (const p of activeInputs(n.def, n.params)) {
          const w = n.wires.get(p.id);
          const src = w ? (backEdges.has(w.id) ? prev : curr).get(w.from.node) : undefined;
          inputs[p.id] = (w ? src?.[w.from.port] : undefined) ?? portDefault(p);
        }
        const result = n.def.evaluate(makeCtx(id, tickIndex, input), inputs, n.params, n.state);
        const outs: PortValues = {};
        for (const p of activeOutputs(n.def, n.params)) {
          const v = result?.[p.id] ?? portDefault(p);
          outs[p.id] = v;
          if (p.type === 'bool' && v === true && prev.get(id)?.[p.id] !== true) {
            risen.add(`${id}|${p.id}`);
            tickRisen.add(`${id}|${p.id}`);
          }
        }
        curr.set(id, outs);
      }
      tickIndex++;
    },
    getOutput(nodeId, portId) {
      const v = curr.get(nodeId)?.[portId];
      if (v !== undefined) return v;
      const nd = nodes.get(nodeId)?.def;
      const port = nd ? knownOutputs(nd).find((p) => p.id === portId) : undefined;
      return port ? portDefault(port) : null;
    },
    getWireValue(wire) {
      return rt.getOutput(wire.from.node, wire.from.port);
    },
    lastTickRisen() {
      return tickRisen;
    },
    takeRisen() {
      const out = risen;
      risen = new Set<string>();
      return out;
    },
    applyNodeParams(nodeId, patch) {
      const n = nodes.get(nodeId);
      if (!n) return false;
      let allApplied = true;
      for (const [key, value] of Object.entries(patch)) {
        const pd = n.def.params.find((p) => p.id === key);
        if (!pd || !sameParamShape(pd.default, value)) {
          allApplied = false;
          continue;
        }
        const handler = n.def.liveApply?.[key];
        if (n.def.createOnly?.includes(key) && !handler) {
          allApplied = false;
          continue;
        }
        const prev = n.params[key];
        n.params[key] = value;
        if (handler) handler(makeCtx(nodeId, tickIndex, lastInput), n.params, n.state, prev ?? value);
      }
      return allApplied;
    },
  };
  return rt;
}