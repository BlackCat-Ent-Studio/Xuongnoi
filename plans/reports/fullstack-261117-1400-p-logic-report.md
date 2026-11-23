# p-logic report (branch feat/p-logic)

## New kinds (palette category: math, all additive; count 68 -> 71)

| Kind | VI / EN | Inputs | Outputs | Params |
|---|---|---|---|---|
| bool-to-number | Đổi thành số / Bool to Number | on: bool "Bật/tắt" | value: number "Giá trị" | whenOn "Số khi bật" (1), whenOff "Số khi tắt" (0) |
| value-table | Bảng giá trị / Lookup Table | index: number "Số thứ tự" (1-based, rounded) | value: number "Giá trị" | rows "Số hàng (2-12)" (3), v1..v12 "Giá trị 1..12" (0), outside select hold (default) / zero |
| angle-diff | Chênh lệch góc / Angle Difference | a "Góc A", b "Góc B" | diff "Chênh lệch" = A-B wrapped to (-180,180] | none |

math: new op `mod` "% Chia lấy dư" (a - b*floor(a/b), sign of divisor, b=0 -> 0). Default op `add` and old ops unchanged; description text updated.

Notes:
- Param system has no conditional visibility, so the panel shows all 12 "Giá trị" rows; only rows <= "Số hàng" are read (handbook says so).
- Out-of-range with `hold`: index <1 -> row 1, index > rows -> last row. Non-finite/unwired index reads 0 -> row 1 (hold) or 0 (zero).
- angle-diff: non-finite inputs read 0; overflow result (1e308 - -1e308) -> 0.
- Search aliases (via `was`): Bật tắt thành số; Bảng tra, Tra bảng; Hiệu góc (+ English term).

## Files
New: src/nodes/bool-to-number.ts, value-table.ts, angle-diff.ts; src/handbook/content-logic-extras.ts, boards-logic-extras.ts; tests/nodes/logic-extras.test.ts.
Edited (additive): src/nodes/index.ts, node-names.ts, math.ts; src/handbook/index.ts; tests/nodes/step-1-nodes.test.ts (68 -> 71); tests/editor/solid-off-baseline.json (+3 handbook try-board entries, 0 existing entries changed).
Handbook try-boards: bool-to-number (Space held walks character), value-table (timer -> sequence -> table -> PID, robot visits -5/0/5), angle-diff (350 - 10 = -20). Lesson ids reused (no new lessons): health-color, robot-arm.
Line endings: all LF as before; `git diff --numstat` equals `--numstat -w`.

## Tests
- tsc --noEmit: clean.
- Focused (logic-extras, step-1-nodes, tests/handbook): 344 passed.
- solid-off baseline: existing entries unchanged; 3 new entries added.
- tests/editor/solid-on-summary.snap.json: +3 rows appended (additions only, via `-u` on that file).
- Full run (`vitest run --testTimeout 300000`): 3223 passed, 4 failed:
  1. tests/tutorial/course-coverage "teaches every node kind in at least one lesson": missing = bool-to-number, value-table, angle-diff. The test greps src/tutorial/*.ts for the quoted kind; I was told not to edit lessons, so NOT fixed. Needs a lesson (or text) in src/tutorial that mentions the three kinds, by whoever owns lessons.
  2. level-7-decoy "spare cannot replace a piece": timed out at 900 s (known); rerun alone also timed out (900 s).
  3. city-delivery-3d "cars stop at a red light": timed out (known); rerun alone failed again at ~222 s.
  4. handbook:gripper trajectory hash mismatch once in the full run under load; passes when rerun alone (not related to my files).
- Commit: 3e78122 on feat/p-logic (not merged, not pushed).

## Not verified
- No browser/visual check of the panel (12 value rows all visible).
- Not wired into samples/lessons (out of scope): arm sample does not use value-table yet.
