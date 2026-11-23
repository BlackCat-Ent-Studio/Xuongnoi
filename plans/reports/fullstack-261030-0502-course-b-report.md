# Course pack B report

Branch `feat/course-b` (worktree `D:\workspace\GameBuilder-course-b`). 4 lessons registered in `course-pack-b.ts` only.

## Lessons

| id | chapter | mode | steps | what the learner builds |
|---|---|---|---|---|
| route-traffic "Xe chạy theo tuyến" | Xe cộ | 2D top | 18 | Chạy theo tuyến drives a driverless car round 4 points; Hẹn giờ -> Bộ đếm -> "Đổi màu" of a Đèn giao thông Hộp; Cảm biến vùng (Tâm vùng set onto the road, "Tính những gì" = Phương tiện) AND Không(đủ) -> "Dừng" |
| train "Tàu hỏa" | Xe cộ | 2D top | 19 | Hộp "Đường ray" fixed, Phương tiện -> Đầu máy + 2 Toa tàu, "Kéo theo bởi" chain, Chạy theo tuyến "Bám ray", station rest = Tới điểm -> Hẹn giờ "Đếm lại" -> Không -> "Dừng" |
| cargo-delivery "Chở hàng" | Giao hàng | 2D side | 24 | Chất / Dỡ hàng on a truck, "Loại cần chất" + "Loại cần dỡ" = thùng (rock "đá" ignored), key L loads, L inside a Cảm biến vùng unloads (Dỡ beats Chất), Bộ đếm of "Vừa dỡ" target 2 -> win, Hiện số of "Số hàng loại này" |
| guide-arrow "Mũi tên dẫn đường" | Giao hàng | 2D side | 19 | 2 Mũi tên chỉ đường (yellow flag, red flag); Bộ đếm (start 1) counts touch of yellow flag; Chọn theo số Là 1 / Là 2 -> "Hiện" of each arrow; touching red flag wins |

Files (all new except `course-pack-b.ts`), under `app/src/tutorial/`: `lesson-route-traffic.ts`, `lesson-train.ts`, `lesson-cargo-delivery.ts`, `lesson-guide-arrow.ts`, `lesson-b-helpers.ts` (resolve-by-role, multi-wire step, param step), `text-vi-course-b.ts`. Test: `app/tests/tutorial/course-pack-b.test.ts` (27 tests).

Design notes:
- Starter boards use full-size node spacing so tall Hộp / Nhân vật nodes do not overlap.
- route-traffic and train ship a Máy quay (fixed, zoom 0.6) so the whole 12x12 loop is visible; the default route points (+-6) otherwise sit on the view edge and the car is cut off.
- No step targets an "Nâng cao" param, so no step needed the "open Nâng cao" hint.
- `back-to-edit` steps in my lessons point at the top-bar Dừng button (`.play .pbtn.stop`), see concern 1.

## Gates
- `npx tsc --noEmit -p .` clean; `npm run build` ok; `npx vitest run --testTimeout 120000`: 1161/1162 first run, the 1 failure fixed (below); tutorial folder rerun 99/99 green.
- Touched one file outside my list: `app/tests/tutorial/lessons.test.ts` asserted every lesson board is `2d-side` except bot-driver; changed to `['2d-side','2d-top']` containing the mode (needed for the two top-view lessons). Other packs with a top view will hit the same assertion; if two agents edit that line it is a trivial merge.

## Tests
- Per lesson: registered in right chapter, unnumbered name, unique step ids, last step has no check; starter board valid and runs 1 s without error; no check already true on the starter.
- Per step: check false before its edit, hint selectors non-empty, check true (and runner moves on) after the intended edit, in order. Multi-wire steps verified to need all wires.
- Headless play of finished boards: car stops at the stop line on red, light turns green at 8 s, car drives on; without the stop wire it never stops; train stays within 0.7 of the rail polyline for 40 s, wagons keep 2..4.5 gap, rests at stations; truck loads only crates (rock stays), counts 2 unloads in the zone and wins, L outside the zone never counts; arrow 1 then arrow 2 shown (HUD hidden flags) and red flag wins.

## Browser (Playwright, port 5212, real UI)
All four lessons walked end to end by drag/wire/param edits from lesson start to the last step; 0 console errors in each. Server stopped. Shots in `D:\workspace\GameBuilder\plans\reports\shots-course-b\` (mid-lesson: `route-04-mid`, `train-04-mid`, `cargo-02-mid`, `guide-05-mid`; play results: `route-05c-big-view`, `train-05-station`, `cargo-04b-game-loaded`, `guide-06-after-first-flag`).

## Concerns for the lead
1. Foundation bug (not mine): shared `kit.playButton` (`[data-tut="play"]`) is also used by the earlier lessons' "Quay lại sửa" steps, but while playing that button is "Chơi lại"; the real Dừng button is `.play .pbtn.stop`. Earlier lessons highlight the wrong button on those steps. Pack B uses the stop selector.
2. Cargo HUD: "Hiện số" defaults to label "Điểm", so the crate count reads "Điểm: 2". Left as is (text does not ask to rename).
3. Train station stops at every point, including a 3 s rest at the start (timer starts counting at play).
4. Browser keyboard timing for the cargo walk is real-time: tapping L while driving through the zone unloads and can win early; learners tapping L only near the crates are fine.
