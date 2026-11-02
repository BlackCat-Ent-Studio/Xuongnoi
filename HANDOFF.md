# HANDOFF — GameBuilder "Xưởng Nối" + "Xưởng Bot giải đố" — 2026-11-01 18:40 (main = 0118780, 1777+ tests green, tsc clean, build OK)

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

## 0. NEWEST 2026-11-02 00:17 — BIG CHANGE REQUEST (not started, waiting on answers)
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
