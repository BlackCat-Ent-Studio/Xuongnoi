# p-seq report (branch feat/p-seq, worktree D:\workspace\GameBuilder-pseq)

## What changed
- `src/nodes/sequence.ts`: max 12 steps; optional inputs `done1..doneN` (N = step count) shown only when advanced param `showDone` = yes ("Hiện cổng Xong từng bước"). While at step k and `donek` is true (LEVEL) the sequence advances one step per tick; `next` edge and `reset` unchanged and can be mixed (still max one step per tick; reset wins).
- `src/nodes/select-number.ts`: max 12 choices.
- Old boards: `outputs` keep exactly step1..6 + index + finished (is1..6 + changed). step7..12 / is7..12 are `optionalOutputs`, active only when count > 6. `evaluate` emits only the ports the card shows (max(6, count)), so old counts emit the same keys as before. `solid-off-unchanged` (every sample, lesson, handbook board) passes: 0 baseline entries changed; solid-on snapshot untouched.
- `src/nodes/node-names.ts`: names for is/step 4-12 and `doneK` ("Xong bước k" / "Step k done").
- Labels: "Số bước (2-12)", "Số lựa chọn (2-12)"; sequence description mentions the done ports.
- Handbook: sequence page (steps 1-12, done1-12 ports, `showDone` param, tips, limit 12), select-number page (is7-12, limit 12). Handbook try-boards NOT changed (one try-board per page and its hash is in the baseline; adding/changing would alter baseline entries). Samples and lessons not edited; no lesson text stated the 6 limit.
- `src/editor/wiring-canvas.ts` (small, outside the brief but required): the canvas did NOT redraw a card when a setting adds/removes ports (existing bug for pid "Hiện ba phần P, I, D" too, reproduced). Now a `params` change redraws the canvas only when some card's active port ids changed. Without it a learner toggling "Hiện cổng Xong từng bước" would see nothing until another edit.

## Findings on "how the card decides step ports"
It did not: step1..6 were static outputs, so every card always drew 6 "Bước" ports even with stepCount 2. To keep old cards identical (and old saved wires valid) I kept "always the first 6, more only when count > 6" rather than "only up to count". Cards with count 7..12 show exactly count ports.
Known cosmetic limit: ports 7-12 are appended after "Đã hoàn thành" / "Khi đổi" (registry concatenates fixed then optional ports; reordering would change old cards).

## Order independence
Test `sequence with "Xong bước" ports in a feedback loop` (tests/nodes/brain-nodes.test.ts): 3-step looping sequence, each step light goes through an Or card back to that step's done (condition true on arrival). Ids sorted three ways (buffers before sequence, after, mixed): timeline identical `1,2,3,1,2,...` one step per tick, no skip/stick. Test asserts each step lasts <= 2 ticks and same step order in all three.

## Tests
- Added/updated: brain-nodes (level done, one-per-tick, mix with next/reset, 12 steps, shown ports, clamp 2..12, feedback order), logic-small (select 7-12, optional ports), handbook content tests now check "all always-shown ports documented and no unknown id" using knownInputs/knownOutputs.
- `npx tsc --noEmit -p .`: clean.
- Focused: tests/nodes, tests/handbook, tests/io, tests/tutorial, solid-off-unchanged: pass.
- Full run: see final status below.

## Screenshots (read by me)
D:\workspace\GameBuilder\plans\reports\shots-p-seq\: `sequence-12-done.png` (+ `card-sequence-12-done.png`), `select-12.png` (+ `card-select-12.png`). 12-step card with done ports shows 14 inputs / 14 outputs, tall but legible, no overlap; 12-choice card 1 input / 13 outputs, legible. Only console message: one 404 (resource, unrelated).

## Notes
- No CSS, no new kinds, no sample edits.
- Dev port 5282 server stopped.
