# Open AI node params (agent D)
Branch feat/open-aip. Commit: feat(nodes): expose chase and go-to tuning numbers as advanced params.
- Chase: advanced catchDistance (0.4), fleeReach (4), slowRadius (0.6).
- Go-to: advanced slowRadius (0.6). Arrival distance already exposed as "Dừng cách đích" (stopDistance), nothing added.
- steering.ts: SteerOptions.slowRadius (additive), SLOW_RADIUS exported.
- path-follower constants (GOAL_CELL/WALK_REACH/PLANE_REACH/LAND_REACH) NOT exposed: internal stepping.
- New params placed BEFORE pathfind (existing test requires pathfind last param).
- Tests: tests/nodes/brain-tuning-params.test.ts (4). Full suite 1032/1033 before reorder, the one fail was pathfind-last, fixed; nodes tests 280 pass, tsc clean, build OK.
