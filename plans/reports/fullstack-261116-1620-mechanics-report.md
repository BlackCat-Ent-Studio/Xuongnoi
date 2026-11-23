# Mechanics foundation report (2026-11-16)

Worktree `D:\workspace\GameBuilder-mech`, branch `feat/mechanics` (from main 94878ba). App in `app/`.
Engineering-formula layer: SI formulas, material params on bodies, squeeze/damaged, carry by weight, force sensor node, handbook + lesson.

## 1. API of `src/world/mechanics.ts` (pure, SI, no world access)

All inputs: non-finite or negative numbers are treated as 0 (never NaN). "Enough" checks tolerate 1e-9 rounding (5 kg x 9.81 = 49.050000000000004).

```ts
export const G = 9.81;                                              // m/s2
weight(massKg: number, g = G, gravityScale = 1): number              // W = m g scale  [N]
torque(forceN: number, armM: number): number                         // tau = F r  [N m]
accelFromForce(forceN: number, massKg: number): number              // a = F / m ; mass 0 -> 0
frictionForce(mu: number, normalN: number): number                  // F = mu N

interface GripInput { gripForceN: number /* per finger */; mu: number; fingers?: number /* 2 */; weightN: number; accel?: number /* m/s2 upward, 0 */ }
interface GripResult { holds: boolean; marginN: number; requiredForceN: number }
gripHolds(i: GripInput): GripResult        // holds when fingers*mu*F >= W*(1 + a/g); required = W(1+a/g)/(fingers*mu); mu=0|fingers=0 -> Infinity (nothing to hold -> 0)

crushed(forceN: number, crushLimitN: number): boolean                // limit > 0 && force > limit

interface JointLoad { massKg: number; armM: number }
interface JointLiftInput { torqueMaxNm: number; loads: readonly JointLoad[]; angle?: number /* rad above horizontal, 0 = worst */ }
interface JointLiftResult { ok: boolean; requiredNm: number; marginNm: number }
jointCanLift(i: JointLiftInput): JointLiftResult                     // required = sum m g L |cos(angle)|
maxPayloadKg(torqueMaxNm, armM, ownLoads: readonly JointLoad[] = [], angle = 0): number
                                                                     // (tau_max - sum own) / (g L |cos|) ; 0 if own loads use all torque ; Infinity if no lever

maxStaticAngle(mu: number): number                                   // atan(mu) rad
slopeHold(mu, massKg, angleRad): { holds: boolean; marginN: number; pullN: number }   // mu m g cos >= m g sin
```

Hand numbers pinned by tests: 5 kg, mu 0.5, 2 fingers -> required 49.05 N; 1 finger -> 98.1; 3 fingers -> 32.7; lifting at +g doubles it; 200 N limit (200 safe, 200.1 breaks); 30 N m at 0.5 m -> 6.116 kg; 6.2 kg at 0.5 m needs 30.411 N m; 2 kg link at 0.25 m takes 4.905 N m off the budget.

## 2. WorldApi / EntitySpec / EntityView additions (src/engine/types.ts, implemented in src/world/world.ts + material.ts)

```ts
// EntitySpec (all optional; omitted = default of the kind)
mass?: number;        // kg, 0..100000. defaults: block 10, item 1, character 60, vehicle 1000
mu?: number;          // surface friction coefficient 0..1.5, default 0.5
crushLimit?: number;  // N, 0 / omitted = never breaks

// EntityView (present ONLY when set to a non-default value, so old views/hashes are byte-identical)
mass?: number; mu?: number; crushLimit?: number; damaged?: true;

// WorldApi
materialOf(id): { massKg: number; mu: number; crushLimitN: number; damaged: boolean } | null   // always the EFFECTIVE values
applySqueeze(id, forceN): boolean      // damaged for good when crushLimit > 0 and force > limit; returns damaged-now; unknown/hidden id or bad force: no change
massOn(id): number                     // kg standing on the body (underside meets top face within 0.05, footprints overlap, stacks counted, hidden/in-hand/zone skipped)
massHeld(id): number                   // kg carried above the head + in hand by a character
grab(character, reach, maxMassKg?)     // new 3rd arg: > 0 = items heavier than it are not lifted (returns null); old call = unchanged
tooHeavyToGrab(character, reach, maxMassKg): boolean   // the item grab() would pick is too heavy
```
`src/world/mechanics.ts` constants for the second agent to reuse the same units: `weight()` for N from `materialOf().massKg`.
Helpers in `src/world/material.ts`: `DEFAULT_MASS_KG`, `DEFAULT_MU`, `materialTuning`, `materialOf`, `squeeze`, `massOn`, `massHeld`.
`tests/nodes/fake-world.ts` got stubs for the 5 new methods (siblings extending it: merge additively).

Damaged look (render only, collision untouched): `src/render/damaged-look.ts`. `damagedView()` = height x0.6, width/depth x1.12, underside fixed, colour mixed 55% to dark red; `tintDamaged()` clones and darkens materials of models that carry their own colours (pack crates). Wired in `scene-view.ts`. Stays until the game restarts (new world = new entities).

## 3. Node params (all advanced, createOnly, neutral defaults)

| Node | Param id | Label | Default | Range |
|---|---|---|---|---|
| Vật thể, Đồ vật, Nhân vật, Xe | `mass` | Khối lượng (kg) | block 10 / item 1 / character 60 / vehicle 1000 | 0..100000 |
| same | `mu` | Hệ số ma sát bề mặt | 0.5 | 0..1.5 |
| same | `crushLimit` | Lực chịu nén tối đa (N, 0 = không hỏng) | 0 | 0..1e7 |
| Vật thể, Đồ vật | `showDamagedOut` | Báo bị hỏng | no | output `damaged` Bị hỏng (bool) |
| Vật thể, Đồ vật | `showWeightOut` | Báo trọng lượng | no | output `weight` Trọng lượng (N) = mass x 9.81 |
| Khiêng đồ | `strength` | Sức nâng tối đa (kg, 0 = không giới hạn) | 0 | 0..100000 |
| Khiêng đồ | `showTooHeavyOut` | Báo quá nặng | no | output `tooHeavy` Quá nặng (bool, latches until the next grab attempt, successful grab or drop) |

Shared code: `src/nodes/body-params.ts` (`materialParams(kind)`, `materialSpec()`, `MATERIAL_PARAM_IDS`; NOT added to `BODY_PARAMS`, so a sibling kind that spreads BODY_PARAMS gets no duplicate `mass`), `src/nodes/material-ports.ts`.
The existing item `friction` (Độ trượt, ground slide) is unrelated and untouched; `mu` is the contact coefficient for grips.

## 4. New node `force-sensor` "Cảm biến lực / Cân" (EN Force Sensor / Scale), category logic
- Input `who` Đối tượng (required). Outputs `force` Lực (N), `mass` Khối lượng (kg), `loaded` Có tải.
- Params: `mode` scale (Cân vật đặt lên, default) | hold (Lực đang giữ: item carried/in hand by a character), `smoothing` seconds 0..5 (first-order filter; `loaded` is instant).
- Handbook page, try-board "Thử ngay" (scale platform + 2/5/10 kg crates, Space hides the 10 kg crate), names VI+EN in node-names.ts.
- Lesson `weight-force` "Cân nặng và lực" in NEW `src/tutorial/course-pack-i.ts` (+ `lesson-weight-force.ts`), chapter "Thế giới".
- Handbook topic "Vật lý kỹ thuật" (`src/handbook/topic-engineering-physics.ts`, id `topic:engineering-physics`, link with `document.dispatchEvent(new CustomEvent('handbook:open', {detail: 'topic:engineering-physics'}))`): kg vs N, friction, grip 2 mu F >= m g, crush, torque >= m g L, carry strength. handbook-dialog now lists topics from a `TOPICS` array.

## 5. Tests
New (`tests/mechanics/`, 36 tests): formulas with hand numbers, neutral-default view identity, material clamping, applySqueeze (limit 200: 200 safe, 200.5 breaks, no limit never), damaged view/tint, massOn incl. hidden and neighbours, sensor kg/N/loaded/smoothing/unwired/hold, carry strength (world + node latch), try-board plays to 17 kg / 166.77 N and 7 kg after Space, lesson board reads 17 kg.
Updated: node count 57 -> 58, handbook input-logic kind list (24), block known outputs list.
Identity proof: existing `solid-off-unchanged` (every sample, lesson, handbook board), `solid-on-*`, `physics-invariants` and 7 puzzle level suites are unchanged and must stay green (see run result below).

## 6. Checks run
- `npx tsc --noEmit -p .`: clean.
- Full `npx vitest run --testTimeout 180000`: 171 files, 2791 / 2792 green. The one red, `city-delivery-3d-sample` "cars stop at a red light", timed out at 180 s while other agents loaded the machine (one earlier run also timed out `level-7-decoy`, then passed); re-run alone: passes in 73 s. Not related to this change.
- Identity: `solid-off-unchanged` recorded hashes of all old samples, lessons and handbook boards are untouched; only two NEW boards were appended (`lesson:weight-force`, `handbook:force-sensor`). `solid-on-summary.snap.json` regenerated with `-u`: +38 lines, 0 deleted lines (old rows byte-identical). Puzzle levels / physics-invariants suites green.
- `git diff --stat` == `--stat -w` except `handbook-dialog.ts` (indentation inside the new topic loop).

Screenshots (Playwright on :5254, read): `D:\workspace\GameBuilder\plans\reports\shots-mechanics\` 01 handbook force-sensor page, 02 scale board in editor, 03 playing (HUD Khối lượng 17 / Lực 166.8), 04 after Space, 05 properties of a crate (Nâng cao shows Khối lượng, Hệ số ma sát, Lực chịu nén, Báo bị hỏng, Báo trọng lượng), 06 handbook topic, 10/11 three crates before/after a squeeze (left crate, limit 200 N, squeezed with 300 N: flat and darker; limit 500 and no-limit crates untouched).
The damaged shot used a throw-away dev page and a dev-only squeeze node (deleted, not committed): there is no in-editor source of squeeze until the gripper exists.

## 7. NOT verified
- Real phone / touch; Safari. Only headless Chromium (swiftshader) on desktop.
- 2d-top and 3d views of the scale: `massOn` uses the Y axis (height) in all modes; only 2d-side was played. Stacking test is covered by logic but not by a 3D play-through.
- Damaged look on characters/vehicles/building blocks (tint is skipped for plain boxes, which use the tinted colour instead); only the crate pack model and a plain block were seen.
- Gravity-scale bodies: `weight()` ignores a body gravityScale (sensor reads mass x 9.81).
- The lesson was checked by building/wiring the board in a test, not by clicking through the step coach in the browser.
- Merge with the 3 sibling branches (index.ts, node-names.ts, count tests, handbook indexes, lessons.ts, course.ts, fake-world.ts, content-input-logic KINDS list) not attempted.
- Dev server :5254 left running.

## Unresolved questions
- Default masses (block 10, item 1, character 60, vehicle 1000) are my choice; confirm or adjust.
- Squash look on pack crates uses a flattened model + dark-red tint; the user has not seen it on the real game yet (shots 10/11).
