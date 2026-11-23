# Brainstorm: lesson 7 becomes "Bot quăng thùng", new lesson "Bot đặt thùng"

Date: 2026-10-29 22:00. Status: user approved. Next step: one fullstack agent in a worktree.

## Problem
In the user's video the bot threw the crate past the pad. Cause: the user's board had wires into both "Thả" and "Ném" on "Cầm / Thả". When both fire in the same frame, "Ném" wins. The engine itself is fine: with only "Thả" wired, the crate rests on the pad (verified headless). Lesson 7 also declared a win while the crate lay off the pad.

## Decisions (user)
| # | Decision |
|---|---|
| 1 | "Cầm / Thả" stays as it is: Ném throws, Thả drops. No engine change |
| 2 | Lesson 7 is renamed "Bot quăng thùng". It teaches the throw: the pad-arrived pulse goes into "Ném" |
| 3 | A new lesson "Bot đặt thùng" right after it. Win only when the crate rests on the green pad |
| 3b | No "Thả vào (vật)" port for now |
| 4a | Implemented by an agent in a worktree, then merged |

## Design
- **Lesson 7 "Bot quăng thùng":** same board and the same steps. The drop step changes to wiring "Vừa tới" (pad) → "Ném". The text explains the throw.
- **Lesson 8 "Bot đặt thùng"** (new id `chores-place`):
  - The board is lesson 7 solved but with the throw wire, plus "Cảm biến chạm" (crate, pad) ANDed with the sequence "finished" into the win.
  - Steps: watch the crate fly and no win → delete the "Ném" wire → wire "Thả" → play → win.
  - Explain Ném vs Thả.
- Old lessons 8–14 become 9–15. Only the title numbers change; the ids stay the same, so saved progress still works.

## Acceptance
- A headless test proves:
  - lesson 7 with "Ném" sends the crate past the pad, and the lesson wins;
  - lesson 8 with "Ném" does not win;
  - lesson 8 with "Thả" leaves the crate on the pad (|x − pad| < 1) and the game wins.
- The lesson menu shows 15 lessons with the right numbering.
- The 3 gates are green.

## Unresolved
None.
