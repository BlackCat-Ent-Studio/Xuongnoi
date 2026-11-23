# UI redesign preview: Xưởng Nối editor + Xưởng Bot (2026-11-18)

Preview only. Nothing under `app/` was changed.

- Open: `plans/previews/ui-redesign-261118/index.html` (one self-contained file, 465 KB, no network).
- Source: `index.src.html`; `tools/build-preview.mjs` inlines the real "before" screenshot. Edit the source, then rebuild.
- Screenshots: `plans/previews/ui-redesign-261118/shots/` (53 files) + `shots/metrics.json`.
- Control strip in the preview: Hướng A/B/C, Giao diện Sáng/Tối, Chế độ Học sinh/Giáo viên, Dòng điện Bật/Tắt, So sánh (real screenshot).

## 1. Audit of today's editor

Ratios computed with `tools/palette-search.mjs` from the hex values in `app/src/style.css`.

| # | Finding | Where | Why it hurts | Sev |
|---|---|---|---|---|
| 1 | Secondary text 10.5–11.5 px, base 13 px | `style.css:42`; `panels.css` `.pn-meta` 11.5, `.pn-en` 11, `.pn-item-text small` 11.5; `graph.css` `.wc-need` 10.5, `.wc-badge` 11 | Unreadable from the back of a class on a projector; hard for 8–10 year olds | High |
| 2 | Touch targets 22–28 px | port rows 26 px with 12 px dot (`node-cards.css:43,48`); `.pbtn`/`.icobtn` 28 (`style.css:72,84`); stepper 26 (`panels.css:91`); switch 38×22 | Tablet/phone use is planned; all are below 44 px | High |
| 3 | No persistent "what next" | Hướng dẫn in top bar, Bài học is a hidden tab of the bottom dock, Việc cần sửa inside the dock, "?" per card | A pupil cannot see the lesson step and the board together | High |
| 4 | World settings only exist in the empty state | `properties-panel.ts:340–361`; screenshot `shots-w2-main/sense-finish/half-6000ms.png` | Select any card and Va chạm thật / Vật lý thật / Trọng lực vanish; teacher cannot find them | Medium |
| 5 | Right panel is a shortcut list when nothing is selected | same screenshot: 280 px column, half of it is Delete / Ctrl+D rows | Wasted space; keyboard hints are useless on tablets | Medium |
| 6 | Floating simulation covers cards and wires | `shots-w2-traction/3d-on-2500ms.png`: "Xem mô phỏng" sits on the lower-right cards | Hides the thing being wired; pupils drag it around instead of building | Medium |
| 7 | Bottom-left cluster (coach tip + zoom + minimap + legend) | same screenshot, about 240×210 px | Covers the board corner where new cards land | Low |
| 8 | Bottom dock default 244 px for one line of content | `layout-model.ts` `DEFAULT_SIZES.bottomH`; screenshot shows "Không có gì cần sửa." + 1 log line | 27% of a 900 px screen spent on an empty area | Medium |
| 9 | Top bar loses labels at laptop widths; emoji used as icons | `style.css:95` hides pause/step/stop text at ≤1500 px; `shell-text-vi.ts` "🐢 Từng bước", `text-vi.ts` "⛶ Phóng to", "↩️" | Icon-only Tạm dừng / Dừng on 1366 and 1440 laptops; emoji render differently per device | Medium |
| 10 | Non-text contrast fails | input border #3a404a on #121418 = 1.77; switch off-track 1.24; panel line 1.26; disabled text 3.21 (text itself passes: 13.57 / 7.71 / 5.66) | Field and switch edges disappear on a washed-out projector | Medium |
| 11 | Category colours collide for colour-blind users | deuteranopia min ΔE 4.7 (Hành động / Bộ não), protanopia 6.6 (Đầu vào / Kết quả); 7 full-colour header bands + 3 port colours + green accent | About 1 boy in 12 cannot tell groups apart; the screen is noisy while building | Medium |
| 12 | Parameter labels are one long string | `motor.ts:59` Lực phanh label is 77 characters; wraps 3–4 lines in a 280 px panel | Label, unit and explanation are not separated; hard to scan | Medium |

Also noted: EN sub-name is 12 px weight 700 at 90% ink (`node-cards.css:35`), nearly as loud as the Vietnamese name. Kept per owner, made lighter (weight 500) in all directions.

## 2. Decisions applied (from the owner, relayed mid-task)

- Education fit is a requirement for all directions.
- Two density modes, "Học sinh" and "Giáo viên". Switch: top bar right, also menu Xem; remembered per device.
- Light and dark exist in every direction. Switch: sun/moon button in the top bar, also menu Xem; first run follows the device.
- Scope includes Xưởng Bot: one level screen + level list per direction.
- English sub-names stay, under the Vietnamese name, in both modes.

### Học sinh vs Giáo viên (exact differences in the mock)

| | Học sinh | Giáo viên |
|---|---|---|
| Body / smallest text | 15 / 13 px | 13 / 12 px |
| Card name / EN sub-name | 15 px bold / 13 px | 13 px bold / 12 px |
| Port row / card header / buttons | 34 / 50 / 36 px | 24 / 34 / 28 px |
| Palette | two lines per piece (name + description), 48 px rows; in C only the icon rail | one line, 30 px rows; in C the list is open |
| "Cổng nâng cao" on a card | folded, only wired ports shown | all shown |
| Properties "Nâng cao" | one folded line | open (mock shows 1–2 of the 3 items) |
| "Cài đặt mô phỏng" | one summary line | open, with explanations |
| Bảng tin | strip with "Việc cần sửa" only (B adds live read-outs) | log open with filters |
| "Bố cục" button, minimap | hidden (still in menu Xem) | shown |

Tablet and phone frames use 44 px rows and buttons in both modes.

## 3. The three directions

All three share: the port colours and shapes (yellow circle Đúng/Sai, blue diamond Số, pink square Vật thể), the wire current (glow + moving dashes + spark, on/off), value chips on wires, a lesson strip above the board, an always-visible "Việc cần sửa" count, "Từng bước" next to Chạy, a formula box fed by the selected card, re-tuned category colours.

| | A "Gọn gàng" | B "Bàn kỹ thuật" | C "Sân khấu mô phỏng" |
|---|---|---|---|
| Layout | today's three columns, tidied | three columns; simulation fixed in the bottom tray | icon rail, board, fixed right column (simulation, formula, properties), status strip |
| Card | tinted header in group colour, 10 px corners | square card, 4 px group stripe, neutral header | full group-colour header, 12 px corners |
| Simulation | small pinned window on the board | bottom tray, next to Việc cần sửa | always docked top right; "Chạy thử" enlarges it |
| Projector | good in light | good in light; calmest screen | good in light; best for demonstrating (run + numbers + formula together) |
| Eye strain | medium | lowest (fewest colours) | medium; right column is dense |
| Age 8–11 | good | may feel dry | best (large coloured headers, rail with icon + text) |
| Age 12–15 / teacher | good | best | good |
| Tablet | rail + sheet, pinned simulation overlaps board | same as A | best: rail and stage carry over unchanged |
| Effort | lowest | low to medium | highest |

### Fit for classroom (measured from the mock, `shots/metrics.json`)

| Direction | Smallest text (1440 Học sinh / Giáo viên; tablet) | Text contrast, light (main / secondary / faintest) | Dark | Smallest hit area (desktop Học sinh / Giáo viên; tablet; phone) |
|---|---|---|---|---|
| A | 13 / 12 px; 13 px | 16.5 / 8.2 / 5.7 | 14.3 / 8.4 / 6.0 | 28 / 24 px; 44; 44 |
| B | 13 / 12 px; 13 px | 16.5 / 8.2 / 5.7 | 14.2 / 8.2 / 6.1 | 28 / 24 px; 44; 44 |
| C | 13 / 12 px; 13 px | 15.8 / 7.8 / 5.6 (header text lowest 4.51) | 14.1 / 8.4 / 5.9 | 28 / 24 px; 44; 44 |

Colour-blind check (Machado 2009 simulation, CIE76 ΔE, smallest pair): group colours light 23.2 normal / 14.0 deuteranopia / 15.0 protanopia; dark 32.7 / 23.2 / 26.8 (today 4.7 and 6.6). Port colours: light 70.2 / 56.6 / 28.3; dark 60.6 / 34.9 / 14.4 (dark keeps today's exact port colours). Second cue everywhere: group icon + name, port shape, Bật/Tắt text on switches, dashed border + text on errors.

### Effort to port

- Shared by all three (mostly CSS): tokens in `app/src/style.css :root`; `editor/graph/node-cards.css`, `graph.css`, `panels/panels.css`, `handbook/handbook-dialog.css`. Light theme needs the hard-coded dark hexes removed first (`node-cards.css` `#222832`, `#10151b`; `graph.css` `#0f1114`, `#0d1014`; status colours in `style.css`; `LOGO_SVG` in `top-bar.ts`). `wire-energy.css`: add a darker casing stroke so the yellow wire reads on light.
- Shared, small code: mode and theme switches (`top-bar.ts`, `menu-bar.ts`), lesson strip, label split into name + unit line (`properties-panel.ts`), world settings always present, SVG icons instead of emoji (`shell-text-vi.ts`, `text-vi.ts`).
- New behaviour: "Cổng nâng cao" fold on the card (`node-view.ts`). Today these ports are switched from properties.
- B adds: simulation mounted in the bottom dock (`layout-model.ts` presets, dock shell, `console-dock.ts`).
- C adds: new work grid (`style.css .work/.mid`), `layout-model.ts` (presets and sizes), `palette.ts` as a rail with a drawer, `console-dock.ts` reduced to a strip, "Lắp ráp / Chạy thử" switch.
- Xưởng Bot: `puzzle/ui/shell.css`, `puzzle.css`, `themes/theme-a|b|c.css`, `guide.css`. The mock replaces the wooden frame; see question 2.

## 4. Recommendation

**C**, built in two steps. Step 1 is the shared work (tokens, cards, two modes, light/dark, lesson strip, formula box): it is needed by any direction and is low risk. Step 2 is C's layout. Reason: C is the only one that removes the floating simulation and keeps run, read-outs and formula in view while wiring, which is the classroom use case. If step 2 has to wait, the result of step 1 is direction A.

## 5. Mock vs real

- Real, copied from the app: menus, tab names, run controls, piece names with English sub-names, port names and types, Động cơ parameter labels, "Cài đặt mô phỏng" labels, Bảng tin strings, palette counts for Đầu vào (7) and Logic (18), "71 mảnh ghép, 7 nhóm", puzzle level names and view types, puzzle level 1 pieces and ports, group icons (paths from `node-view.ts`), the "before" screenshot.
- Mock: simulation and puzzle scenes (drawn placeholder, labelled), lesson strip sentence and step count, puzzle brief and guide sentences, level progress and stars, all live numbers, formula numbers (formula is the handbook's; the values are an illustration), group card name, "Cổng nâng cao" fold, mode and theme switches, "Số đo đang chạy" in B, "Việc cần làm" list in C's puzzle screen. The mascot is an empty placeholder: the real art is to be kept.
- The board name shows the app default "Mô phỏng của tôi". The run button reads "Chạy lại" because the mock is in the running state.

## 6. Not done / limits

- The wire animation was checked as still frames only (dashes and sparks present); I did not record it in motion.
- Card outline against the board is 1.8–2.1:1 in every palette (below 3:1). Cards still separate by fill and shadow; darken `cardLine` if a hard 3:1 is wanted.
- Giáo viên mode on desktop has 24 px controls: mouse only. Tablet and phone always use 44 px, but at board zoom below 100% port rows shrink with the zoom (tablet mock is at 76%).
- C light: Đầu vào header text is 4.51:1, just over the 4.5 limit.
- Phone frame shows a cropped, panned board; no phone layout for the puzzle.
- The compact top bar (tablet, phone) has no room for the mode switch; it would live in the menu there.
- The reference kit on E: was not read (the Glob hook blocked listing it) and the `ui-ux-pro-max` search scripts were not run.
- Report saved under `plans/reports/` as the task asked, not under `app/plans/reports/`.

## 7. Open questions for the owner

1. Which direction? a) A; b) B; **c) C in two steps (recommended)**; d) mix: say which card style with which layout.
2. Xưởng Bot look? **a) same style as the chosen direction, keep the mascot art (recommended)**; b) keep today's wooden look untouched; c) both, as selectable themes.
3. "Cổng nâng cao" folded on the card itself? **a) yes (recommended)**; b) no, keep it only in Thuộc tính.
4. Mode on first open? **a) Học sinh (recommended)**; b) Giáo viên; c) ask once.
5. Hành động is dark red and can read as "error" on a full header (C). **a) shift it to orange-red and re-check colour-blind distances (recommended)**; b) keep.
6. Bottom strip in C: Bảng tin opens as a) a panel sliding up over the board (recommended); b) a resizable dock like today.
