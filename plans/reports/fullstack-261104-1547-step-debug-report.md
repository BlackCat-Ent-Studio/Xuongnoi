# Step debug run ("Từng bước") — report 2026-11-04

Branch `feat/step-debug` (worktree D:\workspace\GameBuilder-step, from d701b7d). Dev server :5236 left running. Not merged.

## Commits
- e18e111 feat(render): pause the game loop after a tick in which an accepted output rose
- ffd5e7d feat(puzzle): headless step session and game-clock time limit helper, with tests
- d5c373e feat(puzzle): step-by-step run button that pauses and lights the fired pieces

## How it works
- Runtime: new optional `lastTickRisen()` = bool outputs risen in the LAST tick only (takeRisen unchanged, wire-energy untouched).
- GameView: new `setStepBreak({accepts, onBreak})`. After each tick (never the ending one) the accepted risen keys are collected; if any, the loop breaks out, pauses (existing pacer pause) and calls onBreak once. Ticks, their order and world.step are unchanged, so the trajectory cannot differ. stop()/play() clear the rule.
- Board: `isOutputShown(node, port)` (pin is on screen, so scenery, hidden touch cards, `shownPorts {}` and hidden pins never pause) and `setStepLit(keys)`: lit cards = fired + targets of their outgoing wires, lit wires = wires leaving a fired pin, rest faded with the existing pz-focusing / pz-faded / pz-lit look (no new CSS for the look).
- Level screen: wood button "🐢 Từng bước" between "↺" and CHẠY (class `pz-btn small`, only the pill width added). It starts a run with the board big and the stage as PiP. While paused the same button reads "▶ Tiếp" (dimmed while the game runs between pauses). DỪNG = normal stop. Hidden in a normal run and after the end. Ignored while the guide leads (toast). Time limit uses `timeIsUp(tickIndex)` = game ticks only.
- Headless: `createStepSession` (puzzle/step-run.ts) runs the same tick/world.step loop and shares `stepBreakKeys` with the browser loop.

## Tests (tests/puzzle/step-run.test.ts, 16)
- All 7 levels with their solutions: world state at every pause, final state and result equal runLevel's per-tick trajectory; plus a timeout run.
- Pause only on shown cards/pins (scenery never, hidden pin never), first pause = start card at tick 0, one pause per tick with several outputs rising together (seen on a real level), ticks strictly increasing.
- Time: `timeIsUp` by ticks; a paused pacer yields 0 ticks over a minute of wall time and resume does not replay it; a stuck run with pauses ends at exactly the limit like runLevel.
- Gates: `tsc --noEmit -p .` clean; full `vitest run --testTimeout 120000`: 160 files, 2682 tests pass.
- Line endings: `git diff --stat` equals `-w` (crlf files kept).

## Screenshots (plans/reports/shots-step-debug/, all read)
`l{2,5}-{phone,desk}-{1-topbar,2-first-step,3-later-step,4-won}.png`, plus `base-*` (before). Scripts: plans/browser-scripts/stepdebug-shots.mjs and stepdebug-lib.mjs (port 5236).
- Phone 844x390: bar = back, title, task, stars, gear, ?, ↺, 🐢 Từng bước, CHẠY. Measured, no overlaps (L2 title 60-187, task 194-280, stars 363-457, step 611-724, run 732-831). Long titles still ellipsize.
- First step (L2, L5): "Khi bắt đầu" lit with its wire and target, rest faded, board big, stage PiP, button "▶ Tiếp". Later steps and the win ("Qua màn!") reached by stepping, at both sizes.

## Notes / concerns
- Rule is "output pin shown", slightly stricter than "card shown": a hidden out pin of a shown card never pauses (it has no wire to light).
- L5 has very many pauses (every shown bool rise: sensors, timers; the Playwright loop needed well over 100 iterations). That is what 1b asks; if too many for the client, later options: collapse repeated rises of the same pin, or a "chạy tới cuối" button. Not built.
- Fired card and wire-target card look the same (both un-faded), per "lighting only".
- On phone the free board opens with cards under the top bar (existing behaviour, unchanged).
- New visible button: the user must see it on :5236 before merge (rule 5). level-03, block node and registry untouched.

## v2 (after the L3 feedback) — branch merged with main 714b6a0 (fast-forward, clean)

Rule 1a: a pause needs a shown output pin that rose AND has a drawn wire leaving it (`board.hasWiredOutput`). Unwired rises never pause.
Lighting 2a (pure function `stepLight` in puzzle/ui/step-light.ts, used by the board):
- fired pin dot: class `pz-fired-pin` (scale 1.6, white ring + sun glow, gentle pulse; reduced-motion = no pulse). Existing colours only.
- "what": wires leaving the fired pins + target cards; also any wire from a fired card straight to a character/object card (e.g. "Đi ngang" -> Mèo) even if that pin did not fire.
- "who": character/object cards wired INTO the fired card, with those wires.
- stage: those objects (and a fired object card) get the existing silhouette glow via `GameView.setHighlight`; cleared on Tiếp, stop, end.
- everything else keeps the `pz-stepping` fade (cards .2, wires .1). No text.
Extra: at each pause the board frames the lit cards (`frameLit`: pan the least, or zoom out about the lit box down to the board's min zoom). Needed because the board cannot be panned while running, and on L3 the lit cards were off screen.

Tests: step-run.test.ts now uses the wired rule (identical trajectory/result vs runLevel on all 7 levels still holds; a test proves unwired rises never pause and that the wired rule pauses strictly less on some level); step-light.test.ts (who/what/action-wire/object glow, frameLit). tsc clean; full vitest see Status.

Shots (shots-step-debug/): v2-l3-desk, v2-l3-phone (+ `-stage` = stage swapped in, shows the cat outline), v2-l2-desk, v2-l2-phone. Scripts stepdebug-v2-shots.mjs.
- L3 pause 2: "Chạm nhau" (Mới chạm) lit with pin glowing, Mèo + Sao 1 lit as who, hide wire to Sao 1, "Đang ẩn" pin of Sao 1 glowing, rest faded.
- L2 pause 2: Công tắc nhớ "Đang bật" + Chạm nhau "Đang chạm" pins glow, Bot and Nút đỏ lit as who.
Concern: in L3 the star hides in the SAME tick the pause fires, so Sao 1 is already invisible on the stage and only the cat outline shows. Pausing one tick earlier would change when the pause happens (not done).
