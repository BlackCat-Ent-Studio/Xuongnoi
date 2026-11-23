# Brainstorm — Carry / drop / throw / interact items

- Date: 2026-10-28 22:00 · Status: APPROVED ("1a, 2a, 3a")

## Decision
Approach A: 3 new nodes (not stuffing into Nhân vật). Include throw now. Include sample board + tutorial lesson 4.

## Nodes
| kind | vi label | inputs | outputs | params |
|---|---|---|---|---|
| item | Đồ vật | — | self:object, held:bool (Đang được cầm), interacted:pulse (Vừa được tương tác) | position, size (default 0.6³), color, shape select: hộp/chìa khoá/quả bóng/thùng |
| carry | Cầm / Thả | character:object, grab:bool(edge), drop:bool(edge), throw:bool(edge) | holding:bool, heldItem:object | mode select: "2 phím riêng" / "1 phím cầm-thả" (grab toggles); throwPower |
| interact | Tương tác | character:object, press:bool(edge) | fired:pulse, target:object | reach (default 1.5) |

## World rules
- New EntityKind 'item': dynamic — gravity (none in 2d-top), lands on solids, collides with solid blocks; not solid for characters (no blocking) — KISS.
- Grab: nearest visible free item within reach (~1.2 from character center, prefer in facing direction). One item per character. Held item: kinematic, positioned above head/in front, no gravity, follows facing; contacts still reported (so touch sensor works for "place onto zone").
- Drop: place in front of character at its feet level (not inside solids; fallback above), then falls.
- Throw: release with velocity = facing * throwPower + small up; item flies with gravity; lands/stops on solids (simple friction stop on ground).
- Interact: nearest item (or block?) within reach → that item's `interacted` pulse next tick; interact node outputs fired + target. Only items in step 1.
- Facing: world tracks character facing from last nonzero move intent (side ±X, top/3d XZ).
- Hidden items cannot be grabbed; hiding a held item releases it.

## Rendering
Item shapes from boxes (key, ball-ish, crate, plain box) using color; held item drawn above head/hands.

## Sample + tutorial
- Sample `key-door` (2d-side): key item, door solid block, Phím E → Cầm/Thả grab(toggle mode), Phím F → Tương tác; door.hide when interacted target... (door is a block → use touch: carried key touching door zone + F) — design so it works with step rules; goal → win.
- Tutorial lesson 4 "Cầm và dùng đồ" building the same thing, original text.

## Out of scope
Inventory/bag, pushable objects, item-item stacking physics beyond landing on solids, interacting with non-item blocks.

## Acceptance
Unit tests for grab/drop/throw/interact/held-follow/hide-release in all 3 modes; sample winnable via scripted input; lesson 4 completes in browser; existing 203 tests + tutorial lessons 1-3 still pass; tsc/build clean.
