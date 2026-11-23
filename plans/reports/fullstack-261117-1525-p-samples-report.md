# p-samples report (branch feat/p-samples, worktree D:\workspace\GameBuilder-psamples, from main f8e57e7)

Commits (no merge, no push): `6370c3e` samples, `7ebb309` lesson, `5e65ca9` baselines. Dev server :5285 stopped.
Shots (all read): `D:\workspace\GameBuilder\plans\reports\shots-p-samples\` (scripts `plans/browser-scripts/p-samples-shots.mjs`, `p-samples-boards.mjs`).

## Before / after (cards = pieces on the board, wires)

| Sample | Cards before | Cards after | Wires before | Wires after | What went |
|---|---|---|---|---|---|
| weight-sorter | 32 | 27 | 21 | 24 | 8 pre-placed crates out; Hẹn giờ + Số ngẫu nhiên + Tạo đối tượng in |
| auto-arm | 54 | 42 | 63 | 44 | 9 Quy đổi/Cộng ramps, Chọn theo số, NOT gate, 7 AND/OR done cards, stopper out; 3 Bảng giá trị, pick zone, grip timer, 2 compares in |
| auto-door | 25 | 26 | 28 | 26 | Bộ đếm 0/1 + Quy đổi + NOT + 2 texts out; 2 Đổi thành số + 1 Hiện chữ(lines) in; 3 scenery blocks in (path + 2 end pads) |
| robot-square | 39 | 31 | 49 | 39 | 7 So sánh/Trừ/Và/Hoặc/Số cố định of the wrap test out; 1 Chênh lệch góc in; 2 texts -> 1 |
| agv-shuttle | 80 | 80 | 115 | 115 | NOT touched (see below) |
| robot-avoid | 50 | 50 | 57 | 57 | NOT touched (see below) |

(auto-door grew by one card on purpose: the scene was bare, see "visual nits".)

## 1. weight-sorter (runs forever, 3 new wires)
```
go.started -> feed/scale/belt-end/side-belt.run , make-timer.run , cam.on
make-timer (4 s, repeat).done --> maker (Tạo đối tượng: item box 0.8, wireMaterial yes, max 12, life 30 s).spawn
dice (Số ngẫu nhiên 1..8 whole, mode tick, seed 1).value --> maker.mass
scale.self -> weigh.who ; weigh.mass -> is-heavy.a ; limit(5 kg) -> is-heavy.b ; is-heavy.out -> heavy-seen.set
heavy-seen.on -> wait(2.3 s).run ; wait.done & heavy-seen.on -> now-push -> piston.extend
piston.extended -> heavy-seen.reset , wait.reset
readouts: weigh.mass, side-bin.count, end-bin.count, piston.force, overloaded text, heavy text
```
- Crates made every 4 s (about 6 m apart), mass thrown 1..8 kg, light < 5 <= heavy. Crates vanish after 30 s so it never fills.
- Seed is fixed (1: masses 1,7,3,7,7,3,3...) because the "Va chạm thật off" baseline needs a deterministic hash (seed 0 = Math.random per run, I saw three different hashes). Set seed 0 and every run differs (a test runs seed 0, 7, 99, 2024). Note 5 in the pink note tells the learner.
- Bin readouts now say "Trong thùng ..." = crates lying there NOW. A Bộ đếm on the zone `entered` undercounts (see gap 2).
- Tests (8): structure; random masses 1..8, >=4 distinct, both light and heavy; every heavy ends side, every light end, readouts = crates really in the bins, peak force <= mu*8*9.81; 4 seeds; weak piston (8 kg only, 38 N Quá tải / 41 N works, peak 39.24); ANTI-FORCED 12 wires (timer run, timer->spawn, dice->mass, scale->weigh, weigh->compare, limit->compare, compare->latch, latch->timer, timer->and, latch->and, and->piston, feed belt): side bin gets 0 each. Not essential (sorts fine without): weigh.mass->show-mass, piston.force->show-force, go->cam.on. Without piston.extended->heavy-seen.reset the latch stays on and light crates are pushed too (test).
- Untested wires: piston.extended->wait.reset, go->side-belt.run, text wires.

## 2. auto-arm (the big one)
```
pillar -> swing(yaw) -> shoulder -> upper 1.8 -> elbow -> fore 1.1 -> gripper (grip = between, set on the card)
go.started -> 3 joints.power , out-belt.run
pick (Vùng, item, center rule, 0.3 wide at x 2.05).inside -> NOT belt-run -> feed.run         (belt stops at the pick point)
a-cycle (Chuỗi bước, 5 steps, loop, showDone) 
   .index -> tbl-swing / tbl-shoulder / tbl-elbow (Bảng giá trị, 5 rows).index
   tables.value -> swing / shoulder / elbow .angle
   rows  swing    0   0   0  180   0
         shoulder 60  21.2 21.2 60  60      (raised, lowered, lowered, raised/carry, raised)
         elbow   -130 -95.8 -95.8 -130 -130
   Xong bước:  done1 <- pick.inside                      (crate waiting)
               done2 <- gripper.inReach                  (crate BETWEEN the fingers = arm really lowered)
               done3 <- AND(grip-wait Hẹn giờ 0.6 s run=step3 .done, gripper.holding)
               done4 <- compare(swing.angleNow >= 179)
               done5 <- compare(swing.angleNow <= 1)
   step3 OR step4 -> gripper.close ; const 25 N -> gripper.force
HUD: step name = Hiện chữ(lines 5) with line = index; counters placed / slips / crushes; grip force
```
- 6 crates (2 fragile, crushLimit 60) are still pre-placed on the belt (spawner not requested for the arm). 6 placed in ~36 s, 0 slip, 0 crush, peak shoulder load < 140.
- Re-tuned poses: the old hover (36,-111.8) held the grasp point only 0.09 m outside "between" (0.45 m along the arm against a 0.36 m limit, computed with the gripper's own rule) and was inside the old 0.5 m reach (0.47 m), which is why the old board needed a stopper and a folded rest pose. New raised pose (60,-130) is 1.1 m away along the arm (found by an IK scan: it also keeps the crate out of reach when only the shoulder or only the elbow is changed, so every table wire is essential). The arm has to lower: test records inReach never true at step 1 while a crate waits, and shoulder at the grab is > 15 deg below the raised angle.
- Gripper `grip: 'between'` is written on the card: a card built from code without it gets the old `reach` rule through `legacyDefault`.
- Camera: zoom 0.7 -> 1.3, target y 1.2 (arm fills the frame; nit fixed).
- Tests (10): structure (no map-range / select-number / math / stopper, 3 tables, showDone yes, no `next` wire); shipped force places all 6; below 19.62 N slips and places 0, +0.5 holds; above 30 N crushes the fragile ones, just under does not; lowering test; CARD-ID test (4 variants: ids prefixed a-, z-, sequence renamed last + tables/joints first, node list reversed) all place the same 6; ANTI-FORCED 31 wires (arm links, powers, 3 index->table, 3 table->joint, close wires, force, done1, done2, grip-wait chain, done4/5 chain, belt-run->feed): at most the first crate is let go (cutting only done5 lets crate 1 go: the release is the start of step 5) ; belt-stop test; step text test; non-essential list.
- NOT essential (honest): swing.angleNow->at-home.a and c-home->at-home.b (step 5 "back home" only makes the arm wait for the swing; step 2 waits for a crate between the fingers anyway); drop-zone/slip/crush counters; readouts; camera; step text; go->out-belt.run (crates still leave the table region). PARTLY essential: pick.inside->belt-run.in: without it the belt does not stop and the arm only catches 3 of the 6 crates.

## 3. auto-door
```
go.started -> patrol.on , servo.power , status.show , cam.on ; walker.self -> patrol.self ; patrol.moveX/Y -> walker.moveX/Y (z -5.5 <-> 5.5, waits 4 s)
sensor (zone 5x3x9).entered -> door-open(Công tắc nhớ).set , close-timer.reset ; sensor.inside -> NOT -> close-timer.run ; close-timer.done -> door-open.reset
door-open.on -> to-angle (Đổi thành số, 90 / 0) -> servo.angle ; post.self -> servo.base ; servo.tip -> bar (Thanh nối 3.6 m, 4 kg, Chắn vật = Có).base
door-open.on -> to-state (Đổi thành số, 2 / 1) -> status (Hiện chữ, lines "CỬA ĐANG ĐÓNG / CỬA ĐANG MỞ").line
```
- The bar is now physical: closed bar stops the walker (test: with the sensor wire cut the walker never passes z 0, stands still > 10 s at the bar; with Chắn vật = Không the same closed bar lets it through; weak servo 50 N·m: overloaded, walker held up). Open: walker crosses >= 5 times in 80 s, 0 ticks at the bar with the bar down, closes 2 s after it left.
- Geometry had to change to make the bar really block: character is a 1 m box (y 0.04..1.04), so the posts are 0.7 high and the pivot 0.7 (bar y 0.7..0.9, resting on the posts); the old 1.2 m posts put the bar ABOVE the walker. Zone 10 m -> 9 m: the walker waiting at the end (z 5.3) was touching the 10 m zone, so `inside` never went false.
- Scene (nit fixed): path strip + blue/red end pads (flush 0.04 m tall: a 0.05 m block already stops a character), camera zoom 0.8 -> 0.55 at y 0.5, patrol 6.5 -> 5.5: the walker is inside the frame now (read in shots door-2/door-3).
- Tests (10): structure; opens before the bar / never blocked / closes; never stands still at the bar; 2 s delay; closed bar stops walker; solid off lets it pass; ANTI-FORCED 5 wires (sensor->latch, latch->to-angle, to-angle->servo, power, post->servo.base) each: max angle < 5 AND (4 of them) the walker never crosses; servo->bar link cut = no bar at all, walker crosses; non-essential: status/line wires, readout wires, camera; HUD text test.

## 4. robot-square
- `lech-goc` is now Chênh lệch góc (heading, memory) -> `du-goc` compare >= 89 -> `quay-xong`. Removed c-360, c-am180, goc-vong, qua-vong, dang-vong, vong-xong, quay-ok. The 2 toggled texts are 1 Hiện chữ (lines, line = buoc.index, show <- khi-bat-dau).
- Trajectory hash identical to main (d6963b32:900): the machine is the same machine. Tests unchanged + angle-diff allowed, 1 text card, 2 compares only, anti-forced list updated (du-goc->quay-xong, lech-goc.diff->du-goc, c-goc->du-goc). All 5 pass.
- Not converted to `showDone` (works, would be a rewrite of a verified loop).

## 5. agv-shuttle and robot-avoid: left unchanged
- robot-avoid: the 0/1 reverse mode is a Bộ đếm with its own set/reset/reached (timed); Đổi thành số would need a latch + converter = one MORE card. Its 3 status texts need a state NUMBER (1 straight / 2 avoid / 3 reverse) that has to be built from comparisons + math: more cards, not fewer.
- agv-shuttle: 80 cards / 115 wires in 4 groups, the arm sequence relies on card ids sorting after `buoc` (comment in the file); changing its ramps and done gates is a rewrite of a verified 3-minute loop. Candidates when someone owns it: 6 goc-vai/khuyu ramps -> value-table, the sequence -> showDone, chu-chay/nap/do -> one Hiện chữ(lines). Not low-risk, so not done.

## TASK 2: course
- New lesson `arm-steps` "Bảng giá trị và chuỗi bước" in the Robot chapter right after `robot-arm` (src/tutorial/lesson-arm-steps.ts, pack J). 2D side board: pillar, table, 2.5 kg crate, joint + link + gripper built and wired, a prebuilt Hoặc -> Kẹp, two readout cards. Learner: adds Chuỗi bước, stepCount 3, Nâng cao showDone, Bảng giá trị (rows -12, -12, 30), index -> table -> joint.angle, step2/step3 -> Hoặc, inReach -> done1, holding -> done2, Chạy (arm lowers, grips, lifts by itself), Dừng, adds Chênh lệch góc (table.value, joint.angleNow -> diff -> "Còn phải quay"), adds Đổi thành số (holding -> "Đang giữ (1 = có)"), Chạy. 18 steps.
- `tests/tutorial/course-coverage.test.ts` passes (the three kinds are now in src/tutorial).
- Tests: `lesson-arm-steps.test.ts` (4): registered once after robot-arm in `robots`, valid starting board without the taught pieces, arm cannot work alone (crate stays on the table), solved step by step through the runner (every step id in order, targets resolve), finished board lifts the crate above 1.5 m and holds it, the "Đang giữ" readout is 1, the diff readout returns to 0; ANTI-FORCED: each of the 6 wires cut -> crate not lifted.
- Existing `robot-arm` lesson checked headless the way the learner plays (new `tests/tutorial/lesson-robot-arm.test.ts`): a NEW gripper card is `between`; hold down arrow = joint -15 deg = crate between the fingers; Space grips; with the default 20 N the lifted crate slips back to the table, with 25 N it is lifted to y 1.88 and held. So the lesson works as is, no text or board change needed.

## Baselines
Script-compared against `git show f8e57e7:app/tests/editor/...`:
- solid-off-baseline.json: CHANGED `sample:auto-arm` 2c2acb78 -> d97d3862, `sample:auto-door` db061049 -> ce91e88a, `sample:weight-sorter` 9b4485c6 -> f6c9b640; ADDED `lesson:arm-steps` ebcad3b9. Nothing removed. `sample:robot-square` and `lesson:robot-arm` unchanged.
- solid-on-summary.snap.json: same 3 changed + 1 added (auto-arm's existing "sensor-without-contact x3" note moved from 2.9 s to 3.6 s: it is the pick zone, was the stopper zone before).
- Line endings: `git ls-files --eol` unchanged for every file; samples.ts and robot-square.json stay CRLF, tests/io/auto-arm + weight-sorter tests CRLF; `git diff --numstat` equals `-w` except 1 blank-line line in two test files (eol column checked, LF/CRLF as before).

## Gaps found (reported, engine/nodes NOT touched)
1. **Joint `reached` as a "Xong bước" source is order dependent when the angle comes through a Bảng giá trị from the same sequence.** compile.ts breaks a cycle at the smallest id, so joint -> table -> sequence can read the target 2 ticks late; `reached` is then still true from the old pose and the step is skipped. First version of the arm (done4/5 = joint reached) placed 0 crates when ids sorted joints < tables < sequence (test variant "sequence last, tables and joints first"). Workaround used: done4/5 compare the swing ANGLE with a constant (physical, not derived from the new target). A real fix needs `reached` to be false on the tick the target changed (node change, not mine).
2. Zone `entered` is the edge of "any inside", so a Bộ đếm on a bin that never empties undercounts (1 instead of 8 crates). No per-object entry count; the sorter shows the live `count` instead.
3. Hiện chữ with `show` unwired is HIDDEN at run time although the description says "không nối thì chữ luôn hiện" (the editor's wire rule adds an On Start wire on load; boards built from code must wire `show`). I wired it in all three samples.
4. A new gripper in a board written without `grip` gets the old `reach` rule (legacyDefault), by design for old saves; code-built samples must set `grip: 'between'`.
5. Random with seed 0 differs every run and breaks the baseline guard: a sample that uses it must carry a seed.
6. Items do not collide with each other (crates pile at the bin spot, only the count is right); unchanged since the earlier report.
7. Solid low blocks stop a walking character (0.05 m high pad already blocked it, 0.04 flush did not): scenery on a walker's path must be flush.

## Verification
- `npx tsc --noEmit -p .` clean.
- Focused (tests/io, tutorial, handbook, arm, actuator, nodes, editor, registry): 135 files, 1954 tests green.
- ONE full run `npx vitest run --testTimeout 300000` (machine quiet, run after the 3 commits): 215 files, 3305 tests, ALL green, 594 s. tests/puzzle/level-7-decoy and city-delivery-3d red light both finished inside that time and passed (no timeout this time).

## NOT verified
- The new lesson only headless (runner + sim) and on screenshots of nothing: I did not play `arm-steps` in the browser UI (dock text, "Nâng cao" hint highlight, the 2D picture of the arm).
- Vietnamese texts read by me only. Handbook pages of the new pieces were not changed (they were done in the earlier branches); docs/ not changed.
- The board views are only partly visible (60 % zoom, picture-in-picture covers the right side); the long world column of Vật thể cards at the left of each board is untidy but as before.
- Real touch / phone; sim speed in swiftshader is slower than real time so shot times are not exact sim seconds.
- agv-shuttle / robot-avoid not re-tested beyond the full run (untouched).

## Unresolved questions
- Should the arm sample use the spawner too (random fragile crates via wired Lực chịu nén) so it runs forever like the sorter? Not asked, not done.
- Keep seed 1 on the sorter (same masses every run, deterministic guard) or ship seed 0 and exclude the board from the hash baseline?
