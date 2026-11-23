# L6 step run: who + what (branch fix/l6-step, worktree D:\workspace\GameBuilder-l6step)

## Changes (app/)
| Fix | File | What |
|---|---|---|
| A | puzzle/levels/level-06.ts | guard shows moveX/moveY in; patrol shows self in + moveX/moveY out; guard/patrol/start cards moved down (y 132/256/462) so locked cards do not overlap with the taller cards. Wires b1/b2/b3 now drawn (locked). |
| B | puzzle/ui/step-light.ts | after the old pass, every lit non-character card also lights characters wired straight into / out of it (+ wires). Only adds light; shared by puzzle and editor. |
| C | render/step-break.ts, app-contracts.ts (StepBreak.moveKeys), puzzle/step-run.ts, render/game-view.ts, puzzle/ui/level-screen.ts, puzzle/types.ts (`stepMoveBreaks`) | opt-in: pause when a wired moveX/moveY goes 0 -> moving; per-run memory `moving` set. No pause on patrol.atEnd. Only L6 sets the flag. |
| why | step-light.ts (`why` param), board-view.ts | when flag on, cards feeding the fired card (one step before) light too. |

Simulation untouched (no engine/world edits).

## Tests
- tests/puzzle/step-light.test.ts: driven character lit; why lights feeders only when asked.
- tests/puzzle/step-run.test.ts: L6 wires drawn; L6 pauses on patrol/cat move, never atEnd; L6 every pause lights >=1 character, first = guard+hero; L7 pause ticks identical to main (38, hard-coded from main before change; matches the audit).
- tests/editor/step-run.test.ts: expectation updated (B now also lights the character the lit card acts on: wires w1+w2, cards key/mv/ch).
- Existing headless "same state at every pause / same result as runLevel" for all 7 levels stays green (now with the move rule for L6).
- tsc --noEmit: clean.

## Browser (dev :5244, left running)
Shots in plans/reports/shots-l6-step/: 1-board-solved.png (guard<->Di tuan wires drawn), 2-pause-1..3.png.
- Pause 1: start, compare, patrol, guard, cat, route lit.
- Pause 2: cat starts moving: cat card + route + feeders (start, compare) lit; guard faded.
- Pause 3: forecast + compare + guard/patrol lit (why).
No console errors.
