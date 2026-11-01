# HANDOFF — GameBuilder "Xưởng Nối" — 2026-11-01 15:00

## 1. Goal
An ORIGINAL browser node-wiring game builder for a Vietnamese non-coder user. You drag nodes ("mảnh ghép"), wire ports and press Chơi to play a 2D or 3D game.
- Claude writes all the code; the user only playtests and decides.
- It is NOT a clone of Game Builder Garage. Never read `D:\gbg\` and never mirror its nodes, UI, lessons or text. Generic genre mechanics are fine.

## 1b. NEW 2026-11-01 afternoon — "Xưởng Bot giải đố" puzzle game (in main)
- **Open:** http://localhost:5173/giai-do.html (also Xưởng Nối menu Trợ giúp → "Chơi giải đố"). Decision record: `plans/reports/brainstorm-261101-1357-puzzle-game-report.md`; agent reports `plans/reports/fullstack-261101-14*-*.md`.
- **Runs on the real engine.** A level (`app/src/puzzle/types.ts` PuzzleLevel) = locked `base` graph (must contain a win-lose node; 3D levels lock a camera node) + `shownPorts` (locked node with `{}` = hidden scenery) + `tray` + `editable` params + `par` + `timeLimit` + reference `solution`. `run-level.ts` plays it headless (tests prove every solution wins and wrong answers don't). Node `pos` uses a logical 1000×560 board; cards stay readable, only positions scale.
- **8 levels** `app/src/puzzle/levels/level-01..08.ts` (one file each, `PUZZLE_LEVELS` in index.ts): 1 Bot đầu tiên, 2 Cửa kho, 3 Nhặt sao (2D ngang/từ trên) · 4 Hai nút một cửa (two robots take turns on buttons → teaches Hoặc) · 5 Đủ ba thùng, 6 Né lính gác, 7 Cầu nhấp nháy, 8 Xưởng tổng hợp (3D). Locked objects carry `params.name` (card subtitle).
- **UI** `app/src/puzzle/ui/**` + `app/giai-do.html` + `src/puzzle-main.ts` (Vite multi-page): level list with unlock + stars (localStorage `xuongnoi.puzzle.progress`), tap-port-then-tap-port wiring, real board cards + wire energy reused, tray, hint, editable param editor, CHẠY/DỪNG, win overlay. Stage: play look, overview fit before run, camera follows the main character on run, toggle "Toàn cảnh / Theo nhân vật" (`GameView.setStageFit`). Dev fixture only via `?fixture`.
- **4 new character looks** (render/character-styles): robot-wheel (Chắn bùn mount), robot-legs, cat-chibi, cat-quad; in Nhân vật "Kiểu dáng". Cats are always black (`fixedColor`); robots tint with "Màu" (levels use #7cc4f0).
- **4 new sensors** (logic, now 54 kinds): speed-sensor, ahead-sensor, vision-sensor (new WorldApi `lineOfSight`, `world/line-of-sight.ts`), color-sensor (matches the block's colour against its Màu 1/2/3). Handbook pages + lesson "Giác quan cho bot" (`course-pack-e.ts`, end of Bot chapter).
- **Hộp input `hiddenWhile` "Ẩn khi bật"** (last input): level-follow hide/show, acts only on change; unwired = old behaviour.
- **Not verified:** real phone touch, real GPU FPS, no human has played the 8 levels; vision cone gizmo not drawn in the editor; level 7 still uses the old locked Hoặc/"Hiện lại" bridge trick (could move to "Ẩn khi bật"); 3D characters still small on phone overview.

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
| Xưởng Bot giải đố (puzzle mode mockup, landscape phone) | https://claude.ai/artifact/HZCcLSsT1PytkJ8YddedtV | `plans/ui-mockups/puzzle-phone/bot-workshop-puzzle.html` | Level "Cửa kho" playable: tap-port-then-tap-port wiring, CHẠY, stars. User has NOT answered the 3 follow-up questions (style ok? 5 levels ok? 2D vs 3D stage) |
| Robot Bánh Xe (one wheel) | https://claude.ai/artifact/MqQoHLu1wjjhpJFMJ8UR9V | `plans/ui-mockups/cozy-robot/robot-wheel.html` | Done, ~5.3k tris. User has not picked a robot |
| Robot Chân Ngắn (two legs) | https://claude.ai/artifact/Seb1v2hHj6boPhF5qcwLDk | `plans/ui-mockups/cozy-robot/robot-legs.html` | Done (face screen fixed), ~5.7k tris |
| Mèo Mun Chibi (team mascot, 2 legs) | https://claude.ai/artifact/2cHfjMpvTusonbpu1d7iQH | `plans/ui-mockups/black-cat/cat-chibi.html` | Plain smooth, no cheeks/belly lumps/fur, ~8.5k tris. Collar still the OLD style (no collar sliders) |
| Mèo Mun Bốn Chân (team mascot, 4 legs) | https://claude.ai/artifact/E7Rr1PS7FgwPzBPE71yz7r | `plans/ui-mockups/black-cat/cat-quad.html` | Plain smooth, no fur, ~7.6k tris. Circular collar with 6 "Vòng cổ" sliders; user defaults 0.90 / 0.085 / 0.17 / 0.00 / -6° / 0.92; X pendant hangs BELOW the ring |

- Puzzle mode design (agreed so far): stays inside Xưởng Nối; separate game-like landscape phone screen; level = task text + locked pre-placed objects + a tray with only the needed pieces + hidden result checker; stars ⭐ solved · ⭐⭐ no hint · ⭐⭐⭐ fewest pieces; 1 tutorial + 4 main levels (Bot đầu tiên, Nhặt sao, Cửa kho, Đủ ba thùng, Né lính gác). Decision record: `plans/reports/` (brainstorm-261101-*).
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
- **Design previews — waiting on the user:**
  - which robot (Bánh Xe / Chân Ngắn / both) and which cat (Chibi / Bốn chân / both) become game characters;
  - port the collar sliders + hanging X to the Chibi cat? (offered, not answered);
  - puzzle mockup follow-ups (style ok, 5 levels ok, 2D vs 3D stage) not answered;
  - after the fur removal, expressions other than the default were not re-shot on either cat.
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
9. **"Mở web local"** means the app at http://localhost:5173: start it in the background (`npm run dev -- --port 5173 --strictPort` in app/) if `curl` gets no 200, then `Start-Process http://localhost:5173`.

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

- **Agents flip line endings.** Twice on 2026-11-01 a merge rewrote whole CRLF files to LF (game-view.ts, app-contracts.ts; and my own `sed` on level-05.ts). After every merge compare `git diff HEAD~1 --stat` with `--stat -w`; if they differ, convert back byte-safely with node (`replace(/\r?\n/g,'\r\n')`). Git Bash `sed`/pipes strip `\r`.
- **Puzzle levels:** block "Ẩn đi" is a one-shot pulse — use "Ẩn khi bật" for doors that follow a signal. Prove every level headless (solution wins, each wire removed fails) before looking at the UI.

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
