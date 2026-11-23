# UI naming report (branch feat/ui-naming)

## Rules
- (a) solid box object -> "Hộp": block.ts label/self port/desc/"Loại hộp", spawner option 'Hộp', "Hộp xoay" (rotating-platform self port + desc), "hộp rắn" (was "khối rắn"), "hộp chặn" (teleport), lesson port "Hộp" (flag/star ports), "hộp vàng/nhặt được/cổng xám/cao".
- (b) graph node -> "Mảnh ghép": all remaining Khối/khối in editor, engine, io text-vi, tutorial/*.ts, and node descs ("mảnh ghép Cổng kia", "mảnh ghép Bộ não", "mảnh ghép Đi tới").
- Unit "khối" -> "ô" (distance desc, moving-platform "ô/giây", "3 ô" in lessons).
- kind `block`, ids, save format untouched. Added test "loads a save whose nodes keep the internal kind block" (tests/io/save-roundtrip.test.ts); fixed one text assertion.
- Only string literals changed in nodes/.

## Leftovers (grep "hối")
- src/editor/wiring-canvas.ts:115 `def?.label ?? 'Khối lạ'` -> MERGER: change to 'Mảnh ghép lạ' (not edited, file owned by another agent).
- src/nodes/character.ts:32 'Người khối' = blocky-person style option; intentional, stays.
- palette.ts, properties-panel.ts: no "hối" strings (use text-vi).

## Checks
vitest 655/655, tsc clean, build OK.
