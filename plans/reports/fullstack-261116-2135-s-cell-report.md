# S-cell report (2026-11-16): three automated machine samples

Worktree `D:\workspace\GameBuilder-scell`, branch `feat/s-cell` (from main 15cfec5). Dev server :5274 left running.
Shots: `plans/reports/shots-s-cell/` (script `plans/browser-scripts/s-cell-check.mjs`; `door|arm|sorter-N-...png`, `-0-board` = wiring view).

All three: mode 3D, floor block, Máy quay (fixed, tilted, zoomed to frame the machine), on-screen readouts, 3 notes (what it does + "thử đổi thông số" x3), no Phím / Cần điều khiển / UI-button piece, nothing but palette pieces (no new node kinds, no engine change). Labels have no "game".
New files: `src/samples/{cell-board-kit,auto-door-board,auto-arm-board,weight-sorter-board}.ts`, `tests/helpers/cell-run.ts`, `tests/io/{auto-door,auto-arm,weight-sorter}-sample.test.ts`. `cell-board-kit.ts` = plain-data helper (cards stacked per column so none overlap). Menu list: `robot-line-follow`, `auto-arm` (replaced the old `robot-arm` line in place), `auto-door`, `weight-sorter` (one appended line each). The keyboard `robot-arm` sample moved to ARCHIVED_SAMPLES (builder untouched, tests/arm still green; archived list is now the 16 game samples + keyboard arm).

## 1. Cửa tự động (`auto-door`)
```
go.started -> patrol.on, servo.power, cam.on
walker.self -> patrol.self ; patrol.moveX/moveY -> walker.moveX/moveY      (bot patrols z -6.5 <-> 6.5, waits 4 s at each end)
sensor(Vùng kích hoạt 5x3x10 at the barrier).entered -> door-open(Công tắc nhớ).set ; -> close-timer.reset
sensor.inside -> NOT -> close-timer.run ; close-timer.done -> door-open.reset
door-open.on -> bit(Bộ đếm).up ; door-open.on -> NOT -> bit.reset
bit.value -> Quy đổi khoảng (0..1 -> 0..90) -> servo.angle ; post.self -> servo.base -> bar(Thanh nối 3.6 m, 4 kg).base
readouts: servo.angleNow, distance(walker,post), passes counter, load, text open/closed, text overload
```
Params: walker speed 3 m/s, close delay 2 s, servo maxTorque 120 N·m, maxSpeed 120 deg/s. Closed bar needs 4 x 9.81 x 1.8 = 70.6 N·m (seen on screen: "Mô-men khớp 70.6").
Test (5, all green): bar >= 89 deg whenever walker |z|<0.6 (0 blocked ticks, >30 ticks at the bar); open for 2.0 s +-0.3 after the zone clears then closes (<1 deg); >= 3 passes in 80 s; ANTI-FORCED: removing sensor.entered->latch, latch->counter, counter->map, map->servo.angle, go->servo.power, post->servo.base: max angle < 5 deg every time (unpowered servo sags, stays at 0); maxTorque 50 -> "quá tải", never lifts.

## 2. Tay máy tự gắp và đặt (`auto-arm`)
```
pillar -> swing(yaw) -> shoulder -> upper(1.8 m) -> elbow -> fore(1.1 m) -> gripper
a-cycle (Chuỗi bước, 5 steps, loop): 1 chờ (H pose) | 2 hạ (D) | 3 kẹp | 4 nâng + quay 180 (H pose) | 5 nhả + quay về (H)
step done (go-next -> a-cycle.next):  s1 & gripper.inReach | s2,s4,s5 & all joints reached | s3 & gripper.holding, AND NOT stage.changed
taught angles: a-cycle.index -> Quy đổi khoảng ramps -> Phép tính add -> joint.angle (3 joints x 2 ramps)
gripper.close = step3 OR step4 ; grip-force (Số cố định 25) -> gripper.force ; inReach -> NOT -> feed.run (belt stops while a crate is there)
placed = Vùng kích hoạt over the place belt .entered -> counter ; gripper.slipped / crushedOut -> counters
```
Numbers: hover (shoulder 36, elbow -111.8), down (21.2, -95.8), swing 180, rest/start (70, -140); grip 25 N each finger; crates 2 kg mu 0.5 (hold needs 19.62 N), fragile crate crushLimit 60 N (breaks above 30 N/finger); window 19.6-30 N. Torque: shoulder peak 76 N·m of 140, no overload. 6 crates (2 fragile, #3 and #5) on a belt; all 6 placed within ~45 s, 0 slipped, 0 crushed.
Measured (60 s runs): force 10/15/19 N -> 14 slips, 0 placed; 20-30 N -> 6 placed, 0 slip, 0 crush; 31 and 40 N -> 6 placed, 2 crushed (the two fragile ones).
Test (5, green): >=3 placed / 0 slip / 0 crush / no overload / no strays at 25 N; 16.6 N slips and places 0, 20.1 N holds; 35 N crushes, 29.5 N does not; ANTI-FORCED: removing inReach->done-wait, the three joint-angle wires, grip close, grip force, go-next->next, shoulder/swing power: 0 placed in 40 s.
Why the folded rest pose and a stopper: the first version still placed crates after removing the elbow wire (the gripper can grab anything within 0.5 m of where it stands), so the arm starts folded (it cannot reach the belt) and a stopper block fixes the pick point.

## 3. Băng chuyền phân loại theo cân nặng (`weight-sorter`)
```
go.started -> feed/scale/belt-end/side-belt .run (Vật thể "Băng chuyền", 1.5 m/s)
scale(block, orange belt section).self -> weigh(Cảm biến lực / Cân).who ; weigh.mass -> is-heavy(So sánh >=).a ; limit(5 kg) -> .b
is-heavy.out -> heavy-seen(Công tắc nhớ).set ; heavy-seen.on -> wait(Hẹn giờ 2.3 s).run ; wait.done AND heavy-seen.on -> piston.extend
piston.extended -> heavy-seen.reset, wait.reset
readouts: weigh.mass, side-bin / end-bin zone counts, piston.force, piston.overloaded text
```
Crates: 8 Đồ vật cards 2 kg (beige) / 8 kg (red) every 5.5 m, pattern L H L L H H L H. Piston: stroke 2 m, speed 4 m/s, head 1.4 m, maxForce 80 N, pushes across the 1 m wide belt (no side walls); the side belt carries pushed crates away so they cannot pile in front of the piston.
Physics: push needs mu x m x 9.81 = 0.5 x 8 x 9.81 = **39.24 N** (read back from `piston.force`); light crates 9.81 N. **maxForce below 39.24 N (test uses 38 N) -> "Quá tải", 0 heavy crates sorted, they ride to the end bin; 41 N works.**
Test (4, green): all 4 heavy in the side bin, all 4 light in the end bin, count 4/4 on the zones, no overload, peak force 39.24; weak piston as above; ANTI-FORCED: removing scale->weigh, weigh->compare, limit->compare, compare->latch, latch->timer, timer->and, latch->and, and->piston.extend, belt run: side bin gets 0.

## Baselines and shared tests
- `solid-off-baseline.json`: script-checked vs `git show 15cfec5:` : 128 -> 131 entries, 0 removed, 0 changed, +`sample:auto-arm`, `sample:auto-door`, `sample:weight-sorter`. `solid-on-summary.snap.json`: same (128 -> 131, 0 changed). No existing entry changed because the arm menu sample changed (the keyboard arm keeps its `sample:robot-arm` entry, archived).
- `tests/io/samples.test.ts` edited in place (4 expectation lines: all-ids order now `...,'city-delivery-3d','robot-arm','robot-line-follow','auto-arm','auto-door','weight-sorter'`, modes, menu list, archived list +`robot-arm`). Siblings editing the same lines will conflict on merge: keep both id lists.
- CRLF: `git diff --numstat` == `-w` for samples.ts and samples.test.ts. tsc clean.

## Gaps found in the palette (worked around, nothing faked)
1. **Spawner cannot set mass / crushLimit** (always 1 kg, no fragile) -> crates are pre-placed Đồ vật cards on the belt, not spawned. A "Tạo đối tượng" with mass param would let the sorter run forever.
2. **No bool -> number piece**: door uses a Bộ đếm 0/1 (up = latch on, reset = NOT latch on); arm uses the step number + Quy đổi khoảng ramps (6 ramps + 3 adds for the taught table). A "Chọn giá trị theo bước" piece would cut ~9 cards.
3. Chuỗi bước advances only on a rising edge, so a step whose condition is already true at arrival would stick; the board gates it with Chọn theo số `Khi đổi` (NOT) -> AND. Also the evaluation order of the feedback loop depends on card ids (sequence id `a-cycle` sorts first so its `next` is the delayed wire). Without that id the arm skipped steps. Fragile for a user who rebuilds it by hand.
4. Items do not collide with each other: crates reaching a bin pile up at the same spot (count by zone still right, looks like one crate). Joint / link pieces are non-solid, so the barrier is a drawing: it does not physically block the walker (test "never blocked" = it is up in time).
5. Gripper reach is shared by `inReach` and the grab: lowering is not forced by the geometry, only the stopper/rest pose make the angle wires essential. Removing one ramp input (e.g. index -> el-down) leaves the arm working with a fixed elbow, so those 3 sub-wires are not in the anti-forced list (final angle wires are).

## NOT verified
- Real phone, Safari; board view of each sample only fit to 60 % (wide boards, 6-10 columns; the Xem game picture-in-picture covers the right part of the board in the shot). Console shows one 404 (also on main, not investigated).
- Notes' Vietnamese read only by me. Sim speed in the swiftshader browser is slower than real time, shots are not at the exact sim second.
- Arm in the browser: steps 3-5 seen (holding, swing); slip and crush variants only headless.

## Verification
- `npx tsc --noEmit -p .` clean. Full vitest (--testTimeout 300000, 200 files): 3135 passed, 6 failed. 4 were mine and fixed (hash baseline recorded before the last camera/belt tweaks, summary snapshot, a "stray crate" check) and re-run green with samples/arm/baselines (242 tests). The other 2 are long tests in untouched areas that time out under load: `city-delivery-3d` red light passes alone (30 s-scale rerun, 29/30 with the next one); `level-7-decoy` (own 900 s limit) fails again alone at ~920 s on this slow machine (known from HANDOFF 17:10 note), not touched by this branch.
- Commit `e95131e` on feat/s-cell.
