# HANDOFF — GameBuilder "Xưởng Nối" + "Xưởng Bot giải đố" — 2026-11-04 01:10 (main = b365347, 2639 tests green, tsc clean)

> **Read order:** §00 (current state) → §4 (workflow, items 20+ are new) → §5 (lessons; newest subsection "2026-11-03/04" first). §0z is the raw decision log 2026-11-02 → 11-04; §00b is the 11-02 state (superseded); §1a–§3 older history.

## 00. CURRENT STATE — 2026-11-04 01:10 (READ FIRST)
**Run:** `cd app; npm run dev -- --port 5173 --strictPort` (background) → Xưởng Nối http://localhost:5173 · Xưởng Bot http://localhost:5173/giai-do.html. No agents running. Worktrees: main + `../GameBuilder-apk` (feat/apk, clean, APK work PAUSED by user — resume only when asked).

**Project rules agreed with the user/client (11-03/04) — every change must respect them:**
1. **Every ACTION needs its own wire** ("không nối dây mà chạy được là sai"). Switch-on inputs default OFF; old boards are migrated by adding ONE visible "Khi bắt đầu" card wired to them (`app/src/editor/graph/wire-rule-migration.ts`, marker `graph.settings.wireRule`). One input = one action (no toggle modes in puzzle). Physics rules (gravity, collision, respawnFallen) and consequences of a wired action (turn toward grabbed crate, death→hide) are OK without a wire. Test: `tests/nodes/no-action-without-wire.test.ts` (all 57 kinds).
2. **No forced code**: bots act only through general board pieces that Xưởng Nối also has. No puzzle-only brains (fetch-store, slot-patrol, pad-patrol, pad-carry all deleted; slot-patrol copy lives only in levels/archive for L8). Anti-forced tests per level.
3. **Puzzle boards show only characters + objects**; the player builds all bot logic from the tray (+1 decoy). Win/lose plumbing hidden. L6 guard patrol = one locked visible card + a locked visible "Khi bắt đầu".
4. **New engine pieces are GENERAL** (also in Xưởng Nối, handbook page + lesson, advanced/default-off so old boards stay hash-identical).
5. **UI look is the user's call**: never add visible buttons/colours/card-shape changes the user hasn't seen on the real game (see memory feedback-no-unpreviewed-ui). Cards/wires/characters keep their look.

**What is in main now (since 11-02):**
| Area | State | Key files / report |
|---|---|---|
| Levels | 7 levels (L8 archived in levels/archive), all player-built. Par: L1 2 · L2 4 · L3 3 · L4 4 · L5 5 · L6 3 pieces/11 wires · L7 11 | levels/level-0*.ts · fullstack-261103-2000-l1-l4, -2000-goto-l5-l7, -1840-l6-stealth, -2220-wire-rule |
| L6 | "Lẻn qua mắt lính gác": legs-robot guard patrol + 3D vision fan, cat cover-to-cover; player: Chạy theo tuyến (từng chặng) + Dự đoán tầm nhìn + So sánh Còn ≥ Cần → Chạy (no +0.5) | sight-forecast node, render fan |
| L7 | player builds 11 pieces (route + timer 0.5 + compare + or → Dừng; Đọc màu AND Đã đứng yên → Nhấc lên; Đang khiêng → Đi tới Ô trống kế tiếp; Tới Đích 2 → Thả). Win = blue crate in EACH of 3 slots; crate lane z 1.12 | level-07.ts |
| New general pieces (57 kinds) | Ô trống kế tiếp (next-free-slot), Tìm vật gần nhất (nearest-item), Dự đoán tầm nhìn (sight-forecast) | nodes/*.ts, handbook, lessons tidy-bot / nearest-bot / sight-forecast / two-goals-bot |
| Upgraded pieces | go-to: Đích 2 / Dùng đích 2, outputs Tới Đích / Tới Đích 2, advanced settle · route-follow: Chạy (leg by leg), Đang ở điểm, Đã đứng yên, Tuyến chạy, legacy stopFor/faceAtStop · patrol: Tuyến đi tuần · on-start: held "Đã bắt đầu" · enter-exit Lên/Xuống xe · hand-tool Cầm/Cất · chase/fight Cho đi | |
| Puzzle board UI | tray one scrollable row; mascot bubble avoids spotlight; card scale ladder; routed wires avoid cards; tap card = focus (others fade); double-tap wire = reroute knot (drag, Ctrl+R, merge same source; memory only); pins INSIDE cards (old look restored); "Sắp xếp gọn/Gom dây/Vừa khung" buttons HIDDEN (code kept, not appended) | board-view.ts, wire-geometry.ts, wire-knots.ts, board-arrange.ts |
| "?" help | on every card (puzzle: beside ×/lock; editor: header right) + tray chips; soft dark circle like ×; short handbook popup + "Xem đầy đủ"; never costs stars | handbook/card-help-popup.ts, card-help.css |
| Previews (artifacts) | guard-vision v2 https://claude.ai/artifact/DgRd23WWMS9eYSHPojESGJ · wire-tidy https://claude.ai/artifact/TNe2cb4gbhP1EAgcqfSXPL | plans/ui-mockups/guard-vision, wire-tidy |

**Open / waiting on the user (asked, unanswered — offer again):**
1. Phase 2 (⭐ defaults): 1a shorten L7 (~8 pieces, e.g. route input "Dừng một lúc (giây)") · 2a doors L2–L4 → dedicated Ẩn/Hiện inputs (L4 needs a close path) · 3a route-follow lookAhead auto-stop + route driving vehicles → default off + migration · 4a texts: guide WIRE_LINES/task/hint per level + handbook examples still showing old wiring (e.g. "Đã tới → Nhấc lên").
2. Board: keep knots/focus/routing, or strip back to the exact old board (user may ask).
3. "?" makes long card subtitles truncate ("Rô-bốt c…") — option: show "?" only on the tapped card.
4. APK (paused): debug APK to Desktop `XuongBot-debug.apk`, name "Xưởng Bot", icon Mèo Mun; worktree ../GameBuilder-apk ready; agent brief in §0z 21:30 (11-03).
5. Old open items: L4 flag spot, thin-object outline thickness, Bố cục B for editor, real phone/GPU/touch/sound test.

## 00b. State 2026-11-02 23:10 (superseded by §00)
**Run:** `cd app; npm run dev -- --port 5173 --strictPort` (background) → Xưởng Nối http://localhost:5173 · Xưởng Bot http://localhost:5173/giai-do.html. No agents running, no extra worktrees (`git worktree list` = main only).

**What is in main now (all merged, all verified by full vitest):**
| Area | State | Key files / report |
|---|---|---|
| Puzzle shell | Style A permanent; title `#/`, map `#/map`, level `#/level/<id>` (reload OK), ending `#/end`, settings (music/sfx/reset), confetti win card; B/C themes dev-only `?theme=b|c` | puzzle/ui/title-screen, map-screen, shell.css · fullstack-261101-2040-shell |
| Buttons | Press no longer shifts sideways (centering uses CSS `translate`, press uses `transform`) | shell.css · fullstack-261102-1205-title-fix |
| Sound | Code-made WebAudio sfx + 2 music loops, respects settings; never heard by a human | puzzle/ui/sound.ts + sound/ |
| Layout B | Board full-screen + stage PiP bottom-right; CHẠY/tap swaps (stage full, board mini); DỪNG/tap mini swaps back; top bar with "Đề bài" button | level-screen.ts, stage-camera-input.ts · fullstack-261102-1145-layout-b |
| Camera | Drag pan, wheel/pinch zoom 1–4×, double-tap/⟳ reset; edit = overview fit, run = follow (FOLLOW_CONTEXT_ZOOM floors in cameras.ts) | render/cameras.ts |
| Smooth motion | Render interpolation between last two 60 Hz ticks (sim untouched) | render/tick-blend.ts · debug-261102-1402-smooth-motion |
| Physics | `WorldOptions.solidBodies` (+ `frontCarryAll`, `respawnFallen`): characters/items/crates solid, carried crate blocked by walls, drop at hands + falls straight, refused drop keeps holding, stacking, zones ignore carried items, 1.6× collider in puzzle. ON for ALL 8 puzzle levels (2D + 3D) | world/physics.ts, puzzle/world-options.ts · fullstack-261102-1215-physics3d, -1430-carry-place, -2232-levels-audit |
| Hidden physics check | Headless invariant suite over every level each tick (overlaps, shut/open doors, win/lose proof, no-stuck, crate jump limits) + DEV-only watcher (stripped from prod) | tests/puzzle/physics-invariants.test.ts, src/dev/physics-watch.ts, world/physics-check.ts |
| Store slots | L5 3 slots, L7 blue store 3, L8 2; robot fills next empty slot, crate centred | puzzle/store-slots.ts, slot-patrol.ts · fullstack-261102-1508-store-slots |
| Level 5 | Legs robot; 3 crates at 3 spots, `fetch-store` brain fetches each into a distinct slot; mandatory guide on first visit | puzzle/fetch-store.ts · fullstack-261102-2115-l5-scatter |
| Level 4 | Redesigned so nobody passes through anyone (A btn1 → B through door to btn2 → A past door → B leaves to flag → A follows); A ends just behind the flag | level-04.ts · levels-audit report |
| Level 7 | "Phân loại thùng màu" (colour pad under feet + Và); old "Cầu nhấp nháy" in levels/archive | level-07.ts |
| Editor "Va chạm thật" | `graph.settings.solidBodies` per game; new boards ON; all 16 samples, 31 lessons, 54 handbook try-boards OFF and hash-identical to before. Only `cleaner-bot` breaks if turned ON. No sample flipped | fullstack-261102-1500-editor-solid |
| Node names | 54 kinds renamed (Vietnamese + small English `labelEn`), ports too; old names are search aliases; `block` = **Vật thể · Object** | src/nodes/node-names.ts · -1600-rename, -2205-object-naming |
| Object cards | Both workshops: title = kind (Vật thể / Nhân vật / Đồ vật), subtitle = instance name (Cờ, Bot…), normal category icon, no thumbnails | node-view.ts cardSubtitle |
| Two-way highlight | Tap card → object's silhouette OUTLINE glows (mask + edge shader); tap object → its card glows (mini board too) | render/object-highlight.ts · -2115-outline-icons |
| Doors | 2D side doors = thin post + edge-on leaf that swings (never sinks); swing 0.25 s to match the collider | puzzle/stage/cozy-stage.ts |

**Open / waiting on the user:**
1. Level 4: A stops behind the flag, not on it — widen flag area? (asked, unanswered)
2. Thin objects (door) outline glow looks too thick (my own observation, not raised by user yet).
3. Bố cục B for Xưởng Nối editor — not started, ask before doing.
4. Turning "Va chạm thật" ON for samples: user decides per sample; `cleaner-bot` needs a re-layout first.
5. "Làm lại 3D cho đẹp/hay hơn" — still undefined; ask what to change.
6. App name (placeholder "Xưởng Bot" = `GAME_NAME`), APK (part D), real phone/GPU/touch/sound test — none done.
7. Phone: long card names truncate ("Rô-bốt chân n…"); robot looks small in 2D overview on 844×390.

## 1. Goal
An ORIGINAL browser node-wiring game builder for a Vietnamese non-coder user. You drag nodes ("mảnh ghép"), wire ports and press Chơi to play a 2D or 3D game.
- Claude writes all the code; the user only playtests and decides.
- It is NOT a clone of Game Builder Garage. Never read `D:\gbg\` and never mirror its nodes, UI, lessons or text. Generic genre mechanics are fine.

## 1a. NEWEST 2026-11-01 21:10 — style A full game (main = 15c4246+, 238 puzzle tests green, tsc clean)
Decision record: `plans/reports/brainstorm-261101-2035-style-a-full-game-report.md` (user answers 1a 2b 3a 4a 5a + L5 mandatory guide; app name placeholder "Xưởng Bot" = `GAME_NAME` in puzzle-text.ts).
- **Merged:** shell (title `#/`, map `#/map`, `#/level/<id>` reload works, ending `#/end`, settings modal, transitions, confetti win card; A permanent; B/C in `themes/` dev-only `?theme=b|c`; list-screen deleted; files title/map/ending/character-stage/confetti/win-card/shell-kit/map-state in puzzle/ui) · sound (`puzzle/ui/sound.ts` + `sound/` WebAudio code-made sfx + 2 music loops; settings `puzzle/ui/settings.ts`; nobody listened by ear) · rules ("?" counts once per step via `countHint`/`stepKey`; level 5 mandatory guide via LEVEL_INTRO; level 7 bridge already required — could not reproduce the no-bridge win, tests added). Reports `plans/reports/fullstack-261101-2040-{shell,sound,rules}-report.md`; my shots `plans/reports/shots-shell-main/sheet.png` (looked OK).
- **Waiting on user (asked, unanswered):**
  1. New level 7 to REPLACE "Cầu nhấp nháy": 1a ⭐ "Phân loại thùng màu" (color-sensor + Và; robot carries only blue crates to store, 3 blue = win, red = lose; prove headless first, fall back to 1b if engine can't) · 1b "Dừng trước vật cản" (ahead-sensor + Không; cart crosses corridor) · 1c "Trốn khỏi tầm mắt" (vision-sensor; needs vision cone drawn). 2a ⭐ keep old level-07 file in kho (not in PUZZLE_LEVELS) · 2b delete. New level must update guide-script WIRE_LINES (`cau-nhap-nhay` keys), map title, levels-5-8 tests.
  2. Stage look preview (part B, user chose "preview first"): DONE by agent, NOT yet shown to user / not published. Page `plans/ui-mockups/cozy-stage/index.html` (built from `src/` by build.sh; shots in `shots/`; report `plans/reports/fullstack-261101-2040-cozy-stage-preview-report.md`). Defaults: stage frame 370×390, character scale 1.6, zoom 1.0, follow camera on. Questions for user: frame/size values (copy JSON), one or two lamps in 2D, small diorama tray OK for 3D. Porting notes: level 2 cast is legs robot; level 3 is 2d-top in data; collision sizes ≠ visuals; hiding by sinking with clipping planes; wheel robot ~25k tris (could cut ~12k).
- **User feedback 21:30 on preview Màn 2 door:** no big framed door / dark hole / sink-into-floor. Wanted "A": side view sees door EDGE-ON = thin vertical hinge post + thin vertical leaf; on button press the leaf swings open around the vertical hinge toward the viewer. Sent to the preview agent to redo (cozy-stage). Apply the same door in the real game port. 21:40: user APPROVED the redone door ("đúng rồi") and asked the same for the Màn 3 star gate (sent to the preview agent). Rule for every 2D side-view door/gate: thin post + edge-on leaf that swings open, never sinking. 21:45: user considered merging Màn 3 into Màn 2 (7 levels) but then chose to KEEP 8 levels and make the Màn 3 gate the SAME wooden door as Màn 2 (sent to preview agent). 21:50: user wants Màn 5 robot = LEGS robot (not wheel) — preview agent updating; in the real game change level-05.ts cast/look to PUZZLE_LOOKS.robotLegs + name/task text "Rô-bốt chân" and guide/hint lines mentioning "bánh xe" for level 5 (level 8 text also names the wheel robot — leave unless asked). 21:55 USER APPROVED the whole cozy-stage preview ("ổn rồi, dựng thành game"); unanswered items took ⭐ defaults: char scale 1.6 / zoom 1.0 / follow cam, 1 lamp in 2D, new level 7 = "Phân loại thùng màu", 3D scenes + prop kit OK. Agents launched: feat/stage (port preview into real game, worktree ../GameBuilder-stage, port 5204) and feat/level7 (new level 7, ../GameBuilder-level7, port 5205). Merge each, junctions first on cleanup. 22:27: feat/level7 MERGED into main (new level 7 `phan-loai-mau`, legs robot reads the coloured pad under its feet; old level in levels/archive; report fullstack-261101-2200-level7-report.md). Worktree ../GameBuilder-level7 NOT yet removed (agent background work was still running) — remove junctions then worktree. feat/stage MERGED 22:45 (cozy stage in all levels, chars 1.6x, follow cam default, level 3 changed to 2d-side with the shared door, level 5 legs robot; 261 puzzle tests green; report fullstack-261101-2200-stage-port-report.md). Worktrees removed. NEXT: user playtest; level 7 needs its own cozy props (colour pads); wheel robot ~25k tris in levels 4/8; then part D APK. (Old list:) character size (default 1.6), lamps 1 vs 2, new level 7 (⭐ Phân loại thùng màu), 3D scenes/prop kit OK?
- **Next:** show preview (Start-Process the local file, or publish via claude-artifacts MCP `publish_files`) → user approves → agent ports stage props into render + level scenes (keep rules; re-run all level tests) → new level 7 → HANDOFF update. Then part D (APK).
- Known: phone HUD level title truncates ("Bot đầu ti..."); real sound/touch untested; "Xoá tiến độ" not clicked for real.

## 1b. 2026-11-01 afternoon — "Xưởng Bot giải đố" puzzle game (in main)
- **Open:** http://localhost:5173/giai-do.html (also Xưởng Nối menu Trợ giúp → "Chơi giải đố"). Decision record: `plans/reports/brainstorm-261101-1357-puzzle-game-report.md`; agent reports `plans/reports/fullstack-261101-14*-*.md`.
- **Runs on the real engine.** A level (`app/src/puzzle/types.ts` PuzzleLevel) = locked `base` graph (must contain a win-lose node; 3D levels lock a camera node) + `shownPorts` (locked node with `{}` = hidden scenery) + `tray` + `editable` params + `par` + `timeLimit` + reference `solution`. `run-level.ts` plays it headless (tests prove every solution wins and wrong answers don't). Node `pos` uses a logical 1000×560 board; cards stay readable, only positions scale.
- **8 levels** `app/src/puzzle/levels/level-01..08.ts` (one file each, `PUZZLE_LEVELS` in index.ts): 1 Bot đầu tiên, 2 Cửa kho, 3 Nhặt sao (2D ngang/từ trên) · 4 Hai nút một cửa (two robots take turns on buttons → teaches Hoặc) · 5 Đủ ba thùng, 6 Né lính gác, 7 Cầu nhấp nháy, 8 Xưởng tổng hợp (3D). Locked objects carry `params.name` (card subtitle).
- **UI** `app/src/puzzle/ui/**` + `app/giai-do.html` + `src/puzzle-main.ts` (Vite multi-page): level list with unlock + stars (localStorage `xuongnoi.puzzle.progress`), tap-port-then-tap-port wiring, real board cards + wire energy reused, tray, hint, editable param editor, CHẠY/DỪNG, win overlay. Stage: play look, overview fit before AND during the run (user asked 2026-11-01 17:45: zooming on the character looked bad); follow only if the player taps the toggle "Toàn cảnh / Theo nhân vật" (`GameView.setStageFit`). Dev fixture only via `?fixture`.
- **4 new character looks** (render/character-styles): robot-wheel (Chắn bùn mount), robot-legs, cat-chibi, cat-quad; in Nhân vật "Kiểu dáng". Cats are always black (`fixedColor`); robots tint with "Màu" (levels use #7cc4f0).
- **4 new sensors** (logic, now 54 kinds): speed-sensor, ahead-sensor, vision-sensor (new WorldApi `lineOfSight`, `world/line-of-sight.ts`), color-sensor (matches the block's colour against its Màu 1/2/3). Handbook pages + lesson "Giác quan cho bot" (`course-pack-e.ts`, end of Bot chapter).
- **Hộp input `hiddenWhile` "Ẩn khi bật"** (last input): level-follow hide/show, acts only on change; unwired = old behaviour.
- **Visual tutorial (16:30):** `puzzle/ui/guide.ts` + `guide-script.ts` + `guide.css`: Mèo Mun mascot (`mascot.ts` = engine cat-chibi in a round frame, talks: typing + mouth flap + head nod, natural blinks; face API `rig.face` in cat-chibi.ts, `blink.ts`), spotlight, tapping hand, dotted ghost wire; steps generated from `level.solution`; levels 1–7, auto only on first open (`xuongnoi.puzzle.guideSeen`), "↻ Hướng dẫn" replays; "?" = ghost of next missing wire (costs a star except while the guide leads). Approved preview: https://claude.ai/artifact/3zeovA1nDaLFRd9oY37cgR. In-game chibi blinks naturally. Hẹn giờ has "Tự lặp lại". Level 7 redone (timer repeat → latch toggle → go + Không → bridge Ẩn khi bật); a test now replays every level's solution through the real `canConnect` (self-wires were rejected by the board but not by runLevel). Level 7 can still be won without the bridge wire (bridge stays shown).
- **Hints & stars (17:30):** level 1 guide is mandatory on the first visit only (replay button on level 1 only); levels 2–8 have no auto guide — each "?" reveals ONE next step (cat + spotlight + hand + ghost wire). `freeHints` per level (L2 1, L3–5 2, L6–7 3, L8 4); `starsFor(level, answer, hintsUsed)`: 3 if pieces ≤ par else 2, minus 1 per hint beyond free, min 1. "?" badge shows free hints left (red + crossed star when none). New-piece intro: one cat line per unseen kind on first open (`intro:<id>` in guideSeen). Decoy tray pieces in levels 2, 3, 4, 7 (tests prove no cheaper shortcut). The task box hides while the cat talks. Repeat "?" on the same step counts (user may want to change).
- **Polish + APK track (from 17:50):** decision record plans/reports/brainstorm-261101-1753-cozy-polish-apk-report.md. Android toolchain installed: JDK 21 `D:\android\jdk-21`, SDK `D:\android\sdk` (platform 35, build-tools 35.0.0, platform-tools/adb 37.0.1; Google SDK license accepted with the user's approval), activate per shell with `D:\android\env.ps1` / `env.cmd`; user env ANDROID_HOME/ANDROID_SDK_ROOT set; JAVA_HOME and system PATH untouched (Java 8 at D:\Java stays). An older SDK (android-34, jdk17 zip, 2025-09-25) sits at the D:\android root — left alone, user may delete. Style previews A/B/C: https://claude.ai/artifact/Cp51RqEctmLeNhifT7fy8N , QTjjmT3rMqqb2YkzxxBduU , Gg4bamT5XnpHZaWavNuYCk (plans/ui-mockups/cozy-style/). **User chose A "Xưởng gỗ ấm áp" as default and wants B and C kept** (puzzle/ui/themes/, switcher A·B·C, localStorage xuongnoi.puzzle.themeTrial, DEFAULT_THEME=a). Themes never touch node cards, wires or characters (pixel diff 0) — user rule: change the UI, never the characters/cards/wires. Next: part B (themed floors/props per look), C (transitions, sound), D (standalone build + Capacitor APK). App name still not given (placeholder Xưởng Bot).
- **Theme state (18:30):** A is the default; level floors/blocks/props are still the old flat colours (grey 3D floor, green 2D strip) and clash with the themed backdrops — that is part B. The floating A·B·C switcher overlaps the board corner at 844×390; move the choice into a Settings screen in part C.
- **Not verified:** real phone touch, real GPU FPS, no human has played the 8 levels; vision cone gizmo not drawn in the editor; level 7 can be won without the bridge wire; 3D characters small in the phone overview; a hash URL reload (`#/level/x`) falls back to the level list; mascot motion (mouth/blink timing) only checked as forced poses.

## 2. Current state before 2026-11-01 afternoon (main was 2f223eb, 1496 tests)
- **Run:** `cd app; npm install; npm run dev` → http://localhost:5173 (strict port 5173).
- **Gates (in app/):** `npx vitest run --testTimeout 120000` (~4–7 min; slow when agents run), `npx tsc --noEmit -p .`, `npm run build`.
- **Stack:** Vite 8, TypeScript strict (noUncheckedIndexedAccess, noUnused*), three.js, vitest (node env, no DOM tests), plain DOM, no UI framework.
- **Engine:** typed ports bool/number/object, fixed 60 Hz tick, one world with 3 view modes (2d-side, 2d-top, 3d). `Runtime.takeRisen()` reports bool outputs that rose since the last read (used by the wire effect).
- **50 node kinds in 7 categories** (registry `app/src/nodes/index.ts`, count asserted in `tests/nodes/step-1-nodes.test.ts`):
  - input: key, stick, on-start, ui-button, ui-pick, ui-dialog, ui-start
  - logic: and, or, not, compare, touch, select-number, latch, zone, distance
  - math: const, math, counter, timer, random, map-range
  - object: character, block, item, vehicle, portal, moving-platform, rotating-platform
  - output: win-lose, show-number, show-text, guide-arrow, ui-meter
  - action: carry, interact, hand-tool, health, enter-exit, cargo, camera, teleport, shooter, spawner
  - brain: patrol, go-to, route-follow, chase, sequence, fight
- **Open params ("Nâng cao").** `ParamDef.advanced: true` folds a param under "Nâng cao ▸" in the properties panel. Defaults always equal the old constants, so old boards behave the same. Examples:
  - Every body (Hộp, Đồ vật, Nhân vật, Xe): collider size/offset (`world/collider.ts`) and gravity scale; Đồ vật also has friction and bounce.
  - Character hit reaction; carry drop distance and throw lift; fight backoff.
  - Vehicle brake, reverse, crash speed and shove; cargo gap and cells per layer; route arrive radius and steer gain.
  - Chase catch and flee distances, slow radius.
  - Sensors:
    - zone: rotate with follower, goods filter, rule edge/center/inside, min count
    - touch: grow, rule, hold time, "Vừa thôi chạm" output
- **Big features added this period:**
  - **UI nodes** (button, pick, meter, dialog, start screen).
  - **"Kho game của tôi":** a localStorage library (Tệp menu).
  - **Node groups:** Ctrl+G groups, Ctrl+Shift+G ungroups, double-click enters, Esc leaves, Ctrl+D duplicates; saved as `graph.groups`.
  - **Block styles:** 16 "Kiểu dáng", including Băng chuyền and Đường ray.
  - **Traffic:** route-follow, vehicle collision, guide arrows, cargo by goods type.
  - **Conveyor belts:** Hộp params plus "Chạy băng"/"Đảo chiều" inputs; riders stand on moving vehicles.
  - **Trains:** route-follow "Cách chạy: Bám ray" with 32 points; Đầu máy and Toa tàu models; "Kéo theo bởi" coupling (`world/vehicle-train.ts`).
- **16 samples** (`app/src/io/samples.ts`):
  - side-stars, top-collect, 3d-hop, key-door, pickaxe-rock, guard-patrol, cleaner-bot, maze-chase, platform-bot, arena, race, dice-zones, portal-camera, dodge-shoot
  - city-delivery (2D)
  - city-delivery-3d: 687 nodes, 32 groups, generated by `app/scripts/gen-city-delivery-3d.mjs`. Its `SIZES` table must cover `estimateNodeSize`.
- **Course: 30 lessons in 9 chapters.**
  - `app/src/tutorial/course.ts` holds the `COURSE` chapters. `arrangeCourse` orders `LESSONS` and renumbers the titles.
  - New lessons register through `course-pack-{a,b,c,d}.ts` (`createCoursePackX(kit)`).
  - The menu is grouped by chapter. Progress is stored by lesson id, so reordering keeps the ✓ marks.
  - `tests/tutorial/course-coverage.test.ts` fails if any node kind is not used by some lesson.
- **Sổ tay mảnh ghép** (Trợ giúp → Sổ tay mảnh ghép, or "?" on palette items and in the properties header):
  - `app/src/handbook/`: one page per node kind, with purpose, when to use, every port, every param, example, tips, lesson link and a "Thử ngay" tryBoard.
  - Levels Cấp 1–5 come from the lesson's chapter.
  - `tests/handbook/handbook-coverage.test.ts` fails if a node kind has no page.
- **Board look:**
  - Node cards use the "C · Khối đồ chơi" look (`editor/graph/node-cards.css`) at the OLD footprint (min 168 px, 26 px rows, inputs then outputs). Pins sit inside the card.
  - Wire "dòng điện" (`editor/graph/wire-energy.ts/.css`), toggled with Xem → Hiệu ứng dòng điện:
    - play: lit, dim, sparks
    - edit: stepped flowing dots
    - no CSS filters (they dropped FPS to 4)
  - `editor-state.loadBoard` runs `spreadOverlaps` (graph-geometry.ts), which pushes overlapping cards down per scope.
- **3D model pack "MEGA PACK WORLD"** (Mnostva Art, licensed Unity Asset Store pack the user owns):
  - Source `D:\asset\hieu333.unitypackage` → extracted + converted to coloured GLB in `D:\asset\hieu333_extracted\` (tools in `_tools\`, preview `MEGA_PACK_WORLD\Preview\index.html`).
  - All 2142 GLB copied to `app/public/models/mega-pack-world/` (570 MB, **gitignored**, not redistributable). Worktrees need a junction for this folder, same as node_modules. `npm run build` copies it into dist.
  - `render/pack-models.ts` (loader, ONE shared Lambert material, PackSlot, placements footprint/stand/inside/tile, tiled copies baked into one mesh) + `render/pack-model-table.ts` (style/vehicle/item → model pools).
  - Replaced by models (old code builders DELETED): block styles house, shop, stall, factory, tree, lamppost, trafficlight (+lamp overlay), road (orange), sidewalk, field, rock, fence; vehicles car, truck, bike; items crate, veggie, ore, bucket, ball, key.
  - Still code-drawn: box, sign, conveyor, rail, locomotive, wagon, all characters, tools (sword, pickaxe, hammer, torch, wand, lock, box item).
  - Variant per entity = `pickVariant(pool, ownerNodeId)` (items: ownerNodeId|entityId). Model colours are baked: "Màu" no longer tints replaced looks (handbook updated); traffic light colour still picks the lit lamp. Drivers are hidden inside car/truck models.
  - Mapping preview `plans/ui-mockups/model-mapping/index.html` (+ `build-mapping-preview.py`, `mapping.json`). Pools later trimmed: models > 20k triangles and the City_4/Farm_14 fences removed.
- **Approved preview artifacts:**
  - Node style + electricity: https://claude.ai/artifact/LK9fmQK5QZGmug49tPxZ9d (local copy `plans/ui-mockups/node-style-preview/index.html`)
  - Group demo: https://claude.ai/artifact/4U1nFMPX9o7pDvNSVVTqaf

## 2b. Design previews — 2026-11-01 (characters and puzzle mode are now IN the game, see 1b; previews stay as reference)
Standalone HTML pages (three.js 0.160 from jsDelivr via importmap, built only from code primitives + toon material, no files). Local copies under `plans/ui-mockups/` (gitignored); published as private artifacts. Each page has orbit view, motion/expression buttons, a tuning panel and "Sao chép thông số" (copy JSON).

| Artifact | Link | Local file | State |
|---|---|---|---|
| Xưởng Bot giải đố (puzzle mockup) | https://claude.ai/artifact/HZCcLSsT1PytkJ8YddedtV | `plans/ui-mockups/puzzle-phone/bot-workshop-puzzle.html` | Approved; real cards + wire energy copied in. Now built for real (§1b) |
| Hướng dẫn trực quan (talking Mèo Mun guide) | https://claude.ai/artifact/3zeovA1nDaLFRd9oY37cgR | `plans/ui-mockups/puzzle-phone/tutorial-preview.html` | Approved; now in the game |
| Robot Bánh Xe | https://claude.ai/artifact/MqQoHLu1wjjhpJFMJ8UR9V | `plans/ui-mockups/cozy-robot/robot-wheel.html` | Smoothed (more segments) + wheel mounts A Càng đôi / **B Chắn bùn (used in game)** / C Váy chuông |
| Robot Chân Ngắn | https://claude.ai/artifact/Seb1v2hHj6boPhF5qcwLDk | `plans/ui-mockups/cozy-robot/robot-legs.html` | In game |
| Mèo Mun Chibi | https://claude.ai/artifact/2cHfjMpvTusonbpu1d7iQH | `plans/ui-mockups/black-cat/cat-chibi.html` | In game; user kept the OLD collar (7b); page has a "Nói" button + natural blinks |
| Mèo Mun Bốn Chân | https://claude.ai/artifact/E7Rr1PS7FgwPzBPE71yz7r | `plans/ui-mockups/black-cat/cat-quad.html` | In game (collar defaults 0.90 / 0.085 / 0.17 / 0.00 / -6° / 0.92) |
| Style A / B / C | Cp51RqEctmLeNhifT7fy8N · QTjjmT3rMqqb2YkzxxBduU · Gg4bamT5XnpHZaWavNuYCk | `plans/ui-mockups/cozy-style/style-{a-workshop,b-meadow,c-night}.html` | A chosen as default, B/C kept. NOTE: preview A redrew cards and a 2D bot — NOT wanted in the game |

- Artifact publishing: the built-in `Artifact` tool may be missing; use the `claude-artifacts` MCP `publish_files` (republish needs the UUID slug + base_version — get them from `list_artifacts`, the short URL id is not the slug). Multi-file pages (HTML + PNG) publish fine.
- Mascot source: `D:\asset\Black cat` = the user's own team mascot as a Live2D/VTube Studio model (ava.png, 2× 8192 atlases, 8 expressions: ANGRY, BIG EYE, BLUSH, box, CRY, logo, sleepy, suprise). Rebuilt in 3D cozy style; reference copies in `plans/ui-mockups/black-cat/ref/`. All 9 expressions + 4 motions exist in both cat pages.
- Screenshot scripts per page: `shot-*.mjs` next to each HTML (Playwright by absolute path).

## 3. Open items / waiting on the user
- The user is test-learning the course at http://localhost:5173 and will report confusing steps.
- **Proposed, not approved:**
  1. Màn hình bắt đầu should pause the whole game until Start; today only timers wait.
  2. Spawner should get "Loại hàng".
  3. The zone "Chỉ tính loại hàng" filter should trim spaces.
  4. The train should not wait 3 s at start.
  5. A step-up ("bậc leo") mechanic for characters, which does not exist yet.
  6. Cargo "Giao vào điểm" and character "Đặt vào": an unload into a target, discussed but parked.
- **City 3D game:** the user wants it to live in their Kho game for long-term editing. It was parked ("để tạm"); it is still only a sample. Kho game is in the user's browser localStorage, so Claude cannot write it from the terminal.
- **Pack models — not verified on real hardware:** city 3D draws ~400k triangles per frame while playing (was ~9k). Software GL (SwiftShader): play 13 FPS vs 27 before; edit 60 both. Needs a check in the user's real Chrome. Next levers if slow: simplify meshes, fewer traffic-light triangles (16 × 6.7k), shadow casters.
- **Pack models — known gaps:** held item may show a different variant than on the ground (EntityView.tool has no seed); pack wheels don't spin; key model small in its cube; race sample not checked in 3D.
- **Puzzle game — waiting on the user (2026-11-01 18:40):**
  - **App name** for the APK (user picked "another name" but has not typed it; placeholder "Xưởng Bot", one constant).
  - **Next part:** B themed floors/props (⭐ recommended) vs C feel (title screen, map, transitions, sound) vs D APK first.
  - Repeat "?" presses on the same step: count each (now) or only when the step changes (⭐ offered, unanswered).
- **Puzzle polish plan (agreed):** A style + animated backdrop ✅ → B floors/props per theme (preview first) → C title screen with 3D characters, level map, Settings (theme choice, sound), transitions, confetti, music/SFX (code-made or royalty-free, credited) → D standalone build without the editor, offline, only used pack models, Capacitor APK, icon = Mèo Mun, landscape lock, self-signed keystore, install via adb.
- **Not verified by a human:**
  - playing all 30 lessons by hand
  - try-boards that need key or mouse input
  - real-GPU FPS
  - Firefox/Safari

## 4. Workflow that works (keep doing this)
1. **Requests.** The user writes short Vietnamese requests via `/brainstorm`.
   - Scout the code first, then reply in simple Vietnamese with tables: findings → options → ⭐ recommendation.
   - Ask plain-text numbered questions (`1a 2b`) and never popups. Unanswered questions take the ⭐ default; say so.
   - Visual decisions: build a quick artifact preview first (load the `artifact-design` skill, write HTML to the scratchpad, take one Playwright screenshot, publish with the `Artifact` tool), then implement after the user picks. To show it to the user, `Artifact action:open` or PowerShell `Start-Process <url>`.
2. **Decision record.** Write a short `plans/reports/brainstorm-<yymmdd-hhmm>-<slug>-report.md` before spawning agents. `plans/**` is gitignored, so reports stay local.
3. **Shared contract first, then parallel agents.** Before fanning out, commit the shared contract yourself so agents never edit the same file:
   - `ParamDef.advanced` + panel fold
   - `course.ts` + per-agent `course-pack-x.ts`
   - `handbook/types.ts` + per-agent `content-*.ts`
   - the agreed DOM hooks between agents (`data-live`, `is-hot`)
4. **Worktrees (manual):**
   - `git worktree add -b feat/x ../GameBuilder-x HEAD`.
   - Create the dependency junction YOURSELF with PowerShell: `New-Item -ItemType Junction -Path <wt>\app\node_modules -Target D:\workspace\GameBuilder\app\node_modules`. Some agents (fullstack-developer) have no PowerShell tool and get BLOCKED.
   - Give each agent a dev port (5201+), an explicit file-ownership list and the "do not touch" list of its siblings.
   - Agents use `subagent_type: fullstack-developer` with no `isolation` param (`isolation: worktree` fails here).
5. **Merge as each finishes:**
   - `git merge --no-edit feat/x`, then tsc + vitest (focused first, full at the end of a batch).
   - Clean up:
     1. Remove the junction with PowerShell `(Get-Item $j -Force)` after checking `LinkType -eq 'Junction'`, then `.Delete()`. Never a recursive delete through a junction.
     2. `git worktree remove --force ../GameBuilder-x; git branch -d feat/x; git worktree prune`.
6. **Verify yourself after merging:**
   - Run a combined Playwright check against :5173 (scripts in `plans/browser-scripts/`, e.g. `handbook-check.mjs`, `board-combined.mjs`).
   - LOOK at the screenshots.
   - Many real bugs were only caught this way: grey headers, overlapping cards, wrong search order.
7. **Wrap up.** Report to the user: what changed, how to open it, what was verified and what was NOT. Update this file.
8. **Design-preview loop (characters, mockups):**
   - One standalone HTML page per variant, written by one agent each (fullstack-developer, no worktree needed: different files in `plans/ui-mockups/<topic>/`). Give a shared style brief (palette hexes, face rules, "everything rounded", three.js pinned via importmap) so siblings match.
   - Agent must screenshot every state with its own `shot-*.mjs` and Read the PNGs. Then YOU look (contact sheet with PIL) before publishing.
   - Publish with the `Artifact` tool (same file path = same URL, new version). Also open locally with PowerShell `Start-Process <file>` when the user says "mở local".
   - Iterate by `SendMessage` to the SAME agent (it keeps the code in context) — much faster than a new agent. Paste the user's screenshot path; tell it exactly what to remove/move.
   - The user circles problems in red on screenshots (`c:\Users\trong\OneDrive\Pictures\Screenshots\...`). Read them; act on exactly what is circled.
   - For fine-tuning, add sliders + "Sao chép thông số"; when the user sends values, make them the defaults (and what "Đặt lại" restores).
9. **"Mở web local"** means the app at http://localhost:5173: start it in the background (`npm run dev -- --port 5173 --strictPort` in app/) if `curl` gets no 200, then `Start-Process http://localhost:5173`. Puzzle game: http://localhost:5173/giai-do.html. "Mở trên Chrome" = `Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" <url...>` (several URLs = several tabs).
10. **Puzzle level workflow (proven 2026-11-01):**
   - Contract first (types.ts, run-level.ts, one stub file per level + index), then one agent per group of levels.
   - Every level needs headless tests: reference solution wins; empty answer fails; removing each solution wire/piece fails; tray counts; shown ports only; no key/stick; locked cards don't overlap in 1000×560; **every solution wire passes the real board `canConnect`** (runLevel alone bypasses it).
   - Then look at it in the browser: unlock levels with localStorage `xuongnoi.puzzle.progress` (Record<id,{stars}>) and `xuongnoi.puzzle.guideSeen` (array of ids + `intro:<id>`), open a level by clicking its card (a hash reload returns to the list), click pulsing ports with `{force:true}`.
   - Scripts: `plans/browser-scripts/puzzle-levels-check.mjs` (all 8 levels × desktop/phone), `puzzle-hint-overlap-check.mjs`, `puzzle-run-overview-check.mjs`, `puzzle-default-theme-check.mjs`.
11. **Compare looks on the REAL game, not only mockups.** When the user wants to "see the levels in each style", add a temporary switcher (`?theme=` + floating control + localStorage) on the real page and screenshot all levels per option + one contact sheet each. It caught issues mockups hid (flat floors clash, moon behind a door pillar).
12. **Agent briefs for UI work must list what is untouchable**: node cards, wires/wire energy, characters, level data. Ask for a pixel diff of one card per variant (it was 0/9480 for A/B/C).
13. **When the user answers only some questions**, apply ⭐ defaults for the rest and say which defaults were used; re-ask only the ones that block the next step (app name).
14. **(11-02) Loop that worked all day:** user request → I scout + restate in simple Vietnamese (ASCII sketch for anything visual) → user "ok/A" → append one line to §0z → `git worktree add -b <fix|feat>/<x> ../GameBuilder-<x> HEAD` + 2 junctions (node_modules, public/models) → one agent per independent area with its own dev port (52xx), explicit file ownership and "do not touch" list of the parallel agent → merge as each finishes → check `git diff HEAD~1 --stat` vs `--stat -w` (fix CRLF flips with a byte-safe node script, see scratchpad `to-crlf.mjs` pattern) → tsc + full vitest → LOOK at 1–2 shots myself → kill the agent's dev port, delete junctions, remove worktree, delete branch → §0z line → short Vietnamese report with "chưa kiểm" list.
15. **Restate before building.** The user's words are short and often mean something else than the first reading (see §5 "Reading the user 11-02"). For every visual/behaviour request, first reply with "Mình hiểu là…" + an ASCII before/after sketch and 2 options; build only after "ok". This saved several wrong builds (door edge-on, outline glow, Layout B swap).
16. **Physics/logic rule:** any change touching movement, carry, doors or levels must keep `tests/puzzle/physics-invariants.test.ts` green; new mechanics add an invariant first (red), then the fix (green). Never ship a level whose win can happen for the wrong reason.
17. **"Tắt/dừng agent"** from the user = pause while they are away (use TaskStop; worktrees keep the work). When they return and say "tiếp tục", resume the SAME agents with SendMessage, not new ones. It is not a permanent ban on agents.
18. **Previews:** agents cannot publish artifacts (no claude-artifacts tools in subagents) — they build the HTML, I publish with `mcp__claude-artifacts__publish_files` (republish = same slug + `base_version` from the last publish result) and open it with `Start-Process <url>`.
19. **Editor stability first.** Anything that also touches Xưởng Nối goes behind a per-game setting (default OFF for shipped boards) and must prove "OFF = byte/trajectory-identical" over all samples + lessons + handbook boards before merge.

20. **(11-03/04) Merge-conflict hygiene with many parallel agents:** agents branched from an old main conflict in shared files (nodes/index.ts, node-names.ts, step-1-nodes count, handbook content + counts, course.ts / course-pack-e.ts, guide-script.ts + guide/hint tests, solid-off-baseline.json / solid-on-summary.snap.json, city-delivery-3d.json). Do NOT resolve big conflicts yourself: `git merge --abort`, then SendMessage the SAME agent "merge latest main into your branch, keep-both, node count = N, regenerate only new snapshot entries, rerun full suite". If main moves again while it works, send the new hash. Node count after two parallel node additions must be bumped by hand (git auto-merges 55→56 twice into 56).
21. **Agent finished on a merged-with-main branch → fast-forward merge** (`git stash; git merge --no-edit feat/x; git stash pop` because HANDOFF.md is usually dirty), then the agent's own full-suite result is valid for the identical tree; still LOOK at 1–2 shots.
22. **Read-only audit agent before rule-wide changes** (e.g. "every action needs a wire"): general-purpose agent writes plans/reports/audit-*.md with VIOLATION/GREY/OK + file:line + fix + impact, verified by headless runs in the scratchpad. Translate to simple Vietnamese table, ask ⭐ options, then one engine agent (phase 1: engine + migration + minimal level wiring to stay green) and later a polish phase.
23. **Engine default changes must ship with a load-time migration** that adds VISIBLE wiring (not hidden defaults) and prove 110 old boards hash-identical (sample/lesson/handbook baseline). Keep migration in one module, run on every load path (parseBoard, loadBoard, lessons, handbook try-boards), always set the marker.
24. **Previews: hand-coded sims are only for look & rules.** When the user asks "is this really the engine?", answer honestly; the real level must be built on general nodes with anti-forced tests. Tell the user which parts are mockup.
25. **UI agents get an explicit style brief:** "match style A wood look; header buttons look like the card ×; no new toolbars/colours; cards/wires/characters unchanged". After merging any visible change, screenshot the real game and show the user before moving on.
26. **Pause = TaskStop** ("dừng dừng"); worktree kept; note state in §0z; resume the SAME agent with SendMessage.
27. **Small UI fixes the user circles: do them directly in main** (Edit + puzzle tests + rerun an existing Playwright script against :5173 with a copied `*-v2.mjs`), commit, show the shot. No agent needed.

## 5. Lessons learned, bugs and fixes
- **Agent hand-off claims can be wrong; check before acting.** Example: "Quay lại sửa highlights the wrong button" was false, because `controller.playAware` already swaps play→stop while playing.
- **The new card CSS overrode the category colour.**
  - Cause: `.wc .wc-node { --cc: grey }` loaded after `.wc .cat-* { --cc }` at the same specificity.
  - Fix: put the default on low-specificity `.wc-node`.
- **The bigger cards broke every saved layout.**
  - The first C-style cards were wider and taller than `estimateNodeSize`, so old boards overlapped.
  - Fix: keep the old footprint, keep `estimateNodeSize` = old formula, and add `spreadOverlaps` on load.
  - Lesson: any card-size change must keep saved boards readable.
- **Adding inputs to a node grows its card.** Hộp got "Chạy băng"/"Đảo chiều", so sample layouts overlapped and the city sample overlap tests failed. Fix: respace samples (the 3D one by regenerating with matching `SIZES`); `spreadOverlaps` now also covers user boards.
- **Wire effects and FPS.** CSS `filter: blur/drop-shadow` on SVG wires took the city board from 60 to 4 FPS, and a continuous dash animation did the same. Use plain wide translucent strokes and `steps()` animations.
- **One-tick pulses.** Pulses are invisible if the UI samples every 100 ms, so `Runtime.takeRisen()` records rising edges between reads.
- **Search ranking.** Grouping search results by section hid the best match. While searching, show one flat list in score order.
- **Sensor "chạm mép" is too loose for delivery pads.** Hence the rule options (center inside / fully inside) and hold time.
- **Delivery dropped goods on the road.** Cargo unload only places items beside the truck. The discussed fix is "Giao vào", which is parked.
- **Tutorial:**
  - Never assert lesson positions or numbered titles in tests; use `lessonName()` and `chapterOf()`.
  - LESSONS items are copies made by `arrangeCourse`, so compare by id, not identity.
  - Step checks match by kind + port, never by id or position.
  - A node cannot wire to itself; timer loops need an extra Hoặc.
- **Merge conflicts:**
  - The usual spots are `nodes/index.ts`, the `types.ts` WorldApi tail, `fake-world.ts` stubs, `world.ts` step order, and the `vehicle.ts`/`character.ts` params + `createOnly`.
  - Resolve by keeping both sides.
  - `pathfind` must stay the LAST param where present (a test checks it).
- **Line endings.**
  - Many files are CRLF or mixed. Edit with a Python script that detects `\r\n` and writes bytes back.
  - `sed -i` on CRLF files is fine for single-line substitutions.
  - Check that `git diff --stat` stays small.
- **Tooling quirks:**
  - The Bash hook blocks commands containing the words "node_modules" or "dist".
  - Bash heredocs that contain Python with `'\r\n'` or nested quotes sometimes fail with "unexpected EOF". Write the script with the Write tool and run it.
  - PowerShell has no `git` on PATH; run git from Bash.
  - The dev server must be started in the background (`npm run dev -- --port 5173 --strictPort`).
- **Stray worktree folders.** A stray vitest run from an agent can keep a worktree folder locked ("Permission denied"). Wait for the agent's "finished" notification, then remove the folder after checking it contains no junctions.
- **Tests.** Full vitest takes 4–7 min while agents run, so always pass `--testTimeout 120000`; city sample sims are slow. vitest has a node env only, so DOM behaviour is checked with Playwright from `plans/browser-scripts` (Playwright is imported by absolute path from an old scratchpad `.../091c5a2d-.../scratchpad/smoke/`; it is not in package.json).
- **Known engine limits:**
  - head-on route cars deadlock
  - houses always face +Z
  - the start screen does not pause the sim
  - Spawner has no goods tag
  - zone goods match is exact
  - wagons fold back on ping-pong routes
  - no character step-up

- **Worktree cleanup order (slipped once 2026-11-01):** delete the junctions FIRST, then `git worktree remove`. Git stopped at the junction that time and nothing was lost, but don't rely on it. Also kill leftover agent dev servers (`netstat -ano | grep :52xx`).
- **Agents flip line endings.** Twice on 2026-11-01 a merge rewrote whole CRLF files to LF (game-view.ts, app-contracts.ts; and my own `sed` on level-05.ts). After every merge compare `git diff HEAD~1 --stat` with `--stat -w`; if they differ, convert back byte-safely with node (`replace(/\r?\n/g,'\r\n')`). Git Bash `sed`/pipes strip `\r`.
- **Puzzle levels:** block "Ẩn đi" is a one-shot pulse — use "Ẩn khi bật" for doors that follow a signal. Prove every level headless (solution wins, each wire removed fails) before looking at the UI.
- **Puzzle bugs found and fixed on 2026-11-01:**
  - *Level 7 unplayable*: its solution wired the timer's "Hết giờ" into its own "Đếm lại"; the board forbids self-wires but `runLevel` didn't care, so tests passed while players and the guide got stuck. Fix: Hẹn giờ "Tự lặp lại" param + level redesign + a test replaying every solution through `canConnect`.
  - *Level 4 AND bypass*: one sensor straight to the door also won. Fix (user picked 4b): both robots must pass, each holds the door for the other → the level teaches Hoặc.
  - *3★ was automatic*: trays held exactly the solution pieces. Fix: decoy pieces (L2 extra touch, L3 extra Hoặc, L4 Và, L7 Và). A decoy "Không" was rejected: an unwired Không outputs true and opened the door with 1 piece.
  - *Stage looked like the editor* (grid, tiny scene) → play look + fit the scene to the visible stage; characters tiny → follow toggle; the user then disliked auto-zoom on run → overview by default.
  - *Cards unreadable on phones* (whole card scaled to the 1000×560 fit) → scale positions only, cards ~1.0 desktop / ~0.78 phone, spread overlaps.
  - *Mascot bubble overlapped the task box* → `.pz-screen.mascot-on .pz-task { visibility:hidden }`.
  - *Mascot cat too small in its frame* → tighter portrait framing (FRAME_SHARE 0.9).
  - *Number editor closed after each +/−* (made "set the number" hint steps unusable) → fixed in board-view.ts.
- **Reading the user (2026-11-01):** "thô" on the wheel robot meant the body sat bare on the wheel (wanted a connector/decoration), not faceted geometry — ask or show both when a word is ambiguous. "Lấy y chang" = copy the look AND the effects (wire energy). "Biểu cảm mới" after the talking preview = put talking/blinking on the cat itself. "Thay giao diện" = never the characters, cards or wires.
- **My own slips today:** removed a worktree before its junctions (nothing lost; order now in §4); left an agent dev server on :5207 (kill with Stop-Process); `node -e` with nested quotes/backticks broke twice — use the Edit tool or a script file; a `sed` on a CRLF level file flipped endings — use node byte-safe edits; inline Playwright imports in Bash are blocked by the hook (path contains "node_modules") — write the script to a file first.
- **Preview-page pitfalls:** a guide variable named `step` clashed with the simulation's `step()`; `page.setContent` can't load `file://` images (navigate to the image instead); pulsing ports are "not stable" for Playwright clicks (`force:true`).

- **Pack model lessons:**
  - FBX from Unity: texture path points at the author's PC; vertex colours must be dropped (Unity ignores them, glTF multiplies them → a black pizzeria); units are cm (scale 0.01); mergeVertices shrinks GLB ~3×.
  - Give all GLBs one shared material/texture, otherwise every model uploads its own copy of the palette.
  - Triangles, not draw calls, were the cost: measure with `renderer.info` (temporarily expose it) before optimising. Square/corner models tile into dozens of copies — keep tile pools to long thin pieces.
  - `sed -i` on a CRLF file rewrote all line endings (game-view.ts): restore with `git checkout -- file` and use the Python byte-safe edit.

- **Character art: do only what the user asked.** Self-added details were rejected every time on 2026-11-01: cheek puffs, round fur clumps ("popcorn"), pointed fur spikes, then shell fur (soft but 5–8× triangles: 40–66k vs 8k). All reverted to plain smooth shapes. Offer extras only as an optional toggle or a question.
- **Jagged face edge** (robot legs): the cream face was a second sphere intersecting the head → noisy seam. Fix: a separate flattened ellipsoid sitting just in FRONT of the head surface; never coplanar/intersecting shapes.
- **Collar iterations (cat-quad):** a ring "computed to hug body+head" became an oversized float tube around the back; a short-neck tiny collar hid under the head; the final answer was a plain circular torus at the neck + user sliders + the X pendant placed each frame at the ring's lowest-front point hanging straight down (otherwise the chin hides it).
- **Tail rendered pale** (chibi): inside-out geometry winding. Fix the winding, don't paint over it.
- **Shell fur pitfalls (if ever retried):** a square-grid strand mask shows a dotted grid and dark specks on white; use jittered cells + a rotated second octave, keep the lowest ~30% of layers solid, very light root darkening on white.
- **Tooling:** the `claude-artifacts` MCP server can be down; the built-in `Artifact` tool still publishes. Preview pages need internet (three.js + Google Fonts from CDN). Agents' dev servers/Playwright can keep worktree folders locked; stop them (`Get-NetTCPConnection -LocalPort ...` → `Stop-Process`) before deleting.

### Lessons, bugs and fixes — 2026-11-03/04 (newest)
- **"Code ép" (forced code) was wrong from step one.** Puzzle-only brains (fetch-store, slot-patrol, pad-patrol, pad-carry) made bots behave without board logic; the client rejected it. Fix: general pieces + player-built circuits + anti-forced tests (only editor-registered kinds, level runs with puzzle registry cleared). Lesson: never solve a level by writing a bespoke brain.
- **Hidden action without a wire.** carry mode `toggle` let "Nhấc lên" also drop (L5 dropped crates with no Thả wire); 13 inputs defaulted to true so bots moved with nothing wired (L1/L3/L4/L6 proven). Fix: defaults off + visible start-card migration + dedicated ports (Tới Đích / Tới Đích 2, Lên/Xuống xe, Cầm/Cất) + no-action-without-wire test over all kinds.
- **Puzzle cheats found by search, not by eye:** Số cố định into both So sánh inputs (always true) → L3 dropped So sánh; unwired compare B reads 0 → L5 instant win (fixed by hidden win plumbing "crate in each slot"); "Khi bắt đầu" wired to a door opened it from tick 0 (fix: on puzzle boards start card may only feed switch-on inputs); unwired Đảo ngược outputs true (can replace a start piece) → not used as L1 decoy. Keep `tests/puzzle/fixtures/cheaper-win-search.ts` (drop each piece ± decoy, try every extra wire) for every level change.
- **Preview sim vs engine:** L6 v1 preview hand-coded decisions; user asked "is it the engine?" — honest answer was no. v2 real level needed a new general Sight Forecast node (simulates patrol + real line-of-sight forward, no world mutation, matches sensor within 0.2 s).
- **+0.5 margin wasn't binding** (forecast already conservative) → user dropped it; always test that every solution wire/piece is essential.
- **L6 stealth jitter:** stop-when-seen at the fan edge flickered; fix: cover-to-cover latched dashes, never stand in the open.
- **Agents' unrequested visible changes upset the user:** 3 blue tool buttons, white "?" circles, pins moved to card edge. Fixed directly: buttons not appended, "?" styled like ×, pins inside cards. Lesson: preview = approval of idea, not of in-game styling.
- **Tap-to-delete wire now waits 320 ms** (to allow double-tap knot) — known side effect.
- **Two parallel node additions** → node count test merged to wrong number; fix by hand.
- **Agents writing through junctions:** `npm install` in a worktree writes into main's node_modules (only add packages).
- **Background dev server dies with the session**; `curl :5173` before telling the user to open it.

### Reading the user — 2026-11-03/04
- "Bot phải có logic" = sense→think→act behaviour from the board, not scripted motion; later "code ép là sai từ bước đầu".
- "Kịch bản khoá" confused the user — say "mảnh có sẵn"; then user wanted only characters/objects on the board.
- "Khách đang bảo" = client requirement; treat as a project rule and record it in §00.
- "Không cần 3 nút này" + circled screenshot = remove exactly those; "đứng kế chứ đừng để trên đầu nút tắt" = inline next to ×; "chung style với bảng" = reuse existing button look.
- "Giao diện mảnh ghép cũ" = card look before the tidy port (pins inside the card).
- "Dừng dừng" = pause running agents now.

### Lessons, bugs and fixes — 2026-11-02
- **Characters walked through crates / each other (3D, then 2D level 4).** Cause: only `block` bodies collided (physics.ts); puzzle 2D had no solid option at all. Fix: `WorldOptions.solidBodies` (character↔character, character↔item, item↔item, carried item ↔ walls). Lesson: when physics changes, audit EVERY level and EVERY mode, not just the one reported — the same bug existed in 2D.
- **Level designs that only worked because of pass-through.** L5/L7/L8 robots stood inside crate piles; L4 needed A to pass B. Solid physics exposed them. Fix: re-lay levels + brains (`fetch-store`, slot routes, L4 sequence). Lesson: when you make the world stricter, expect level data to break and re-run every solution headless.
- **Crate "flew" to its final spot.** Cause: drop chose a free spot sideways + render blend smoothed the jump. Fix: drop exactly at the hands, fall straight down, refuse drop if blocked; invariant "release shift ≤ 0.02, no jump > 0.3/tick".
- **Win while still carrying the 3rd crate.** Zone counted carried items. Fix: `EntityView.carried`, zones skip it; invariant "win proof" checks the reason for every win/lose.
- **Visual vs collider mismatch.** Characters drawn 1.6× with 1× box (overlap before "caught"); legs robot drew the crate low while physics held it overhead; door leaf animated 0.8 s while its collider vanished instantly (robot stood "inside" a closed-looking door). Fix: collider 1.3×1.6×1.3, shared hold point constants, door swing 0.25 s. Lesson: every visual animation of a blocking thing must match its collider timing.
- **Jerky movement.** Cause: 60 Hz sim drawn raw per frame (0/1/2 ticks per frame). Fix: render interpolation (tick-blend.ts). Measured first, then fixed; camera was a victim, not the cause.
- **Buttons slid right when pressed.** `.pz-btn:active { transform }` overrode `transform: translateX(-50%)` centering. Fix: center with the CSS `translate` property, press with `transform`. Lesson: never use `transform` for both layout and feedback.
- **Agents flip CRLF→LF** (again: store-slots.test.ts). Always compare `--stat` vs `--stat -w` after each merge.
- **Vite through a node_modules junction** can serve a blank page from stale optimized deps — restart with `--force`.
- **Dev server dies between sessions.** Check `curl :5173` first; restart in background before telling the user to open it.
- **Agents' dev ports and worktrees**: always kill the port (Get-NetTCPConnection → Stop-Process) and delete junctions BEFORE `git worktree remove`.

### Reading the user — 2026-11-02
- "Bộ kiểm tra logic" first meant an on-screen checker → really meant **a physics/collision engine** ("tương tác giữa người và đồ vật") + a **hidden** physics test that never shows in the game.
- "Không chia hai màn hình" → Layout B **swap** (board full + stage PiP; run swaps them), chosen from an artifact preview, not from text.
- "Cửa mở ra" in 2D → thin post + **edge-on** leaf that swings; never a framed door, never sinking.
- "Phát sáng" → only the **silhouette outline** glows; object colours untouched.
- "Mảnh ghép vật phẩm để là hộp" → the problem was the KIND name "Hộp"; standard = kind on top (Vật thể / Nhân vật / Đồ vật), instance name below; no thumbnails, normal icons.
- "Đặt thùng vào 3 ô" → robot must walk to each slot and set the crate down there; "3 hộp ở 3 nơi" → crates start scattered.
- "Simple" names (client) was ambiguous; user clarified it was about object cards, not node vocabulary.
- When the user circles something in a screenshot, Read the screenshot first; their sentence alone is usually not enough.

## 6. Backlog ideas (not approved yet)
- Sound and music.
- Gamepad and touch input.
- Online sharing.
- Character accessories.
- A "Mô hình" param on Hộp to pick any of the 2142 pack models (needs a model browser in the editor).
- Free "thử thách" lessons (task-only, checked by result).
- Dark/light theme toggle.
- A Playwright devDependency in app/.

## 7. Gotchas
- The user is a non-coder. Explain plainly, give links (http://localhost:5173, artifact URLs), and say what was not verified in the browser.
- Report honestly: unverified items, deviations from the approved design, and when tests were not re-run in full.
- Security: never read `D:\gbg\`. The skill kits (`D:\skill\taste-skill-main`, `D:\skill\impeccable-main`, `E:\ux-ui-agent-skills-main`) are read-only references; never install their hooks or run impeccable's launcher. Use the user's email only for identification.

- 22:50: user says overview ("Toàn cảnh") still too far, wants a tighter "just enough" fit and a TRIAL first (screenshot Screenshot 2026-11-01 224722.png). Agent on branch feat/overview-fit (worktree ../GameBuilder-fit, dev :5206, presets Hiện tại / Gần vừa / Rất gần), not merged; report fullstack-261101-2250-overview-fit-report.md. Show trial to user, merge chosen preset, remove trial control, clean worktree (junctions first).

## 0z. Decision log 2026-11-02 → 11-04 (raw, chronological — §00 is the summary)
### 00:17 — client's big change request (all now resolved, see §00)
User (client feedback) says STOP the overview-fit work (branch feat/overview-fit + worktree ../GameBuilder-fit + dev :5206 still exist, NOT merged — park or delete; junctions first) and wants:
1. A "bộ kiểm tra logic" on the play screen: shows whether the run follows the wired pieces' logic (e.g. live per-piece state / which piece fired / why the level failed).
2. NO split screen (game left + board right) — on phones it is too small. One side fills the screen (switch Bảng mảnh ghép ⇄ Sân chơi), OR the game view is small/zoomable and grows when needed.
3. Redo ALL 3D levels (5–8) from scratch.
4. Player-controlled camera in the game view: pan (drag) + zoom (pinch/wheel).
Asked user (numbered 1a..) — see chat; record answers here. Recommended order: layout (2) + camera (4) first, then logic checker (1), then 3D redo (3) via brainstorm + preview per level.

- 00:25: user said "stop talking, make an artifact to check". Agent building preview plans/ui-mockups/phone-layout/ (layouts A toggle / B picture-in-picture, camera pan+zoom, logic checker V1 on-board / V2 checklist, "Làm sai thử"); will publish via claude-artifacts MCP; report fullstack-261102-0025-phone-layout-preview-report.md. 3D redo not in this preview.
- 00:43: phone-layout preview PUBLISHED https://claude.ai/artifact/7VYWBcEfNcUfRUop9Df2cQ (slug 34931270-6c14-4f18-a8e6-9a51393ef499). Waiting for user pick: layout A/B/C, checker V1/V2, then 3D redo details.
- 00:50: user CHOSE Layout B with a SWAP: stage enlarges full-screen -> board shrinks into the corner (two-way picture-in-picture). Preview agent updating; then republish artifact slug 34931270-6c14-4f18-a8e6-9a51393ef499 (publish_files with slug + base_version 1793554951-5458). Checker V1/V2 still to pick; 3D redo details still unknown.
- 01:18: Layout B swap built + REPUBLISHED (same link, version 1793557063-b87e). Next: user checks it, picks checker V1/V2; then implement layout B swap + camera pan/zoom + checker in the real game (new brainstorm/plan), then 3D redo.
- 11:45: USER APPROVED Layout B swap; DROP the logic checker entirely. Agent implementing layout B swap + stage camera pan/zoom in the real game on feat/layout-b (worktree ../GameBuilder-layout, port 5207). feat/overview-fit superseded (delete it: junctions first). After that: 3D redo (ask user what is wrong with 3D).
- 11:55: user: 3D has many PHYSICAL logic errors (e.g. level 7 robot walks THROUGH crates). User meant a physics/collision engine, not a logic checker. Read-only audit agent running -> plans/reports/audit-261102-1155-3d-physics-logic-report.md (fix current engine vs Rapier). Then show user, decide, and do the 3D redo on top.
- 11:58: user ALSO wants a HIDDEN physics check (never shown in game): plan = (1) headless invariant test suite run over every level each tick (no character/item overlap with solids/items/closed doors, nothing below floor, carried item not inside walls, visual 1.6x vs collider sanity, sensors fire only on real contact) + (2) DEV-only runtime watcher logging violations to console (stripped from production build). Build it together with the 3D physics fix after the audit.
- 12:10: 3D physics AUDIT done: plans/reports/audit-261102-1155-3d-physics-logic-report.md. Root causes: only blocks collide (physics.ts:279-333), drops ignore crates (world.ts:217), zones count carried crates (zone-sensor.ts:142), 1.6x drawn vs 1x collider, carry pose mismatch, carried crate no collision. Recommends A (fix own engine, puzzle-3D only, ~2-3 days, re-lay 4 levels + hidden overlap tests) over B Rapier. Waiting user pick A/B. Title-screen overlap fix agent running (commits on main).
- 12:15: user chose A (fix own engine, puzzle 3D only). Agent on feat/physics3d (worktree ../GameBuilder-physics, port 5208): hidden overlap tests first (red), then engine fixes, then re-lay levels 5-8.
- 12:11: UI bug clarified by user: shell buttons (Chơi, Cài đặt, ...) jump/skew to the RIGHT when pressed/hovered — sent to the title-fix agent (commits on main).
- 12:28: button press bug FIXED on main (17fcfea): .pz-btn:active transform overrode translateX(-50%) centering; now centered with `translate`. Title layout de-overlapped (shell.css, character-stage.ts, shell-kit.ts). 38 buttons measured, 0 shifts. Report fullstack-261102-1205-title-fix-report.md.
- 13:20: MERGED feat/physics3d (solid bodies for puzzle 3D, hidden invariant suite tests/puzzle/physics-invariants.test.ts + DEV watcher src/dev/physics-watch.ts, levels 5-8 re-laid) and feat/layout-b (B swap + camera pan/zoom, top bar with Đề bài button, follow cam floors FOLLOW_CONTEXT_ZOOM in cameras.ts). Full vitest 1954 green, tsc clean. feat/overview-fit deleted (superseded). Worktrees removed. Open: agent questions (zoom chip relative to default? task text closed on won levels?); 3D redo still pending (ask user what to change); L7 red tile drawn as round button; level 8 cards small on phone.
- 14:16: MERGED fix/smooth-motion: render interpolation between the last two 60 Hz ticks (src/render/tick-blend.ts, game-loop alpha, game-view). Cause proven: raw tick state drawn per frame. 1984 tests green per agent. Not checked on real GPU/phone; editor also gets the blend (not hand-tested). Report debug-261102-1402-smooth-motion-report.md.
- 14:30: user: box placing is wrong — bot does not walk to the exact spot and set the crate down; the crate flies/teleports to its final spot. Agent on fix/carry-place (../GameBuilder-carry, port 5210).
- 14:40: user chose A for Xưởng Nối editor: per-game "Va chạm thật" switch (new boards ON; samples/lessons/saved boards keep old behaviour until each is verified). STABILITY of Xưởng Nối is the top priority. Start AFTER fix/carry-place merges. Needs: graph-level setting persisted in save/load + Kho game, properties/Tệp UI toggle, handbook pages, physics-invariant suite over all 16 samples + 30 lessons try-boards (both modes), full regression; do not flip any sample until proven.
- 15:00: MERGED fix/carry-place (drop at hands + falls straight, refused drop keeps holding, stacking, smooth pick-up rise, wheel robot carries in front; levels 5/7/8 retuned; new invariants). Starting editor "Va chạm thật" work on feat/editor-solid (../GameBuilder-editor, port 5211).
- 15:08: user chose A for store SLOTS: store pads have N marked slots (L5 3, L7 blue store 3, L8 2); robot auto-walks to next empty slot, faces it, sets crate centred in slot. Runs in PARALLEL with feat/editor-solid on feat/store-slots (../GameBuilder-slots, port 5212) — expect merge conflicts in world/carry code.
- 15:35: user: RENAME all 54 node labels (1a: plain Vietnamese name + small standard English term, e.g. "Bật/Tắt giữ · Toggle", "VÀ · AND"; ids unchanged; update handbook, 30 lessons, guide lines, level texts) — first a rename TABLE artifact for approval (agent building plans/ui-mockups/node-rename/). And 2a: two-way highlight — selecting a card glows its object on stage, tapping an object glows its card (editor + puzzle). Implement both AFTER feat/editor-solid and feat/store-slots merge.
- 15:45: MERGED feat/store-slots (PuzzleLevel.storeSlots, puzzle-only slot-patrol node, L5/L7 3 slots, L8 2; L8 brain wait 2s) and feat/editor-solid (graph.settings.solidBodies, toggle in Properties + Tệp>Cài đặt game, new boards ON, all 101 shipped boards OFF and hash-identical; options frontCarryAll/respawnFallen; handbook topic). Full vitest 2241 green. Only cleaner-bot breaks when ON (needs re-layout) — no sample flipped. Rename proposal published https://claude.ai/artifact/4qQe73vGicfUwvMsnfCaao (plans/ui-mockups/node-rename/, 19 node + 53 port renames, Carry split into Khiêng đồ / Cầm dụng cụ) — waiting user approval; then implement rename + two-way highlight.
- 16:00: user approved node rename proposal as-is (plans/ui-mockups/node-rename/node-rename.json) for Xưởng Nối; and for Xưởng Bot object cards (1a): main title = real object name (params.name e.g. Cờ, Cửa kho) + small thumbnail of the object, hide generic kind (Hộp/Đồ vật) in puzzle only; plus two-way highlight. Agents: feat/rename (../GameBuilder-rename, 5213) and feat/obj-cards (../GameBuilder-cards, 5214).
- 16:05: USER: after feat/rename and feat/obj-cards finish, DO NOT start any more agents. Just merge those two, verify, report, and wait.
- 16:30: USER PAUSED until tonight. feat/rename (../GameBuilder-rename) and feat/obj-cards (../GameBuilder-cards) agents may still be running/finished on their branches — NOT merged. Tonight: read their reports (fullstack-261102-1600-rename-report.md, fullstack-261102-1600-obj-cards-report.md), merge rename first then obj-cards (expect conflict in shared card component), tsc + full vitest, browser check, remove junctions then worktrees, report to user. No new agents.
- 16:32: both agents (rename, obj-cards) STOPPED by user request mid-work. Their worktrees ../GameBuilder-rename and ../GameBuilder-cards keep partial (likely uncommitted) work — NOT merged. Tonight: inspect each worktree (git status/log), decide resume (new agent or finish by hand) vs discard; remove junctions before deleting worktrees.
- evening 11/02: user back, said continue -> RESUMED the two stopped agents (rename, obj-cards) via SendMessage (no new agents). Merge rename first, then obj-cards.
- 21:00: MERGED feat/rename (node-names.ts table, labelEn on NodeDef/PortDef, ~90 text files, old names as search aliases, LEGACY_LONGEST_LABEL keeps estimateNodeSize) and feat/obj-cards (puzzle object cards = object name + offscreen thumbnail; two-way highlight via GameView.setHighlight in puzzle + editor; new render/object-highlight.ts, object-thumbnails.ts, puzzle/ui/object-cards.ts). Full vitest 2257 green, tsc, build OK. My own checks on :5173: puzzle 42/42, editor 16/16, shots plans/reports/shots-main-after-merge/. Worktrees removed. No agents running. WAITING for user. Known: L5 has no object cards (all scenery hidden); 3 node names widen card slightly only with the missing-wire badge; editor tap on empty stage now clears selection.
- 21:15: user: agents allowed again ("tắt" only meant while away). Corrections: (1) highlight = glowing OUTLINE/rim of the object silhouette only, not a yellow shell; (2) puzzle cards: remove thumbnails, restore normal category icon, KEEP object name as title; (3) L5: 3 crates start at 3 different places, robot fetches each and places into 3 distinct slots (auto route, puzzle unchanged). Agents: fix/outline-icons (../GameBuilder-outline, 5216), feat/l5-scatter (../GameBuilder-l5, 5217).
- 21:35: MERGED feat/l5-scatter (puzzle-only fetch-store brain, L5 crates at 3 spots, fills 3 slots; wins 27.0s; 383 puzzle tests green). Fixed agent CRLF->LF flip in tests/puzzle/store-slots.test.ts. fix/outline-icons still running.
- 21:50: MERGED fix/outline-icons (silhouette outline glow via mask + edge shader in render/object-highlight.ts; thumbnails removed, category icon + object name on puzzle cards). Full vitest 2260 green. My look: robot outline OK; thin door (L2) outline is so thick the door looks filled white — may need thinner edge for thin objects. No agents running.
- 22:05: user chose A: rename node kind block "Hộp" -> "Vật thể" · Object (search alias "Hộp"); object cards in BOTH workshops = title kind name (Vật thể / Nhân vật / Đồ vật) + subtitle instance name (Cờ, Bot...), normal icon. Agent on fix/object-naming (../GameBuilder-naming, 5218).
- 22:20: MERGED fix/object-naming (block = "Vật thể · Object", aliases Hộp/Block; cards kind on top + instance name below in both workshops). 2260 green. PENDING user answer: level 4 2D robots pass through each other (2D puzzle levels lack solidBodies; L4 design forces A to pass B on button 2) — proposed A: solid bodies for all 2D puzzle levels + B leaves button 2 toward flag after A passes door; or B: move button 2 past the flag.
- 22:32: user: audit ALL 8 levels for physical/logic correctness, 2D and 3D. Took default A for level 4 (solid bodies for 2D puzzle levels; B leaves button 2 toward flag after A passes). Agent on fix/levels-audit (../GameBuilder-audit, 5220): audit table first, then fixes.
- 23:05: MERGED fix/levels-audit: solidBodies for ALL puzzle levels incl. 2D; L4 redesigned (A btn1, B through door to btn2, A past door, B leaves to flag, A follows; win = B on flag + A behind); door swing 0.25s to match collider; L7 flat red pads no longer drawn as buttons; invariants extended (shut-door, open-door, win/lose proof, no-stuck). 2296 tests green. Report fullstack-261102-2232-levels-audit-report.md. Open: L4 A ends behind flag not on it. No agents running.
- 23:31: user: L7 crates fly into hands while bot walks + bot goes to row end before returning. Chose ⭐ 1a 2a 3a: stop ~0.5s at every pad with a crate (red too), face crate, player's circuit decides grab, grab only when standing still, return to store at once, skip empty pads. L7 only. Agent on fix/l7-stop-grab (../GameBuilder-l7stop, 5221). Report brainstorm-261102-2331-l7-stop-and-grab-report.md.
- 23:40: user: L6 too simple. New L6 'Lẻn qua mắt lính gác': 1a lose = seen while moving (stand still safe, crates block sight), 2b guard patrols while looking, 3a 3D top view + drawn vision fan (yellow/red), 4a PREVIEW first. Solution vision-sensor seen → Không → go; distance = decoy. Preview agent → plans/ui-mockups/guard-vision/. Report brainstorm-261102-2340-l6-guard-vision-report.md.
- 23:48: MERGED fix/l7-stop-grab (puzzle-only pad-patrol brain + pad-carry hands: stop 0.5s at every loose crate, grab only when still, straight back to store; win 19.9s; 9 new tests). Worktree removed. L6 guard-vision PREVIEW published https://claude.ai/artifact/DgRd23WWMS9eYSHPojESGJ (slug 66aed81c-2fbd-49ea-a9ec-77eab0c13be3, v 1793638105-92da); guard does NOT chase yet. PENDING user answers on 'bot logic' (see→think→act states + head icons ! ? 💭 ✓; guard chase/search).
- 23:55: full vitest after L7 merge: 2305/2305 green, tsc clean. User rejected L6 preview logic (cat runs in the open, freezes in front of guard, jitters at fan edge). Proposed cover-to-cover stealth (cat dashes between crates only when guard not watching the next gap; guard ! chase / ? search / return). Waiting answers 1a/2a/3a.
- 00:05 (11-03): L6 decisions 1a 2a 3a 4b: cover-to-cover stealth; player wires So sánh(window > dash+0.5s) → cat runs; chain covers if time remains; guard sees cat = lose at once; guard = robot legs. Resumed SAME preview agent to rebuild guard-vision preview (same artifact link).
- 00:12: L6 preview v2 REPUBLISHED same link (version 1793639498-27d3): cover-to-cover, cat predicts guard window (sim forward 12s), runs if window >= dash+0.5s, chains; guard = legs robot; seen = lose; sim 12/12 (correct wins 9-15s w/ >=1 wait + >=1 chain; 3 wrong ways lose). Safe band patrol 3.2-3.4, guard speed 1.3-1.6, cat speed 3-3.4 (lock in game). Waiting user review.
- 00:52 (11-03): user scaled back: KEEP scripted levels (fixed task + reference solution), KEEP tray pieces, stars unchanged, '?' still costs stars. Change only: hidden puzzle-only brains (fetch-store, slot-patrol, pad-patrol, pad-carry) → replaced by small GENERAL pieces (also added to Xưởng Nối) wired as LOCKED visible cards = the script. Pilot L7 first. User asked per-level piece list (sent).
- 14:30 (11-03): user OK -> L7 pilot: hidden pad-patrol/pad-carry replaced by general pieces as locked VISIBLE cards (1a, left side); route-follow stop-at-points upgrade + new 'Ô trống kế tiếp'; keep tray/solution/stars. Agent on feat/l7-board (../GameBuilder-l7board, 5222). Report brainstorm-261103-1430-l7-board-pieces-report.md.
- 15:10 (11-03): MERGED feat/l7-board (d4f408e): L7 runs only on editor-registered pieces as 12 visible locked cards; pad-patrol/pad-carry deleted; route-follow advanced stopFor/faceAtStop + output atPoint; new node next-free-slot (55 kinds) + handbook + lesson tidy-bot; solution wire sw5 now ends at locked Và input A; win 17.7s. My look: board is cluttered (locked cards ~70% width, wires crisscross, phone cramped). Hint text outdated. Open: slot marks visible vs hidden; maybe collapse locked cards into a 'Bộ não bot' group (1b).
- 17:50 (11-03): user 1a 2a 3a 4a: L7 player builds whole circuit (board only robot + 3 slot marks), short ref circuit ~8 pieces/14 wires (atPoint replaces speed+or gate), tray = needed + 1 decoy, mandatory first-visit full guide + freeHints 7, L8 archived, L7 last. Agent feat/l7-self-build (../GameBuilder-l7self, 5223). Before: full vitest 2335 green after l7-board merge.
- 18:35 (11-03): MERGED feat/l7-self-build (22970cc): L7 board = robot + Ô kho 1..3 only; player builds 7 pieces/17 wires (route stop 0.5 + Phép tính +, Đọc màu & Đang ở điểm → Và → Nhấc lên, Đang khiêng → route Dừng + Đi tới Cho đi, Ô kho → Ô trống kế tiếp → Đích, Đã tới → Thả); tray +Đảo ngược decoy, par 7, freeHints 7, mandatory first-visit guide; L8 archived (levels/archive/level-xuong-tong-hop.ts), 7 levels, ending after L7. Agent-added (need user OK): win needs a blue crate in EACH of 3 slots; crate lane z 1.02→1.12 so wrong circuit can't grab mid-walk. Concerns: phone tray wraps to 2 rows, cramped built board; decoy proof bounded (~440 runs); decoy test +85s. slot-patrol only used by archive L8 (fetch-store imports parkingSpot from it).
- 18:40 (11-03): user 1a (keep 3-slot win + crate lane), 2a (L7 phone fix), 'sửa luôn các màn' → 3 parallel agents: ui-phone (../GameBuilder-uiphone 5224), L5 general pieces (../GameBuilder-l5gen 5225), L6 stealth real level (../GameBuilder-l6new 5226). Report brainstorm-261103-1840-fix-remaining-levels-report.md.
- 19:25 (11-03): MERGED feat/l5-general (a3663f9): L5 = 11 visible locked cards/23 wires (editor kinds only), new node nearest-item (56 kinds) + go-to advanced 'settle', lesson nearest-bot; fetch-store + puzzle-nodes.ts deleted; slot-patrol moved into levels/archive (L8 only); parkingSpot → store-slots.ts. Win 27.4s. tsc OK (full vitest pending after all merges). My look: L5 board very cluttered, player's 2 pieces drown among locked cards. Pre-existing bug: removing sw2 (Số cố định→So sánh B) wins instantly (unwired B=0).
- 19:45 (11-03): MERGED fix/puzzle-phone (387cad3): tray single scroll row, cat bubble placed by code avoiding spotlight, board card scale ladder +0.52/0.46 (L7 built on phone ~0.46, small text). Remaining: L6 agent (feat/l6-stealth) still running.
- 20:00 (11-03): user rule: ALL levels show only characters+objects, player builds all bot logic. 1a go-to 'Đích 2' upgrade; 2a L5 4-piece circuit; 3a L6 guard patrol one locked card; 4a parallel: (I) feat/goto-l5-l7 (../GameBuilder-l5l7, 5227), (II) feat/l1-l4-built (../GameBuilder-l1l4, 5228), (III) feat/l6-stealth running (told via SendMessage). Report brainstorm-261103-2000-all-levels-player-built-report.md.
- 20:50 (11-03): MERGED feat/l1-l4-built (064bb4f): L1-4 player-built, board only characters/objects; L1 1 piece, L2 3, L3 2 (route preset + counter goal; compare dropped — Số cố định into both compare inputs was an always-true cheat), L4 4 pieces (2x Đi tới, Chạm, Hoặc; A starts on Nút 1, B's Đã tới → A Cho đi; sequences removed); mandatory guides 1,2,4(+5,7); cheaper-win search fixture. L6 branch conflicts with main → asked L6 agent to merge main into its branch (node count must be 57). L6 open: +0.5 margin not binding (removing it still wins) — user choice: keep / multiplier ×1.2 / bake into route (par 3). Track I (goto-l5-l7) still running, branched before L1-4 merge.
- 21:00 (11-03): user 1a (L6 drop +0.5: Còn ≥ Cần → Chạy, ~3 pieces; sent to L6 agent), 2a (L3 without So sánh OK), 3a (L3 no mandatory guide).
- 21:05 (11-03): track I done (feat/goto-l5-l7: go-to Đích 2/Dùng đích 2 + lesson two-goals-bot; L5 = 4 pieces/15 wires, win = crate in each slot, loophole gone, 27.5s). L7 NOT shortened (Đích 2 can't replace route walk) — options a keep / b L5-circuit+xanh filter / c new route port or select piece; ask user. Asked agent to merge main (064bb4f) into its branch first.
- 21:20 (11-03): MERGED feat/l6-stealth (a810a26, fast-forward): L6 player builds 3 pieces/8 wires (Chạy theo tuyến từng chặng + Dự đoán tầm nhìn + So sánh Còn≥Cần → Chạy), guard patrol = 1 locked card, vision fan, new node sight-forecast (57 kinds), lesson sight-forecast; agent suite 2458 green. Guard turns instantly (fan flips). Track I asked to merge latest main. L7 shortening question (a/b/c) pending user.
- 21:15 (11-03): MERGED feat/goto-l5-l7 (dacff3d, ff): go-to Đích 2 + lesson two-goals-bot; L5 player-built 4 pieces/15 wires (win = crate in each slot, old loophole gone). All 7 levels now player-built (L6 guard patrol 1 locked card). No worktrees left. L7 shortening (a/b/c) pending user.
- 21:20 (11-03): full gates on main dacff3d: tsc clean, vitest 151 files / 2476 tests green.
- 21:30 (11-03): user wants APK: 1a name 'Xưởng Bot', 2a debug APK, 3a file on Desktop, 4a icon = Mèo Mun face from game. Agent feat/apk (../GameBuilder-apk, 5229).
- 21:35 (11-03): user said 'dừng' → APK agent STOPPED mid-work (pause, not cancel). Worktree ../GameBuilder-apk (feat/apk) kept with partial work; resume same agent via SendMessage when user says tiếp tục. Note: npm install may have added capacitor packages into main app/node_modules via junction.
- 22:00 (11-03): client rule: every action must come through a wire ('không nối dây mà chạy được là sai'); found L5 carry 'toggle' (Nhấc lên also drops). User asked full read-only audit of engine/nodes/levels for wire-less behaviour → audit agent → plans/reports/audit-261103-2200-wireless-behaviour-report.md. Pending user: 1a/2a/3a from previous message (go-to Tới Đích/Tới Đích 2; ban toggle in puzzle).
- 22:20 (11-03): user approved 'every action needs a wire' fix: a (L7 keep), 1a engine-wide defaults OFF + load migration inserting visible Khi bắt đầu wires, split dual inputs, 2a/3a consequences OK, 4a L7 stop via Hẹn giờ wiring, 5a forecast gets route via wire; L5 go-to Tới Đích/Tới Đích 2 + carry separate. P1 agent feat/wire-rule (../GameBuilder-wire, 5230). Report brainstorm-261103-2220-every-action-needs-wire-report.md.
- 22:35 (11-03): user wants Unreal/Unity-style tidy wires; asked for artifact preview first. Agent builds plans/ui-mockups/wire-tidy/ (real cards + wire energy + real L5/L7 solution boards, toggles: ① pins on card edge ② back-wires route around ③ focus dim ④ reroute knots ⑤ auto-arrange ⑥ object-wire stubs with label). Engine wire-rule agent still running.
- 22:45 (11-03): wire-tidy preview PUBLISHED https://claude.ai/artifact/TNe2cb4gbhP1EAgcqfSXPL (slug d5930b25-1772-43ad-a0dc-0b548ff93acf, v 1793720642-92e2). Crossings M5 34→5, M7 32→5 with all 6 toggles. Waiting user pick.
- 22:55 (11-03): user OK wire-tidy for XƯỞNG BOT FIRST: ① pins on edge, ② back-wires route around, ③ focus dim, ④ Unreal-style reroute knots (double-click add, drag, multi-branch from one knot, Ctrl+R, double-click remove) + 'Gom dây' button, ⑤ Sắp xếp gọn, NO ⑥; board grows taller/scrolls. Started now in parallel with wire-rule agent; knots kept in puzzle-only side data (no engine Wire type change) to avoid conflict. Agent feat/puzzle-wire-tidy (../GameBuilder-tidy, 5231).
- 23:35 (11-03): user 1a 2a 3a: '?' help on every card (Xưởng Bot cards + tray chips + Xưởng Nối board cards), short handbook popup + 'Xem đầy đủ'. QUEUED: start after feat/puzzle-wire-tidy merges. Report brainstorm-261103-2335-card-help-button-report.md.
- 00:05 (11-04): MERGED feat/wire-rule (cb470f3): 15 switch-on inputs default OFF; on-start held output 'Đã bắt đầu'; migration (wire-rule-migration.ts, marker graph.settings.wireRule) adds one visible Khi bắt đầu per scope, all 110 old-board hashes unchanged; go-to Tới Đích/Tới Đích 2; enter-exit Lên/Xuống xe; hand-tool Cầm/Cất; forecast fed by patrol 'Tuyến đi tuần' + route 'Tuyến chạy' wires; route 'Đã đứng yên'; no-action-without-wire test over 57 kinds; 14 lessons got start steps. Levels: L1 par2, L2 4, L3 3, L4 4, L5 5, L6 3 pieces/11 wires, L7 11 pieces (stopFor removed: timer+compare+or). Puzzle: start card may only wire to switch-on inputs. Phase 2 todo: texts/guides, L2-L4 doors still hiddenWhile, L4 door open+close paths, L7 size. Open decisions: N7 lookAhead auto-stop, N12 route drives vehicles, lessons using legacy ports. Tidy agent (branched dacff3d) must merge main.
- 00:10 (11-04): full gates on main cb470f3: tsc clean, vitest 155 files / 2610 tests green.
- 00:20 (11-04): MERGED feat/puzzle-wire-tidy (aa1e8e8, ff; agent suite 2635 green on identical tree): puzzle board pins on edge, routing around cards, focus, Unreal-style knots (double-tap, drag, Ctrl+R, branch merge), Gom dây, Sắp xếp gọn + pan/zoom/Vừa khung; knots in memory only; tap-to-delete wire delayed 320ms. Crossings L5 86→8, L7 118→27 (desktop). My look at L7: still busy, some routed wires run around the board perimeter, cards small. Next queued: '?' help button (1a2a3a) + phase-2 texts (waiting user 1a-4a).
- 00:22 (11-04): started '?' card help agent feat/card-help (../GameBuilder-help, 5232).
- 00:36 (11-04): MERGED feat/card-help (b3357e8, ff; agent suite 2639 green on identical tree): white '?' with blue ring on every puzzle/editor card + tray chip, short handbook popup + 'Xem đầy đủ' (puzzle mounts read-only handbook), never costs stars, editor card size unchanged. Note: some handbook examples still mention old wiring (e.g. Đã tới → Nhấc lên). Pending user: phase-2 1a-4a.
- 00:55 (11-04): user circled & rejected the 3 blue tidy buttons (Sắp xếp gọn/Gom dây/Vừa khung) → hidden (code kept, not appended). '?' restyled like the card '×' (soft dark circle), puzzle: inline next to ×/lock; tray: inside chip corner; editor: inside header right. Lesson: never add visible UI (buttons/colours) the user hasn't seen in a preview on the REAL game.
- 01:05 (11-04): user asked old card look back → puzzle pins inside cards again (edge-pin CSS removed). Kept: '?' beside ×, double-tap knots, focus, routing. 593 puzzle tests green.
