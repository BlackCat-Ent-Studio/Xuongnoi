# Hand-held tools (Cầm tay) - implementation report

Status: DONE. Vitest 304/304 (was 253), `tsc --noEmit` clean, `npm run build` ok. Not committed.

## What was built
- **Types** (`engine/types.ts`, additive):
  - `ItemShape` gains sword, pickaxe, hammer, torch, wand, bucket. New `HoldStyle` = head | hand.
  - `EntitySpec.holdStyle`. `EntityView` gains `holdStyle`, `inHand` (items) and `tool`, `swing` (characters). All of these appear only when relevant.
  - `WorldApi` gains `equip`, `unequip`, `handItem`, `isInHand`, `useTool`, `wasUsedOn`.
- **World** (`world/world.ts`, `entity.ts`, `physics.ts`):
  - Second slot, `handHolding`, independent of `holding` (above the head). The tool follows the holder just ahead of it at chest height, so it still reports contacts.
  - `grab` now accepts only `head` items. `equip` accepts only `hand` items. Nearest in reach, facing bias, one tool per character.
  - `isHeld` stays "above-head slot only", so old boards and `item.held` are unchanged.
  - `unequip` reuses the drop-spot rules (front, behind, feet).
  - `useTool` swings for 0.3 s (`SWING_SECONDS`). A swing in progress is the cooldown, and `useTool` returns null while it lasts.
  - Target = nearest visible block / item / other character in a box ahead of the swinger:
    - It runs from the swinger's center out to `reach`, as wide as the swinger, at the swinger's height.
    - It needs at least 0.1 vertical overlap, so the floor underfoot is never a target.
    - It excludes self, the tool, and the above-head item.
    - It works along the facing direction in 2d-side, 2d-top and 3d alike.
  - `usedOn` is a one-tick pulse, visible on the tick after the swing (same pattern as `interact`). `hit` on the node is immediate.
  - Hiding a tool or its holder releases it. Deterministic.
- **Nodes**:
  - `item`: appended `holdStyle` param (default `head`, unknown values fall back to `head`), outputs `inHand` and `usedOn`, and the 6 new shape labels.
  - `block`: appended output `usedOn`.
  - New `hand-tool` "Cầm tay" (category Hành động).
    - Inputs: character, toggle (Cầm/Cất), use (Dùng).
    - Outputs: holding, tool, used, hit.
    - Param: reach (1.3).
    - Both inputs are rising-edge triggered. Use with an empty hand still swings (punch): `used` is true and `tool` is null.
  - Registered, 20 kinds in total.
- **Render**:
  - Six upright tool shapes from boxes in `item-shapes.ts`, plus `handGrip()` (tilt, grip offset, size).
  - `StyleRig.hand` is a new optional mount (swing joint, anchor, length, swing share). Tools are drawn on the figure, and the loose item entity is skipped by `SceneView` while `inHand`.
  - Mount per look:
    - human / robot: left arm (the arm meshes now live in an inner swing joint, so the arm and tool swing together).
    - cat / dino: mouth. The dino's mouth joint is under `upper`, so it leans with the body.
    - chick: under the near wing.
    - jelly: stuck to the side, outside the squashing blob.
  - `swingAngle` and `swingLunge` live in `character-motion.ts` (wind up, strike, settle, plus a small body lunge).
  - `localYRange` skips `userData.noFit` subtrees, so the tool never compresses the figure.
  - The above-head carry render is untouched.
- **Sample** `pickaxe-rock` "Cuốc đá mở đường (2D)" (`samples/pickaxe-rock.json`, registered in `io/samples.ts`):
  - Arrows move, Space jumps, E takes or puts away the tool, F swings.
  - A sword (grey) at x=-4 and a pickaxe (orange) at x=0, both `hand` items. A 1x3x1 rock at x=4 blocks the way, with the goal at x=9.
  - Wiring: `rock.usedOn AND pickaxe.inHand -> rock.hide`. The sword also pulses `rock.usedOn`, but `pickaxe.inHand` is false, so the rock stays.
- **Tutorial lesson 5** `hand-tools` "Dụng cụ cầm tay" (21 steps, original text in `tutorial/text-vi.ts`).
  - The board has the mover, rock, goal and win wiring.
  - The learner adds:
    - an item, shape Cuốc and holdStyle Cầm trên tay
    - Cầm tay wired to the hero
    - keys E and F, wired to toggle and use
    - a play test
    - Và with rock.usedOn and pickaxe.inHand, then `Và -> rock.hide`
    - the final play, ending on a win
  - Lessons 1-4 are unchanged.

## Tests (new/changed)
- `tests/world/hand-tools.test.ts` (new, 49 tests), `describe.each` over all 3 modes:
  - equip nearest / ignore head items
  - independence from the head slot (both filled, drop one, other stays)
  - ignores fixed / hidden / head-style items
  - tool follows the character
  - unequip and re-equip
  - use hits the front target once, with a one-tick `usedOn` pulse
  - cooldown
  - empty-hand swing
  - out of reach / hidden / own tool / above-head item are ignored
  - hits items and characters
  - floor underfoot is not a target
  - hide releases the tool
  - determinism

  Mode-independent tests: `hand-tool` node edges, `item` / `block` node outputs and params (including an old board without `holdStyle`), swing curve.
- `tests/io/samples.test.ts`: 5 samples. `pickaxe-rock` scripted win (walk, E, walk, F, walk -> win), plus 3 negatives:
  - no win without breaking the rock
  - sword in hand cannot break the rock
  - empty-hand swing does nothing
- `tests/tutorial/lessons.test.ts`: lesson 5 step by step with real editor-state operations, then plays the learner's graph in the engine to a win.
- `tests/nodes/{fake-world.ts,step-1-nodes.test.ts}`: stubs and kind count 19 -> 20.

## Browser verification (Playwright, headless, real keyboard)
Scripts are in `...\scratchpad\smoke\`: `tools-pickaxe.mjs`, `tools-looks.mjs`, `tools-lesson5.mjs`, `tools-montage.mjs`.
- `tools-pickaxe.mjs`: opened the sample, E to take the pickaxe, walked to the rock, F, rock gone, walked to the goal. Showed "Thắng! Đá đã vỡ, bạn thắng rồi!". 0 console errors.
- `tools-looks.mjs`: for all 6 looks (human, robot, cat, chick, jelly, dino), a crate carried above the head (Q) and the pickaxe in hand (E) at the same time. Then F, with swing frames. 0 console errors.
- `tools-lesson5.mjs`: all 21 steps auto-advanced from real drags, wires, select options and key capture. The final play won and the panel closed. 0 console errors.
- Regression runs:
  - `tut-run.mjs` (lessons 1-3): 66 PASS, no FAIL, no console errors.
  - `items-lesson4.mjs` (lesson 4): done, no console errors.
  - `items-keydoor.mjs`: win message, no console errors.
- Screenshots are in `...\scratchpad\tools\`:
  - `p03-pickaxe-in-hand`, `p04-swing-a`, `p06-rock-gone`, `p07-win`
  - `<look>-both-slots`, `<look>-swing-1`, `<look>-swing-2`, `<look>-after` for each of the 6 looks
  - `contact-looks.png` (all 6 looks, both slots, and the swing)
  - `l5-01..06` (lesson 5)

## Files
- Modified:
  - `src/engine/types.ts`
  - `src/world/{world,entity,physics}.ts`
  - `src/nodes/{item,block,index}.ts`
  - `src/render/{character-motion,humanoid-model,item-shapes,scene-view}.ts`
  - `src/render/character-styles/{kit,human,robot,cat,chick,dino,jelly}.ts`
  - `src/io/samples.ts`
  - `src/tutorial/{lessons,text-vi}.ts`
- New:
  - `src/nodes/hand-tool.ts`
  - `src/samples/pickaxe-rock.json`
- Tests:
  - new: `tests/world/hand-tools.test.ts`
  - modified: `tests/nodes/{fake-world,step-1-nodes.test}.ts`, `tests/io/samples.test.ts`, `tests/tutorial/lessons.test.ts`

## Notes / deviations
- Ground tools are drawn upright, so a sword lying on the floor is a thin vertical sprite. In hand they are tilted forward. A lying pose would be a cosmetic follow-up.
- `reach` (1.3) is measured from the character center and used for both equip and use. Blocks are measured by their near face, so a 1-wide rock is hit from about 1.8 center distance.
- Facing left in the side view puts the left arm on the far side. The tool still pokes out in front, so it stays visible.
- Headless Chromium in this environment sometimes drops to a few fps during the tutorial play step. The browser scripts therefore use closed-loop key presses (the `Đúng` badge) rather than fixed walk times. One lesson 4 run and one lesson 2 HUD check failed once on timing and passed on rerun. The engine tests are deterministic and cover the same paths.
- `HANDOFF.md` at the repo root shows as deleted in `git status`. I did not touch it, and it was already gone before this work.

Status: DONE
Summary: Hand-held tool slot (item holdStyle, Cầm tay node, block/item usedOn, 6 tool shapes, per-look hold and swing), the `pickaxe-rock` sample and tutorial lesson 5 are in. Engine win plus negatives, lesson 5, both-slots-at-once for all 6 looks and the lessons 1-4 regressions were verified in a real browser; 304 tests, tsc and build pass.
Concerns/Blockers: none blocking. Minor: headless browser fps flakiness in the scripts, and `HANDOFF.md` is deleted in the working tree (not by this work).
