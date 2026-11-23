# Puzzle phone layout fixes (worktree D:\workspace\GameBuilder-uiphone, branch fix/puzzle-phone)

Commit 387cad3 "fix(puzzle): single scrolling tray row and guide bubble that avoids the spotlight on phones". Dev server 5224 stopped.

## Changes (all under app/src/puzzle/ui/, LF files kept LF)
| File | Change |
|---|---|
| puzzle.css | `.pz-tray` nowrap, `overflow-x:auto`, hidden scrollbar, chips `flex:none`; bottom padding so chip shadow is not clipped. Touch drag is native. |
| level-screen.ts | wheel listener on tray turns wheel into sideways scroll (only when it overflows). |
| guide.ts / guide.css | removed `mascot-low` top/bottom CSS switch. New `placeMascot(ring)`: tries 3 rows x (left,right,center) plus above/below/left/right of the ring, picks first spot not touching the ring (+6px margin) else least overlap, clamped inside screen, under the HUD. No ring (intro, tip, bye) = top-left. Task-box hide rule (`mascot-on`) untouched. |
| board-view.ts | card scale ladder extended with 0.52 and 0.46 so 12+ cards fit above the bottom bar (L7 built board). Card look, wires, level data untouched. |

## Verification
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 120000`: 140 files, 2315 tests passed (run alone; running it parallel with Playwright timed out once).
- Script D:\workspace\GameBuilder\plans\browser-scripts\puzzle-phone-shots.mjs (7 levels x 844x390 and 1280x720: empty, guide start, 6 guide steps, L7 wired 17/17 both sizes). Result: ALL CHECKS PASSED. Asserts: all `.pz-chip` share one offsetTop; mascot rect inside screen and not intersecting `.pz-spot` (waits until ring stops sliding).
- Shots: D:\workspace\GameBuilder\plans\reports\shots-puzzle-phone\ (read: L7-phone-built, L7-phone-guide-mid, L5-phone-empty, L1-desktop-guide-mid, L7-phone-guide-step4).
- Phone L7: tray is one row (8 chips, scrolls, last chip cut off as scroll hint); built board no longer overlaps tray; cat sits bottom-left away from the ringed port.

## Notes
- Guide is only active on L1, L5, L7; L2/3/4/6 use tips, so bubble-vs-ring assert is "inside screen" there (logged as "guide off").
- Many steps are "no target" (intro) so only inside-screen is asserted; ring-intersect asserted wherever a ring existed.

Status: DONE_WITH_CONCERNS
Summary: Tray is a single scrollable row, bubble avoids the spotlit element, L7 phone built board fits above the tray; tsc, 2315 tests and Playwright asserts pass.
Concerns: L7 built board on phone now scales cards to ~0.46, so card text is small (readable only by zoom); wires still cross card text, which is wire-look territory I did not touch. Cat bubble can still cover non-spotlit tray chips by design. Branch not merged.
