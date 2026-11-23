# p-spawn report (feat/p-spawn, commit f261950)

## Task A - spawner material
- `src/nodes/spawner.ts`: advanced params Khoi luong / Ma sat / Luc chiu nen via `materialParams('item')` + `materialSpec` (body-params.ts, reused, no duplication). New advanced toggle `wireMaterial` (no/yes) -> optionalInputs `mass`, `crushLimit` (number), same pattern as robot-body. Wired value at the moment of spawn (finite number) replaces the param; clamped by `materialTuning` in world.spawn.
- Neutral defaults: spec carries mass 1 / mu 0.5 / crush 0 -> `materialTuning` drops them -> no field on entity. Block template left on param mass 1 keeps the block default 10 kg (mass set undefined), so old block spawners stay hash-identical. Side effect: a block cannot be set to exactly 1 kg via the param (wired value can).
- Handbook: spawner page params documented (mass, mu, crushLimit, wireMaterial), tip text on scale; extra try-board "Thu: thung nang nhe ngau nhien" (On Start -> Hen gio repeat 2s -> Tao + So ngau nhien 1..20 -> Khoi luong; scale block -> Cam bien luc -> Hien so).
- Optional ports are not listed under `entry.ports` (existing handbook tests compare to def.inputs only); described in the `mass`/`wireMaterial` param texts.

## Task B - show-text
- `ParamDef.multiline?: boolean` (types.ts); properties-panel renders a `<textarea>` with the same classes `prop-input pn-text` (rows 4, auto height + 6px padding inline; no CSS file touched) when `multiline`.
- `show-text.ts`: advanced text param `lines` (default ''), optional input `line` (number) shown only while `lines` non-blank. Wired + lines non-empty -> 1-based rounded line; out of range -> card hidden (empty pill avoided). Otherwise exactly as before ("Chu" param). Splits on CRLF/LF.
- Handbook: param `lines` documented, tip rewritten, extra try-board "Thu: chu doi theo buoc" (On Start -> Hen gio -> Chuoi buoc `index` -> Dong so).
- `tests/handbook/extra-tries.test.ts` expected kinds list extended (`show-text`, `spawner`) - sibling branches adding extraTries will conflict there trivially.

## Tests
- New: tests/nodes/spawner-material.test.ts (8: neutral no-field item+block, block 10kg, params, clamp, wired mass changes between spawns / ignored when hidden, wired crush, optional ports, scale reads spawned mass), show-text cases (+5), tests/handbook/spawn-text-boards.test.ts (boards played: >=3 distinct masses + scale reading > 0; text cycles 3 lines).
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 300000`: 207/208 files, 3212/3213 tests; only failure tests/puzzle/level-7-decoy (known load timeout, 900 s default hit under 4 parallel agents). Rerun alone: see final status below.
- Baselines: tests/editor/solid-off-baseline.json not modified (git status clean on it), solid-off-unchanged passes.
- `git diff --numstat` == `--numstat -w` (no line-ending churn).

## Screenshots (read, OK)
D:\workspace\GameBuilder\plans\reports\shots-p-spawn\
- spawner-weight-play-2.png: crate on scale, HUD "Can (kg): 17" (sum of random masses), random wired to Khoi luong visible on card.
- text-lines-play-2.png: single card shows "Dang chay" (line 2) as Chuoi buoc advanced.
- text-lines-panel.png: Nang cao "Cac dong chu" textarea (3 lines) + new "Dong so" port in wire list. Textarea looks like other inputs (dark, bordered).
- Console: one 404 resource (pre-existing, unrelated).

## Notes / unresolved
- Spawner board in editor shows the usual "no Character" warning (still runs), same as other non-character boards.
- Text board's `show` input gets an auto on-start via the existing wire-rule migration (second On Start card appears); same as other boards.
- Textarea min visual tweak is inline style (height auto/padding), because panels.css fixes `.prop-input` height 30px. Not new CSS, but reviewer may want a real rule.
