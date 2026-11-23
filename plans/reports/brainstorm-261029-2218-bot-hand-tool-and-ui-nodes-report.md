# Brainstorm: bot holds tools in hand + interactive UI nodes

Date: 2026-10-29 22:18. Status: user approved (1a 2b 3a 4a). Next step: 2 parallel agents in worktrees.

## Scout facts
- `nodes/hand-tool.ts` ("Cầm tay") accepts any character. `world.equip` uses `liveCharacter`, which takes any kind 'character', bots included. So the engine probably already supports a bot with a tool in hand. This is not yet verified visually.
- The only UI nodes are output-only: Hiện chữ, Hiện số, Thắng/Thua. There is no pointer input into the runtime yet (`rt.tick({ keysDown })`).
- Lessons live in `tutorial/lessons*.ts` with text in `tutorial/text-vi.ts`. There are 15 lessons now.

## Decisions
| # | Decision |
|---|---|
| 1a | Verify in the browser that a bot shows the tool in its hand and can swing it. Fix the render or logic if needed. New lesson "16. Bot cầm cuốc": the bot walks to the pickaxe, takes it in hand, walks to the rock and breaks it |
| 2b | Add 5 UI nodes: Nút trên màn hình, Bấm vào vật, Thanh đo, Hộp hỏi, Màn hình bắt đầu/tạm dừng |
| 3a | New lesson "17. Rương bí mật": click the chest to open it, a countdown bar, a "Chơi lại" button |
| 4a | 2 parallel agents (A = bot, B = UI), merged by the controller |

## Ownership (to avoid conflicts)
- **A:**
  - may edit `world/*`, `render/*` (hand/robot visuals only), and `nodes/hand-tool.ts` if needed;
  - creates `tutorial/lesson-bot-tool.ts` and `tutorial/text-vi-bot-tool.ts`, plus its tests;
  - adds a single line in the LESSONS registry.
- **B:**
  - creates new `nodes/ui-*.ts` files, pointer input plumbing (`engine` input type, `render/game-view.ts` input), and HUD overlay rendering;
  - adds lines in `nodes/index.ts` and the palette category;
  - creates `tutorial/lesson-ui-chest.ts` and `tutorial/text-vi-ui.ts`, plus its tests;
  - adds a single line in the LESSONS registry.
- **Overlap:** both may touch `render/*`. A only touches character/hand visuals; B only touches the HUD/overlay and pointer input. The controller resolves the LESSONS registry line.

## Acceptance
- Headless tests:
  - a bot equips the pickaxe, uses it, and the rock gets "used";
  - each UI node outputs the expected signals from simulated pointer input;
  - both lessons pass a full step walk-through.
- Browser: a screenshot shows the bot with the tool in hand, and the UI nodes are visible and clickable in play.
- Old saves and old lessons are unchanged. The 3 gates are green.
