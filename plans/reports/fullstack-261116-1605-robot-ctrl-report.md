# Robot control + measurement: `pid` and `signal-plot` (branch feat/robot-ctrl, worktree D:\workspace\GameBuilder-rbctrl)

## PID Controller (`pid`, "Bộ điều khiển PID", EN "PID Controller", category math)
Pure module `app/src/nodes/pid-math.ts`, node `app/src/nodes/pid.ts`. dt = ctx.dt (1/60).

Formulas (per tick):
- e = target - measured
- P = Kp*e
- I = running sum of Ki*e*dt (gain applied while summing, so live-editing Ki does not jump I)
- D = Kd * filtered slope. slope = -(m - m_prev)/dt (derivative on measurement) or (e - e_prev)/dt. filtered += (1-s)*(slope - filtered), s = dFilter clamped 0..0.99. First sample after start/reset has slope 0.
- out = clamp(P+I+D, outMin, outMax); saturated = clamp cut the sum
- Anti-windup (yes): if saturated and error pushes further into the limit, I is not updated this tick; I also kept inside [outMin, outMax]; out recomputed. (no): I grows freely.
- Reversed limits swapped. Non-finite inputs read as 0.
- Disabled (enable false): out 0, saturated false, I held, memory follows signal (no D spike on re-enable). `error` still reported.
- reset rising edge: integral = 0, D memory cleared (before that tick's computation).

Ports
| in/out | id | type | label | note |
|---|---|---|---|---|
| in | measured | number | Giá trị đo | |
| in | target | number | Giá trị đặt | port default NaN = "unwired" -> param `target` |
| in | enable | bool | Bật | port default true: unwired = ON (computing a number is no world action) |
| in | reset | bool | Đặt lại | pulse |
| out | out | number | Điều khiển | |
| out | error | number | Sai lệch | |
| out | saturated | bool | Chạm giới hạn | |
| out (optional, param showParts=yes) | p / i / d | number | Phần tỉ lệ (P) / tích lũy (I) / dự đoán (D) | via optionalOutputs |

Params (defaults): kp 1, ki 0, kd 0, target 0, outMin -1, outMax 1; advanced: antiWindup yes, dFilter 0.2, dOnMeasurement yes, showParts no.

## Signal Plot (`signal-plot`, "Đồ thị tín hiệu", EN "Signal Plot / Scope", category output)
Pure ring/scale module `app/src/nodes/plot-buffer.ts`, node `signal-plot.ts`, HUD painter `app/src/render/hud-plot.ts` (canvas 2D, no CSS filters).
- Inputs a, b, c (number, port default NaN = unwired = trace not drawn), pause (bool). Bool wires NOT accepted: the port system rejects bool->number (type-mismatch). Numbers only.
- Hidden HUD item while no trace is wired, so the "no HUD without a wire" rule holds with no allow-list change.
- Params: title "Tín hiệu", windowSeconds 10 (1..60), autoScale yes, min -10, max 10, labelA/B/C ("Tín hiệu 1/2/3"), colorA #5aa9ff, colorB #f7d046, colorC #f27ad0 (the wire type palette: number blue, bool yellow, object pink), legend yes, corner top-right; advanced width 260, height 150 (px).
- Cheapness: ring per trace, <=300 points (window sampled every floor(window*60/300) ticks, 1 for <=5 s); widget snapshot rebuilt at most every 3rd tick and only when a sample was added; HUD repaint keyed on `rev` only (no hashing of samples); changing the window restarts history.
- Engine type change: `HudWidget` gains `{type:'plot', title,width,height,min,max,legend,points,traces,rev}` and `PlotTrace` (types.ts). `CornerWidgets.sync` (hud-widgets.ts) handles `plot` with a rev-based signature.
- Position: corner + size (ui-meter has only a corner; no free x/y was built).

## Other changes
- node-names.ts: VI+EN for both kinds and all ports (incl. optional p/i/d). nodes/index.ts: 57 -> 59 kinds.
- Handbook: `content-robot-ctrl.ts` (2 pages, every port + param), `boards-robot-ctrl.ts` (try boards), wired in handbook/index.ts. `build/Spec/Wire` exported from boards-math-object-output.ts (3 `export` keywords, no other change).
- Try board "Thử: Bộ điều khiển PID" (and "Thử: Đồ thị tín hiệu", Kp 3, fixed scale): on-start -> timer(8 s, repeat) -> map-range (steep at 4 s = square target -5/+5 every 4 s) -> PID target; character (robot look, speed 4) x -> PID measured; PID out -> character moveX; signal-plot a=target b=x c=out. Only general pieces + the two new ones.
- Lesson `pid-control` "Giữ đúng mục tiêu với PID": `lesson-pid-control.ts`, new `course-pack-h.ts`, registered in lessons.ts, new chapter `robots` ("Rô-bốt") in course.ts. Steps: intro, add PID, wire in (2 wires), wire out, add plot, wire plot (3), play, done.
- Tests: count 57->59 (step-1-nodes, no-action-without-wire); solid-off-baseline.json +3 entries (lesson:pid-control, handbook:pid, handbook:signal-plot, no existing entry changed); solid-on-summary.snap.json +57 lines (additive, no removed line).

## Tests added
- tests/nodes/pid.test.ts (16): P-only step response (steady-state 0.8 for Kp 4 on a unit plant), I removes steady-state error (P leaves >0.3, PI <0.01), clamp + saturated, reversed limits, anti-windup on/off (integral bound, smaller overshoot), reset, derivative on measurement (no kick) vs error (kick), D filter, disabled hold, non-finite input, determinism, node: unwired target -> param, wired 0 overrides param, optional p/i/d ports, reset pulse, runtime defaults (unwired Bật = on).
- tests/nodes/signal-plot.test.ts (13): ring order/wrap, NaN -> 0, sampling vs window, range/auto/fixed/repair, fraction, hidden when unwired, only wired traces with colours/labels, <=1 rebuild per 3 ticks, window cap, pause freeze, fixed scale, runtime hidden item.
- tests/handbook/content-robot-ctrl.test.ts: pages cover all ports incl. optional + all params, lesson exists, try board round-trips and in 12 s headless robot reaches > 4 and < -4 after each target flip and plot HUD has 3 traces.
- tests/tutorial/lesson-pid-control.test.ts: registered/chapter/unique ids, start board lacks taught kinds, scripted solve step by step, finished board robot reaches target.

## Verification
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 180000`: 170/171 files, 2793/2794 tests passed (machine heavily loaded by sibling runs, 1125 s). The one failure was tests/puzzle/level-7-decoy.test.ts hitting a 900 s timeout (an exhaustive search that does not use the node registry); rerun alone it passes (3/3, 597 s under load). Commit c75c085.
- Playwright on :5253 (script plans/browser-scripts/robot-ctrl-check.mjs, chromium-1248 executablePath because the playwright package in the old scratchpad is gone): handbook PID page, try board, PID properties panel (Kp/Ki/Kd/target/min/max + advanced folded open), play: plot with 3 traces in "Xem game" window and in the full "Màn chơi" view with legend. Shots in plans/reports/shots-robot-ctrl/ (01 handbook, 02 try board, 03 properties, 04 playing PiP, 05 full view). Only console error: favicon 404 (dev server, not from this work).

## NOT verified / caveats
- Not tried on a phone or touch; plot size is fixed px (260x150), not scaled with the stage.
- In the small "Xem game" window the legend row under the plot is clipped by the window (full view shows it).
- Character has no inertia (speed follows moveX at once), so on this plant P alone already reaches the target and Ki/Kd effects are only visible on machines with lag (future motor/arm pieces). Ki/Kd math verified in unit tests, not in the try board.
- Plot x axis: fills from the left, then scrolls once the window is full; sample spacing for windows > 5 s is 2+ ticks.
- unwired `target` uses NaN as the "no wire" sentinel via PortDef.default; fine because a wired value is never NaN, but if siblings change the runtime default handling this must be rechecked.
- Merge hotspots: nodes/index.ts, node-names.ts, handbook/index.ts, lessons.ts, course.ts, the two count tests, solid-off-baseline.json, solid-on-summary.snap.json (re-run `-u` after merge, check diff is additive).
