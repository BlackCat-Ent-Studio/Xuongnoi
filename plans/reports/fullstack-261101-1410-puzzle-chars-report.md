# Puzzle characters: 4 new looks (branch feat/puzzle-chars)

## What changed
Four toon-shaded looks ported from the approved preview pages, built from three.js primitives (no external files):
`robot-wheel` (Chan bun mount only), `robot-legs`, `cat-chibi` (original collar), `cat-quad` (collar defaults, X tag below ring).
Registered in `CHARACTER_STYLES`, added after the existing six in the character node `look` select (default stays `human`),
handbook "Nhan vat" `look` text lists them. Thumbnails work unchanged (generic renderer).

## Files (app/)
New: `src/render/character-styles/{robot-wheel,robot-legs,cat-chibi,cat-quad,toon-parts}.ts`
Edited:
- `character-styles/kit.ts`: backward-compatible `PartKit` additions (`toon`, `toonTinted`, `ramp`, `sphere`, `own`, rim shader option); `StyleRig.selfFitting`, `StyleDef.fixedColor`.
- `character-styles/index.ts`: registration.
- `character-motion.ts`: `Motion.vy` (rising vs falling), `motionOf(..., vy = 0)`.
- `humanoid-model.ts`: passes `vy`; skips box-corner height fitting for `selfFitting` rigs.
- `hit-flash.ts`: toon materials flash red too.
- `nodes/character.ts`: 4 select options. `handbook/content-math-object-output.ts`: text.
- `tests/render/character-styles.test.ts`: option list/registration, triangle budget, vertex-accurate extents, fixed-palette recolor rule.

## Behavior
- Fit: model built in its own units, turned to face +X, centered, base on floor, uniformly scaled so rest pose <= 1 tall and inside the 0.5 footprint (80-97% of radius, slack for swinging parts). Rest-pose figures are measured per vertex at build time.
- Motion (existing hooks, no per-frame allocation): idle breathe/blink/antenna or tail; run: wheel spins with speed + body leans, legs/arms swing, cats trot diagonal pairs; airborne: rising vs falling poses (arms up / legs reach, happy ^ ^ eyes on robots); landing squash. No win/lose hook used (not exposed cheaply).
- Colors: robots tint body with the entity color (shade derived darker); cats are fixed black (`fixedColor`), entity color ignored.

## Triangles (3d, one figure)
robot-wheel 10756, robot-legs 4772, cat-chibi 7712, cat-quad 6918 (budget 20k, asserted in test).

## Verified
- `npx tsc --noEmit -p .` clean.
- `vitest run tests/render tests/nodes tests/handbook`: 36 files / 687 tests green (new looks run through the shared stay-in-box / feet-on-floor / owner-tag / recolor tests in 2d-side and 3d).
- Visual (temporary harness page, deleted; dev server on 5201 stopped): 4 looks standing, running, jumping in 3d, 2d-side, 2d-top, plus solo close-ups, compared with preview screenshots. Shots: `plans/reports/shots-puzzle-chars/`.

## Not verified / notes
- Real GPU (screenshots are swiftshader). Look picker thumbnails not exercised in a browser (node has no WebGL; the code path is the generic one).
- Feet may sink under 0.5% of figure height below the floor mid-stride (test allows this slack for the 4 new looks only; box looks stay exact).
- Rim-light shader hook relies on three.js `opaque_fragment` chunk (three 0.186).
- Tools in hand are not shown on the new looks (no hand mount), 2d-side hides the wheel robot's sideways arm swing.
- Robot default color is the entity blue (#3b82f6), darker than the preview's light blue (#7cc4f0); pick the color to match.
- Win/lose faces skipped.
