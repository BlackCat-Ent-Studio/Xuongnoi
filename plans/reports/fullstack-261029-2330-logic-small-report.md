# Logic small: report

Branch feat/logic-small, commit b522b96 (worktree D:\workspace\GameBuilder-logic-small). Not merged.

## Done
1. "Hiện lại" bool on Hộp and Đồ vật. New `WorldApi.show(id)`, implemented in world.ts. Node state `hidden` tracks it, so show only acts after a hide. Hide and show on the same tick end up visible.
   - World rules: no-op if unknown, already visible, a disposable copy (shots, spawner), or a dead body. Otherwise visible again at the old spot, velocity zeroed, `solidRev++` for solid blocks (mirror of hide). Items stay released (hide already let go).
   - Overlap rule: the entity is still shown, nothing is moved. Physics depenetration handles any overlap. Tested in 2d-side; the solid box list and revision are tested in all three modes.
2. Bộ đếm: ports "Số cộng thêm" (number) + "Cộng số" (bool), "Số đặt" (number) + "Đặt số" (bool). Each acts on a rising edge. Order: +1, -1, reset, add, set, so "Đặt số" wins on the same tick. Unwired or NaN number = 0. The Mục tiêu / Đã đủ rules are unchanged.
3. New node `select-number` "Chọn theo số" (Logic), file nodes/select-number.ts. Input "Số", param `choices` 2..6, default 3. Always emits `is1`..`is6` (labelled "Là 1".."Là 6") plus `changed` ("Vừa đổi"), the same pattern as sequence. Ports above N stay false. Selected index = round(Số) if in 1..N, else 0. "Vừa đổi" fires when the index changes, including to or from "none". It does not fire on the first tick.
4. Tests: new tests/nodes/logic-small.test.ts (nodes, world.show, counter, select-number). fake-world gained `show`/`shown`. Node count test is now 47. Palette synonyms were added for `select-number`. No optional bool "Bật" input was added (the brainstorm mentioned one; the task did not).

## Shared-file edits (additive)
engine/types.ts (+show on WorldApi), world/world.ts (+show), nodes/index.ts (+import and registry entry after sequenceNode), step-1-nodes.test.ts (46 to 47), tests/nodes/fake-world.ts, palette-search.ts (+1 synonym line). CRLF kept. A merge with the vehicle-cargo branch may conflict on nodes/index.ts, the count test and WorldApi, all trivially.

## Gates (app/)
- `npx vitest run`: 825 passed (60 files)
- `npx tsc --noEmit -p .`: clean
- `npm run build`: OK (chunk-size warning only)

Note: the dependency folder in the worktree is a link to the main app's one and is untracked and ignored.

Status: DONE
Summary: Hiện lại on block and item (new WorldApi.show), counter add/set number inputs, new Chọn theo số node, tests and gates green, committed b522b96 on feat/logic-small.
Concerns/Blockers: None blocking. Revive-onto-occupant leaves the overlap to the physics resolver, tested only in 2d-side. Saves with the old ports are unchanged (new ports are optional). No browser smoke was run.
