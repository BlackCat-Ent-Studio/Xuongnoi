# Block "Ẩn khi bật" + puzzle levels 2-4

Branch feat/block-levels (main merged in, 3 times).

## Input
- `hiddenWhile` (bool, "Ẩn khi bật"), last input of Hộp (after "Đảo chiều").
- Acts only when the value changes (prev starts false): rising -> hide, falling -> show (only if state differs). Unwired = never changes = no effect. Initial true hides on tick 1.
- Evaluated after "Ẩn đi"/"Hiện lại" pulses: latest change wins; same-tick conflict -> the signal wins. Documented in node description and handbook.
- State field `whilePrev` optional (keeps `NodeDef<BlockState>` assignable alongside item in logic-small test).
- Handbook Hộp page: port text + tip "dùng để làm cửa mở theo tín hiệu" (tips merged to stay <= 4 per handbook test).
- Tests: tests/nodes/block-hidden-while.test.ts (follows signal, initial true, unwired, interplay with pulses, input order).
- Samples: NOT respaced. tests/io sample tests (incl. city samples overlap) all green with the extra row.

## Levels (all robots colour #7cc4f0; locked objects have `name`)
| # | solution | par | must fail |
|---|---|---|---|
| 2 | touch(bot,button) -> latch.set; latch.on -> door.hiddenWhile (locked Hoặc/Không removed; door shows only hiddenWhile) | 2 | empty; each wire/piece removed; touch straight to door (door re-closes when bot steps off) |
| 3 | unchanged chain, compare.out -> gate.hiddenWhile (locked pair removed) | 5 | empty; each wire/piece; const 5,0,1,2,4 |
| 4 | touch(A,nút1), touch(B,nút2) -> Hoặc -> door.hiddenWhile | 3 | empty; each wire/piece; only touch A (s6 removed: A leaves nút 1, door closes, A stuck); only touch B (s5 removed: B stuck) |

Level 4 base (locked): A = go-to nút 1 (step 1 of a sequence) then go-to cờ (step 2, advanced by touch(B, nút 2) began); two go-to moveX merged by locked math add (one wire per input). B = go-to nút 2 (past door at x=2). Win = And(touch(A,cờ), touch(B,nút 2)) so both passed. No key/stick. Time limit 40s. Task/hint rewritten; teaches Hoặc.

## Verification
- tsc clean. Full vitest: 1632/1633, only failure was handbook tip count (fixed). Build OK. After final main merge, tsc + puzzle/io/nodes/handbook suites rerun (see status).
- Level file line endings were LF (not CRLF); edited byte-safely anyway.
