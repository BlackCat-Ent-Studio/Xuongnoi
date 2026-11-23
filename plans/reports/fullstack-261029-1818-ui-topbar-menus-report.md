# UI top bar + menus report (branch feat/ui-topbar-menus, commit 811d2b0)

## Done
- Segmented control "2D ngang | 2D trên | 3D" in top bar after game name (`top-bar.ts`, css in `editor/menu/menu.css`). ARIA radiogroup, roving tabindex, arrows select+wrap. Disabled while playing, tooltip "Bấm Dừng để đổi góc nhìn". Syncs on board/mode/playing changes (load, open, sample). Uses existing `changeMode` (it had no confirm step). <=1180px short labels 2D↔ / 2D↓ / 3D with full aria-labels. Góc nhìn radios removed from Tệp.
- Menus restyled (mockup F): icon slot (tick replaces icon when checked), label, `kbd` shortcut chip, thin separators, rounded dark panel, active top button highlighted. Submenu flyout (samples) via hover / Enter / Right; Left/Esc closes flyout; Home/End/arrows; hover-switch between menus.
- Tệp: Tạo game mới, Mở game mẫu ▸ (14 samples), Mở file…, —, Lưu `Ctrl S`, Xuất ra file.
  - Lưu = flush autosave to browser storage (blocked in lessons); Xuất ra file = old download.
- Sửa: Hoàn tác/Làm lại (disabled by history), Thêm ghi chú (kept), Nhân đôi, Xóa, Sắp xếp gọn, Vừa màn hình. Structural items + arrange disabled while playing. Arrange/fit switch to the Bảng nối tab first.
- Xem kept (restyled, icons). Trợ giúp: Bài học (opens bottom dock Bài học), Phím tắt `?`. Glossary does not exist, skipped.
- New shortcuts in app.ts: Ctrl S, `?` (both ignored when typing in inputs; existing handler order). Help dialog rows updated.
- Icons added: folder, save, download, star, keyboard, note.
- Strings in `shell-text-vi.ts`.
- Layout tweaks in `style.css` so top bar fits 1 row: left grid column sizes to content below 1430px (centred above), pstate + brand name hidden <=1560, non-primary play labels hidden <=1500, <=1100: select max 104px, name input 90px, tutorial button icon-only (CSS clip, tutorial files untouched). Old `.mb-*` rules removed from style.css (menu.css owns them).
- Browser scripts (worktree copy, force-tracked): after clicking `[data-menu="file"]` they now hover "Mở game mẫu" before clicking a sample (10 files).

## Verification
- vitest 708/708, `tsc --noEmit` clean, `npm run build` OK.
- Playwright at 1440/1280/1024 (+1181/1100/1000 measured): top bar 40px high, no scroll overflow, no overlap of tutorial button / play cluster / seg; seg click, arrows, wrap, follows sample load, disabled + tooltip while playing, enabled after stop; Sắp xếp/Nhân đôi disabled while playing; undo enabled after arrange; submenu keyboard (Down, Right in, Left out, Esc), hover switch, Bài học tab, `?` dialog, Ctrl S toast; 0 console errors.
- Screenshots inspected for Tệp (with sample flyout) and Sửa menus at 1440 and top bar at 1024.

## Concerns / not verified
- Old scripts `check-editor-tools.mjs` (clicks a "Tạo mới" button that no longer exists, pre-existing) and `check-portal-camera-win.mjs` (win-overlay selector; game visibly wins) fail independent of this change. Not fixed.
- Menu-bar logic has no unit test (test env has no DOM); covered by browser check only.
- Tutorial lessons not re-run end to end; grep shows no lesson uses menu selectors.
- Hover-switch Xem menu and layout presets not re-clicked individually (only restyled).
- At 1440 the centred grid fits with ~10px slack; wider left content (longer game name uses shrink only) is safe, extra menus would break it.
- Dev server on 5182 stopped.
