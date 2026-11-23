# Levels 1-4 built by the player (2026-11-03)

Branch `feat/l1-l4-built` in `D:\workspace\GameBuilder-l1l4`, 1 commit `064bb4f` on top of `ccf3f82`. Not merged. Dev port 5228 stopped at the end; main's 5173 untouched. Level ids unchanged (saved progress stays valid).

## What changed (all levels)
- Board cards = only characters + objects. The ground, the win rule (hidden `touch` / `and` / `win-lose`) and the L3 "star hides when touched" effect are scenery (shownPorts `{}`). No `go-to`, `route-follow`, `sequence`, `latch`, `counter`... left in any base (test-enforced).
- Every level now uses a tray with the solution pieces + exactly 1 spare piece. A tiny shared helper `levels/player-built-kit.ts` (wire, scenery strip, ground) was added; levels 5-7 do not use it.
- Old hidden logic removed: L2 `go-flag`, L3 `route` + 3 `or`-chain scaffolding, L4 the 2 long sequence scripts (13 hidden go-to/sequence/math nodes).
- Guide: mandatory first-visit full guide now on levels 1, 2, 4 (plus existing 5, 7); L3 uses "?" steps (only 2 pieces / 4 wires). New LEVEL_INTRO, WIN_LINES and hand-written WIRE_LINES for levels 2, 3, 4.

## Per level
### L1 Bot đầu tiên (2D) - 1 piece, 3 wires
```
 Bot.Nhân vật ──> [Đi tới].Bot
 Cờ.Vật thể   ──> [Đi tới].Đích
 [Đi tới].Đi ngang ──> Bot.Đi ngang
```
Board: Bot, Cờ. Tray: Đi tới x1 + spare `Đảo ngược` (new, was no spare). par 1, freeHints 1 (was 0), timeLimit 15. Wins in **4.28 s**. Mandatory guide kept.

### L2 Cửa kho (2D) - 3 pieces, 7 wires
```
 Bot.self ─> [Đi tới].Bot ; Cờ ─> [Đi tới].Đích ; [Đi tới].Đi ngang ─> Bot.Đi ngang
 Bot.self ─> [Chạm nhau].Vật chính ; Nút đỏ ─> [Chạm nhau].Vật kia
 [Chạm nhau].Đang chạm ─> [Công tắc nhớ].Bật ; [Công tắc nhớ].Đang bật ─> Cửa kho.Ẩn suốt lúc bật
```
Board: Bot, Nút đỏ, Cờ, Cửa kho. Tray: Đi tới, Chạm nhau x2 (spare = 2nd Chạm nhau), Công tắc nhớ. par 3, freeHints 3, timeLimit 25. Wins in **4.78 s**. Guide: mandatory (new circuit with the memory switch; my call).
Door label is the real node label "Ẩn suốt lúc bật" (brief said "Ẩn khi bật"; engine label kept). "Bật/Tắt giữ" = existing `latch` ("Công tắc nhớ").

### L3 Nhặt sao (2D) - 2 pieces, 4 wires (brief said ~4 pieces: see deviation)
```
 Mèo.self ─> [Chạy theo tuyến].Ai ; [Chạy theo tuyến].Đi ngang ─> Mèo.Đi ngang
 [Chạy theo tuyến].Tới điểm ─> [Bộ đếm].Cộng 1 ; [Bộ đếm].Đã đủ ─> Cổng.Ẩn suốt lúc bật     (Mục tiêu 5 -> set to 3)
```
Board: Mèo, Sao 1-3 (self port, only to look at), Cổng. Route preset on the tray piece (stars -4/0/4, flag 11, lookAhead 0). Tray: Chạy theo tuyến, Bộ đếm (goal editable, starts 5), spare `Và`. par 2, freeHints 2, timeLimit 30. Wins in **4.53 s**. Goal 4 or 5 times out; 3 wins. Guide not mandatory ("?" steps with 4 hand-written lines + new-piece intros).
**Deviation (please confirm):** no `So sánh` / `Số cố định`. I built it (route, counter, compare eq, const 3) and the cheaper-win search found a 3-piece win: `Số cố định` into BOTH compare inputs is always true and opens the gate with no counting. Making the compare op `gt`/`ge` leaves the same hole with an unwired input (a > 0). So the counter's own `Đã đủ` does the comparing and the "count to 3" lesson is the counter goal 3. Also the stars are counted through the route's "Tới điểm" (one point per star): a `Chạm` cannot count 3 separate stars with one piece, and star blocks cannot be counted by a zone (zone counts items/characters only, items are solid). Stars still hide when the cat touches them (scenery).

### L4 Hai nút một cửa (2D) - 4 pieces, 12 wires
```
 Bot A ─> [Đi tới A].Bot ; Cờ ─> [Đi tới A].Đích ; [Đi tới A].Đi ngang ─> Bot A.Đi ngang
 Bot B ─> [Đi tới B].Bot ; Nút 2 ─> [Đi tới B].Đích ; [Đi tới B].Đi ngang ─> Bot B.Đi ngang
 [Đi tới B].Đã tới ─> [Đi tới A].Cho đi            (A waits until B is on nút 2)
 Bot A ─> [Chạm nhau].Vật chính ; Nút 1 ─> [Chạm nhau].Vật kia
 [Chạm nhau].Đang chạm ─> [Hoặc].A ; [Đi tới B].Đã tới ─> [Hoặc].B ; [Hoặc].Kết quả ─> Cửa.Ẩn suốt lúc bật
```
Layout (x): Bot A + Nút 1 at -9 (A starts ON nút 1) | Bot B -5.5 | Cửa -1 | Cờ 6 | Nút 2 8.5. B walks through the open door (A holds it) to nút 2; B arrives, door stays open through B, A is released (`Cho đi`), leaves nút 1 and walks to the flag, ending behind B. Nobody passes anybody (solid bodies). Hidden win rule: A touches the flag AND B on nút 2. Tray: Đi tới x2, Chạm nhau x2 (spare), Hoặc x1. par 4, freeHints 5, timeLimit 40. Wins in **6.93 s**. Mandatory guide (12 hand-written lines, `Hoặc` is the "Mảnh mới!" piece).
Why 4 not 5: B's `Đã tới` can stand in for a 2nd `Chạm nhau` (B stops on nút 2), so the 5-piece version had a cheaper 4-piece win; par = 4 and the 2nd `Chạm nhau` is the tempting spare (using it costs 2 stars, tested). `Hoặc` is required: only A's button -> the door shuts when A leaves; only B's arrival -> B cannot get through the shut door at the start.
Win is only A at flag + B at nút 2, but "both robots reach the flag area" holds: nút 2 is 2.5 from the flag.

## Tests
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 120000`: **144 files, 2403 tests, all pass** (582 s while Playwright also ran).
- `levels-1-4.test.ts` (72): per level solution wins before the limit, empty fails, each wire removed fails, each piece removed fails, every solution wire passes real `canConnect` one by one, shown ports, no key/stick, visible cards non-overlapping (left part, 1000x560), tray = solution + exactly 1 spare, **bounded cheaper-win search with the spare** (`fixtures/cheaper-win-search.ts`: drop each solution piece, with/without the spare in its place, then no extra wire / every single extra wire the board accepts / every pair "wire into spare + wire out of spare"; tried 1 / 141 / 66 / 278 answers for L1-L4, 0 wins), over-built answer wins with 2 stars, freeHints scale (<= half the wires), plus level-specific cases (L2 no-latch stuck, L3 goal 4/5 stuck, L4 each of Hoặc inputs and the "Cho đi" wire needed).
- `levels-1-4-board-pieces.test.ts` (anti-forced): registry cleared + editor registry only builds and runs; visible = exactly characters/objects; hidden = exactly the scenery list; no logic kind in base; no locked wire drives a character or a door; locked wires only end on hidden sensors (or the star hide effect); cards show exactly the ports the player wires.
- physics-invariants green for all 7 levels (L4 win-proof rewritten: A at flag, B on nút 2, both past the door, A never past B; door-crossing invariant checks all answers).
- guide-script: steps cover every piece/wire, guided levels 1,2,4,5,7 (+3 via "?"), guide followed step by step to a real win for levels 1-4. hint-rules updated (L1 has 1 free hint, forced guide 1,2,4,5,7).

## Visual (Playwright `plans/browser-scripts/l1-l4-built-shots.mjs`, shots in `plans/reports/shots-l1-l4/`)
Read: l1..l4 `empty/built` desktop + phone (built through real tray taps + port taps: 3/3, 7/7, 4/4 incl. counter goal 3 via the popover, 12/12 wires drawn), `guide-start/mid` desktop + phone, `run-*` frames (phone, stage in focus), `win-card-phone` (all four levels reach the win card in the real UI; L2 shown 3 stars). Desktop boards are clean (cards in a left column, tray row at the bottom). Phone: built boards (L2, L4) are crowded, wires cross card text, but every port is visible and tappable; the guide bubble covers the left cards on the intro step (same as levels 5/7). No page errors, no physics-watch warnings.

## Not verified / concerns
- L3 is 2 pieces (brief ~4), see deviation. Cheaper win search is bounded (single extra wires and spare-in/out pairs), not exhaustive; with 2-3 pieces the space is small but a human could find something else. I know of no cheaper win.
- L4 changes the story: A starts standing on nút 1 (it must, otherwise the door is shut for B) and the answer needs the "Cho đi" wire (new idea for L4). Old saves keep the id; stars earned before stay.
- `Chạy theo tuyến` exposes "Điểm hiện tại" and the counter exposes "Số đếm": not usable as a shortcut in L3 (counter goal is the only comparison), verified by the search, not proved in general.
- L3 star cards show a `Vật thể` output nobody needs; the stars are listed so the board shows the objects of the story.
- Real touch, GPU speed, human playtest, sound not checked. Phone layout beyond 844x390 not checked.
- HANDOFF.md not edited (avoid merge conflicts): items 10/16 text and the L1-L4 lessons need a line at merge. Shared files touched: `guide-script.ts` (LEVEL_INTRO / WIN_LINES / WIRE_LINES for levels 1-4 only + 2 comments), `guide-script.test.ts` (guided list now `[1, 2, 4, 5, 7]`, L3 param `target`), `hint-rules.test.ts` (L1 hint, forced list), `physics-invariants.test.ts` (L4 proof only). When merging with levels 5-7 work the guided list/forced test lines will need keep-both.
- Dev port 5228 stopped; leftover Playwright Chromium processes from two interrupted runs may still exist (I did not kill them: not mine to kill by name).

Status: DONE_WITH_CONCERNS
Summary: Levels 1-4 now show only characters/objects and the player wires everything (L1 1 piece, L2 3, L3 2, L4 4; trays = solution + 1 spare; par = pieces; freeHints 1/3/2/5; guides mandatory on 1, 2, 4). tsc clean; full suite 2403 tests pass; screenshots read.
Concerns/Blockers: L3 has 2 pieces and no So sánh (compare+const had an always-true cheat); L4 redesigned (A starts on nút 1, par 4, "Cho đi" wire); cheaper-win proof is bounded; HANDOFF not updated.
