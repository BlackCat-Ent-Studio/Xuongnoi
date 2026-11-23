# Decoy tray pieces (branch feat/decoys)
| Level | Decoy | Why |
|---|---|---|
| 2 Cửa kho | 2nd Cảm biến chạm (touch count 1->2) | player may think each of bot/button needs its own sensor; touch without latch still sticks |
| 3 Nhặt sao | 3rd Hoặc (or 2->3) | 3 stars looks like 3 gates; extra Or only chains |
| 4 Hai nút | Và (and x1) beside Hoặc | classic and/or mix-up; And never opens the door (B can't reach button 2) |
| 7 Cầu | Và (and x1) | plausible logic piece; no shortcut |
Par/hints/base/solutions/story unchanged; level 1 untouched.
Rejected: Không on level 2 (unwired Not outputs true, would open door with 1 piece).
Tests: levels-1-4 (parameterized decoy block for L2/3/4) and levels-5-8 (L7): spare piece check, over-built wins with 2 stars (solution 3), dropping any piece (with/without decoy unwired / swapped in) never wins. 185/185 puzzle tests pass, tsc clean.
