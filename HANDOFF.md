# HANDOFF — GameBuilder "Xưởng Nối" — 2026-10-29 03:05

## Goal
An ORIGINAL browser node-wiring game builder for a Vietnamese non-coder user. You drag nodes, wire ports and press Chơi to play. Claude writes all code and the user playtests. NOT a clone of Game Builder Garage: never read `D:\gbg\` and never mirror its nodes, UI or text.

## Run
`cd app; npm install; npm run dev` → http://localhost:5173. Then `npx vitest run`, `npx tsc --noEmit -p .` and `npm run build`.

## Done (all committed on `main`, latest `dff2719`, 392 tests)
- Engine:
  - typed ports bool/number/object, 60 Hz ticks, back-edges
  - one 3D world with 3 view modes: 2d-side, 2d-top, 3d
- Editor:
  - palette, wiring canvas, properties panel
  - resizable splitters and ⛶ maximize
  - edit-mode pan/zoom with 🎯 reset
- Save:
  - autosave and JSON files
  - samples: side-stars, top-collect, 3d-hop, key-door, pickaxe-rock, guard-patrol, cleaner-bot, maze-chase, platform-bot
- Characters: 6 animated looks with a thumbnail picker, plus a role param (player/bot) so the camera follows the player.
- Items:
  - carry above head, drop, throw
  - interact
  - hand-tool slot with use/swing
- Bots:
  - brains: patrol, go-to, chase/flee, sequence
  - A* pathfinding: grid for top/3d, platform graph for side
- Tutorial: 6 in-app lessons.

## Latest (2026-10-29 03:05) — all approved jobs DONE, main = df1ede5, 511 tests
- Job 1: lesson 7 'chores' (Chuỗi việc), show-text node + floating labels, lock shape, tools smaller in hand / flat on ground.
- Job 2 combat: health node + bar, punch/tool/thrown damage, knockback, i-frames, death = tip over then hide, fight brain, arena sample, lesson 8.
- Job 3 vehicles: vehicle + enter-exit nodes, steer modes, bots drive, closest-cell pathing, brain 'Tìm đường' param, race sample, lesson 9.
- Integration: vehicles/seated drivers not damageable; key-door hint hides after opening; health bar lifts above carried item.
- Samples (11): side-stars, top-collect, 3d-hop, key-door, pickaxe-rock, guard-patrol, cleaner-bot, maze-chase, platform-bot, arena, race. Lessons: 9.

## Latest (2026-10-29 13:20) — main = 657b7be, 631 tests, 41 node kinds, 14 samples, 10 lessons
- Lesson 10 is 'bot-driver' (a bot boards a car and drives to a flag).
- Gap-closing batch, all merged (design in `plans/reports/brainstorm-261029-1255-gap-closing-batch-report.md`; each feature's report is `plans/reports/fullstack-developer-261029-1300-wt-*`):
  - Editor tools: undo/redo, multi-select copy/paste/duplicate, sticky notes saved in board JSON.
  - Logic/sensors: random (seeded), latch, map-range, zone sensor, distance; sample dice-zones.
  - Objects: moving platform (carries riders), rotating platform (90° steps when solid, spin when not), shooter, spawner; sample dodge-shoot.
  - Camera/teleport: play-camera node, teleport, portal pairs; sample portal-camera.
- A post-merge browser sweep is running; its report will be `plans/reports/tester-261029-1320-post-merge-sweep-report.md`.
- Bots treat moving/turning blocks as empty space when pathfinding.

## Known issues / ideas
- Characters pass through each other; vehicles pass through each other.
- Health-bar lift and 3D vehicle visuals only unit-tested (not eyeballed in browser).
- Browser scripts (scratchpad, may be lost): L4 E/F loop flaky; L9 script step index stale.
- Backlog: character accessories (hats), tutorial for 2D-top/3D basics, arrow keys on WASD samples.

## Gotchas
- A project hook blocks Bash commands whose text contains "node_modules" or "dist", so prefer the Write/Edit tools.
- Commit only `app/` (the zip/dump and tooling are gitignored). The git identity is repo-local.
- Playwright smoke scripts live in the session scratchpad and may be lost. Some legacy tutorial browser checks flake on headless fps (verified against a baseline): L4 alternating E/F loop.
- The user prefers plain-text numbered questions and simple Vietnamese explanations.
