# HANDOFF — GameBuilder "Xưởng Nối" — 2026-10-29 02:30

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

## In progress / next (approved, see `plans/reports/brainstorm-261029-0228-combat-vehicles-polish-report.md`)
Run these as sequential agent jobs. Commit and update this file after each one.
1. Lesson 7 "Chuỗi việc"; tools smaller in hand and lying flat on the ground; a lock shape; a "Hiện chữ" node.
2. Combat:
   - Máu node with health bar; punch and tool damage; thrown-item damage
   - knockback and i-frames; death = tip over, then hide
   - fight brain for bots
   - arena sample, lesson 8
3. Vehicles:
   - Phương tiện node (xe hơi/xe máy/xe tải nhỏ; steer modes Theo hướng / Ga-Lái); Lên/Xuống xe node
   - bots drive, with path clearance for vehicles
   - unreachable goal → path to the closest reachable cell; brain "Tìm đường" on/off param
   - race sample, lesson 9

## Parallel run (started 02:35)
- Job 1 is running in the main tree. It must NOT commit.
- Job 2 (combat) runs in worktree `D:\workspace\GameBuilder-combat`, branch `feat/combat`. It commits on its branch.
- Job 3 (vehicles) runs in worktree `D:\workspace\GameBuilder-vehicles`, branch `feat/vehicles`. It commits on its branch.
- Merge order:
  1. Commit Job 1 on main.
  2. `git merge feat/combat`, resolve conflicts, then run tests.
  3. `git merge feat/vehicles`, resolve conflicts, then run tests.
  4. Remove the worktrees.
- Lessons, appended in order: 7 `sequence`, 8 `combat`, 9 `vehicles`.

## Gotchas
- A project hook blocks Bash commands whose text contains "node_modules" or "dist", so prefer the Write/Edit tools.
- Commit only `app/` (the zip/dump and tooling are gitignored). The git identity is repo-local.
- Playwright smoke scripts live in the session scratchpad and may be lost. Some legacy tutorial browser checks flake on headless fps (verified against a baseline): L4 alternating E/F loop.
- The user prefers plain-text numbered questions and simple Vietnamese explanations.
