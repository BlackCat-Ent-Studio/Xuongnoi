# HANDOFF — GameBuilder "Xưởng Nối" — 2026-10-29 15:00

## 1. Goal
An ORIGINAL browser node-wiring game builder for a Vietnamese non-coder user. You drag nodes, wire ports and press Chơi to play a 2D or 3D game.
- Claude writes all the code; the user only playtests and decides.
- It is NOT a clone of Game Builder Garage. The user asked for "98% giống" early on and was declined. Never read `D:\gbg\` and never mirror its nodes, UI, lessons or text. Generic genre mechanics are fine.

## 2. Current state (main = a840e3e + this handoff, 654 tests green)
- **Run:** `cd app; npm install; npm run dev` → http://localhost:5173.
- **Gates:** `npx vitest run`, `npx tsc --noEmit -p .` and `npm run build` must all pass.
- **Stack:** Vite 8, TypeScript 7 strict (noUncheckedIndexedAccess, noUnused*), three 0.186, vitest 5, plain DOM (no UI framework).
- **Engine:** typed ports bool/number/object, a fixed 60 Hz tick, back-edges read the previous tick, and one 3D world with 3 view modes: 2d-side, 2d-top and 3d.
- **41 node kinds in 7 categories** (`app/src/nodes/index.ts`):
  - input: key, stick, on-start
  - logic: and/or/not, compare, latch, zone, distance, touch
  - math: const, math, counter, timer, random, map-range
  - object: character (6 looks plus role player/bot), block, item (10+ shapes, holdStyle head/hand, damage, carryable), vehicle, moving/rotating platform, spawner, portal
  - action: carry, interact, hand-tool, enter-exit, shooter, teleport, health
  - brain: patrol, go-to, chase/flee, sequence, fight (A* pathfinding with a path-finding on/off param)
  - output: win-lose, show-number, show-text, camera
- **Editor:**
  - palette, wiring canvas, properties panel with a look picker
  - resizable splitters and a maximize button
  - edit-mode pan/zoom with 🎯 reset
  - undo/redo, multi-select copy/paste/duplicate (Ctrl+C/V/D), sticky notes
  - a floating status toast and an autosave/JSON file
- **14 samples:** side-stars, top-collect, 3d-hop, key-door, pickaxe-rock, guard-patrol, cleaner-bot, maze-chase, platform-bot, arena, race, dice-zones, portal-camera, dodge-shoot.
- **14 lessons:**
  - 1–3 basics
  - 4 carry
  - 5 tools
  - 6 make-bot
  - 7 chores (sequence)
  - 8 combat
  - 9 vehicles
  - 10 bot-driver
  - 11 chance-zones
  - 12 platforms-shooting
  - 13 camera-portals
  - 14 editor-tools
  - Each lesson is its own file `app/src/tutorial/lessons-*.ts`, registered in `lessons.ts` → `LESSONS`.

## 3. NEXT: UI/UX redesign (waiting for the user's choice)
- **Audit:** `plans/reports/ui-ux-designer-261029-1440-editor-ux-audit-report.md` (15 problems). The top ones:
  - narrow node cards cut off Vietnamese labels
  - nodes overlap when added
  - busy boards are unreadable (no zoom buttons, fit or minimap)
  - "Khối" means two things (all nodes, and the box object)
  - the palette has no search or icons
  - category colours fail contrast and clash with wire colours
  - Chơi turns into "Sửa" instead of "Dừng" plus "Chơi lại"
  - hints cover the game view
  - the top bar wraps at 1280px
- **Three mockups** (private artifacts; local copies in `plans/ui-mockups/*/index.html` + `preview.png`; each has its own report `plans/reports/ui-ux-designer-261029-1440-mockup-*-report.md`):

  | Mockup | Artifact | Notes |
  |---|---|---|
  | A Studio tối (dark, amber accent) | https://claude.ai/artifact/KNSN9o6woKHZku7qZBzjcA | Most interactive: real wire drag, wrong-type port shake, "Nối giúp tôi". About 4–6 dev days |
  | B Sáng thân thiện (warm light, pastel) | https://claude.ai/artifact/UieGR5Z6c9X5ntby13QNJ4 | Stacked ports (labels never clip), tutorial card docked under the palette, "Thiếu 1 dây" badge |
  | C Kính mờ hiện đại (glass bento) | https://claude.ai/artifact/1HP4DBh5pgSKYnqvreBAwm | Ctrl+K that ignores diacritics, flowing wires in play, solid fallbacks |

- **Recommendation already given to the user:** B as the base, plus A's wire interactions and "Nối giúp tôi", plus C's Ctrl+K. A dark-mode toggle can come later.
- **Five questions are pending; ask them again as plain numbered text:**
  1. Which mockup?
  2. Rename the box object "Khối" to "Hộp" or "Vật cản"? Keep the internal kind `block` so saves still load.
  3. Change category colours so green/blue/orange mean port type only?
  4. Add a `required` flag to port defs to drive the "Thiếu dây" badge?
  5. Tablet/touch in scope? The recommendation is no.
- **After approval:** brainstorm report → plan phases (tokens/CSS, top bar, palette with search and icons, node cards with smart placement, canvas zoom/fit/minimap, properties, game view and toast, tutorial card, rename and colours, required ports) → split into parallel worktrees by file ownership → merge → browser sweep.

## 3b. UPDATE 2026-10-29 15:45: a second round of mockups (D/E/F, pro game-engine style)
- **The user's request.** Make more mockups in a professional, modern game-engine editor style (Unity/Unreal genre, without their names or logos). Use these 3 skill kits as read-only guidance, plus https://21st.dev/community/components for visual inspiration only.
- **Skill kits.** All three were checked by hand and scanned with Windows Defender, and none had threats. Do not install them: their hooks would clash with ClaudeKit.
  - `D:\skill\taste-skill-main`
  - `D:\skill\impeccable-main`: its `impeccable.cmd` downloads an exe from GitHub, so never run it.
  - `E:\ux-ui-agent-skills-main`: the user wants it kept on drive E, not drive C.
- **Three ui-ux-designer agents** were launched in the background. Each writes `plans/ui-mockups/<dir>/index.html` + `preview.png` and a report `plans/reports/ui-ux-designer-261029-1520-mockup-<x>-report.md`:
  - **D `d-pro-docked`**: 4 docked panels. **DONE, published at https://claude.ai/artifact/NcZBP7Gy3Ysx2CUfFsTMjD.** Fit zoom is 65% at 1280. Porting is estimated at 13–17 days.
  - **E `e-graph-focus`**: the graph fills the screen, with presets Nối dây/Chơi thử/Cân bằng and a floating PiP game. **DONE, published at https://claude.ai/artifact/4CxnpFqtjZ2qhg4X6RgCtZ.** It passed the checks at 1280 and 1440. Concerns:
    - the fit zoom is only 57% at 1280
    - it renames nodes to "Mảnh ghép" and the box to "Hộp"
    - play mode allows live editing
    - porting is estimated at 11–14 dev days
  - **F `f-split-live`**: a 50/50 game/graph split, wires show live values during play, plus Ctrl+K. **DONE, published at https://claude.ai/artifact/H2sAgUkXkV9ERYRbKzWXCa.** Fit zoom is 65% at 1280. Porting is estimated at 16–18 days. All 3 are done; the next step is asking the user to choose.
  - **2026-10-29 16:48: the user tentatively chose D (Xưởng Pro) as the base.** Parts of E/F will be picked later. Still waiting on questions 2–7 (renaming Khối, "Mảnh ghép", live editing during play, colours, required ports, touch).
  - **2026-10-29 16:50: decisions locked** (2a Hộp, 3a Mảnh ghép, 4a, 5a, 6a, 7a). Report: `plans/reports/brainstorm-261029-1648-ui-redesign-pro-docked-report.md`. Next: /ck:plan (P1 Shell first, then P2–P6 in parallel). Note: the engine has no pause/step yet.
- **Next steps:**
  1. When D and F finish (if those agents are gone, check whether the files exist and re-run any missing mockup), eyeball each preview.png.
  2. Publish each with `mcp__claude-artifacts__publish_files` (files: index.html as index.html, title "Xưởng Nối – Mẫu D/E/F …", icon "layout").
  3. Give the user the links.
  4. Ask, batched as plain numbered text:
     - which of A–F
     - the Khối rename (Hộp / Vật cản / Mảnh ghép)
     - category colours only for port types
     - a required-port flag
     - live editing during play vs locking
     - a collapsed palette at 1280
     - tablet out of scope
- **Note:** Playwright is NOT in `app/package.json`. Agents used an install from an old scratchpad, so add it as a devDependency or reuse `plans/browser-scripts`.

## 4. Workflow that works (keep doing this)
1. **Requests.** The user writes short Vietnamese requests, usually through `/brainstorm`. Reply in simple Vietnamese with tables.
   - Present the options and a recommendation first.
   - Ask plain-text numbered questions (`1a 2b`), never AskUserQuestion popups.
   - Batch every open question into one message when the user asks for that.
2. **Scale.** For each approved feature write a short brainstorm report in `plans/reports/brainstorm-<date>-<slug>-report.md`, then spawn `fullstack-developer` agents.
   - The user wants max parallelism ("mở hết agent").
3. **Parallelism means git worktrees.**
   - Create them yourself: `git worktree add -b feat/x ../GameBuilder-x HEAD`. The Agent tool's `isolation: worktree` failed here.
   - Each agent runs `npm install`, uses its own dev port (5174+), commits on its branch and writes a report in `plans/reports/`.
4. **Merging.** Merge as each agent finishes with `git merge --no-edit feat/x`. Conflicts are almost always append points:
   - `nodes/index.ts` (imports and the node list)
   - the `types.ts` WorldApi tail
   - the `io/samples.ts` list
   - the `tests/io/samples.test.ts` id/mode arrays and idle exclusions
   - the node count in `tests/nodes/step-1-nodes.test.ts`
   - the `fake-world.ts` stubs
   - the `LESSONS` array and imports in `tutorial/lessons.ts`
   - `scene-view.ts`
5. **Resolving.** Use a small node script that does union merging (HEAD + theirs) and preserves CRLF/LF per file.
   - Watch for methods landing inside the wrong interface (e.g. after `PortalLink`), and for a missing `},` between union-merged object methods in `world.ts`.
   - Big multi-file semantic conflicts (combat vs vehicles) go to a resolver agent.
6. **Verifying.** After each merge run tsc and vitest, then commit, `git worktree remove --force` and `git branch -d`. After a batch, run a tester agent browser sweep of every sample and key lessons.
7. **Wrapping up.** Update this file and commit after every batch. Give the user `http://localhost:5173`; start the dev server in the background if it is down.
8. **Mockups.** Write the files and publish them with `mcp__claude-artifacts__publish_files`; they are private by default. Read `guide(pages)` once per session.

## 5. Lessons learned, bugs and fixes
- **The status toast shifted the layout.** It made the top bar wrap, so the canvas jumped 33 px and wire drags missed (the lesson 3 "flake").
  - Fix: `.status` is absolutely positioned with `pointer-events:none`.
  - Lesson: intermittent UI script failures can be REAL bugs; probe element rects per action.
- **Perf and determinism tests flake when 4+ agents run at once.** The A* budget was raised to 6 s. Re-run on an idle machine before calling it a bug; 5/5 green when idle.
- **Tutorial gotchas:**
  - Step checks must be tolerant: match by node kind + port, never by id or exact position.
  - Lessons hard-coding "is the last lesson" break when lessons are appended; use `toContain`.
  - A node cannot be wired to itself (`same-node`), so timer loops need an extra node.
- **Samples:** a solid car means `go-to` must have stopDistance ≥ 1.5 to "arrive". Bots treat moving/turning blocks as empty space in A*.
- **Bash hook:** it blocks commands containing the words "node_modules" or "dist", which affects Bash heredocs that mention them. Write files with the Write tool.
- **Git:** the identity is repo-local (user "trong"). Commit `app/`, HANDOFF and plans as needed; `plans/**` is gitignored except templates, so reports stay local only. The zip/dump, ClaudeKit and `.agents` are ignored.
- **Scratchpad:** session scratchpads are lost between sessions. Useful Playwright scripts are copied to `plans/browser-scripts/*.mjs` (tut-run/tut-common, sweep, lessons 11–14). Point them at port 5173.
- **Known open issues:**
  - characters and vehicles pass through each other
  - 3D vehicle visuals, portals in top/3D and camera shake checked only in unit tests
  - lessons 11–13 are long (24–28 steps)
  - no sound
  - no mouse, touch or gamepad input
  - no online sharing

## 6. Backlog ideas (not approved yet)
- sound and music
- mouse, touch and gamepad input
- character–character collision
- shorter lessons 11–13
- character accessories
- 2D-top/3D basics lessons
- arrow keys on WASD samples
- dark mode

## 7. Gotchas
- The user is a non-coder. Explain plainly, give links, and say what was not verified in the browser.
- Report honestly: list unverified items and deviations from the approved design.
