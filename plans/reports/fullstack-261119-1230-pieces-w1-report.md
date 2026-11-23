# Pieces wave 1: Nhớ số, Bộ điều phối, spawner random classes

Worktree `D:\workspace\GameBuilder-pieces-w1`, branch `feat/pieces-w1`, last commit `a3cfc0e` (4 commits on top of c929622). Node kinds 71 -> 73. tsc clean. Dev server 5312 stopped.

## Pieces as built

### `sample-hold` "Nhớ số" (Sample and Hold, group Tính toán) — `app/src/nodes/sample-hold.ts`
- In: `value` Giá trị (number), `store` Lưu (bool, rising edge), `clear` Xoá (bool, rising edge).
- Out: `held` Số nhớ (number), `stored` Vừa lưu (bool, one tick).
- Param: `start` Số ban đầu (0).
- Rules: Lưu + Xoá on the same tick -> Xoá wins and no "Vừa lưu". Unwired Lưu never stores. Missing / non-finite value = 0.

### `dispatcher` "Bộ điều phối" (Dispatcher, group Bộ não) — `app/src/nodes/dispatcher.ts`
- In: `job` Có việc (bool, rising edge = one job); `busy1..12` Máy k đang bận (bool, `feedback: true`, shown by "Số máy"); `jobId` Mã việc (number, only with the advanced toggle).
- Out: `chosen` Máy được chọn (machine of the latest hand-over, held; 0 before the first), `waiting` Đang chờ (a job waits and every machine is busy), `given` Đã giao (count), `give1..12` Giao máy k (one-tick pulse), `code1..12` Mã cho máy k (held; only with the toggle).
- Params: `machines` Số máy (2-12, default 2), `mode` Cách chọn: Lần lượt (default) / Máy rảnh đầu tiên, `showCode` Hiện cổng Mã việc (advanced, default Không).
- Rules: jobs queue first come first served (codes queue with them); at most one hand-over per tick; unwired busy input = always free; "Có việc" already on at the start = one job.
- Deviation from the brief: "Mã việc" input sits behind the same advanced toggle as "Mã cho máy k" (otherwise the 12-machine card would be 29 rows, one more than the sequence card).
- Card port order: Máy được chọn / Đang chờ / Đã giao come before the Giao máy k rows (fixed outputs are drawn before optional ones).

### Spawner random classes — `app/src/nodes/spawner.ts`
- Advanced toggle `randomClass` "Sinh ngẫu nhiên theo loại" (default Không, no legacyDefault needed: new and old cards both read Không).
- When on (rows hidden otherwise via `shownWhen`): `classCount` Số loại (2-6, default 3), `class{1..6}Color` Màu loại k, `class{1..6}Mass` Khối lượng loại k (kg) (only rows 1..Số loại shown), `classSeed` Hạt giống (0 = mỗi lần chạy khác nhau).
- Defaults: colours red / yellow / green (= Màu 1, 2, 3 of "Đọc màu") / blue / purple / orange; masses 1..6 kg. Classes are equally likely (no weights: not asked).
- Optional outputs when on: `lastClass` Loại vừa sinh (1..6, 0 before the first), `lastMass` Khối lượng vừa sinh (mass actually applied).
- Seed: same rule as "Số ngẫu nhiên" (`createRng((seed or world.runSeed()) ^ hash(card id))`); `hashText` in random.ts is now exported, nothing else changed there.
- Class mass 0 = by kind (10 / 1 kg); a wired "Khối lượng" (wireMaterial) still wins over the class mass; a spawn refused by "Số lượng tối đa" draws nothing.
- The `position` param line is untouched.

### Handbook, lesson
- New files: `app/src/handbook/content-memory-dispatch.ts`, `boards-memory-dispatch.ts`; index.ts +2 lines. Spawner page (content-action-brain.ts): +2 ports, +15 params, one extra try "Thử: sinh ngẫu nhiên theo loại".
- course-coverage only accepts a kind used in a lesson file, so I wrote one small real lesson instead of a bare mention: `share-jobs` "Chia việc cho hai máy" (14 steps, last in chapter Robot) in `app/src/tutorial/lesson-share-jobs.ts` + `course-pack-l.ts`; one-line edits in lessons.ts and course.ts. This is new user-visible content nobody has previewed in a browser: only its headless play-through is tested.

## Tests
- New: tests/nodes/sample-hold.test.ts (7), dispatcher.test.ts (19: edges, both modes, queue, 2/5/12 machines, 10 000 random ticks x 5 seeded cases with every job handed exactly once in arrival order), dispatcher-busy-feedback.test.ts (4: 302 card-id orders, identical traces; with the `feedback` flag removed 188 orders hand a job to a working machine -> the flag is needed), spawner-random-class.test.ts (12), tests/handbook/content-memory-dispatch.test.ts (12: pages, try boards, lesson solved step by step).
- Edited: step-1-nodes (71 -> 73), extra-tries (second spawner entry).
- Guards, no re-record: solid-off-unchanged 139 old hashes identical, real-physics-on-hash unchanged and green.
- Baseline entries ADDED (solid-off-baseline.json): `handbook:sample-hold` 6d02f185:900, `handbook:dispatcher` fe93cc64:900, `lesson:share-jobs` b8f785d:900. solid-on-summary.snap.json: +57 lines, 0 removed (the same three boards).
- Full suite on a3cfc0e: 256 files, 3874 passed / 2 failed. The 2 are the known load-only ones (level-7-decoy 1071 s, city-delivery-3d red light 266 s); rerun alone: 2 files, 30/30 passed.
- An earlier full run (during the layout fix, tree not final): 256 files / 3876 passed.

## Shots (read) — `D:\workspace\GameBuilder\plans\reports\shots-pieces-w1\`
Học sinh, light theme. Script `take-shots.mjs` in the same folder (uses plans/browser-scripts/ui-c-lib.mjs).
- 1-sample-hold-board.png, 1-sample-hold-card.png
- 2-dispatcher-board.png, 2-dispatcher-card.png
- 3-dispatcher-8-12-vs-sequence-12.png + 3-dispatcher-8-machines-card.png, 3-dispatcher-12-machines-card.png, 3-sequence-12-steps-card.png, 3-dispatcher-8-machines-with-codes-card.png
- 4-spawner-classes-card.png, 4-spawner-classes-page.png, 4-spawner-classes-panel-advanced.png, 5-spawner-classes-off-page.png
- 6-palette-nho-so.png, 6-palette-dieu-phoi.png
- Findings: no clipped label on any card or panel row. Heights at the same zoom: dispatcher 8 machines 20 rows / 728 px; 12 machines 28 rows / 995 px = sequence 12 steps with done ports (28 rows / 995 px); dispatcher 8 machines WITH codes 29 rows / 1028 px = one row taller; 12 with codes would be 41 rows. Toggle off: 5 advanced rows, 7 ports, as before.
- The shots load boards straight from the autosave; the real "Thử ngay" path was not clicked. One 404 for a resource appears in the page log; not identified.
- First shots showed my try boards overlapping at the Học sinh card size -> respaced (commit a3cfc0e), test now asserts `relayoutShipped` moves nothing.

## Gaps
1. **Colour of a spawned Đồ vật cannot be read.** "Đọc màu" only looks at entities of kind `block` (color-sensor.ts: under the feet or first hit ahead). Test-proven: a spawned Vật thể (template block) with a class colour reads index = class; a spawned Đồ vật (item, i.e. crates) reads 0. No workaround built.
2. "Đọc màu" knows 3 colours (Màu 1-3); the spawner has up to 6 classes -> classes 4-6 read 0 even on blocks.
3. "Đọc màu" reads what its own "Đối tượng" stands on or looks at. There is no way to ask for the colour of a given object (e.g. "Đối tượng đầu tiên" of a Vùng kích hoạt, or "Đối tượng mới nhất").
4. Mass is fine: the scale reads the class mass of spawned items (test + try board). Today a sorter can use "Loại vừa sinh" / "Khối lượng vừa sinh" or a scale, not colour.
5. Dispatcher limit: "Máy k đang bận" must turn on in the tick the machine gets "Giao máy k" (e.g. Công tắc nhớ). A busy signal that rises later (robot "left home") lets the same machine get a second job; stated in the handbook tips, no guard built.
6. Lesson honesty note: "Nhớ số" stores the newest door number at hand-over; if jobs queue, that is the wrong job's number. The lesson says so and points to "Hiện cổng Mã việc" (the board never queues with its default times).

## Unresolved questions
- Keep the `share-jobs` lesson (new visible content), or replace it with something smaller once you have seen it?
- Should "Mã việc" input be always visible (card 1 row taller) instead of behind the toggle?
- Gaps 1-3: extend "Đọc màu" (items, 6 colours, target object input) or a new piece? Needs approval.
- docs / HANDOFF still say 71 kinds and 251 files; not edited by me.
