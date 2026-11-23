# Brainstorm — Hand-held tools (Đồ cầm tay)

- Date: 2026-10-28 23:04 · Status: APPROVED ("1a, 2a, 3a")
- Builds on: `brainstorm-261028-2200-carry-interact-items-report.md` (above-head carry KEPT unchanged — user explicitly likes it)

## Decision
Add a second, independent holding slot: tool in hand, used on things in front.

## Changes
1. **Đồ vật (item)** — new param `holdStyle` "Cách cầm": `head` "Khiêng trên đầu" (default; old boards unchanged) / `hand` "Cầm trên tay". New shapes: kiếm, cuốc, búa, đuốc, gậy phép, xô nước (keep existing 4). New outputs (append only): `inHand:bool` "Đang ở trên tay", `usedOn:pulse(bool 1 tick)` "Vừa bị dùng lên".
2. **Khối (block)** — new output (append only): `usedOn` "Vừa bị dùng lên".
3. **New node ✊ Cầm tay (`hand-tool`)**, category Hành động — inputs: character:object, toggle:bool edge "Cầm/Cất", use:bool edge "Dùng"; outputs: holding:bool "Đang cầm tay", tool:object "Món trên tay", used:pulse "Vừa dùng", hit:object "Trúng". Param reach (default 1.3).
   - Cầm/Cất: if empty hand → pick nearest free `hand` item within reach; else drop tool in front (same drop placement rules).
   - Dùng: swing animation (~0.3 s, cooldown same); target = nearest visible block/item/other character in front within reach (not the tool itself, not the above-head item); target gets `usedOn` pulse next tick; `hit` output = target id for that tick (null otherwise). Using with empty hand still swings (punch) — `used` fires, `tool` null.
   - Hand slot independent of above-head carry slot (Cầm / Thả node only grabs `head` items; Cầm tay only grabs `hand` items).
4. **World**: hand slot per character, tool follows hand anchor; hide releases; deterministic; all 3 modes.
5. **Render**: tool in hand for all 6 looks (human/robot hand; cat/dino mouth; chick under wing; jelly stuck to side), swing animation per look; 6 tool shapes from boxes.

## Sample + tutorial
- Sample `pickaxe-rock` "Cuốc đá mở đường" (2d-side): kiếm + cuốc on ground, rock block blocks path; `rock.usedOn AND pickaxe.inHand → rock.hide`; goal → win. Original.
- Tutorial lesson 5 "Dụng cụ cầm tay".

## Out of scope
Durability, HP, hotbar/switching by number keys.

## Acceptance
Unit tests (equip nearest hand item, independence from head slot, use hits front target once per press, cooldown, wrong tool doesn't open in sample, drop, hide release, modes); sample scripted win + negative; lesson 5 completes in browser; lessons 1–4 + all old samples still pass; tsc/build clean.
