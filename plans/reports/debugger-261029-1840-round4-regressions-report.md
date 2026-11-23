# Round 4 regressions - report

Worktree D:\workspace\GameBuilder-round4-fix, branch fix/round4-regressions (4 commits on top of main 23c1b6b). Dev port 5184.

## 1. Lesson 1 regression - root cause + fix
Evidence: probe after dropping key at canvas (60,380): node at world (20,592) = screen y 704, below the canvas (579 tall, dock under it). Stick dropped at (60,260) landed at world x=-176 (off-view left).
Root cause: placement (findFreeNodeSpot) treats the bottom-left corner rail (x12..250, y344..566 + gap) as blocked, then searches 840px radius with NO visible-area bound. Drop on/near the rail -> nearest free spot was off-screen (left or below). Fit was NOT the cause (view stayed translate(40,40)).
Fix (node-placement.ts, node-actions.ts, wiring-canvas.ts): findFreeNodeSpot takes optional `visible` world box. Candidates must be fully inside it; if no clear gap in view, node stays at the drop point clamped into view (never jumps away, never below dock). Clear drop point is unchanged. Unit tests added (4 for nodes, 1 for notes) in tests/editor/graph-helpers.test.ts.
Result: tut-dock-e2e 54 PASS / 0 FAIL (lessons 1 and 3 inside it). tut-lesson11 FAILED_COUNT 0. l14-run ALL PASS (3 of 3 runs). tut-lesson10 pass. tut-dock-1280 pass.
Script change: tut-dock-e2e fit selector `getByText('Vừa màn hình')` -> `.wc-corner [aria-label="Vừa màn hình"]` (button is icon-only now).

## 2. Pause in the PiP - NOT a bug
Temporary probe (removed, not committed) exposed world.entities() positions. Nhặt sao in PiP: running -> positions change; paused, 4 samples over 2.1 s -> positions identical (1 distinct value), while canvas md5 had 4 distinct values. So sim is frozen (pacer.stepsFor = 0); only render continues: SceneView.sync(dt) figure idle animation + camera update. This is the documented contract (app-contracts: "Freezes the simulation; rendering keeps running"). No code change. Optional later: pass dt=0 to draw() while paused to make canvas fully still.

## 3. Stale scripts - updated, both pass
- check-portal-camera-win: win detection regex stripped hint with `Chạm cổng tím[^⛶]*`; the ⛶ button no longer exists, so regex ate the win text. Now `Chạm cổng tím.*?về lại\.`. PASS.
- check-editor-tools: "Tạo mới" -> Tệp menu > "Tạo game mới". Further stale spots: marquee start (cv.x+4) hit the vertical splitter (+14 now), marquee end/third node/note drag landed under PiP (moved), launchpad card appears on emptied board (click "Tự làm" to dismiss). ALL PASS.

## 4. Sweep (plans/browser-scripts/sweep-round4.mjs, new) 1440x900, 1280x720, 1024x700: all PASS
Top bar 1 row (h=40, no overflow), 4 menus open, PiP visible and plays Nhặt sao (canvas changes, .pip.playing), no console errors, launchpad clear of PiP and corner.
Two real defects found and fixed:
- Launchpad overlapped the bottom-left corner rail at 1280x720 (card 72..632 x 158..384 vs rail 57..295 x 236..459; canvas only 399 tall so no layout fits both). Fix: lessons-dock.css hides .wc-corner while the launchpad shows (nothing to zoom on empty board; insets treat hidden as zero). tut-dock-1280 check rewritten from "centred" (card is deliberately shifted left of PiP) to "clear of PiP and corner".
- First-run prompt "Bạn muốn học..." (.tut-invite, shares .menu z-index 50) covered the Tệp > Mở game mẫu submenu at 1024. Fix: .tut-invite z-index 45.
Also fixed (found via l14-run flake, 1 of 2 runs): new sticky note landed under the PiP. findFreeNoteSpot now takes overlays + visible area (canvas.placementAreas()).

## Gates (app/)
vitest 54 files / 723 tests pass; tsc --noEmit clean; npm run build OK.

## Not verified
- Lessons 2,4-9,12,13 and other tut-*.mjs (tut-run, tut-l2-only, probes) not run; lesson 10 only.
- Not run at 1024 or 1280 for lessons; 1024 top bar is one row but "Hướng dẫn" and "Bố cục" labels are clipped (screenshot seen), not fixed.
- Full-viewport drop point beyond view (very zoomed-out/in) not tested.
- 3D mode in PiP, Firefox/Safari, real GPU.
- Splitter overlaps first 4px of canvas left edge (marquee start blocked there); left as is.
- Docs/HANDOFF not updated.

Status: DONE_WITH_CONCERNS
