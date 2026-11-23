# Carry / drop / throw / interact items - implementation report

Status: DONE. Vitest 253/253 (was 203), `tsc --noEmit` clean, `npm run build` ok. Not committed.

## What was built
- **Nodes** (registered, 19 kinds total): `item` "Đồ vật" (object), `carry` "Cầm / Thả", `interact` "Tương tác". The last two are in a new category `action` "Hành động" (types, NODE_CATEGORY_LABELS, palette order, CSS color).
  - item: outputs self / held / interacted. Params: position, size (0.6^3), color, shape (hộp/chìa khoá/quả bóng/thùng) and one addition, `carryable` ("Cầm được" / "Cố định").
  - carry: inputs character / grab / drop / throw, outputs holding / heldItem. Params: mode ("2 phím riêng" / "1 phím cầm-thả"), throwPower. Each input is edge-triggered. Priority is throw > drop > grab.
  - interact: inputs character / press, outputs fired / target. Param: reach (1.5).
  - "pulse" outputs are `bool` (true for one tick), since PortType has no pulse.
- **World** (`world/world.ts`, `world/physics.ts`, `world/entity.ts`):
  - New EntityKind `item`. Items are always non-solid and never block characters.
  - Gravity applies in side/3d and not in top. Items land on solids. Ground friction stops a thrown item (gentler in top view). No bounce.
  - Facing is tracked from the last non-zero move intent.
  - Held items are kinematic and follow the holder, so they still report contacts. They ride above the head in side/3d and in front of the character in 2d-top (an above-head offset would be invisible from the top camera).
  - Contacts now cover any pair that is not block-block, so touch(item, zone) works.
  - Grab: nearest visible, carryable, free item within 1.2 of the character center. A mild facing bias (0.3 x cos) breaks near-ties toward the facing side. One item per character.
  - Drop: tries in front, then behind, then at the character's feet, taking the first spot not overlapping a solid. Otherwise it falls back to the above-head spot.
  - Throw: velocity = facing * power horizontally and power * 0.5 up (none in top).
  - Interact: nearest item in reach, excluding the one the character holds. The target's `interacted` is true for exactly one tick, on the tick after the press.
  - Hiding a held item, or a character holding one, releases it. Hidden items cannot be grabbed.
- **Types** (`engine/types.ts`, additive only): `'item'` kind, `ItemShape` / `ITEM_SHAPES`, optional `shape` / `carryable` on EntitySpec, optional `shape` on EntityView, and 7 WorldApi methods (`grab`, `drop`, `throwHeld`, `heldItem`, `isHeld`, `interact`, `wasInteracted`). The old `tests/nodes/fake-world.ts` got stubs for these.
- **Render**: `render/item-shapes.ts` builds each shape from boxes with `PartKit` (key = ring + shaft + teeth, ball = shaved cube, crate = body + dark planks, box). SceneView has an `item` entry type; picking still maps clicks to the owner node. Held items are drawn by their world position (above the head), so all 6 character looks work with no per-look code.
- **Sample** `key-door` "Chìa khoá và cánh cửa (2D)" (`src/samples/key-door.json`, registered in `io/samples.ts`):
  - Arrows move and Space jumps. E toggles grab/drop, Q throws, F interacts.
  - The door is a solid 1x3x3 block (too tall to jump). Beside it sits a fixed purple crate that acts as the lock (`carryable: no`).
  - Wiring: `lock.interacted AND carry.holding -> door.hide`. Touching the green goal wins.
  - Design choice: a door cannot be interacted with directly (interacting with non-item blocks is out of scope). The fixed lock item is what makes the board solvable, and `carryable` exists so the lock cannot be picked up by mistake.
- **Tutorial lesson 4** "Cầm và dùng đồ" (id `carry-use`, 22 steps, original text in `tutorial/text-vi.ts`). The prebuilt board has the mover, door, lock, goal and win wiring. The learner adds:
  - the key item and its shape
  - Cầm / Thả, wired to the hero
  - a Phím bấm set to E, wired to grab
  - a play test
  - Tương tác, plus a Phím bấm set to F
  - Và, with lock.interacted -> A and holding -> B
  - Và -> door.hide
  - the final play, ending on a win

  Lessons 1-3 are unchanged.

## Tests
- `tests/world/items.test.ts` (new, 45 tests). A `describe.each` over all 3 modes covers:
  - grab nearest, facing preference, out-of-reach / hidden / non-carryable items
  - one item per character
  - hold position and facing follow
  - drop placement, including next to a wall
  - throw arc, landing and coming to rest
  - hide releases (both directions)
  - interact one-tick pulse, ignoring the held item
  - contacts for a held item against a zone block
  - determinism

  Separate tests cover gravity per mode, items not blocking, and bad ids, plus node tests for toggle/separate carry modes, edge firing, interact, and inert nodes.
- `tests/io/samples.test.ts`: 4 samples. The key-door scripted win (walk, E, walk, F, walk -> win) also checks the door is hidden. It also checks that skipping the key or the F press does not win.
- `tests/tutorial/lessons.test.ts`: lesson 4 step-by-step with real editor-state operations, then plays the learner's built graph in the engine to a win.
- `tests/nodes/step-1-nodes.test.ts`: kind count 16 -> 19.

## Browser verification (Playwright, headless)
- `smoke/items-keydoor.mjs`: opened the sample, picked up the key with E, threw it with Q, and ran up to where it landed. Then E, F (door gone) and walk to the goal showed "Thắng! Cánh cửa đã mở, bạn thắng rồi!". No console errors.
- `smoke/items-lesson4.mjs`: all 22 steps auto-advanced from real drags, wires and key capture. The final play won and the panel closed. No console errors.
- `smoke/tut-run.mjs` (lessons 1-3): no FAIL lines, no console errors.
- Screenshots are in `...\scratchpad\items\`: `03-holding`, `04-thrown-in-air`, `05-thrown-landed`, `06-at-door-holding`, `07-door-gone`, `08-win`, `22-l4-holding`, `26-l4-door-gone`, `27-l4-won`, plus contact sheets `contact-a/b/c.png`.
- The script check "palette has Hành động" was a false FAIL: the category text is upper-cased by CSS (HÀNH ĐỘNG), and the category is present.

## Files
- Modified:
  - `src/engine/types.ts`
  - `src/world/{world,physics,entity}.ts`
  - `src/nodes/index.ts`
  - `src/editor/palette.ts`
  - `src/style.css`
  - `src/render/scene-view.ts`
  - `src/io/samples.ts`
  - `src/tutorial/{lessons,text-vi}.ts`
- New:
  - `src/nodes/{item,carry,interact}.ts`
  - `src/render/item-shapes.ts`
  - `src/samples/key-door.json`
- Tests:
  - new: `tests/world/items.test.ts`
  - modified: `tests/nodes/{fake-world.ts,step-1-nodes.test.ts}`, `tests/io/samples.test.ts`, `tests/tutorial/lessons.test.ts`

## Notes / deviations
- Added the `carryable` item param (not in the design table) so a "lock" item can be interact-only.
- Pulse ports are `bool` (true for one tick).
- Thrown items stop dead on friction and do not bounce. Items that fall off the world fall forever (no cleanup) - harmless, same as characters.
- Item-item interaction is not modelled: items overlap freely and do not stack.
- The key-door sample's lock looks like a purple crate. A distinct lock shape or a text hint would be a nice follow-up, but is not required.

Status: DONE
Summary: carry/drop/throw/interact items, 3 nodes, a new "Hành động" palette category, item shapes, the `key-door` sample and tutorial lesson 4 are all in. The sample and lesson 4 were won in a real browser, and all 253 tests, tsc and build pass.
Concerns/Blockers: none blocking. Minor: the extra `carryable` param, and the lock being a plain crate.
