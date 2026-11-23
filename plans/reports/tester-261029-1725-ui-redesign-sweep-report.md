# UI redesign sweep and polish report (wave 3)

Branch `feat/ui-polish` in `D:\workspace\GameBuilder-ui-polish`, 4 commits on top of main (ef2c21c, f3b0cc4, 6e78906, b916c3e). Gates in `app/`: vitest 708/708, `tsc --noEmit -p .` clean, `npm run build` OK. Dev server was port 5180, headless Chromium with SwiftShader WebGL.

## 1. Sample sweep (final code)
Every bundled sample was loaded from Tệp, checked in edit view, played 3 s, then stopped. Per cell: no horizontal overflow, top bar on one row, no clipped text in docks/nodes/tabs (programmatic probe), canvas present, 0 console errors/warnings, 0 overlapping nodes, 0 Bảng tin issues.

| Sample | Mode | 1440x900 | 1280x720 | 1024x700 |
|---|---|---|---|---|
| (empty board + launchpad) | 2d-side | PASS | PASS | PASS |
| Nhặt sao | 2d-side | PASS | PASS | PASS |
| Thu thập | 2d-top | PASS | PASS | PASS |
| Nhảy cóc 3D | 3d | PASS | PASS | PASS |
| Chìa khoá và cánh cửa | 2d-side | PASS | PASS | PASS |
| Cuốc đá mở đường | 2d-side | PASS | PASS | PASS |
| Lính gác | 2d-top | PASS | PASS | PASS |
| Bot dọn dẹp | 2d-top | PASS | PASS | PASS |
| Mê cung | 2d-top | PASS | PASS | PASS |
| Bot leo bục | 2d-side | PASS | PASS | PASS |
| Võ đài | 2d-side | PASS | PASS | PASS |
| Đua xe về đích | 2d-top | PASS | PASS | PASS |
| Xúc xắc và vùng | 2d-side | PASS | PASS | PASS |
| Cổng dịch chuyển | 2d-side | PASS | PASS | PASS |
| Né và bắn | 2d-side | PASS | PASS | PASS |

45/45 cells pass. Mode comes from the sample file; only Nhảy cóc is 3d, so the 3D path is covered by that one sample (switching other samples to 3D was not tried).

## 2. Play controls (Nhặt sao, default layout, 1440x900)
`play-controls.mjs`, 26/26 PASS, 0 console errors. Frozen/moving is measured by the blue character's pixel position (tolerance 2-3 px).

| Check | Result |
|---|---|
| Play switches to Màn chơi, first button becomes "Chơi lại" | PASS |
| Arrow key moves the world | PASS |
| Tạm dừng: `.paused`, frozen with key held for 800 ms, button reads "Tiếp tục" | PASS |
| Từng bước: enabled only while paused, advances the world, frozen again afterwards | PASS |
| Tiếp tục clears pause | PASS |
| Ctrl+Enter stops, then starts | PASS |
| Live edit speed 5 to 0 during play: log "Đã đổi giá trị khi đang chơi", character stops | PASS |
| Dừng: value 0 kept in the Inspector | PASS |
| Add "Cầm/Thả" -> issue "chưa nối dây vào Nhân vật", tab badge equals row count | PASS |
| "Xem" centres the node (dx=0, dy=0); Ctrl+Z removes the added node | PASS |
| Scene tree: clicking the last row selects the node and pans it into view | PASS |

## 3. Lessons
| Script | Lesson | Result |
|---|---|---|
| `tut-dock-e2e.mjs` | 1 (12 steps), 3 (14 steps), launchpad, search-hidden palette item + "Chỉ cho tôi", overlap card/game | 54 PASS, 0 FAIL, 0 console errors (re-run after final commit) |
| `tut-lesson11.mjs` | 11 (28 steps, dice and zones) | 28 PASS, 0 FAIL |
| `l14-run.mjs` | 14 (13 steps, editor tools) | ALL PASS |
| `check-show-me-canvas.mjs` | "Chỉ cho tôi" on a wiring step switches Màn chơi to Bảng nối; a palette step leaves the tab alone | 6/6 PASS |
| `check-invite-dismiss.mjs` | Invite hidden when a lesson starts | 4/4 PASS |
| `check-launchpad-hint.mjs` | Launchpad vs canvas hint | 5/5 PASS |
| `tut-dock-1280.mjs` | lesson 1 at 1280x720 overlap | 0 FAIL |

## 4. Bugs found and fixed
| # | Cause (proven) | Fix |
|---|---|---|
| 1 | `required: true` on `portal.partner`, `teleport.dest`, `go-to.target`. Each has an alternative (portal "Mã cặp" or a one-way wire, teleport and go-to position params), so the Bảng tin listed false issues in the Cổng dịch chuyển and Bot dọn dẹp samples (found by listing issue rows per sample). | Removed `required` from those three ports. Test added: no bundled sample reports a missing wire. |
| 2 | Samples kept their old hand-made positions; nodes are taller now, so 1 to 18 node pairs overlapped per sample (measured with DOM rects, 14/14 samples). | Positions only: nodes processed top to bottom, pushed down past what they overlap, using real DOM sizes. Now 0 overlaps in all samples. IDs, wires, params untouched; CRLF kept per file. |
| 3 | "khối" strings left in panels/console/shell text files (new files written after the naming rename). | Reworded to "mảnh ghép" (tab, search, counts, Inspector, shortcuts, console). |
| 4 | Launchpad card is translucent, so the canvas's own "Bảng trống..." hint showed through behind it (screenshot). | CSS `:has()` hides the hint while the launchpad shows. |
| 5 | The first-launch invite ("Bạn muốn học cách làm game không?") stayed on screen over the Inspector/game after starting a lesson from the launchpad. | `start()` now hides it and marks it seen. |

## 5. Requested leftovers
1. Dead CSS: removed `.tut-panel`, `.tut-head`, `.tut-progress`, `.tut-lesson`, `.tut-exit`, `.tut-title`, `.tut-text`, `.tut-explain`, `.tut-actions`, `.tut-btn`, `.tut-skip`, `.menu-sep`, `.menu-empty`, `.panel-hint`, `.palette-group`, `.palette-cat` from `style.css` (each had no reference in `src/**/*.ts`; `.tut-lesson-item`/`.tut-lesson-summary` were first removed by my regex by mistake, then restored since the menu still uses them). `cat-*`, `color-*`, `dot-*`, `type-*`, `pn-cc-*`, `t-*` look unused by a static grep but are built with template strings, so they stay. No `.wc*` leftovers remain in `style.css`.
2. Bottom dock default height 188 to 244 px (`layout-model.ts` + CSS fallback). Saved sizes still win. At 1280x720 the centre keeps about 380 px.
3. "Chỉ cho tôi" switches the centre tab to Bảng nối when a step points at a `.wc-` node or port (`pointsAtCanvas`, `revealGraph` dep). Verified in the browser.
4. Tutorial step checks were not touched (still kind + port).

## 6. Browser scripts migrated (`plans/browser-scripts`, main working tree, not committed)
- 46 old scripts moved to the dock: `.tut-panel`/`.tut-progress`/`.tut-title`/`.tut-exit` to `.ld-*`; "Mở ▾" + `[data-sample]` to the Tệp menu by sample name; `[data-lesson]` scoped to `.menu-item`; `[data-act="add-note"]` to the palette note item; port via `PORT` env (default 5173); `file:///...smoke` imports to `playwright` / `./tut-common.mjs`.
- The play button now reads "Chơi lại" while playing, so old "click play again to stop" became `.pbtn.stop` through an inline toggle (29 scripts).
- Renamed titles in lessons 11, 12, 13 ("khối" to "mảnh ghép"). Long-lesson viewports raised (tut-lesson11 to 1920x1700) because the canvas is shorter now and drop targets at y=700-900 fall behind the bottom dock.
- New scripts: `sweep-ui.mjs`, `sweep-issues.mjs`, `sweep-overlaps.mjs`, `relayout-samples.mjs`, `play-controls.mjs` (+ `charx.py`), `check-show-me-canvas.mjs`, `check-invite-dismiss.mjs`, `check-launchpad-hint.mjs`. `common.mjs` takes `PORT`, `SCRATCH`, `VP` env vars. Scripts importing `playwright` need a directory with it installed (junction to the old smoke folder was used).
- Run for real: tut-dock-e2e, tut-dock-1280, tut-lesson11, l14-run and the new ones. All other migrated scripts only pass `node --check` (syntax), not a browser run.

## 7. Screenshots (scratchpad)
Folder `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\28feef90-daae-4318-8ffa-6bf07e972cef\scratchpad\`
- `sweep\` (per viewport: `<w>-empty.png`, `<w>-<sample>-edit.png`, `<w>-<sample>-play.png`), for example `sweep\1440-Nh-t-sao-nh-y-2D--play.png`, `sweep\1280-C-ng-d-ch-chuy-n-qua-v-c-edit.png`, `sweep\1024-Ch-a-kho-v-c-nh-c-a-2D--edit.png`, `sweep\1440-empty.png`, `sweep\1440-Nh-y-c-c-3D-play.png`
- Play controls: `pc-1-loaded.png`, `pc-2-playing.png`, `pc-3-paused.png`, `pc-4-inspector.png`, `pc-5-stopped.png`, `pc-6-xem.png`, `pc-7-scene-tree.png`
- Lessons: `tutorial\00-launchpad.png`, `tutorial\01-l1-intro.png`, `tutorial\03-l1-playing.png`, `tutorial\14-l3-won.png`, `tutorial\dbg-before-key-wire.png`
- Raw result lists: `final-sweep-1440x900.txt`, `final-sweep-1280x720.txt`, `final-sweep-1024x700.txt`, `final-issues.txt`, `final-overlaps.txt`, `l11-result.txt`
- Note: the `sweep\` screenshots of the first pass were overwritten by the final pass, except those taken before the rename (a few still show the old "Khối" tab text).

## 8. What remains
- Mockup has a bottom status bar (game name, "9 mảnh ghép, 8 dây", "1 việc cần sửa", zoom, "Bấm ? để xem phím tắt"). The real app has none; it was in no plan item. Needs a decision.
- Palette descriptions are cut to one line with an ellipsis; the mockup wraps them to two lines.
- Lesson boards (`createBoard`) also use old node positions: lesson 11 shows 4 "Hộp" nodes overlapping by about 10 px. Only samples were re-laid out. A generic overlap pass at lesson start would fix it, but lesson e2e scripts drop nodes at fixed coordinates, so it needs a rerun of all lessons.
- The floating zoom toolbar/legend at the canvas bottom-left can hide a node dropped there (found when the shorter canvas put a lesson-1 key node's port under it, `tut-dock-e2e` key drop moved from y=460 to 380). Smart placement could avoid that zone.
- Lessons 12 and 13 scripts (and 10) are migrated and the viewport raised, but were not run again.
- HANDOFF.md was not updated (not in this task).

## 9. Not verified
- No real GPU or Firefox/Safari; SwiftShader only. Frame rate untouched.
- Only Nhảy cóc covers 3D; no 3D live-edit of look/colour.
- Splitter dragging with a real mouse, keyboard-only flow, touch, screen readers, hover states.
- Pause/step/live-edit were measured on one sample (Nhặt sao). The other 13 samples were only played for 3 s without input, so "show the game" means canvas present and no console error, not that the gameplay logic was checked.
- The "clipped text" probe only flags elements that hide overflow with scroll width larger than client width; palette ellipsis is excluded by design. A few eyeballed screenshots, not every cell.
- Old browser scripts beyond the five run (see section 6).
- Google Fonts offline fallback.

## Unresolved questions
1. Add the mockup status bar, or leave it out?
2. Should palette descriptions wrap to two lines like the mockup?
3. Re-lay out the lesson boards at lesson start (needs lessons rerun)?

Status: DONE_WITH_CONCERNS
