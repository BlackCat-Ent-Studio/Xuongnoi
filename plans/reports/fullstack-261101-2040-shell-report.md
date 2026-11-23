# Game shell (style A) — report

Branch `feat/shell` (worktree `D:\workspace\GameBuilder-shell`), commit `852eda2`. Screenshots: `plans/reports/shots-shell/` (desk = 1280x720, phone = 844x390). Scripts: `plans/browser-scripts/shell-check.mjs`, `shell-card-diff.mjs`.

## What was built

| # | Item | Result |
|---|------|--------|
| 1 | Style A permanent | `themes/theme.ts` (A always; `initTheme`, `buildBackdrop`). Floating A·B·C switcher, `theme-trial.*`, `backdrops.ts` deleted. B and C kept in `themes/` ("kho") and only loaded by `themes/theme-extra.ts` through a lazy import behind `import.meta.env.DEV` + `?theme=b|c`. Checked: the production build contains no B/C code. No "TEMPORARY" or "trial" text left in src. |
| 2 | Routes | `routes.ts` (pure): `#/` title, `#/map`, `#/level/<id>`, `#/end`. Back: level -> map, end -> map, map -> title. Reload on `#/level/<id>` opens the level (checked in Playwright, both sizes). Locked level or unfinished game on `#/end` -> `#/map`. |
| 3 | Title | `title-screen.ts` + `character-stage.ts`: small three.js ortho view, Mèo Mun (cat-chibi), robot-wheel, robot-legs on a bench, using the engine's own `styleFor(...).build(PartKit)`; idle bob, head sway, ear flick, robots raise arms about every 5.5 s. `GAME_NAME = 'Xưởng Bot'` in `puzzle-text.ts`. Buttons "Chơi" and "Cài đặt". |
| 4 | Map | `map-screen.ts` + `map-state.ts` (pure): wooden path, 8 nodes (number, title, 3 stars, padlock, pulsing "next", 2D/3D tag), star total. Fixed 844:390 scene scaled by `cqw`, so it fits both sizes with no scroll. `list-screen.ts` deleted. |
| 5 | Settings | `settings-panel.ts`: modal, Nhạc / Tiếng động switches (`getSettings`/`setSettings`), "Xoá tiến độ" with in-page confirm (no `confirm`/`alert`), link "Mở Xưởng Nối" (index.html). Opens from title, map and the level HUD gear. Esc closes, Tab stays inside. Reset also clears the guide-seen memory (tutorial runs again). |
| 6 | Transitions | `transitions.ts`: old screen fades/slides out (150 ms), new one in (320 ms); opacity + transform only; `prefers-reduced-motion` = instant, no animations. |
| 7 | Win | `win-card.ts` + `confetti.ts` (2D canvas, 90 pieces, two cannons, removes itself); stars pop one by one; buttons "Màn tiếp" / "Chơi lại" / "Bản đồ". After the last level "Màn tiếp" -> `#/end` (`ending-screen.ts`: cheering characters, confetti, total stars, "Về bản đồ"). Unlock animation on the map when a level opened since the map was last shown (lock pops open + ring), checked after a real win. |
| 8 | Sound hooks | `unlockAudio` on first pointerdown/keydown; `startMusic('menu')` title/map/end, `'level'` in a level; `tap` (delegated on all buttons except chip, hint, ×, run), `pick`/`wire`/`unwire` in board-view, `run`/`stop`, `win`/`lose` (incl. timeout), `star` per star, `unlock`, `page`. No `hint` call. `sound.ts` untouched. |

## Level screen changes (level-screen.ts)
Back -> map; gear in HUD; backdrop call; sfx; `showWin` now calls `showWinCard`. `hintBtn` click handler, `replayBtn`, `forcedGuide` logic untouched. `LevelScreenContext` gained `openSettings(host)`.
Side effect: the HUD badge is a little narrower (font 1.75cqw, tooltip shows the full text); long titles truncate sooner.

## Verification
- `npx tsc --noEmit -p .`: clean.
- `npx vitest run tests/puzzle --testTimeout 120000`: 10 files, 205 tests pass (new `tests/puzzle/shell-routes-map.test.ts`: 11 tests for route parse/round-trip/back, stop states, unlock detection, star totals, map layout).
- `npm run build`: OK.
- Playwright desk + phone: title (+wave), settings, confirm, map fresh / 3 done / all done, end, level, level settings, real win of level 1 (confetti, stars), unlock animation on return to map, back chain. Console: no errors or warnings. I read the screenshots and fixed: a stops layer that blocked the map back/gear buttons, bubble overlapping Play on the phone, settings dialog too tall on the phone (footer buttons now in one row), empty win stars invisible.
- Node card pixel check (level 1 "Cảm biến chạm", main vs branch): 0 differing pixels inside the card; 6 pixels on its left/right edge columns differ where an animated wire crosses (wire energy timing). Characters/cards/wires code untouched.
- Line endings: all touched files were LF and still are. `git diff <merge-base> --stat` and `-w`: same 29 files; only `puzzle-main.ts` differs by 13 lines (re-indented code, no CR).
- Dev server :5201 and a comparison server :5202 are stopped.

## Not verified / notes
- Real sound (stub), real phone touch, real GPU FPS (only SwiftShader).
- Last-level win -> `#/end` and the unlock of levels 3-8 were not played end to end (level 8 not solved in the browser); the end screen itself was shot via the URL with all stars. Logic: `ctx.next === null` -> `#/end`.
- Settings "Xoá tiến độ" was shown (confirm) but the actual wipe + map refresh was not clicked in Playwright.
- theme-b.css / theme-c.css still carry dead rules for the removed level list (left alone, they are "kho"). Unused text keys (`listTitle`, `listLede`, ...) left in `puzzle-text.ts` on purpose.
- The `?fixture` and `?theme=b|c` dev switches only work on the dev server.
- Branch not merged; main moved on (sound module landed there), expect a trivial merge in `level-screen.ts` if the hint agent also edits it.

Status: DONE_WITH_CONCERNS
Summary: Full shell (title, map, settings, ending, transitions, win effects, sound hooks) is committed on feat/shell; tsc, 205 puzzle tests and build pass, and desk/phone screenshots were read and fixed.
Concerns/Blockers: last-level to ending, settings wipe and real sound/touch were not exercised in a browser; HUD badge now truncates a bit earlier because of the gear.
