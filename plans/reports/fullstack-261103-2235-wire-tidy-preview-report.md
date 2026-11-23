# Wire-tidy preview report

Page: `D:\workspace\GameBuilder\plans\ui-mockups\wire-tidy\index.html` (single file, opens from file://, only Google Fonts online). Script: `shot-wire-tidy.mjs`. Screenshots: `shots/` (+ `counts.json`). Nothing under `app/` touched, no commit.

## What it shows
Two real boards (level 5, level 7): robot + Ô kho 1..3 (locked cards, shown ports exactly as `shownPorts`) + the reference solution nodes with their `pos`. Cards/wires copy the game CSS (node-cards.css, graph.css, wire-energy.css, puzzle.css board colours), port colours bool yellow / number blue / object pink, flow dots on wires. Labels = Vietnamese from node-names.ts, English term as the small subtitle. "Trước" = game layout (saved pos, then overlapping cards pushed down like `spreadOverlaps`, measured sizes). "Sau" = all six on. Segmented Trước/Sau, "So sánh cạnh nhau" checkbox (left fixed Trước, right live), tabs Màn 5/Màn 7, live counter "Số chỗ dây cắt nhau" with breakdown and the Trước number.

## Toggles
| # | Name | Does |
|---|---|---|
| 1 | Chân nối ở mép thẻ | Pins centred on the card border, text padding smaller (cards ~20px narrower). Wire no longer starts inside the card. |
| 2 | Dây đi ngược tự vòng | Wire that goes backwards (target left of source) or whose bezier would run over a card is re-routed by a grid A* router (8px grid, 10px clearance around cards, small penalty for bends, bigger for overlapping/crossing other wires). Result: orthogonal path with rounded corners through the gaps and above/below cards. Wires that are fine keep the game's cubic bezier. |
| 3 | Soi dây | Tap/hover card: its wires bright + thicker + flow dots, other wires 20%, unrelated cards 62%. Tap wire also lights it. Tap empty clears. |
| 4 | Nút bẻ dây | Double-click / double-tap a wire adds a knot, drag moves it, double-click knot removes. With toggle 2 on, each leg between knots is routed by A* and knots snap to the 8px grid; with 2 off the legs are chained beziers. |
| 5 | Sắp xếp gọn | Columns by role (objects, finders/sensors, logic, math + move, carry), longest-path layering over forward edges, back edges ignored, barycentre order then every permutation of each column (<=6 cards) minimising straight-line crossings then vertical distance, cards centred on their sources, no overlap. Animated 620 ms (JS tween, wires follow), then view re-fits. Button "Sắp xếp gọn" replays from the saved layout. Cards can be dragged by the header. Knots cleared on arrange. |
| 6 | Dây vật thể dạng nhãn | Object wire source with >=3 targets (robot.self: 3 in L5, 4 in L7) drawn as short stub + "x3/x4" badge at the source and a chip "🤖 Rô-bốt" at each input. Tap chip: full wire drawn bright, rest 20%. Stub wires are what is counted. |

## Crossing numbers (wire x wire + wire x card, counted on sampled wire geometry; wires sharing a pin are not counted against each other)
| Board | Trước | Sau (all 6) |
|---|---|---|
| Màn 5 | **34** (20 + 14) | **5** (5 + 0) |
| Màn 7 | **32** (12 + 20) | **5** (5 + 0) |

Each item alone (Trước baseline is 34 / 32): 
| Config | Màn 5 | Màn 7 |
|---|---|---|
| 1 only | 30 | 31 |
| 2 only | 13 | 32 |
| 5 only | 27 | 32 |
| 6 only | 24 | 27 |
| 1+2 | 15 | 35 |
| 1+2+5 | 7 | 9 |
| all six | 5 | 5 |

Reading: 2 alone helps level 5 but not level 7 (orthogonal detours on the messy original layout cross more wires). Real gain comes from 5 + 2 + 1 together; 6 removes the last robot fan-out crossings.

Honest limits: crossing counter is my own measure (polyline samples), not a game metric. "Sau" growth: with real full-port cards, arranged boards are 1022x599 (L5) and 1020x713 (L7) logical px, not within 1000x560 (L7 needs ~700 height: route card 334 + eye 126 + slot finder 204 in one column; label chips need ~116 px gaps). No overlap in either. Trước bounds for reference: 638x644 and 978x854.

## Verification
Playwright (Chromium) screenshots read and checked: m5-before/after, m7-before/after, m7-focus, m7-knot (add, drag, remove via double-click all passed in script), m7-labels-tap, m5-labels, m5-compare, phone 844x390 (m5/m7 after, m7 before, tap card focus = passed, double-tap wire adds knot = passed, pinch/wheel code path untested on a real phone). No page errors. Emoji glyph for the robot looks small in headless Chromium; real browsers use their emoji font.

## Porting notes (game files, nothing changed yet)
| Item | Files that would change | Notes / risk |
|---|---|---|
| 1 pins on edge | `editor/graph/node-cards.css` (dot absolute, padding), `graph.css` (dot rules), `puzzle.css` (15px dot override); `dotCenter` in board-view.ts already reads the DOM so wires follow | Card width shrinks ~20px: `estimateNodeSize` in graph-geometry.ts and old saved layouts (LEGACY_LONGEST_LABEL comment says width must not change) need re-check; hit area of port rows must still reach the half-outside dot; first/last wire `wirePath` start points move 10px. |
| 2 auto-route | `graph-geometry.ts` (add router next to `wirePath`), `board-view.ts` `drawWires`/`drawGhost`, editor graph wire drawing (canvas), `wire-energy.ts` (uses path length, fine) | Needs card rects when drawing wires (today only pin points). Recompute on card drag; A* cost small (<50 ms for 17 wires in preview) but run in rAF-throttled way. Wire hit path/selection uses same `d`. Not saved, so no data risk. |
| 3 soi dây | `board-view.ts` (existing `pz-picked` lit card logic can be reused), `wire-energy.css` (`.is-dim` already exists), editor canvas selection | Pure view state. Conflicts with play-mode live dimming (`is-dim` means "value off") - use a separate class. |
| 4 knots | `engine/types.ts` Wire gets optional `knots?: {x,y}[]`, serializer/loader, `graph-geometry.ts`, `board-view.ts`, editor wire-drag/canvas-pointer, undo/redo, copy/paste, group in/out | **Needs saving in the graph.** Old files load without the field (safe); older app versions would drop it silently. Deleting/rewiring a wire must drop its knots. Auto-arrange must clear knots (preview does). Level `solution`/hint wires and base wires need a stance (locked wires: no knots). |
| 5 arrange | `editor/graph/auto-layout.ts` (`computeLayout` already does layering + barycentre; add role columns, back-edge handling, permutation search, tween), `graph-toolbar.ts` button | Moves every card pos, so it must be undoable and ask/confirm on big boards. Puzzle levels: positions of locked cards (robot, slots, in a left column) should stay fixed or be part of column 0. Board height may grow past 560. |
| 6 label wires | `board-view.ts`/editor wire layer, `object-link.css` (exists: check overlap with the current object-link feature before building), `graph-text-vi.ts` for chip names | Display-only toggle; chip name = instance name (robot, Ô kho n). Wire selection/delete/hit-testing must map chips to wires; port-compat drag-to-wire must still work from chip. |

Saved-board risks overall: only item 4 adds saved data; items 1, 5 change geometry (card width, positions) and therefore interact with existing saved layouts and `spreadOverlaps`; items 2, 3, 6 are view-only.

## Unresolved questions
- Is the 1000x560 logical board a hard limit? L7 with full-port cards needs ~700 tall; options are compact cards (hide unused ports) or a taller board.
- Should knots be allowed on locked/base wires and on level solution hints?
- Keep the crossing counter in the real game, or only as a dev/preview metric?

Status: DONE_WITH_CONCERNS
Summary: Preview page built and verified with Playwright; crossings drop 34 to 5 (Màn 5) and 32 to 5 (Màn 7) with all six on; per-item numbers and porting notes above.
Concerns/Blockers: arranged boards exceed 1000x560 (1022x599, 1020x713) because real cards are tall; crossing counter is a custom measure; pinch not tested on a real device; knots need a saved-graph schema change.
