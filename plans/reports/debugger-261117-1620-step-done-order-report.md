# Step "Xong bước" feedback order - report

Branch fix/step-done-order (worktree D:\workspace\GameBuilder-stepfix), commits 7d0d9f1 + merge 1c5b4ea (main fc93d95 merged, clean, no conflicts). Not pushed.

## Proven cause
- Bug is real but NOT in the minimal wiring. Tested sequence -> value-table -> joint -> reached -> done (1 joint, all 6 id orders) and 2 joints + `and` (720 orders): never skips, only 0/1 tick timing differences (compile cuts one edge of the loop, loop delay is 1).
- Skip needs TWO cut edges on the path index -> table -> joint. Happens when the loop through the sequence is part of a bigger tangle (arm chain, gripper inReach, grip-ok timer loop, 2nd loop sequence.finished -> not -> and -> done). compile.ts then forces several cards by smallest id, each force cuts its own incoming wires.
- Real trace (auto-arm with steps 4/5 on swing.reached, random card ids, case that placed 0 crates): order `... swing, shoulder, upper, tbl-swing, ..., a-cycle`; back edges `a-cycle.index -> tbl-swing.index` AND `tbl-swing.value -> swing.angle`.
  - t206: seq enters step 4, index=4. tbl-swing(t206) reads index(t205)=3 -> 0.
  - t207: tbl-swing reads index(t206)=4 -> 180, but swing(t207) reads tbl(t206)=0 (still old target), reached=true; swing runs BEFORE seq, so seq(t207) sees fresh stale-true reached, step 4 ends after 1 tick (idx 5 at t207, swing at 0.0).
  - Target is 2 ticks behind the index (2 back edges), done is fresh (0 back edges) => reached describes the old target. Step skipped. 4 of 40 random id sets placed 0 crates (12, 24, 25, 32); the other 36 placed 6.

## Fix chosen (general, id-independent)
- `PortDef.feedback?: boolean` (types.ts). Sequence `done1..N` ports set it.
- compile.ts: before Kahn, every wire into a `feedback` input that lies on a loop (target node reaches source node) is made a back edge. The rest of the loop is then evaluated in order within one tick, so seq(t) emits index, table/joint/reached see it in the same tick, seq(t+1) reads a correct done. Loop delay is always exactly 1, whatever the ids/order. Wires into feedback ports NOT on a loop stay forward (no behaviour change, e.g. pick.inside -> done1). Unknown kinds -> ignored.
- A done already true on entry still ends the step (level), 1 tick later when it is in a loop.
- Source-agnostic: joint/piston/go-to/timer/any output works, since the fix is on the receiving port.
- Rejected: (b) settle window - needs the engine to tell the card the real loop delay (extra plumbing), and ids would still change timing by a tick; (c) joint reached false on target change - only fixes joints; (a) as "smallest id except one edge" cannot guarantee 1 cut per path in a shared loop (the proven failure), declaring the cut port does.
- Old boards: dormant unless a card has a feedback port wired on a loop; only showDone sequences have one.

## Files
- src/engine/types.ts (+5), compile.ts (+33/-4), src/nodes/sequence.ts (+2)
- src/samples/auto-arm-board.ts: removed c-place, at-place, c-home, at-home; done4 and done5 now `swing.reached`. Cards 4 fewer, wires 6 removed + 2 added (net -4). Note text updated.
- tests: new tests/nodes/sequence-done-feedback.test.ts (swing/2 joints/and/not loop, 403 sampled id orders of 8 cards: no step ends before joints are at its angles, identical run for every order; verified FAILS without the fix: skipped steps [2,2,4,4], and passes with it); tests/engine/engine.test.ts +1 compile test; tests/io/auto-arm-sample.test.ts essential/optional wire lists updated (CRLF kept).
- Lesson arm-steps: not changed (needs nothing; its tests pass).

## Verification
- `npx tsc --noEmit -p .` clean after merge.
- Full `npx vitest run --testTimeout 300000` after merging main: 216 files, 3310 tests passed, 0 failed (678 s).
- Before merge, focused run (engine, nodes, io, tutorial, handbook) had 3 failures: 2 were auto-arm test wire lists (fixed), 1 city-delivery "careful player wins (dice seed 1)" - passed in the final full run; it was not touched by my change (appears timing/load flaky under the default 5 s timeout); not investigated further.
- Auto-arm 4 id/order variants test passes: same 6 crates placed. Random 40 renames: all placed 6.
- Baselines: tests/editor/solid-off-baseline.json and solid-on-summary.snap.json NOT modified and all editor baseline tests pass => no changed keys (even for sample:auto-arm / lesson:arm-steps; not investigated why the removed cards left the recorded hash unchanged, presumably the baselines do not cover those rows' trajectories).
- Line endings: `git diff main --numstat` == `-w` for every file.

## Not verified
- Browser/visual run of auto-arm; the baseline coverage claim above.
- Other consumers of done-style feedback (counters, latches, piston-driven loops) are not covered by a port flag; only sequence done inputs are. Any card can opt in by setting `feedback: true` on an input.
- Loops that do not pass through a feedback port still cut at smallest id (unchanged, old-board behaviour).

## Unresolved
- Should other "level done" inputs (e.g. next-step style ports on other cards) get the flag too?
