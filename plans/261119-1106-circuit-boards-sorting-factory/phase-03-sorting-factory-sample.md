# Phase 3 — Sample "Xưởng phân loại kiện hàng" + lessons

## Circuits
Xe AGV ×8 (go-to-point, tray, remembers chute number) · Tay máy · Trạm nạp (belt + scale / scan + arm) · Cửa thả ×6 (zone + counter) · Xưởng (instances + Bộ điều phối + totals HUD).

## Sorting rule (user, 11-19 ~14:00)
Sort by COLOUR and by MASS (both read by pieces: upgraded "Đọc màu" + scale). Needs branch feat/color-read merged (items / crates readable, 6 colours, named-object input / zone mode).
Lesson `share-jobs` "Chia việc cho hai máy": user said keep; show it to the user in wave 2.

## Looks + mechanics picked (user, 11-19 ~17:25: `7a,8a,9b`)
Parcels = cartons (`parcel-carton`, tape = class colour). Belt = `belt-frame` (auto-run like `conveyor`, branch feat/chassis-turn). Tray dumps SIDEWAYS (recipe in fullstack-261119-1730-chassis-turn-belt-tray-report.md). AGV look `agv`, arm look `factory`, chute style `chute`, markers look 2.
Traffic (nav report): one-way lanes + give-way-to-right; head-on in one lane deadlocks; 8 robots untested → test early.

## Rules
Params / wires / circuits only. If a piece is insufficient: STOP and report.

## Tests
- Reference run of 5 simulated minutes: every parcel in the chute of its class.
- 0 chassis overlap (per-tick geometry), no starvation (every AGV served).
- Anti-forced: cut each pin wire → the run fails.
- On-mode hash baseline; cost per tick recorded in the report (not asserted).

## Lessons chain "Bảng mạch" (3)
Make a board + pins · reuse it twice · join two boards with a rule.

## Fallback
If grid driving is not stable: same circuits on a painted loop. Say so to the user; do not hide it.

## Done when
One link :5173, sample in menu "Bài mẫu", shots of every level read, user watched it run.
