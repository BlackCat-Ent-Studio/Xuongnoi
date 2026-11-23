# Open character/carry/fight params (agent B)

Branch feat/open-charp, worktree D:\workspace\GameBuilder-charp.

New advanced params (defaults = old constants):
- character: invulnSeconds 0.5, knockSpeed 7, knockLift 5 (createOnly) -> EntitySpec.hitReaction -> Entity.hit -> world/combat.ts
- carry: dropDistance 0 (0 = old auto gap), throwLift 0.5 -> world.drop(id, distance?) / throwHeld(id, power, lift?)
- fight: backoffSeconds 0.25

Not done: "Bậc leo được". platforms.ts MAX_STEP is a platform sub-step length (internal collision safety), not a character step-up; no step-up mechanic exists. Exposing it would be a new feature, skipped.

Files: engine/types.ts (HitReaction, spec field, drop/throwHeld optional args), world/entity.ts, world/combat.ts, world/world.ts, nodes/character.ts, carry.ts, fight.ts, tests/world/tuning-params.test.ts (7 tests).

Gates: vitest 77 files / 1036 tests pass; tsc clean; build ok. pathfind-last rule: not applicable (none of these nodes has pathfind).

Status: DONE_WITH_CONCERNS
Summary: All requested params exposed except step-up (no such mechanic).
Concerns: character params are createOnly (change needs restart); merge conflicts likely in types.ts/entity.ts/world.ts with agent A.
