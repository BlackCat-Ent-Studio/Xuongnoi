# Engine runtime report

Files (app/): src/engine/wiring.ts, compile.ts, runtime.ts, text-vi.ts; tests/engine/engine.test.ts

API:
- `canConnect(graph, from, to): ConnectResult`; `addWire(graph, from, to, id?) : Graph | {ok:false,reason}`; `removeWire`, `removeNode` (immutable)
- `compileGraph(graph) -> { order, backEdges }` (+ `CompiledGraph` type)
- `createRuntime(graph, world, mode): Runtime` (throws on unknown kind)
- `CONNECT_FAIL_TEXT: Record<ConnectFailReason,string>`

Notes: wrong-direction wins over unknown-port when the port id exists on the opposite side. Wires referencing missing nodes are ignored by compile/runtime. Runtime tolerates back-edge reads via prev/curr map swap.

Results: vitest tests/engine 22/22 pass; `tsc --noEmit -p .` clean (no errors at all). No contract changes requested.
