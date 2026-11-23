# 4 new sensor nodes - report (branch feat/sensors, worktree D:\workspace\GameBuilder-sensors)

## Nodes (all category logic, registered after Cảm biến khoảng cách; total kinds now 54)

| kind | inputs | outputs | params (advanced marked *) |
|---|---|---|---|
| speed-sensor | who (Vật, required) | speed, still (< 0.05 u/s), fast (> threshold) | threshold 3; axes* flat/all (default flat = ignore jumping) |
| ahead-sensor | who (Vật, required) | blocked, distance, thing, hit (pulse) | reach 3 |
| vision-sensor | viewer (required), target (optional) | seen, gained, lost (pulses), nearest, distance | range 6, angle 90, walls yes/no (yes), filter (player; used only when target not wired) |
| color-sensor | who (required) | index (0/1/2/3), match | where feet/ahead, want 1..3 (1), reach* 1.5, color1*/color2*/color3* (default = block's traffic colours) |

Conventions chosen (documented in descriptions + handbook):
- Speed: from position change between ticks (node state), 0 on first tick / object missing; missing -> still=false. Side view ignores z, top view ignores y.
- Ahead / Vision: when nothing is found, `distance` = the reach/range (not 0), so "distance < x" never fires falsely.
- Vision: viewer facing = character `facing`, vehicle `heading`. Side view: cone on the x/y plane facing left/right; top/3D: horizontal angle on x/z (distance is 3D in 3D). Edge inclusive. Viewer is never its own target; hidden, seated, in-hand, fallen candidates skipped. `matchesFilter` exported from zone-sensor.ts (1-word change) and reused.
- No cone gizmo in the editor: skipped (would need renderer work; not cheap).

## Colour rule
The world only stores one colour per entity (the Hộp "Đổi màu" input just sets it), so the sensor compares the block's current colour (case-insensitive) with its own palette Màu 1/2/3. Defaults equal the Hộp defaults (red/yellow/green) so it works when dropped in; if the user changed Màu 1-3 on the Hộp, they set the same in the sensor's Nâng cao. Any other colour, a never-recoloured block of another colour, or no block -> 0. "Dưới chân" = highest visible solid non-zone block whose box covers the object centre (x, and z unless side view) with its top not above the feet + 0.15. "Phía trước" = probeAhead result (reach param) if it is a block, else 0.

## New WorldApi probe
`lineOfSight(fromId, toId): boolean` (engine/types.ts), implemented in new `src/world/line-of-sight.ts` and wired in world.ts. True when no visible solid non-zone block (collider box, shrunk 0.02) crosses the centre-to-centre segment (slab test); both endpoints' own bodies ignored; false for unknown/hidden ends; flat views ignore the unseen axis. Stub `lineOfSight: () => true` added to tests/nodes/fake-world.ts (the only fake WorldApi that implements the full interface).

## Handbook
4 full pages appended to `src/handbook/content-input-logic.ts` (purpose, when, every port/param, example, tips, lesson link, try board) + 4 try boards in `boards-input-logic.ts`. Test constant list in tests/handbook/content-input-logic.test.ts updated 16 -> 20.

## Course
New lesson `bot-senses` "Giác quan cho bot": file `src/tutorial/lesson-bot-senses.ts`, registered by new `src/tutorial/course-pack-e.ts`, spread in lessons.ts, listed at the end of the "Bot" chapter in course.ts. Game: a red guard bot at the left looks right; wire vision (viewer=guard, target=hero), speed (hero), AND(seen, fast) -> lose; ahead sensor -> "Có tường, nhảy lên!" text; colour sensor want=3 -> win; set hero "Tốc độ chạy" <= 2 to sneak (threshold is 3). 19 steps, all matched by kind + port / param.

## Verified
- `npx tsc --noEmit -p .` clean.
- New tests: tests/nodes/new-sensors.test.ts (speed numbers/thresholds/axes/views, ahead distance + pulse + reach, vision cone in/out, 90 vs 89 degree edge, wall blocks, walls off, gained/lost pulses, filter, target, side facing left, top view, lineOfSight, colour under feet / raised block / recoloured / palette / ahead), tests/tutorial/lesson-bot-senses.test.ts (step walk, targets resolve, headless sneak = win, run = lose). Node-count test 50 -> 54.
- Full `npx vitest run --testTimeout 120000` and `npm run build`: see final status line below.

## Not verified
- No Playwright screenshots (no gizmo added; try boards and lesson run headless in tests but were not looked at in a browser).
- Vision in real 3D / vehicles as viewer only covered by logic (vehicle heading branch not unit-tested).
