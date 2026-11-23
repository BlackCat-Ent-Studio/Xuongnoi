# L3 "Nhặt sao" real stars + 7-level hidden-logic audit — 2026-11-04 14:15

## Problem (user)
"3 ngôi sao không nối dây, không va chạm, sao mèo biết chạy hết rồi thắng? Mọi thứ phải nối dây thì mới chạy."

## Facts found in level-03.ts
- Tray "Chạy theo tuyến" has the 3 star coordinates + the flag preset (ROUTE_PARAMS); the cat walks there with no wire to any star.
- Stars hide through 3 HIDDEN locked `touch` cards (scenery wires bs*a/b/c).
- The counter counts route "Tới điểm", not stars, so removing every star still wins.
- The win (cat touches the flag through a hidden touch → win-lose) is allowed, because the rule says win/lose plumbing may stay hidden.

## Decisions
- 1a: stars become real. The player wires Mèo + Sao k into "Chạm nhau" (one per star). "Mới chạm" → Sao k hides AND the counter counts. The counter still counts to 3, then "Đã đủ" opens the gate. The cat still walks by "Chạy theo tuyến". Hidden star-touch scenery is removed. Expected par is 6–7 pieces. If an input cannot take 3 wires, "Hoặc" gathers them.
- 2a: one read-only audit agent checks all 7 levels for (a) hidden wires doing work the story says the player does, (b) tray params that hard-code object positions, and (c) counters or logic that measure something other than the story. Each finding is verified headless (e.g. remove the object, does it still win?). Output: table only, no fixes.

## Acceptance (L3)
- The reference solution wins.
- Removing any star's touch wire, any star's hide wire, or a star object → no win (gate stays shut).
- Every solution wire passes the real `canConnect`.
- There is no cheaper win with tray + decoy.
- Guide/hint/task texts match the new circuit.
- Physics invariants stay green; other levels are untouched.
