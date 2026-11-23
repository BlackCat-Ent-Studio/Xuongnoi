# "Đọc màu" upgrade: six colours + reads a wired object

Branch `feat/color-read` (worktree `D:\workspace\GameBuilder-color`), commit `c1553e3` on top of main `0e55578`. Not merged.

## What changed

| Gap | Now |
|---|---|
| Only read blocks | New optional input **"Vật cần đọc"** (`thing`, EN "Object to read"): while it holds a visible object, the sensor reads that object's colour, whatever its kind (Đồ vật, rigid crate, Vật thể, Nhân vật). Empty / hidden / gone -> sensor falls back to "Đối tượng" as before. |
| Only 3 colours | **Màu 1..6** (`color4..color6` advanced, defaults blue / purple / orange). "Màu cần tìm" accepts 1-6. Index stays 0 for unknown colour or nothing read. |
| Palette duplicated | One list `PALETTE_COLORS` in new `src/nodes/color-palette.ts`, used by both the sensor and the spawner class colours -> spawner class k reads as index k on defaults. |

Scan gate a learner can build: belt -> **Vùng kích hoạt** ("Tính những gì" = Đồ vật) -> "Đối tượng đầu tiên" -> **Đọc màu** "Vật cần đọc" -> "Chỉ số màu" -> Nhớ số / Bộ điều phối. "Khi đối tượng vào" of the same zone is the pulse for Nhớ số.

## Design choices

1. **No "Trong vùng" mode.** An existing piece already outputs the object inside a zone as an object value: Vùng kích hoạt -> "Đối tượng đầu tiên". A mode on the sensor would need the same number of cards (a zone box wired into "Đối tượng") and a second pick rule to learn, so I dropped it and rely on the input. Pick rule is therefore the zone's: first matching object in creation order (not nearest to centre). The zone never returns itself, the floor or blocks (filter is by kind), nor hidden / carried things.
2. **Old modes stay block-only.** "Dưới chân" / "Phía trước" are unchanged code paths (`probeAhead` cannot see items anyway). Zero risk to recorded hashes; new ability is only through the new input.
3. **"Đối tượng" is no longer marked required.** Either input is enough alone; keeping the mark would show a false "chưa nối" on a correctly built scan gate. Side effect: an unwired Đọc màu card no longer shows the missing-wire flag.
4. No file under `src/world/**` or `src/engine/**` touched.

## Files

- new `app/src/nodes/color-palette.ts`
- `app/src/nodes/color-sensor.ts`, `spawner.ts` (imports shared list only), `node-names.ts` (port name + EN)
- text: `app/src/handbook/content-input-logic.ts`, `boards-input-logic.ts`, `content-action-brain.ts`, `app/src/tutorial/lesson-bot-senses.ts`
- tests: new `app/tests/nodes/color-sensor-read-things.test.ts` (15 tests); `spawner-random-class.test.ts` (the test that pinned "3 colours" now pins 6; two titles reworded, assertions kept)
- level-07 and guide-script texts checked: still true, not edited.

## Tests

- `npx tsc --noEmit -p .`: clean.
- Focused set (nodes, handbook, tutorial, puzzle, solid-off-unchanged, real-physics-on-hash): **122 files / 2071 tests passed**, nothing re-recorded, no timeouts. Run before a final wording-only edit of the card description; the 5 files touching the sensor were re-run after it (151 passed). Whole suite not run.
- New tests cover: 6-class spawner, index == "Loại vừa sinh" for all 6 classes, plain world and real physics (rigid crates confirmed via `isRigidCrate`), by name and through a zone; spawned Vật thể; named object of each kind; hidden / missing / unwired -> 0; unknown colour -> 0; "Đúng màu" for want 1-6; zone gate with two crates in a real runtime graph; old 3-colour settings give the old outputs.

## Screenshots

`D:\workspace\GameBuilder\plans\reports\shots-color-read\` (5 shots, checked: card, settings with Nâng cao open, handbook page; nothing clipped, no console errors). Dev server on 5181 stopped.

## Limits / to decide

1. **Narrow old-board difference (not bit-identical in one case):** a card saved before the upgrade takes the defaults for Màu 4-6, so a block coloured exactly `#3b82f6`, `#a855f7` or `#f97316` that used to read 0 now reads 4, 5 or 6. "Đúng màu" cannot change (old "Màu cần tìm" is at most 3); level 7 is unaffected (its blue is Màu 2, lowest number wins); both hash tests pass. Strict alternative: `legacyDefault: ''` on `color4..6` — but then old cards show blank Màu 4-6 and any sample written with partial params silently knows only 3 colours. I chose defaults; one-line switch if strictness is preferred.
2. Two crates in the zone: reads the older one, not the nearest to centre. For one-at-a-time reading make the zone narrow or use "Tâm vật vào trong".
3. Vùng kích hoạt has no filter for Vật thể, so a spawned *block* cannot go through the zone gate; it can be read via "Đối tượng mới nhất" -> "Vật cần đọc". Items / crates (what a belt carries) work.
4. The card is one row taller on every board (new port). Card description in the settings panel is longer than before.
5. No sample or lesson uses the new input yet.
