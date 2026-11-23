# Brainstorm — Level 7 "Phân loại thùng màu": stop at each crate, grab, return (2026-11-02 23:31)

## Problem (user, verbatim gist)
Bot passes crates → crate "flies" into its hands while it keeps walking → bot walks to row end (x=11) → turns back → drops. Repeats. Wrong. Bot must STOP at each crate, pick it up, then go straight back to the store.

## Root cause (scouted)
- L7 brain = `slot-patrol` (app/src/puzzle/slot-patrol.ts): ping-pong store ↔ fixed pickup end `STORE.pickup` x=11. Never stops at pads.
- Crates in a lane beside the walking line (CRATE_Z 1.02), within hand reach → player's circuit (color match AND not holding → `grab`) fires mid-walk → grab while moving = crate looks like it flies.
- After grab the brain still heads to x=11 before turning.

## Decision (user "ok" = all ⭐)
- 1a: robot stops ~0.5 s at EVERY pad that still has a crate, faces the crate; player's circuit still decides grab. Solution wires unchanged.
- 2a: red pads too: brief stop (bot visibly "reads" the colour) then continue.
- 3a: after drop, walk out again to the next crate still on a pad, skipping empty pads.
- Grab only while standing still facing the crate; crate lifts in front of the bot (no slide/fly from afar).
- As soon as hands hold a crate → head to next empty store slot immediately.
- Rejected 1b (brain picks blue crates itself): kills the puzzle (player's colour circuit meaningless).

## Scope
- In: L7 only (new puzzle-only brain or new mode; level-07.ts brain swap; guide/hint text if it mentions walking to the end).
- Out: L5 (fetch-store), L8 (slot-patrol stays), Xưởng Nối editor, solution wiring, tray, par.

## Acceptance
- Headless: reference solution wins; each solution wire removed fails; want=1 (red) loses; no grab while robot speed > ~0; grabbed crate start position within hand reach of a stopped robot; after grab, robot's next goal is the store (never goes past to row end); physics-invariants suite green; full vitest + tsc green.
- Visual: shots of L7 run show stop at pad, lift, return.

## Risks
- Time limit 60 s: 6 stops × 0.5 s + 3 round trips — verify win time fits (adjust timeLimit if needed, report it).
- Grab edge: `hands` mode toggle + circuit rising edge must happen during the stop window; a held-true grab while walking must not grab.
