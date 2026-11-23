# Hints rework report (branch feat/hints, worktree D:\workspace\GameBuilder-hints)

Commit: "feat(puzzle): one-step hints with free-hint badge, forced level 1 guide and new-piece intros"

## Done
- Level 1: guide is mandatory the first visit (no "Bo qua", no replay button). Marked seen on first win. Later visits free play + "Huong dan" replay (replay skippable). "?" while guide leads: cat nods, not counted.
- Levels 2-8: no auto guide, no replay button. "?" reveals the first undone solution step (`nextHintStep`, same generator as guide; decoy tray pieces ignored since only solution pieces are steps): cat line + spotlight + hand + dotted ghost wire. Disappears when step done, after 7 s (extended 3.5 s while a port is picked / param editor open), or on tapping the cat bubble.
- Every "?" press that reveals a step counts (also repeat press on same step, per spec). All-joined press: cat says "Bam CHAY nhe!", not counted.
- Badge on "?" = free hints left; at 0 it turns red with a crossed star (aria-label says next press costs a star). Level 1 starts red (0 free).
- Win note updated ("Dung it goi y hon de them sao" / "Con cach dung it manh hon day"). Stars: `starsFor(level, answer, hintsUsed)`.
- New-piece intro (levels 2-8): once per level, one line per unseen tray kind ("<name>: <purpose>"), cat only, auto-hides 4 s or tap, queue advances. Remembered as `intro:<levelId>` in `xuongnoi.puzzle.guideSeen`. Free.
- Bug fixed (board-view.ts): param popover closed after every +/- tap and showed a stale number after the first change (placed piece object replaced on each change). Needed for "set number" hint steps (level 3: 5 -> 3).

## Files
src/puzzle/ui: guide.ts, guide-script.ts, guide.css, hint-rules.ts (new), level-screen.ts, puzzle-text.ts, puzzle.css, board-view.ts (popover fix only).
tests/puzzle: hint-rules.test.ts (new: counter/badge, first-undone step, intros across levels, forced level 1, per-level memory), guide-script.test.ts (adapted: only level 1 has full guide; steps for 1-7 from solutionSteps).

## Verification
- tsc clean; vitest tests/puzzle + tests/editor 308 pass; build OK.
- Playwright (port 5208, stopped after): L1 first visit (guide on, no skip, no replay), L1 revisit (replay shown, replay has skip), L2 intro (2 lines, ~4 s each, no spotlight, gone at 9 s), L3 badge 2 -> 1 -> red star after 2nd press, 3 presses then solve = 2 stars + new win note, L6 no hints = 3 stars, L2 all joined: cat says run, badge unchanged. No console errors.
- Shots: D:\workspace\GameBuilder\plans\reports\shots-hints\ (read: level1-first, level2-intro, level3-hint1, level3-win).
- git diff --stat vs -w differ by 1 line in guide-script.test.ts: a real re-indent, not EOL damage.

## Notes
- Spec wording "2 -> 1 -> 0 -> red": red shows when 0 free left (after the 2nd press on L3); the 3rd press is the one that costs a star (L3 3 presses = 2 stars, verified).
- Level 1 forced guide is considered done on first win; leaving mid-way makes it forced again next time.
- Not verified: real touch, decoy pieces from the parallel levels change (logic is unit-safe, UI untested with decoys).

Status: DONE_WITH_CONCERNS
