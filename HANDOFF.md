# HANDOFF — GameBuilder — 2026-10-28 15:50

## Goal
Build an ORIGINAL node-wiring game builder (players drag pre-made nodes, connect wires, and get playable games — no code typing), using Game Builder Garage (GBG) only as a design-study reference. Claude writes all code; user (non-coder, Vietnamese-speaking) plays and gives feedback. First deliverable: a small playable web prototype ("v0") so the user can try the concept before bigger decisions.

## Status
- ✅ Done:
  - Unzipped `game-builder-garage-full-extract.zip` (4.7 GB) to `D:\gbg\` (short path needed: Windows 260-char limit). 33,752/33,752 files OK.
  - 4 research agents ran; reports in `plans/reports/`:
    - `researcher-261027-gbg-logic-nodon.md` (node signal/eval model, 90 node types, graph format)
    - `researcher-261027-gbg-graphics.md` (art style, assets pipeline)
    - `researcher-261027-gbg-content-ux-audio.md` (7 lessons/59 steps, checkpoints, UX, audio, l10n)
    - `researcher-261027-gbg-engine-architecture.md` (sead/Havok stack, .blgc format, cost cap 2000)
  - Synthesis: `plans/reports/brainstorm-261027-1759-gbg-research-synthesis-report.md`
  - v0 prototype design presented to user (see Key decisions + Next steps).
- 🔄 In progress:
  - Waiting for user "ok" on the v0 design (last message of 2026-10-28 session). User asked for this handoff before answering.
- ⬜ Not started:
  - Brainstorm report for v0 design, `/ck:plan`, implementation in `D:\workspace\GameBuilder\app\`.

## Key decisions (and why)
- NO clone / port / emulation of GBG (incl. "high % similar", local-only, or web port) — dump comes from pirated NSP (Ziperto); Nintendo IP. Repeatedly declined; do not revisit. Dump at `D:\gbg\` = read-only reference, nothing from it ships (no assets, text, code, node list, lessons, characters).
- OK to use generic genre mechanics: node wiring, input→logic→output layers, objects-as-nodes, timers/counters/AND/NOT/compare, edit-time caps, versioned save.
- Claude writes all code; user only tests — user explicitly said "bạn làm thay tôi vẫn được".
- Web stack (TypeScript + Vite, Canvas/SVG) — runs via browser link, no install for player; Node v24.15.0 / npm 11.12.1 present.
- v0 = 2D side view; logic core decoupled from renderer so 3D can be added later — user wants both 2D and 3D eventually; 2D first = fastest playable.
- Eval model: fixed 60 Hz tick, topological order, back-edge reads previous tick (avoid GBG's push-recursion); typed ports checked at connect time; JSON save with `format_version`.
- Audience: both beginners and hobbyists ("low floor, high ceiling"). Sharing: undecided → v0 uses local JSON export/import + localStorage autosave.

## Next steps (in order)
1. Get user approval ("ok" or edits) on v0 design below.
   - Working name "Xưởng Nối". Screen: left node palette | center wiring canvas | right properties; buttons Chơi / Sửa / Lưu / Mở.
   - 12 original nodes: Phím, Mũi tên (axis -1..1), Và, Không, Hẹn giờ, Bộ đếm, So sánh, Nhân vật, Khối, Sao, Cảm biến chạm, Thắng/Thua, Hiện số.
   - Sample game "Hái sao": collect 5 stars within 30s; fall = lose.
   - Out of scope v0: 3D, sound, tutorials, online share, mobile/touch, node personas.
   - Acceptance: `npm run dev` → editor at http://localhost:5173; sample game plays win/lose correctly; user can wire a run/jump game from blank; save survives browser restart.
2. Write brainstorm report for approved design — `plans/reports/brainstorm-<date>-v0-node-builder-prototype-report.md`.
3. Run `/ck:plan` with that report → `plans/<date>-v0-node-builder-prototype/`.
4. Implement in `D:\workspace\GameBuilder\app\` (Vite + TS); verify acceptance criteria; user playtests.

## Open questions / blockers
- Awaiting user "ok" on v0 design.
- Later: 3D timing, sharing method (file vs online), node art/persona style (possibly Vietnamese flavor), Vietnamese UI copy (pronoun pair for any host character).
- Workspace is not a git repo (no commits possible until `git init`, if user wants).

## Resume info
- Important files: `HANDOFF.md`, `plans/reports/brainstorm-261027-1759-gbg-research-synthesis-report.md`, `plans/reports/researcher-261027-gbg-*.md`, `.claude/rules/*.md`
- Reference dump (read-only, do not ship): `D:\gbg\game-builder-garage\` (REPORT.md inside); original zip `D:\workspace\GameBuilder\game-builder-garage-full-extract.zip`
- Commands to run: (after app exists) `cd app; npm install; npm run dev`
- Environment notes: Windows 11, PowerShell 5.1 primary; user communicates in Vietnamese and is not a programmer — explain plainly, avoid jargon; user sometimes rejects AskUserQuestion popups — plain-text numbered questions work better.
