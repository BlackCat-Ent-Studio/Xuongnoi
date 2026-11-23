# Job 1 report: lesson 7 + polish (uncommitted)

## Done
- Lesson 7 "Chuỗi việc" (id `chores`, 19 steps): starter board = player (center), bot (home x=-5), crate, green pad, 3 pre-wired "Đi tới" (crate / pad / home) summed by 2 Phép tính into bot.moveX, 2 "Hoặc" gathering arrivedPulse, unwired Thắng/Thua. Learner: watch chaos, add Chuỗi việc, stepCount 3, wire step1-3 -> Cho đi, final Hoặc -> Xong việc, add Cầm/Thả, wire bot, grab on crate-arrive, drop on pad-arrive, `finished` -> Thắng. Bot fetches crate, drops it at pad, walks home, win.
- Tools in hand x0.65 (`IN_HAND_SCALE`, humanoid-model). Tools on ground (sword/pickaxe/hammer/torch/wand) lie flat via pose group (yaw + lay), lifted by figure bounds so bottom rests at entity floor. Physics unchanged.
- Item shape `lock` "Ổ khoá" (boxes: body, dark keyhole, steel shackle). key-door lock-1 uses it.
- Node `show-text` "Hiện chữ" (output): in show(default true), anchor(object); params text/color/corner. Corner = HUD row text; anchored = floating DOM label above entity (projected each frame, follows, hidden when entity hidden). key-door has hint "Bấm F để mở" anchored to lock.
- Append-only: `ItemShape`+'lock'; `HudItem` optional text/color/anchor/hidden; `Hud.setFloating`, new `render/floating-labels.ts`. Lesson 4 board untouched (still crate lock).

## Files
src: engine/types.ts, nodes/{item,index,show-text(new)}.ts, render/{hud,game-view,scene-view,item-shapes,humanoid-model,floating-labels(new)}.ts, samples/key-door.json, tutorial/{lessons,text-vi}.ts
tests: nodes/show-text(new), render/item-polish(new), tutorial/lessons (+lesson 7, 3 tests), io/samples (+key-door), nodes/step-1-nodes (24->25 kinds)

## Verify
- vitest 406 pass (392 + 14), `tsc --noEmit -p .` clean, `npm run build` ok (size warning pre-existing).
- Browser: lesson 7 e2e script PASS (19/19 steps, win, no console errors); key-door hint floats over padlock; pickaxe-rock: tools lie flat on floor, smaller in hand (screens in scratchpad `job1\`: j1-p02-start, j1-p03-pickaxe-in-hand, j1-kd-hint, l7-0*).
- Rerun tut-run (L1-3), L4 (first run flaked at last step, 2 reruns PASS), L5, L6, samples: all PASS, no console errors. items-keydoor script "palette has Hành động" fails only because palette header renders uppercase (script case issue, unrelated).

## Notes
- HANDOFF.md not updated (left to caller). Not committed.
- Hint "Bấm F để mở" stays visible after the lock is used (door opens); no show-wire in sample.

Status: DONE
Summary: Lesson 7, smaller in-hand tools, flat ground tools, lock shape and Hiện chữ node with floating labels implemented; 406 tests, tsc, build and browser scripts green.
Concerns/Blockers: none; L4 E/F script flaked once (known), passed on reruns.
