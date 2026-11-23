# Robot arm report (2026-11-16)

Worktree `D:\workspace\GameBuilder-rbarm`, branch `feat/robot-arm` (from feat/mechanics f617b09). Dev server :5256 running.
Shots: `D:\workspace\GameBuilder\plans\reports\shots-robot-arm\` (script: scratchpad robot-arm-check.mjs / props.mjs).

## Pieces (kinds 58 -> 61)
Shared: `src/world/arm-kinematics.ts` (pure FK + servo step), `src/nodes/arm-parts.ts` (per-world registry: frames + masses by entity id; wires carry only "object").
Pieces are drawn as non-solid blocks (no collision). Added `WorldApi.setBlockTilt` (3D pitch of beams) + `EntityView.tilt` (only when set).

### joint "Khớp xoay (Servo)" (action)
- In: base Gắn vào (object, required), angle Góc đặt (number; unwired = start angle), power Bật (bool; unwired = OFF = servo holds nothing: a load sags it, no load stays; follows the wire rule).
- Out: tip Đầu khớp, angleNow, load Mô-men đang chịu (N·m), overloaded Quá tải.
- Params: axis ngang/đứng (pitch), start 0 deg, min -90, max 90, maxTorque 50 N·m, maxSpeed 90 deg/s, mount vec3 (dọc/lên/ngang m, advanced), color (advanced).
- Physics: required = jointCanLift(loads beyond joint, horizontal arm length from pivot) = sum m*9.81*L. required > maxTorque (or unpowered) -> cannot rise, sags toward down at maxSpeed*min(1, excess/maxTorque) deg/s (never snaps); overloaded = true. Lifting against load allowed only while required <= 99.5% of torque. Yaw joint: gravity has no lever, load 0.
### link "Thanh nối" (object)
- In base; out tip. Params length 1 m, mass 1 kg (at the middle), thickness 0.2, color #a3a3a3. Kinematic only.
### gripper "Tay kẹp" (action)
- In: base, close Kẹp, force Lực kẹp (N/finger; unwired = default). Out: holding, held, gripForce, slipped (pulse), crushedOut (pulse).
- Params: defaultForce 20, maxForce 120, fingerMu 0.8, width 1 m, reach 0.5 m, mass 0.5 kg, fingers 2, color.
- mu used = min(fingerMu, object mu). Holds when fingers*mu*F >= m*9.81 (gripHolds). A lifted object that does not hold slips out and falls with normal gravity; must open and close again to re-grab. A resting object (on ground) is supported, no friction needed. applySqueeze(fingers*F): above crushLimit it becomes damaged (existing look), still held. Arm acceleration NOT included.
- Names: node-names.ts VI+EN; handbook pages (content-robot-arm.ts, try-boards boards-robot-arm.ts, link to physics topic via tips); lesson `robot-arm` "Tay máy gắp thùng" in NEW course-pack-j.ts, chapter id `robots` "Robot" (one added line in course.ts; siblings create the same chapter -> merge into one).

## Sample "Tay máy gắp thùng" (2d-side; `src/samples/robot-arm-board.ts`, id robot-arm)
```
pillar.self -> shoulder.base ; shoulder.tip -> upper.base ; upper.tip -> elbow.base ; elbow.tip -> fore.base ; fore.tip -> gripper.base
on-start.started -> shoulder.power, elbow.power
W/S keys.pressed -> Bộ đếm(8).up/down -> Quy đổi khoảng(0..12 -> -30..90) -> shoulder.angle
D/A keys.pressed -> Bộ đếm(4) -> Quy đổi khoảng(0..12 -> -150..30) -> elbow.angle
Space.held -> gripper.close ; Up/Down.pressed -> Bộ đếm(1) -> Quy đổi khoảng(0..12 -> 0..120) -> gripper.force
gripForce / shoulder.load / elbow.load -> Hiện số ; overloaded -> Hiện chữ ; slipped / crushedOut -> Chốt nhớ -> Hiện chữ
```
Crates: 2 kg (needs >=19.6 N/finger), 6 kg (>=58.9 N; shoulder 120 N·m overloads -> raise to 250), 2 kg fragile limit 60 N (breaks above 30 N/finger). 4 notes on the board. Start grip 10 N so the first try slips.

## Tests (new: tests/arm/*, helpers/arm-rig.ts)
Kinematics + servo step; 5 kg mu 0.5 slips at 40 N, holds at 50 N; fragile breaks 2x35 not 2x25; 30 N·m at 0.5 m lifts 6 kg, 7 kg overloads; sag proportional; unpowered; top-view yaw; 3D tilt; sample: slip at 10 N, hold at 20 N, fragile 30 safe / 40 breaks, 6 kg overload then 250 N·m lifts; ANTI-FORCED: removing any essential wire of the 19 (picks of both crates) fails the pick; Up/Down force steps. Updated: kinds 61, samples list, solid-off baseline (+5 entries only), solid-on summary (+99 lines, 0 deleted), fake-world stub. Wire-rule test covers the 3 kinds automatically.
Checks: tsc clean. Full vitest: see below.

## Screenshots read
2d-side: start, reach, closed, lifted (holds 2 kg crate at 20 N), slip (10 N, message "Vật tuột"), fragile crushed (40 N, message), heavy 6 kg overloaded ("Vai quá tải", arm sagging, 149 N·m), 3D lifted (beams pitch correctly), properties of gripper (joint/link panels saved too).

## NOT verified
2d-top play-through in browser (only headless test of yaw), real phone, Safari. No acceleration term in grip. 3D heavy/slip shots not taken. Gripper hand drawn as a simple palm + 2 fingers; crushed crate look not re-checked on this sample (box shape used instead of crate model because the crate model hid mass colours). Lesson not clicked through the coach in browser. Handbook pages not opened in browser.

## Merge pass (main 172cc10 into feat/robot-arm)
- Merged keep-both: 67 kinds; ONE "Robot" chapter = two-motor-robot, line-eyes, pid-control, weight-force, robot-arm; samples list has robot-line-follow + robot-arm; handbook index has DRIVE/LINE/CTRL/ARM; lessons packs F-J; world.ts keeps materialTuning + robot body; `DEFAULT_MASS_KG` got `robot: 2`.
- Baselines: script-checked vs 94878ba: 0 changed entries in solid-off-baseline (109 -> 126) and solid-on-summary (109 -> 126 rows, all old rows identical).
- (a) joint `base` accepts a robot chassis: frame yaw = -robot heading (heading is clockwise from above; flat side view has no turning). Test: yaw joint + link on a chassis with heading 90 lies along +z from the chassis centre.
- (b) gripper description cut to 2 short sentences.
- Hint "Chưa có Nhân vật" now also hidden when the board has a joint (issues.ts PLAYABLE_KINDS + test in play-edit-console.test.ts). Screenshot shows "Không có gì cần sửa" on the arm sample.
- CRLF: `git diff main --numstat` equals `-w` except handbook-dialog.ts (indentation inside the topic loop, inherited from mechanics).
- tsc clean. Full vitest: 188 files, 3018/3018 green. Dev server :5256 restarted on the merged tree.
- Shots read: shots-robot-arm/merged-light.png (arm holding crate, 20 N), merged-fragile-crushed-zoom.png (fragile crate squashed and darker while held).
- Not verified: chassis-mounted arm in the browser (headless test only).
