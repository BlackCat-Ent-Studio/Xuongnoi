# Tool target selection fix

Root cause: `useTarget` (app/src/world/world.ts) ranked candidates by `fwd - fwdHalf`, the target box's projection on the facing axis. With diagonal facing a wide/long wall has a huge `fwdHalf`, so its "gap" was 0 even though its surface was farther (Euclidean) than a small item in front.

Fix: same candidate filter (swing box, behind rejection, vertical overlap), then rank by Euclidean distance from the character centre to the box's closest ground-plane point; reject if dist > reach or the closest point is behind (dot with facing < 0). Ties (1e-9) -> smaller centre-forward, then spawn order (deterministic).

Tests: app/tests/world/tool-target.test.ts (18): 2d-top (1,1),(-1,1); 3d (1,1),(-1,-1); 2d-side +x/-x. Each: close item beats wide wall; nothing behind hit; equal-distance tie = first spawned. Wide-wall test fails pre-fix in 2d-top and 3d (4 cases), passes post-fix; 2d-side passed already (axis facing, no diagonal bias).
Gates: vitest 885/885, tsc clean, build ok. Commit on fix/tool-target, not merged. CRLF kept.

Status: DONE
Summary: Swing target now chosen by nearest box surface in front; regression tests added.
Concerns: Reach is still measured from character centre (unchanged). Created a dependency-folder junction in app/ (untracked/ignored).
