# Audit: hidden logic in the 7 Xưởng Bot levels (2026-11-04 14:15)

Read-only audit of main 09aca5d. Each item below was checked with a headless `runLevel` run on an in-memory mutated copy of the level, unless it says otherwise.
Script: `C:\Users\trong\AppData\Local\Temp\claude\a12094c0c35d488c\28f1b49e-f9c2-4636-800e-2111225b7830\scratchpad\audit.test.ts`. Raw output: `...\scratchpad\out.txt`. Run it with `npx vitest run --config <scratchpad>\vc.mjs`.

The script ran these checks on every level:
- each reference wire removed on its own;
- each reference piece removed on its own;
- each story object removed;
- targeted mutations: objects moved or recoloured, and hidden wires cut.

## Summary

| Lvl | Verdict | Finding (short) |
|---|---|---|
| L1 Bot đầu tiên | OK | Only win plumbing is hidden. Moving the flag still wins, because the wired "Đi tới" follows it. |
| L2 Cửa kho | OK | The button and the latch are both needed. Removing the button gives a timeout. |
| L3 Nhặt sao | **VIOLATION ×3** (already known) | The route has the star coordinates preset. The stars hide through hidden touch cards. The counter counts route points, so removing or moving every star still wins. |
| L4 Hai nút một cửa | OK | Hidden AND = win plumbing. Moving button 2 still wins. |
| L5 Đủ ba thùng | OK (1 minor GREY) | Moving the crates still wins. One reference wire is redundant. |
| L6 Lẻn qua mắt lính gác | **VIOLATION (b), (e)** + GREY | The cover spots are preset in the route piece. Moving the crates gives a timeout. 2 of the 3 cover crates can be removed and the level still wins. |
| L7 Phân loại thùng màu | **VIOLATION (b), (c)** + GREY | The robot reads the colour of the hidden floor PAD, not the crate: swapping the crate colours makes the robot carry red crates and lose. The pad coordinates are preset in the route. |

Baselines (reference solution): L1 win 4.28s · L2 win 4.78s · L3 win 4.53s · L4 win 7.10s · L5 win 27.48s · L6 win 11.63s · L7 win 18.45s. With an empty answer, every level times out.

## Details

### L1, L2, L4: OK
- Hidden: the `touch` that leads to `win-lose`, and the ground. In L4 there is also the `and` "A at the flag AND B on button 2". All of this is win plumbing, which rule 3 allows.
- Generality check (each still wins):
  - L1 flag moved to x=4: win 3.03s.
  - L2 button moved to x=-8: win 4.78s.
  - L4 button-b moved to x=7: win 6.73s.
- Ablation: no reference wire or piece can be dropped. Removing the button, flag or bot always times out.
- Removing the door wins (L2 4.78s, L4 7.10s), but that is expected: the door is an obstacle. The latch and OR still decide when it opens.
- No preset positions in the tray and no actions without a wire.

### L3 Nhặt sao: VIOLATION (known, brief)
- **(b)** `level-03.ts:26-34, 100`: the tray piece "Chạy theo tuyến" comes with p1..p3 set to the star x positions and p4 set to the flag.
  - The stars do have a usable output (`self`), but route-follow has no object input for its points. Wiring them instead needs an engine change.
- **(a)** `level-03.ts:22, 78`: the hidden `touch-star-*` cards hide each star when the cat touches it. The player never wires the pick-up.
- **(c)** `level-03.ts:119`: the counter counts `reached` of the route. Evidence:
  - all 3 stars removed: **win 4.53s**;
  - stars lifted to y=6, out of reach: **win 4.53s**;
  - stars shifted +1.5 x off the route: **win 4.53s**;
  - the hidden hide wires cut: **win 4.53s**.
- **(e)** As a result, each star is pure decoration.
- Fix: another agent is rebuilding this level in `GameBuilder-l3stars`, so it is not covered here.

### L5 Đủ ba thùng: OK
- Crates moved to new spots ((-3,5), (2,-5), (-11,-2)): **win 22.30s**. "Tìm vật gần nhất" finds the crates itself, so nothing about their position is hard-coded.
- The crates are scenery (no card). That is acceptable because the general "Tìm vật gần nhất" scans the floor, but it is GREY by rule 3: the main story object is not on the board.
- GREY minor: reference wire `sw4` (slot-3 into "Bỏ qua đồ trên ô 3", `level-05.ts:117`) is not needed (still wins 27.48s).
  - The game ends the moment slot 3 is filled, so that skip never matters.
  - Impact: none. Par counts pieces, not wires.
- `store-pad` removed: still wins. It is only a floor mark, which is OK.
- GO_TO_PARAMS presets stopDistance and settle. These are tuning values, not positions: OK.

### L6 Lẻn qua mắt lính gác: VIOLATION
- **(b)** `level-06.ts:34-47, 66-80, 147`: the tray route comes preset with the start, the 3 cover spots and the goal.
  - The crates are scenery with no card, so there is nothing the player could wire. Route-follow also has no object inputs.
  - Evidence: crates moved to z=-5 with the route left unchanged gives **timeout 60s**. The cat still runs to the old "cover" spots, and the forecast never says it is safe.
  - The player never decides where to hide, but the task says "nấp sau từng thùng".
- **(e)** Removing crate-1 gives **win 11.63s**, and removing crate-3 gives **win 11.63s**. Only crate-2 matters (removing it gives lose 5.33s).
  - So 2 of the 3 cover crates are decoration for the win. The guard never looks at spots 1 or 3 in a way that matters.
- GREY (accepted earlier, open item 6): the guard's patrol `patrol` (`:100`) is a locked visible card with preset end points. It is the enemy's brain, so it is legal under rule 1. It is still waiting for the user's answer.
- GREY: "Dự đoán tầm nhìn" reads the range and angle of the HIDDEN `eyes` vision sensor (`:101`) through a side note (`sight-notes.ts`). That is sensible, since the player wires "Người nhìn" = guard. But a hidden lose-plumbing node feeds the player's piece.
  - Removing `eyes` gives win 6.47s, because there is no loss and the forecast says safe.
- Logic check: route + "Chạy" always on (no forecast) gives **lose 5.33s**, so the forecast is really needed: OK.
- Fix options:
  - **6a** (no engine change): re-layout with the existing `stealthBase(layout)` search so each crate is needed. Pass condition: removing any crate gives a lose. Pieces and par are unchanged.
  - **6b** (general engine change): route-follow gets object point inputs ("Điểm từ vật", plus an advanced "nấp sau so với…" offset, default off). Show the crates as cards and let the player wire them. Wires and par go up by 3-5. Needs a handbook entry. Old boards stay identical.
  - **6c**: keep the preset route and change the task text to say the route is already drawn. This needs the user's decision.

### L7 Phân loại thùng màu: VIOLATION
- **(c)** `level-07.ts:132, 168` with `color-sensor.ts:13-29` (`blockUnder` only looks at `kind === 'block'`): "Đọc màu" reads the hidden coloured PAD under the robot's feet, never the crate (crates are `item`). The task says "Chỉ được khiêng thùng XANH".
  - Evidence: crate colours and tags swapped, pads unchanged: **lose 4.08s** ("Có thùng đỏ lẫn vào kho rồi!"). The robot trusts the pad and carries red crates.
  - Pads made grey (crates still coloured): **timeout 60s**.
  - All pads removed: **timeout 60s**.
  - The pads are scenery with no card, and the task text never mentions them.
- **(b)** `level-07.ts:43-51, 131`: the tray route has the 6 pad x positions preset.
  - Evidence: pads and crates shifted +1.5 x: **timeout 60s**.
  - Pads and crates have no card or output to wire, and the route has no object input anyway.
- GREY `:132`: the "Đọc màu" tray piece is preset with color1=RED and color2=BLUE, matching the hidden pads. The default palette would not match. The player only edits `want`.
- GREY `:140`: "So sánh" is preset to `gt` and is not editable. The player cannot choose the comparison type: it is a forced setting, not logic.
- (e) Red crates and red pads are decoys, so removing them still wins (expected). Blue pads and blue crates are each needed.
- Fix options:
  - **7a** (general engine change): "Đọc màu" gets a mode `where: 'beside'` (or 'ahead' also counting items) that reads the item within hand reach. Rule-4 style: default off and documented. Rewire `match` the same way. Pieces and par are unchanged.
  - **7b** (no engine change): rewrite the task and hint so the robot reads the colour of the tile, and show the pads as cards. Weaker, because the crate colour is still not checked.
  - **7c**: route positions as in 6b (object point inputs), or "Tìm vật gần nhất" with "Chỉ tìm loại hàng = xanh" (already general). 7c removes the route and colour reading altogether, so it would be a new level design.

### (d) Actions without a wire (all levels)
- None found in the 7 levels. Route lookAhead is set to 0 in L3, L6 and L7. Go-to pathfind is off in L5 and L7.
- The hidden `on-start → camera` in L5 and L7 only turns the camera on, which is not a bot action.
- Auto-turn toward the grabbed crate counts as a consequence of a wired action (already accepted).
- `storeSlots` level data is not read by any runtime code. It is informational only.

## Unresolved questions
1. L6: should the cover spots stay preset (6c, with the text changed), become a layout where every crate counts (6a), or come from wires (6b, engine change)?
2. L7: is reading the pad colour acceptable as the "Đọc màu" story, if the text and cards say so (7b)? Or should the sensor read the crate itself (7a, engine change, rule-4 general piece)?
3. Preset route points (L3, L6, L7) are one shared class of problem. Does the user want one general fix ("route points from objects", 6b/7c) applied to all three, or a fix level by level?
4. L5/L7 crates and L7 pads are scenery (no card). Rule 3 says the board shows "characters + objects". Should the story objects get read-only cards even when no port is used?
