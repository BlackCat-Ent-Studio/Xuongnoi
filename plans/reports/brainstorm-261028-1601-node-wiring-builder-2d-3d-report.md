# Brainstorm — Node-wiring game builder (2D + 3D), step 1

- Date: 2026-10-28 16:01 (Asia/Saigon)
- Status: APPROVED by user ("1a, 2a")
- Flags: none
- Inputs: `HANDOFF.md`, `plans/reports/brainstorm-261027-1759-gbg-research-synthesis-report.md`

## Problem / goal
User (non-coder, Vietnamese) wants a wiring board: drag pre-made logic nodes, connect wires, press Play → a real game runs. No tutorials, characters, polish. Must support both 2D and 3D games, chosen per project. Claude writes all code; user playtests.

## Hard constraints
- Original product. NOT a clone of Game Builder Garage: no 1:1 node list, names, params, lessons, UI layout, assets, text from `D:\gbg\` (pirated-dump reference; declined repeatedly — do not revisit). Generic genre mechanics OK.
- Web: TypeScript + Vite, runs in browser via `npm run dev`. Code in `D:\workspace\GameBuilder\app\`.
- UI copy in Vietnamese.
- Git initialised (`main`); zip/dump/tooling ignored.

## Requirements (exact)
- **Output:** browser editor at http://localhost:5173 — left palette | center wiring canvas | right properties; top bar: Chơi / Sửa / Lưu / Mở / Góc nhìn; "Tạo game mới" dialog with 3 modes: 2D nhìn ngang, 2D nhìn từ trên, 3D.
- **Step-1 nodes (16):**
  - Input: Phím bấm, Cần điều khiển (2 axes −1..1), Khi bắt đầu
  - Logic: Và, Hoặc, Không
  - Number/time: Hằng số, Phép tính (+−×÷), So sánh, Bộ đếm, Hẹn giờ
  - Object: Nhân vật (move, jump, gravity), Khối (wall/floor/pickup), Cảm biến chạm
  - Output: Thắng/Thua, Hiện số
- **Acceptance:**
  1. `cd app; npm install; npm run dev` opens editor.
  2. From blank board user wires a side-view run/jump game: left/right, key → jump, touch star → +1, fall → lose.
  3. Top-down game: 4-dir move, touch item → +1, 5 → win.
  4. Same board plays correctly after switching view mode (2D side / 2D top / 3D).
  5. Wrong-type wire rejected at connect; clicking wire shows live value.
  6. Autosave survives browser restart; JSON export/import works.
  7. 3 bundled sample boards (side, top, 3D) play.
  8. Logic engine unit tests pass (`npm test`).
- **Out of scope step 1:** sound, tutorials, mobile/touch, online sharing, nice art (colored boxes only), random/spawn/rotate/camera/text/color nodes (→ step 2), undo/redo beyond basic, node cost cap.

## Approaches evaluated
| | A: 2D first, 3D later | B: one 3D world + mode lock (chosen) |
|---|---|---|
| Time to first play | fastest | slightly slower |
| Later 3D | rewrite renderer + collision | none — already there |
| Code dup | 2 physics/render paths eventually | 1 path |
| Risk | rework | 3D lib learning curve (low, Three.js mature) |

**Chosen B**: single 3D world (Three.js). 2D mode = lock one axis + fixed orthographic camera (side: lock Z, top: lock Y-plane movement). Joystick axes map by mode (2D side: X; top: X/Z on screen; 3D: camera-relative). Palette hides 3D-only nodes in 2D modes. Mode stored in save; boards reopen in other mode.

## Architecture (high level)
```
app/src/
  engine/   graph model, port types, tick evaluator (pure TS, no DOM) ← unit-tested
  nodes/    one file per node kind: ports + params + eval()
  world/    entities, simple AABB physics + gravity, mode axis-lock
  render/   Three.js scene, camera per mode
  editor/   palette, wiring canvas (SVG), properties panel, top bar
  io/       save/load JSON {format_version, mode, nodes, wires}, localStorage autosave
  samples/  3 sample boards (JSON)
```
- Eval: fixed 60 Hz; topological order each tick; cycles allowed only via back-edge reading previous-tick value.
- Port types: bool, number, (axis = number −1..1). Checked at connect time.
- Physics: own minimal AABB (box vs box, gravity, ground check) — no physics lib (YAGNI; boxes only).
- Deps: vite, typescript, three, vitest. Nothing else.

## Risks
- Wiring-canvas UX for non-coder → mitigate: big ports, color by type, snap, live value on wire; early playtest after core.
- Tunneling/jitter in hand-made physics at 60 Hz → fixed timestep, clamp velocity.
- Scope creep (user wants "many things later") → keep step-1 list frozen; collect feedback list for step 2.
- Node design drifting toward GBG copies → names/params designed fresh; review node list vs rule before merge.

## Success metrics
- User completes acceptance 2 and 3 alone without asking how.
- No console errors during 10-min play session.
- Engine tests green.

## Next steps
1. `/ck:plan` with this report → `plans/261028-1601-node-wiring-builder-2d-3d/`.
2. Implement phases; commit per phase (conventional commits).
3. User playtest → feedback → step 2 (≈35 nodes).

## Unresolved questions
- Product name (working: "Xưởng Nối").
- Sharing method (file vs online) — later.
- Art/persona style — later.
