# Lesson 10 "Bot lái xe"

## Verification
- `npx vitest run`: 513 passed (511 + 2 new), `npx tsc --noEmit -p .` clean, `npm run build` ok. Not committed.
- Test `tests/tutorial/lesson-bot-driver.test.ts`: drives every step via editor-state ops (step id asserted after each action), then plays the learner's board in the engine: bot boards at ~1.0 s, win at ~3.9 s (bound 40 s).
- Browser (port 5173, real drags/wires, script `scratchpad\job3\lesson10.mjs`): all 23 steps advance in order, bot walks to car, drives through bend, win in ~6.8 s headless, no console errors. Shots in `scratchpad\lesson10\` (`l10-3-walking`, `l10-4-drive-4`, `l10-5-win`, plus start/idle/wired).

## Files
- New: `app/src/tutorial/lessons-bot-driver.ts`, `app/tests/tutorial/lesson-bot-driver.test.ts`.
- Edited: `app/src/tutorial/lessons.ts` (import + `lessonBotDriver` + LESSONS entry), `tests/tutorial/lessons.test.ts` (mode check allows 2d-top for this lesson), `tests/tutorial/lesson-vehicles.test.ts` ("last lesson" assert became `toContain`).

## Design
- Id `bot-driver`, "10. Bot lái xe", mode 2d-top. Starter: bot (robot), blue car (steer "Theo hướng"), yellow pickup flag, 5 solid wall blocks forming an L road (west-east then north). No wires.
- 23 steps (more than ~15 because each wire pair is its own checked step): intro, watch/back, add Chuỗi việc, add Đi tới, wire bot+car, wire moveX/Y to bot, set "Dừng cách đích" to 1.5, step1 -> Cho đi, add Lên/Xuống xe, bot -> Ai, Vừa tới -> Bấm AND Xong việc, add Đi tới #2, car+flag wiring, step2 -> Cho đi, moveX/Y -> car, add touch, wire car/flag, add Thắng/Thua, touching -> Thắng, play, win, done.
- Checks tolerant: nodes resolved by kind/role; walker go-to = the one fed by bot (else first), driver go-to = fed by car (else the other). Multi-wire steps hint the first missing wire.
- No Hoặc needed: only go-to #1 arrival advances the sequence.

## Deviations
- No player spectator: the camera follows the player else the bot; with no player it follows the bot/seated car, so the whole trip stays in view (a stationary spectator would let the car leave the follow view).
- Extra step "Dừng cách đích" = 1.5: the car is solid, so the bot can never get within the 0.5 default of its center (needs the learner to raise it).
- Port naming: flag's self port is labelled "Khối", texts say so.

Status: DONE_WITH_CONCERNS
Summary: Lesson 10 added (self-contained file, one import + LESSONS entry); 513 tests, tsc, build green and a full browser run wins with no console errors.
Concerns/Blockers: 23 steps vs ~15 planned; no spectator player (camera follows bot/car instead); added a "Dừng cách đích" step because the solid car blocks the default stop distance.
