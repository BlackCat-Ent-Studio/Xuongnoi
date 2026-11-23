# Step debug run ("Từng bước") for Xưởng Bot — 2026-11-04 15:47

## Request
User: "play debug: the bot runs piece by piece and stops, so the client sees each part of the circuit run."

## Facts
- The engine runs every node each 60 Hz tick (dataflow, not sequential). So a "step" = pause each time any SHOWN card's bool output rises (Runtime.takeRisen already reports this; wire energy already lights wires).
- The editor already has a 1-tick step button (too fine-grained for clients).
- 11-02: the user dropped an on-screen "logic checker" panel. This request is different: slow and lit on the board, with no panel.

## Decisions
- 1b: hard pause at each step; continue only on a tap of "▶ Tiếp".
- 2a: step mode layout = board big, stage small PiP (the inverse of normal run).
- 3b: no text bubbles, only lighting (fired cards + their outgoing wires + targets lit, the others faded).
- 4a: a new round wood button "🐢 Từng bước" next to CHẠY. While stepping, the same button becomes "▶ Tiếp". DỪNG quits. New visible UI, so the user must see it on the real game before merge.
- 5a: Xưởng Bot only.

## Acceptance
- A step run gives the same trajectory and result as a normal run; pausing only freezes time.
- It pauses on every rise of a shown card's bool output; hidden scenery (win plumbing) never pauses it.
- Win/lose/stars behave like a normal run.
- The button matches the wood style; cards, wires and characters are unchanged.
- Desktop + phone screenshots on L2 and L5.
