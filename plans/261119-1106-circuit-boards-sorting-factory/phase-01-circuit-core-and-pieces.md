# Phase 1 — Circuit core (no UI) ∥ pieces

## 1A core (one agent; owns src/circuits/**, src/io/save-format.ts, migrations.ts; additive edits in engine/types.ts)
- Types: `Circuit` (id, name, colour, graph, pins[], exposed[], benchIds[]), `Board.circuits?`, node kind `circuit` (instance: circuitId, values, placement).
- `expandBoard(board) → { graph, idMap }`, pure + deterministic:
  - ids `inst/inner`, nested expansion (depth cap 4, cycle rejected);
  - pin wires re-pointed at inner ports, `feedback` flag forwarded;
  - exposed values written into inner params;
  - placement applied to params flagged as world positions (flag per spike result);
  - bench nodes dropped.
- Every run path uses the expanded graph (play, preview world, step debugger, tests); `idMap` kept for live values per instance.
- Save format: version +1 only if needed; files without `circuits` byte-identical after load → save.
- Tests first:
  - reference flat board vs the same board made from circuits → identical entity hashes over 600 ticks;
  - nesting 3 deep; cycle error; two instances keep independent state;
  - old 139 boards unchanged (existing guards).

## 1B pieces (one agent each, own files + own handbook content file; expected node count in the brief)
- `sample-hold` "Nhớ số": value in, pulse "Lưu", held value out (+ reset).
- `dispatcher` "Bộ điều phối": N "Yêu cầu" / N "Đang bận" → "Chọn máy số", per-machine "Giao việc" pulses, queue length; param fair (round-robin) / first free.
- spawner: open list of colour / mass classes with seeded random pick, output class index.

## Done when
Full vitest green on merged main, tsc clean, baselines 0 changed except named new entries.
