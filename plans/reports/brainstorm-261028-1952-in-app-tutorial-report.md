# Brainstorm — In-app tutorial (Hướng dẫn)

- Date: 2026-10-28 19:52 · Status: APPROVED ("1a, 2b") · Flags: none

## Problem
User (non-coder) opened editor, didn't know where to start / which nodes do what. Needs guided in-app tutorial, not external doc.

## Decision
Interactive step-by-step lessons inside editor (option A). No per-node "?" button (user declined).

## Requirements
- Top bar button "📘 Hướng dẫn" → lesson list (3 lessons, show done ✓).
- Lesson runs on its own fresh board (2D nhìn ngang); current board stashed and restored on exit/finish.
- Step panel (corner, non-blocking): instruction text + 1–2 sentence explanation of the node introduced; ◀ Quay lại, ✕ Thoát; progress "Bước 3/9".
- Target highlight: pulsing outline on palette item / port / button.
- Auto-advance: each step has `check(editorState)` (node kind exists, wire kind.port→kind.port exists, param value, is playing, game ended win…). No "Tiếp" needed (except pure-info steps).
- First launch (no tutorial-seen flag): small inline invite "Bạn muốn học cách làm game không?" Có / Không.
- Progress persisted in localStorage.
- Original lesson content:
  1. Đi và nhảy — Khối (sàn, size x=20), Nhân vật, Chơi, Cần điều khiển x→Đi ngang, Phím bấm Đang giữ→Nhảy.
  2. Nhặt sao, tính điểm — Khối loại Vật nhặt, Cảm biến chạm (nhân vật+sao), chạm→Ẩn đi, Bộ đếm, Hiện số.
  3. Thắng và thua — Bộ đếm Đạt mục tiêu→Thắng; So sánh(Vị trí Y < Hằng số −5)→Thua.
- No alert/confirm/prompt dialogs.

## Out of scope
Lessons for 2D-top/3D, voice, host character, per-node help button.

## Touchpoints
`app/src/editor/*` (top-bar, app, editor-state subscribe), new `app/src/tutorial/*`, `app/src/style.css`, tests `app/tests/tutorial/*`.

## Acceptance
- Each lesson completable start→finish in browser by doing the steps; checks advance correctly; Thoát restores previous board.
- Lesson checks unit-tested against graph states.
- All existing tests pass; tsc clean; build ok.

## Unresolved
None.
