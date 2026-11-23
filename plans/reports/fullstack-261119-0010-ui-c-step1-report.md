# UI direction C, step 1: new look inside today's layout

Branch `feat/ui-c-step1` (worktree `D:\workspace\GameBuilder-ui-c`), 2 commits on top of `ecac6a9`, nothing pushed or merged.
Dev server for the owner: `http://localhost:5301/` (left running). Screenshots and proofs: `plans/reports/shots-ui-c-step1/`, scripts: `plans/browser-scripts/ui-c-*.mjs` (`plans/` is git-ignored here, so they stay on disk only).

## What changed (by file)

| File | Change |
|---|---|
| `app/src/style.css` | Palette replaced by direction C: dark set on `:root`, light set on `:root[data-theme='light']`; category colours + matching ink (`--c-*`, `--ci-*`), port colours + edges (`--t-*`, `--t-*-edge`), chrome (navy bar) tokens, `--card-bg`, shadows. Mode sizes `--fs --fs-s --row --hh --ctl --tab-h --bar-h` for `data-mode` student / teacher, raised to 44 px under `@media (pointer: coarse)`. Top bar, buttons, dialogs, tabs, tutorial menu use the tokens; hard-coded dark hexes removed. |
| `app/src/editor/theme/ui-prefs.ts` (new) | Theme (light/dark) and mode (student/teacher): defaults (OS scheme, "Học sinh"), `localStorage` keys `xuong-noi:theme` / `xuong-noi:ui-mode`, writes `data-theme` / `data-mode` on `<html>`, listeners. Only a user choice is saved, so a device with no choice keeps following the OS. |
| `app/src/editor/theme/contrast.ts` (new) | WCAG ratio and `inkOn()` (white or near-black, >= 4.5) used for group header ink. |
| `app/src/editor/theme/ui-c-board.css` (new) | Cards (solid header, ink, tile, "?" disc, port rows, 3 dot shapes with edges, selected / hover / running / error), wires (thicker core, casing in light), badges, zoom rail, minimap, legend, crumb, notes controls. All rules start with `.app`, which only the editor has. |
| `app/src/editor/theme/ui-c-shell.css` (new) | Palette, properties panel (fields, steppers, switch with "Bật/Tắt" word, folds), console, scene tree, lessons, floating simulation frame chrome, dialogs, handbook, narrow-bar rules, coarse-pointer rules, focus rings. |
| `app/src/editor/top-bar.ts` | Segmented control "Học sinh / Giáo viên" and sun/moon button at the right; navy logo; 2D picker shortens at <= 1400 px. |
| `app/src/editor/app.ts` | Menu Xem: Giao diện (Sáng, Tối) and Chế độ hiển thị (Học sinh, Giáo viên). |
| `app/src/editor/properties-panel.ts` | "Nâng cao" fold and "Cài đặt mô phỏng" group: folded for pupils (one summary line), open for teachers; switch gets the word Bật/Tắt. |
| `app/src/editor/wiring-canvas.ts` | Wire casing path; wires re-measured when the mode changes; new cards placed with the current mode's card size. |
| `app/src/editor/graph/graph-geometry.ts` | `estimateNodeSize(node, metrics?)`: default is the legacy estimate (saved boards, samples and the puzzle keep their spacing). |
| `app/src/editor/graph/node-view.ts`, `group-view.ts` | Class `wc-err` on a card with a missing wire; group header ink. |
| `menu.css`, `icons.ts`, `shell-text-vi.ts`, `panels-text-vi.ts` | Restyled menus / segmented controls, sun and moon icons, new Vietnamese strings. |
| Tests | `ui-prefs.test.ts`, `ui-theme-tokens.test.ts`, `card-size-metrics.test.ts` (see totals). |

Not touched: `app/src/render`, `app/public/models`, `app/src/puzzle`, `graph.css`, `node-cards.css`, `wire-energy.*` (the puzzle shares them), entity colours. `git diff --name-only ecac6a9..HEAD` lists none of them. `data-tut`, `data-setting`, `data-param`, ids: same set before and after (one addition: `data-act="theme"`).

## From the preview, NOT built (and why)

Step 2 / not approved: lesson strip above the board, formula box, "Cổng nâng cao" fold on the card (ports still switched from Thuộc tính), status strip, icon rail, docked simulation column, "Chạy thử" switch, Bảng tin as a one-line strip in Học sinh (the dock stays as today).
Also left out: SVG icons instead of emoji (Từng bước, Hướng dẫn keep theirs); parameter label split into name + unit line; tablet / phone layouts; Hành động kept as the preview's dark red `#a5140f` (question 5 of the preview report is still open); the card "?" popup (`.ch-box`) keeps its cream look because the puzzle shares it; world switches stay checkboxes (they already are), only the folded summary is new.
Small deviations: the English sub-name may now widen a card (it used to be cut with "..."); on narrow windows the bar drops, in order, layout picker (< 1500), save note and shortcut "?" (< 1400), undo/redo (< 1300), logo (< 1180). All stay in the menus; the two switches stay on the bar down to 1024 px.

## Measured (headless Chromium, `ui-c-measure.mjs`, 1440x900, desktop pointer)

| | Học sinh light | Học sinh dark | Giáo viên light | Giáo viên dark | Old editor |
|---|---|---|---|---|---|
| Smallest text (px) | 12 | 12 | 12 | 12 | 10.5 |
| Smallest hit area (px) | 30 | 30 | 24 | 24 | 13 |
| Elements under the floor (28 / 24) | 0 | 0 | 0 | 0 | many |
| Port row / card header (px) | 34 / 50 | same | 24 / 34 | same | 26 / ~40 |

Floor excludes text drawn inside the board's zoom (cards shrink with the board zoom, as before) and the 3D view. Coarse pointer (`ui-c-touch-shot.mjs`, touch context at 1024x768): 0 controls under 44 px in both modes (the folded left rail's tabs reach 44 px with an invisible extension).
Wire ends vs port dots on all 7 samples, both modes: worst error 0 px (`ui-c-measure.mjs`). Drop settle, minimap, group view, crumb, step run, tutorial pointer measured from the DOM and checked in screenshots.

Contrast (WCAG ratio, computed from `style.css`; `ui-theme-tokens.test.ts` asserts the >= limits)

| | Light | Dark |
|---|---|---|
| text / text2 / text3 on panel | 15.8 / 7.8 / 5.6 | 14.1 / 8.4 / 5.9 |
| same on board | 14.0 / 6.9 / 5.0 | 15.3 / 9.1 / 6.4 |
| top bar text / secondary | 14.3 / 8.9 | 16.6 / 10.4 |
| header ink: Đầu vào, Logic, Tính toán, Vật thể, Hành động, Bộ não, Kết quả | 4.51, 5.04, 5.38, 4.68, 7.76, 6.04, 5.16 | 12.99, 7.00, 15.44, 6.29, 5.63, 11.12, 6.21 |
| card outline on board (non-text) | 3.26 (preview ~1.8-2.1) | 3.47 |
| field border on panel | 3.68 | 4.00 |
| port shape edge on card (bool / number / object) | 5.38 / 7.77 / 7.50 | 10.15 / 6.17 / 6.11 |

Light yellow fill alone is 1.81 on a white card; its dark edge (5.38) and shape carry it. Accent on panel 6.0 / 9.1; Chạy button 5.1 / 7.9. Never colour alone: port shapes, "Thiếu n dây" badge + dashed outline, Bật/Tắt words, "Đang chạy / Tạm dừng" text, selected = outline + halo.

## Cards that overlap in "Học sinh" (saved positions untouched)

Header 50 + rows 34 make cards about 25% taller than the layout the samples were drawn for (average card height px, old / Học sinh / Giáo viên):

| Sample | old | HS | GV | overlapping pairs HS (GV: 0 everywhere) |
|---|---|---|---|---|
| Robot dò đường | 152 | 194 | 142 | 1 |
| Robot tránh vật cản | 147 | 188 | 138 | 4 |
| Robot đi hình vuông | 140 | 178 | 131 | 1 |
| Cửa tự động | 172 | 220 | 161 | 14 (up to 54 px) |
| Tay máy tự gắp và đặt | 177 | 227 | 165 | 23 (up to 54 px) |
| Băng chuyền phân loại | 168 | 214 | 157 | 19 (up to 54 px) |
| Xe tự hành chở hàng | 249 | 318 | 232 | 6 (up to 44 px) |

Old editor: 0 pairs in all seven. "Sắp xếp gọn" fixes a board in one click; I did not re-lay out any sample or saved board.

## Proof that scene assets and the puzzle are unchanged

- Puzzle: `ui-c-puzzle-compare.mjs`, old build (:5302, `git archive` of `ecac6a9`) vs new (:5301), level 1 and 5 at 1280x720 and level 1 at 844x390: 0 differing pixels in all three (921,600 / 921,600 / 329,160 pixels). Cards keep `rgb(34,40,50)` body and `rgb(240,150,90)` header, no `data-theme`, no wire casing there. Shots: `compare/before-*`, `compare/after-*`.
- Simulation (robot sample, edit state, same window position, button hidden): 60,140 of 60,140 pixels identical (`ui-c-sim-static-diff.mjs`, `compare/diff-sim-static.png` is all black). While running, the scene is time-dependent, so `compare/before-sim-N.png` / `after-sim-N.png` (6 samples incl. arm, gripper, crates, AGV) are for eyes only: same models, colours, ground.
- No file under `render/`, `public/models`, `puzzle/` changed.

## Tests

- `npx tsc --noEmit`: clean.
- New: 3 files, 45 tests (theme/mode defaults, persistence and storage failures, the two switches' state logic, header ink for 7 categories x 2 themes and the 7 group colours, text / non-text contrast, mode size numbers, coarse-pointer tokens, card-size estimate).
- Browser (no DOM in vitest): `ui-c-switches.mjs` 13 PASS (clean-profile defaults for dark and light OS, both top-bar switches, menu Xem entries and ticks, reload keeps both, coarse pointer tokens); `ui-c-tutorial.mjs` plays lesson 1 (12 steps) and lesson 2 (14 steps) to the end in Học sinh, 37 PASS: the highlighted element is the expected card / row / port / button and fully on screen at every step.
- Full run `npx vitest run --testTimeout 300000` (alone, 995 s): 239 files, 3589 tests, all passed (no timeouts). Before it, an earlier run under load had only `step-break-samples` time out; it passed in the full run.

## Screenshots (`plans/reports/shots-ui-c-step1/`)

`{light,dark}-{student,teacher}[-1024]-N-*.png`: 1 empty, 2 robot sample, 3 sorter sample with a card selected (properties panel), 4 running (wire current), 5 step run, 6 handbook, 7 lesson pointer. Also `group-*`, `touch-*`, `tutorial/`, `compare/`. I looked at them: no clipped Vietnamese or overlaps found after the narrow-bar fixes (first runs showed the right cluster over the play buttons at 1024 and in 2D at 1280; fixed and re-measured with `ui-c-topbar-widths.mjs`: no overlap from 1024 to 1440 in both modes, 2D and 3D).

## Not verified

Real touch hardware, screen readers, colour-blind users (preview numbers carried over, not re-run), Safari / Firefox (Chromium only; the wire casing dimming uses `:has()`, Firefox 121+), the wire animation in motion (frames only), light-theme sticky notes / spark colours on a real projector, the old `plans/browser-scripts/tut-*.mjs` (they target the older UI; I wrote new ones).

## Open questions for the owner

1. Học sinh is the default and all 7 samples then show some overlapping cards (4 of them heavily). a) leave and rely on "Sắp xếp gọn"; b) re-lay out the samples once (needs your OK, positions change); c) a smaller header / row in Học sinh (breaks the 50 / 34 numbers).
2. Hành động stays dark red (`#a5140f`) as drawn in the preview; shift to orange-red as the preview report suggested?
3. Hide undo / redo, save note and shortcut "?" on windows under 1300-1400 px (all still in menus): fine, or keep them and drop the English term / mode text instead?
4. Emoji on "Từng bước" and "Hướng dẫn" stay for now: swap for line icons in step 2?

## Cards and wires = C (second round, commit `cdddd2c`)

Correction taken: cards and wires follow the preview, not today's look recoloured. Only the simulated scene stays out. The puzzle still shares `wire-energy.ts` / `graph.css` / `node-cards.css`, so the new look sits behind `.app` (CSS) and an `{ rich: true }` option (code): puzzle compare re-run, still 0 differing pixels in all three shots.

Wires (`ui-c-board.css`, `wire-energy.ts`): casing 4.6 under a 2.8 core in the type edge / colour (both themes, dark edge = colour as in the preview), glow 10 at 20 %, white running dashes (2 on, 14 off, 0.9 s) on live wires while playing (and the faint ones in edit mode as before), spark = white dot with a 3 px type-coloured ring, dotted hint wire for the drag preview (2 on, 9 off), pills on wires in the preview's chip style. Routed paths, knots and the plain bezier all get the same layers (casing is a sibling path, so any route is styled). Kept: current only while playing, step-run highlight, selection (thicker core + casing), `prefers-reduced-motion` hides dashes and sparks, wire-rule colours.
Motion check (`ui-c-motion-compare.mjs`, two frames 250 ms apart, sorter sample running): dash offset -13 px to -14 px (Chromium `getAnimations()` shows `wc-flow` running), 14-15 sparks at new positions, 835 pixels changed between frames; 12 live wires with dashes, 13 value pills. Frames: `compare-preview/motion-frame-1.png`, `-2.png`.
Cards: 184 px base width, 12 px radius, solid header + circle tile + name / EN sub-name + "?" disc, 3 dot shapes with 2 px edge, live halo only (no extra glow), value pills on number ports while running (absolute inside the row, so a card never changes width mid-run; the preview puts them beside the label), selected = accent outline + soft ring, hover = shadow + border, running = category-colour border, error = dashed border + "cần nối" tag + header badge, group card, note card (paper colours kept in both themes). Sizes per mode as before.
Side by side (`compare-preview/side-by-side-{light,dark}-{board,card}.png`): same structure, colours, shapes and states. Deliberate deviations: no "Cổng nâng cao" row (not approved); value pills sit at the card edge; the English sub-name can widen a card; the glow path sits above the casing; the note card keeps its paper colours; app boards are real samples so wires are denser than the preview's three cards.

Shipped boards: `relayoutShipped` (`graph/shipped-layout.ts`) spreads cards at the Học sinh size (52 + 34 per row, 24 px gap; positions only; notes move with their nearest card; collapsed group blocks pushed apart) when a menu sample, lesson board or handbook try-board is opened. Done at open time instead of editing ~140 board definitions, so the board code and every hash stay as they were; a test checks all 139 shipped boards (samples, lessons, handbook): only positions differ, zero overlaps at the Học sinh size. Browser check on the 7 samples, both modes: 0 overlapping pairs, wire ends 0 to 0.1 px from their dots. Looked at all 7 in light Học sinh, Giáo viên and dark Học sinh: `shots-ui-c-step1/samples/`; lesson and handbook boards covered by the test, not each by eye. `solid-off-unchanged` and the other hash tests are in the full run below.
Saved boards: never moved. Opened in Học sinh with overlapping cards, a dismissible bar at the top of the board says "Có mảnh ghép đang chồng lên nhau. Muốn xếp gọn lại không?" with "Sắp xếp gọn" and a close button, once per board (key kept in `localStorage`).
Legend: now a bordered pill with 16 px gap from the zoom rail, cluster raised to 16 px from the corner. Fit to screen: never below the zoom where the smallest card text is 11 px on screen (Học sinh 11/13 = 0.85, Giáo viên 0.92); a board bigger than the window is shown from its top-left at that zoom (pan to see the rest). Chosen because shrinking text below 11 px is what the owner flagged; the old floor was 0.6.
New tests: shipped boards (139 cases), fit floor, value pill text. Full vitest: see the line below.

Full vitest (round 2, alone, 774 s): 240 files, 3732 tests, 3731 passed; the one failure is `real-physics-on-hash` city-delivery-3d, which has its own 120 s timeout inside the file and took 130 s here; run alone it passes (44 / 44). All hash tests (`solid-off-unchanged` etc.) passed. tsc clean. Re-run scripts: measure (0 overlaps, min text 12, min hit 28 / 24), switches 13 PASS, tutorial 37 PASS, puzzle compare 0 differing pixels, motion check as above.
Not verified (new): the lesson and handbook boards by eye (only by the overlap test); Firefox / Safari; wire current on a slow machine with 150+ live wires (dashes are stepped to keep the cost low).

## "Xám dịu" (soft grey light theme)

Surfaces now `SOFT.s2`: bg #dfe3e8, grid #b9c1cc, panel #eceff3, panel2 #e3e7ec, raise #d8dde4, line #cbd2da, card #f1f3f6, card head #e3e7ec, card advanced #e8ebef. Text hues, wires, categories and the navy bar unchanged; dark theme unchanged. No pure white remains in the light tokens (a test asserts it); checked by eye in the dialogs, handbook, menus, inputs, console, coach tip and the floating simulation frame (`shots-ui-c-step1/soft/`).
Two tokens had to move because the softer board lowered contrast: `--text3` #5f6876 to #515b69 (faintest text on the board was 4.37) and `--card-line` #8a8577 to #767164 (outline was 2.86).
Contrast now (light): text / text2 / text3 on panel 13.7 / 6.7 / 6.0, on board 12.3 / 6.0 / 5.3; card outline on board 3.77; field border on panel 3.19; wire casing / port edge on board: yellow 4.17 (fill alone 1.62, so the casing carries it), blue 6.02, pink 5.81. Token tests updated (+9).
Legend pill: it was as wide as its box, so "Vật thể" spilled. It is now as wide as its words; verified contained in both modes at 1440 and 1024 (`ui-c-soft-shots.mjs`).
Merge of main (97a40ed): clean, no conflicts. After it: shipped-boards test 139+ cases green, measure 0 overlaps in both modes, switches 13 PASS, tutorial 37 PASS; 7 samples re-shot in light Học sinh (`samples/`), the new arm samples checked by eye, no overlaps.
Shots: `soft/` (light Học sinh and Giáo viên: empty, robot, sorter selected, running, handbook, Xem menu). Full vitest alone: 251 files, 3810 tests, all passed (820 s). tsc clean.
