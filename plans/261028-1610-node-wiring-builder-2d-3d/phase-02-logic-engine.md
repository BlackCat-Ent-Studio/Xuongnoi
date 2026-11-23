---
phase: 2
title: Logic engine
status: completed
priority: P1
dependencies:
  - 1
effort: M
---

# Phase 2: Logic engine

## Overview
Pure-TS graph model + type-checked wiring + fixed-tick evaluator. No DOM, no Three.js. Fully unit-tested.

## Requirements
- Port types: `bool`, `number`, `object` (entity ref). Strict — no implicit conversion.
- Input port: max 1 wire. Output: many. Unwired input → port default.
- Fixed 60 Hz tick; deterministic.
- Cycles allowed: back-edge reads previous-tick value (no recursion, no infinite loop).

## Architecture
```ts
type PortType = 'bool' | 'number' | 'object';
type ViewMode = '2d-side' | '2d-top' | '3d';
interface PortDef { id: string; type: PortType; label: string; default?: unknown }
interface ParamDef { id: string; label: string; kind: 'number'|'select'|'key'|'color'|'vec3'; default: unknown; options?: string[] }
interface NodeDef {
  kind: string; label: string; category: 'input'|'logic'|'math'|'object'|'output';
  inputs: PortDef[]; outputs: PortDef[]; params: ParamDef[];
  modes?: ViewMode[];                       // omit = all modes
  create(ctx: EvalCtx, params): NodeState;  // per-run state
  eval(ctx: EvalCtx, inputs, params, state): Record<string, unknown>;
}
interface GraphNode { id: string; kind: string; params: Record<string, unknown>; pos: { x: number; y: number } }
interface Wire { from: { node: string; port: string }; to: { node: string; port: string } }
interface Graph { nodes: GraphNode[]; wires: Wire[] }
```
- `registry.ts` — `defineNode()`, `getNodeDef(kind)`, `listNodeDefs(mode)`.
- `wiring.ts` — `canConnect(graph, from, to)` → `{ ok: true } | { ok: false, reason }` (type mismatch, input taken, same node, unknown port). Reasons = keys in `ui-text-vi.ts`.
- `compile.ts` — Kahn topological sort; remaining cycle edges marked `backEdge` (deterministic: sort by node id).
- `runtime.ts` — `Runtime { start(); tick(input); getWireValue(wire) }`. Per tick: for node in order → gather inputs (back-edge = prev-tick value) → eval → store outputs. Keeps value map for wire inspection.
- `EvalCtx` = `{ dt, tickIndex, mode, input: InputSnapshot, world: WorldApi }`; `WorldApi` interface declared here, implemented in phase 4.

## Related Code Files
- Create: `src/engine/types.ts`, `registry.ts`, `wiring.ts`, `compile.ts`, `runtime.ts`
- Create: `tests/engine/*.test.ts`

## Implementation Steps
1. Types + registry.
2. `canConnect` with all rejection reasons.
3. Compile: topo order + back-edge detection.
4. Runtime tick loop, value map, defaults for unwired inputs.
5. Tests with tiny fake nodes: order, defaults, type rejection, 2-node cycle stable, determinism (same input → same output over 600 ticks).
6. Commit `feat(engine): graph model, typed wiring, tick evaluator`.

## Success Criteria
- [ ] Engine tests green
- [ ] Cycle graph runs 10k ticks without hang
- [ ] No DOM/Three imports under `src/engine/`

## Risk Assessment
1-tick delay on back-edges may surprise → deterministic rule; explain in tooltip later.
