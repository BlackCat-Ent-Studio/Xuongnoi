# Bot holds a hand tool + lesson 16 "Bot cầm cuốc"

Branch: feat/bot-hand-tool (worktree D:\workspace\GameBuilder-bot-tool). Commit 918fc3a. Not merged.

## 1. Logic verification
- `hand-tool` node, `world.equip/unequip/useTool` already work for a bot (role 'bot', look 'robot'). No logic fix needed.
- New headless tests (2d-side, 2d-top, 3d): bot equips nearest tool, use hits rock (usedOn pulse), unequip; plus the Cầm tay node driving a bot.

## 2. Visual verification (real browser, port 5187, Playwright)
- 2D ngang and 3D: pickaxe lies on ground, bot picks it up, tool shows in robot's hand facing forward, swing animates, rock vanishes, "Thắng!" shown.
- Render needed no fix (no render files touched).
- Screenshots: D:\workspace\GameBuilder\plans\reports\shots-bot-tool\ (2d-side-*, 3d-*, zoom-*, sheet-*).
- Board for the browser run was generated from the solved lesson and loaded via autosave key (UI drag-wiring was unreliable because overlays cover ports). Dev server stopped.

## 3. Lesson 16 (id bot-pickaxe)
- Board: bot (robot) at x=-6, pickaxe (hand style) x=-2, rock (3 tall) x=3, floor. Prebuilt: 2 "Đi tới" (to pickaxe / to rock, rock stopDistance 1.5 because tall rock stops bot ~1.4 away), Phép tính (sum moveX), Hoặc (gathers both arrived pulses).
- Learner steps (17): intro, play, stop, add Chuỗi việc, step1, step2, Hoặc->next, add Cầm tay, bot->Cầm tay, arrived(pickaxe)->Cầm/Cất, arrived(rock)->Dùng, add Và, rock usedOn->A, pickaxe inHand->B, Và->rock hide, add Thắng/Thua, Và->Thắng, play, win, done.
- Note: Hộp cannot wire usedOn to its own hide (same-node rule), so Và (like lesson 5) sits in between; also gates break on "tool in hand".
- Files: app/src/tutorial/lesson-bot-tool.ts, app/src/tutorial/text-vi-bot-tool.ts (new); one import + one registry line in lessons.ts.

## 4. Tests
- New: app/tests/tutorial/lesson-bot-tool.test.ts (world-level bot tool tests x3 modes, full step walk-through, no-wiring never wins, full headless sim: bot takes pickaxe, swings, rock hidden, win).
- Updated count 15 -> 16 in app/tests/tutorial/lessons.test.ts.

## 5. Gates (app/)
- vitest: 55 files, 737 tests pass. tsc --noEmit: clean. npm run build: OK.

## Notes
- Intermediate hint: the Bot lesson win wires from the Và output (rock hit while pickaxe in hand).
- node_modules in the worktree is a directory junction to the main app's (untracked, ignored).

Status: DONE
Summary: Bot hand tool already worked in logic and render (2D ngang + 3D verified in browser); added lesson 16 "Bot cầm cuốc" with tests; all gates green; committed 918fc3a on feat/bot-hand-tool.
Concerns/Blockers: none. Possible merge conflict only on the LESSONS registry line and lessons.ts import with the UI agent's lesson.
