# Post-merge browser smoke sweep (HEAD 657b7be; main now bc4e7c4, docs-only delta)

Scope: 4 merged branches (editor tools, logic/sensors, camera/teleport, moving objects). Dev server http://localhost:5173. Scripts + screenshots: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\sweep\`.

## Static gates

| Gate | Result |
|---|---|
| `npx vitest run` | PASS. 41 files, 631 tests, 0 fail. ~3.0 s |
| `npx tsc --noEmit -p .` | PASS, exit 0 |
| `npm run build` | PASS, exit 0. Warning only: chunk `index-*.js` 851 kB > 500 kB (pre-existing size advisory, not an error) |

## Check results

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | Editor loads, palette, no console errors | PASS | 42 palette items = 41 node kinds + sticky-note tool (`data-kind="note"`, not a node). 7 categories: Đầu vào, Logic, Tính toán, Vật thể, Hành động, Bộ não, Kết quả. 0 console errors/warnings on load |
| 2 | All 14 samples: open, Chơi, ~5 s input, Sửa | PASS 14/14 | 0 console errors/warnings and 0 dialogs across all 14. Each returns to edit mode. Modes: side-stars 2d-side, top-collect 2d-top, 3d-hop 3d, dodge-shoot/portal-camera 2d-side |
| 3 | Editor tools (undo/redo, multi-select copy/paste, note) | PASS, all checks | Undo/redo of add, move, wire delete. Undo disabled during play. Shift-box select (3 nodes), Ctrl+C/V (6 nodes, 4 wires), Ctrl+D (9/6), Delete, Ctrl+Z restore. Note add, text, colour, move, resize. Note survives reload. Clipboard persisted. 0 console errors |
| 4a | dodge-shoot end-to-end | PASS | Lose overlay "Thua!" appears under random input (≤45 s). 0 console errors |
| 4b | portal-camera end-to-end | PASS | Win overlay "Thắng! Bạn đã qua cổng và về tới đích!" at ~4 s with ArrowRight held and Space every ~1.2 s. 0 console errors. Note: random-key input did not win in 45 s. That is a harness input limitation: the win needs sustained right through the portal, not a product bug |
| 5a | Tutorial lesson 10 (`bot-driver`, 23 steps) | PASS | Menu lists it. All 22 steps advance as expected through wiring. Play: bot reaches flag, "Thắng!" overlay and step 23 "Bot lái xe giỏi quá!" at ~6.7 s. Panel closes on finish. 0 console errors |
| 5b | Tutorial lessons 1, 2 (existing `tut-run.mjs`) | PASS | Lesson 1 and 2 steps and finish all pass in both runs |
| 5c | Tutorial lesson 3 (`win-lose`, existing script) | FLAKY, unresolved | Step 10 wire `const.value → compare.b` does not register in the full sequence. Failed 2 of 4 full runs; passed 2 of 4. Isolated replay (`debug-l3-replay.mjs`) passed 4 of 4. Hit-test probe at both port centres: target dot is topmost (`pointer-events: auto`), no marquee or overlay found. Root cause not found |

## Failed tests

None in vitest. None in tsc or build.

Sweep-script failures found and fixed in the harness only (not product):
- Palette count assumed 41 items. Real: 42 items including the note tool.
- portal-camera first run was a harness regex bug. The win text was stripped by my own regex.
- Lesson 10 script first version placed new nodes over board nodes, so ports were hidden. Re-placed nodes in free canvas space.

## Critical issues

None blocking. Product sweep is green except the intermittent lesson 3 wiring step (5c).

## Performance

Vitest 3.0 s total for 631 tests. Samples play cycle ~10 s each. No slow test found.

## Fixes and commits

None. No app bug confirmed, so nothing committed. Git status: only pre-existing `HANDOFF.md` modification (not touched).

## Recommendations

1. Investigate 5c. Reproduce with the full `tut-run.mjs` sequence and capture the `.wc-wire` count plus pointer events on the failing drag. Check whether state left by lessons 1-2 (palette scroll, pending pointer capture, stuck key) affects mouse-up handling in `app/src/editor/wiring-canvas.ts`.
2. Add a stable wire-drop test in `app/tests/editor` that covers drop onto an input port after prior drag-drops.
3. Consider splitting the build chunk (dynamic import) to clear the >500 kB advisory. Optional.

Status: DONE_WITH_CONCERNS
Summary: Post-merge sweep green. Vitest 631/631, tsc and build clean, 14/14 samples play with zero console errors, editor tools, dodge-shoot lose, portal-camera win, and lesson 10 all pass. One intermittent lesson 3 wire step (2 of 4 full runs) is unresolved and not reproduced in isolation.
Concerns/Blockers: lesson 3 intermittent wire failure (5c) needs root cause.

## Unresolved questions

- Is the lesson 3 flake a product bug (wire drop after prior lesson state) or harness timing? Not determined.
- Brief said 41 kinds in palette. Palette shows 42 items; the extra is the sticky-note tool. Confirm this matches the expected count.
