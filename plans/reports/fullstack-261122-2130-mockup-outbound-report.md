# Mock-up 3D: outbound side (cages, tugs, docks, trucks)

- Worktree `D:\workspace\GameBuilder-mockup`, branch `feat/mockup-outbound`, 7 commits on top of d290c76, head `1fc99fc`. Not merged. Nothing under `app/src/**` touched.
- Status: DONE_WITH_CONCERNS (see "Deviations to decide" and "Not verified").

## Files

| File (under `app/tests/showcase/`) | What |
|---|---|
| `factory-mockup-ground.ts` (new) | Ground-floor plan: lane graph, dock bays, empty-cage lane, waiting bays, route finder |
| `factory-mockup-figures.ts` (new) | Newly drawn figures (factory-kit): roll cage, tug, box truck, dock gate, hole light, hole cover |
| `factory-mockup-outbound.ts` (new) | Live outbound animation: cages, hole lock, tug fleet, trucks, counters, audit |
| `factory-mockup-building.ts` | Columns moved to cell corners, floor paint, wall with real door openings, sunken truck bays, signs |
| `factory-mockup.ts` | Layout A first, hole lock on the deck, cartons end in cages, cameras, counters, trial |
| `factory-mockup.html` / `.css` | Honesty text, outbound counters, route grid, "Cửa bến" camera, "Sàn trong suốt" switch |

Packed: `plans/previews/xuong-phan-loai-261119/artifact-outbound/xuong-3d.html` + `xuong-3d.js` (artifact form, 7 KB + 803 KB) and the local double-click copy `plans/previews/xuong-phan-loai-261119/xuong-3d.html` + `xuong-3d.js`. The pack scripts used (`bundle-mock.mjs`, `compose_artifact.py`, pointing at the worktree) are copied into `artifact-outbound/`.

## The outbound flow, as the user sees it

1. A sorting robot tips its carton into the hole of its route. The carton slides off the tray, falls through the hole and comes to rest on the pile in the cage below; it stays there (real carton figure, tape colour = route).
2. One carton before full: hole light goes amber (frame round the hole + beacon on the deck, ring under the deck) and a tug is called.
3. Cage full, or swap in progress: light red, a red-and-white cover slides over the hole. A robot carrying a carton for it waits beside the hole 4 s, then takes a lap and comes back.
4. The tug (low teal carrier that drives under a cage) arrives with an empty cage. If the cage is not full yet it waits at most 6 s, then swaps anyway.
5. Swap: sets the empty cage down in the lane, drives under the full one, pulls it out to the far side, goes back for the empty one, pushes it under the hole (light green, cover opens), leaves with the full one.
6. Tug drives the full cage along the painted one-way lanes to the dock door of that route and into the truck (truck bed level with the hall floor; trucks stand in sunken bays). Deepest places first.
7. Tug goes on to the "LỒNG RỖNG" lane, picks up the front empty cage, takes the next call or parks in a waiting bay with the cage on its back.
8. Truck with 4 cages: its rear door rolls shut, the dock door rolls up, it drives out; an empty truck backs in, dock door down, rear door up. Board over each door: "LỒNG n/4 · ĐÃ ĐI n XE", "XE ĐANG RỜI BẾN", "XE RỖNG ĐANG LÙI VÀO".

## Design choices

| Item | Choice | Why |
|---|---|---|
| Cage capacity | 6 cartons, all layouts | On A a cage is called about every 25 s; 8 was too slow to watch |
| Swap order | Empty cage first, same tug takes the full one | Hole locked only for the swap itself when the tug is on time. Measured lock on A: average 8.5 s, longest 19.6 s (includes waiting for a late tug) |
| Tug called at | capacity − 1 | Tug usually arrives around the time the cage fills |
| Routes → doors | One door per row of holes: A 9 routes → 3 doors (lỗ 1–3, 4–6, 7–9); B, C 15 → 3; D 35 → 5 | Sign reads "CỬA 1 · LỖ 1–3" |
| Truck size | 4 cages (2 × 2) | Compact truck, a departure roughly every 100 s on A |
| Tugs | A 3, B 5, C 6, D 10 | Sized from the trials; fewer left holes locked 50–140 s on C, D |
| Tug type | Under-ride carrier with latch pin, not a hitch-and-trailer | No trailer swing, cage never rotates, one cell per tug |
| Ground lanes | Same cell pitch as the deck, one-way, outer loop: docks → empty-cage lane → west side → under the holes → docks | Every leg of a tug's round is loaded; columns stand on cell corners so no lane has one |
| Empty cages | Roll in through a small door in the back wall onto a floor track; up to 6 queue there | See deviations |
| Start state | Cages part filled, trucks part loaded | First truck leaves within about 2 minutes |

## 900 s trial per layout (headless, `window.__mock.trial(id, 900)`, packed local copy from `file:///`)

| Layout | Fed + start stock = accounted | Sorted / min | Swaps | Cages shipped | Trucks out | Lock avg / max (s) | Longest robot stand (s) | Longest tug stand (s) | Overlaps |
|---|---|---|---|---|---|---|---|---|---|
| A gon | 207 + 67 = 274 | 13.1 | 35 | 36 | 9 | 8.5 / 19.6 | 4.9 | 6.3 | 0 |
| B vua | 266 + 78 = 344 | 16.7 | 45 | 48 | 12 | 7.9 / 20.0 | 15.7 | 11.4 | 0 |
| C haidau | 412 + 78 = 490 | 25.9 | 70 | 72 | 18 | 11.9 / 38.7 | 11.8 | 8.1 | 0 |
| D lon | 558 + 136 = 694 | 34.5 | 97 | 96 | 24 | 11.0 / 36.9 | 10.3 | 11.8 | 0 |

- Conservation asserted in the result (`conserved: true` on all four): fed + start stock = on belts + on robots + falling + in cages under holes + in cages on the move + in trucks + shipped. Example A: 9 + 1 + 1 + 20 + 5 + 38 + 200 = 274.
- `jam: false` on all four (no robot or tug standing > 30 s). "Overlaps" = cage/cage, tug/tug, robot/robot overlap checks every 4th step.
- Same numbers on the dev server. An earlier 3600 s run (before the last tuning) was also jam-free and conserved on all four.
- Draw cost, packed copy, shadows included: A 495 calls / 224k triangles; D 1460 calls / 575k triangles.
- `npx tsc --noEmit -p .` exit 0.
- Console: zero page errors and zero console errors in every run. On the dev server some runs logged aborted module requests; they appeared only on runs right after source edits (page reload). Packed copy: none, and no non-local request.

## Shots (`plans/reports/shots-mockup-outbound/`, all read)

| Shot | What I saw |
|---|---|
| `a-cam-all` | Deck, 3 trucks backed into doors with cages visible inside, LỒNG RỖNG door and queue, door boards readable, teal lanes east and south. Dock floor right behind the deck edge is hidden by the deck |
| `a-cam-station` | Arm placing a carton on a robot, belt, scan gate; trucks behind |
| `a-cam-hole` | Light frames and beacons round holes, one amber; route flags |
| `a-cam-ground` | Cages with cartons, tugs, light rings and "LỖ n" plates, "XE KÉO CHỜ" sign, lanes and bays |
| `a-cam-dock` | Three trucks, door signs and boards, bays, lanes; clear of the counters panel |
| `a-cam-top` | Plan view; trucks, lane loop, pocket bays. Top panels cover the cabs |
| `a-locked-hole-deck` | Hole 6: red frame and beacon, striped cover shut, loaded robot waiting beside it; panel shows 6 red |
| `a-locked-hole-below` | Red ring under hole 6, tug under an empty cage beside it. Foreground cages crowd the view |
| `a-locked-hole-overview` | Locked hole readable from the default camera |
| `a-tug-swap` | Tug carrying the full cage out from under the red ring |
| `a-tug-swap-through-deck` | See-through deck: locked hole, waiting robot, cages and tug below in one view |
| `a-overview-through-deck` | Whole plant with see-through deck: all 9 cages and lanes visible under the robots |
| `a-truck-loading` | Tug inside the truck setting down the 4th cage next to three others |
| `a-truck-loading-dock-cam` | Same from the dock camera |
| `a-truck-leaving` / `-close` | Rear door shut, dock door up, truck part through the door, board "XE ĐANG RỜI BẾN", empty sunken bay behind it |
| `a-truck-backing-in` | Empty truck reversing in through the open door, board "XE RỖNG ĐANG LÙI VÀO" |
| `vua-overview`, `haidau-overview`, `lon-overview` | B, C, D: docks, trucks, lanes, counters; D route grid 7 × 5 without hole numbers |
| `lon-dock`, `lon-ground` | D: 5 doors with trucks; 35 cages under the deck |
| `packed-local-overview`, `packed-local-dock-through-deck` | Packed copy opened from disk, same picture as the dev page |

## Deviations to decide (my choices, not the user's)

1. **Sorting rate raised.** A station now calls a second robot while the first is being loaded. A went 8.8 → 13.1 cartons/min (B 9.2 → 16.7, C 11.8 → 25.9, D 16.2 → 34.5). Without it a cage on A filled every ~40 s and the outbound side looked idle. This changes the already-seen deck behaviour.
2. **New button "Sàn trong suốt"** (deck becomes see-through, floor markers hidden). Added because from above the deck hides the cages and tugs. It is visible UI the user has not seen.
3. **Under-ride tug instead of hitch and trailer.** The brief suggested "with a hitch"; the latch pin on the tug's back is the hitch.
4. **Cages may ship with 5 of 6.** A tug waits at most 6 s for the last carton (A: 200 cartons in 36 cages). Waiting longer blocked the lane and, with all tugs waiting, could stall the floor.
5. **Empty cages come back through a wall door**, not by truck. The page says so. A closed loop (returning trucks bring empties) needs unloading through a full truck and was left out.

## Not shown / simplified

- No return trip for empty cages (see 5). No people, no forklifts moving.
- Truck wheels do not turn; trucks only drive straight in and out.
- Tugs turn on the spot at cell centres and stop to do it; a cage never rotates.
- The swap uses the lane cells on both sides of the cage for about 8 s; other tugs route round.
- Tug latch is a fixed pin, not animated. Tugs never charge.
- A robot at a locked hole waits 4 s then laps; it does not queue.
- From "Toàn cảnh" the strip of dock floor just behind the deck is hidden; use "Cửa bến" or "Sàn trong suốt".
- Cartons in cages cast no shadow (cost).

## Not verified

- Frame rate on a real GPU (only software GL here). D is heavy: 1460 draw calls.
- Phone / narrow layout was not shot; the counters panel is hidden under 720 px as before.
- The artifact was not published (coordinator's step).

## What the real game would need

| In the mock-up | Has no game piece because | Smallest general piece |
|---|---|---|
| Sorting floor above the cages | Game world is one level | A raised platform piece robots can drive on, with openings things fall through |
| Cage that fills and shows its fill | Chute swallows the parcel | A container piece: counts and holds what falls in, reports count / full on a wire |
| Hole lock (cover, light) | Chute is always open | A gate input on the chute: closed = refuses a drop and shows it; plus a status lamp piece (3 colours) |
| Robot waits or laps at a locked hole | AGV logic has no "destination busy" | A "may I deliver" signal the route logic can read, with a wait / detour rule |
| Carton coming to rest in a pile | Parcels are removed on arrival | Parcels that persist inside a container (physics or slotting) |
| Tug that picks up and sets down a cage | AGV carries on a tray only | A latch / hitch piece: attach to and release a movable object |
| Cage as a movable object | Scenery is static | A wheeled, carryable body |
| Second fleet on its own lanes | One fleet, one lane set | Lanes tagged per fleet; reservation of one cell per vehicle already exists in idea |
| Call a tug when nearly full | No job dispatch | A dispatcher piece: queue of requests → nearest free vehicle |
| Swap sequence | No scripted multi-step task | A task sequence block (go, latch, go, release …) |
| Empty-cage source | No spawner for bodies | A source piece for movable objects, with a queue |
| Truck that takes N cages and leaves | No vehicle that departs and returns | A sink piece with capacity that "departs" when full and resets; truck figure and drive in / out |
| Dock door and board | No doors, no live text | A door piece (open / shut on a signal) and a counter display piece |
| Route → door mapping | Not present | A lookup table piece (route number → door) |
| Sunken bay / level truck bed | Flat ground only | Either a ramp piece or accept trucks at floor level |
| Counters panel | Sample has its own counters | Wire the container, sink and gate counts to the existing counter display |

## Unresolved questions

1. Keep the raised sorting rate (deviation 1), or go back and accept a slower outbound rhythm?
2. Keep the "Sàn trong suốt" button?
3. Under-ride tug accepted, or does the user want a visible hitch and towed cage?
4. Should empty cages return by truck in the real sample (closed loop), or is a source door enough?
5. Ship cages only when completely full (tug waits, lanes may block), or keep the 6 s limit?
