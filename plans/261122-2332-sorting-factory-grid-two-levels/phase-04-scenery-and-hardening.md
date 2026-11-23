# Wave 4: scenery (draw-only), handbook + lessons, anti-forced tables, perf, real GPU, demo checklist

## Context
- Needs wave 3 in main. Scenery rule: HANDOFF §4 item 85 ("lớp máy" proven first, "lớp cảnh" on top, drawn with src/render/factory-kit). Looks of existing simulated objects never change.
- Replaces `../261119-1106-circuit-boards-sorting-factory/phase-04-demo-hardening.md`.

## Result
The sample looks like the mock-up's warehouse, every new piece has its page and lesson, the numbers are measured on a quiet machine, and there is a 2-minute demo script.

## Work items
### 1. Warehouse scenery, DRAW-ONLY
- General form (not sample code): a decor option any board can use. Smallest: `block` style values (walls, columns, roof truss, dock wall, floor paint) added to `engine/block-styles.ts` + drawn in `render/factory-blocks.ts` with `render/factory-kit.ts`; non-solid, no physics, baked per board.
- Test that it is draw-only: the sample's trajectory hash with scenery cards removed = hash with them (same entities otherwise), and the off / on guards unchanged.
- Preview first (page with 2-3 densities on the REAL sample shot; the user picks), then port. Reference figures: app/tests/showcase/factory-mockup*.ts (read-only; no import from tests/ into src/).

### 2. Handbook + lessons (finish what each piece agent stubbed)
- One page + try board per new kind (`raised-deck`, `grid-route`, `grid-traffic`, `code-reader`, `container`, `hitch`) and updated pages for `spawner` ("Thu hồi", code), marker trio (levels), real-physics topic (turned outline vs walls and sensors).
- Lesson chain "Xưởng hai tầng" (4 short lessons, chapter Robot, after `robot-to-marker`; `share-jobs` stays last as an existing test requires): robot finds its way on a grid · two robots, one cell · a box that counts and locks · a carrier that latches a cart.
- Lessons `share-jobs`, `robot-to-marker` and the new ones are played by hand in the browser (they are still unseen by the user).
- Guards: tests/handbook/handbook-coverage.test.ts (one page per kind), tests/tutorial/course-coverage.test.ts (kind named in a lesson source; every lesson in a chapter).

### 3. Anti-forced tables (one report table per circuit)
Circuit → wires cut / wires total → named failure groups. All pin wires one by one; inner wires of every circuit one by one where the count allows (station part 1 did 61 of 61). Plus a mutation audit by a read-only agent: remove each story object (cage, cover, lamp, marker row, table row) → the run must fail or the object is declared decor.

### 4. Perf
- Add a `factory` plan to tests/perf/tick-cost.test.ts (pattern at :18-22, :43): the shipped sample, 300 simulated seconds, max and average ms per tick, profile of the worst tick.
- Target: p99 ≤ 16.7 ms per tick headless on a quiet machine with 6 robots + 3 tugs + 27 cages + up to 154 real cartons; worst single tick recorded and explained (the spike saw one 21.7 ms tick at a 2.9 ms mean). Browser frame time with ~200 drawn carton / cage bodies measured separately (item 5). Also still open from before: `VITE_TICK_COST="agv:1,8 tray:8"` after the turning-chassis change (HANDOFF §A4 "NOT verified").
- Fixes are general (shortcuts with a reference test comparing to the long way), never sample-specific. Starting numbers: phase 00 row A7. REVISE AFTER SPIKE: B6.

### 5. Real GPU + browsers
User's machine: frame time on the sample (3D tab, both themes); Chrome / Edge; Firefox / Safari if available. First-load size noted. Said plainly as "not verified" if not done.

### 6. Full vitest, docs, demo
- ONE full vitest on the merged commit, quiet machine, `--testTimeout 300000`; tsc clean. Number reported with the commit hash.
- HANDOFF §A-newest, docs node count (83), memory project note.
- Demo checklist (2 minutes): open sample → enter "Xe phân loại" (live wires) → cut one wire, show it break, undo → hole goes amber / red → tug swap → truck leaves → change one open setting (cage capacity) and see the rhythm change.
- Deploy ONLY when the user says "deploy" (HANDOFF §00).

## Agent split (kinds unchanged: 83)
No contract commit needed except one line per new lesson id in `tutorial/course.ts` (controller).
| Agent | Worktree / branch / port | OWNS | Must not touch |
|---|---|---|---|
| V scenery | `../GameBuilder-scenery` · `feat/warehouse-scenery` · 5361 | `engine/block-styles.ts`, `render/factory-blocks.ts`, `render/factory-kit.ts`, `render/block-looks.ts`, `tests/render/**`; scenery cards in `samples/sorting-factory-grid*.ts` (only ADDED cards, after agent L's audit is merged) | world, nodes, tutorial, handbook |
| L lessons | `../GameBuilder-lessons` · `feat/two-level-lessons` · 5362 | `handbook/content-*.ts` + `boards-*.ts` of the six kinds, `tutorial/lesson-*.ts` (new), `course-pack-m..q.ts`, `tests/handbook/**`, `tests/tutorial/**`, their `handbook:` / `lesson:` baseline entries | world, nodes, render, samples |
| A audit (read-only, general-purpose) | no worktree | writes only `plans/reports/audit-*-report.md` | all source |
| F perf (last, on the merged tree) | `../GameBuilder-perf` · `perf/factory-tick-cost` · 5363 | `tests/perf/**`, `src/world/**`, `src/engine/**` shortcuts with reference tests | samples, nodes' behaviour |
Sample file ownership order: A (reads) → V (adds decor cards) ; L and F never edit the sample.

## Tests
Focused per item above; hash guards after each merge (script-compare with the pre-merge commit: 0 changed / 0 missing except named); browser script over every sample on :5173 (plans/browser-scripts/main-all-samples-check.mjs) with the controller reading the busy shots at 100 %.

## What the user opens
:5173 → the finished sample; the lesson chain; the demo checklist as a short Vietnamese note. A list "chưa kiểm" with what was not verified.

## Risks, fallback, rollback
| Risk | L x I | Mitigation / fallback |
|---|---|---|
| Scenery pushes draw calls too high on a weak GPU (mock-up D had 1460) | M x M | baked meshes per board; density picked on the real machine; a board setting hides decor |
| Scenery hides the machines | M x M | preview on the real shot; camera default checked in the browser script |
| Perf target missed | M x H | profile → general shortcut; fallback offered to the user: 2 tugs or a lower tick cost setting, never a hidden special case |
| Full suite flaky under load (two known timeouts) | H x L | run once on a quiet machine, rerun alone only timeouts |
Rollback: scenery and lessons are additive merges → revert each alone; perf shortcuts each have a reference test and revert alone.
