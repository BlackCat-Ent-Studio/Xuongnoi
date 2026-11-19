### 1x, 20 s: cards 1.395 ms per tick, world step 1.011 ms per tick

| card kind | cards of it | ms per tick (all of them) | microseconds per card per tick | share of the card time |
|---|---|---|---|---|
| line-sensor | 3 | 0.541 | 180.3 | 43.7 % |
| gripper | 1 | 0.248 | 247.7 | 20.0 % |
| joint | 2 | 0.169 | 84.4 | 13.7 % |
| zone | 2 | 0.120 | 60.2 | 9.7 % |
| linear-actuator | 1 | 0.029 | 28.9 | 2.3 % |
| robot-body | 1 | 0.023 | 22.9 | 1.9 % |
| sequence | 1 | 0.011 | 10.6 | 0.9 % |
| motor | 2 | 0.011 | 5.3 | 0.8 % |
| pid | 1 | 0.010 | 9.6 | 0.8 % |
| block | 6 | 0.009 | 1.5 | 0.7 % |
| show-text | 4 | 0.009 | 2.2 | 0.7 % |
| spawner | 1 | 0.009 | 8.9 | 0.7 % |

### 8x, 20 s: cards 29.925 ms per tick, world step 25.386 ms per tick

| card kind | cards of it | ms per tick (all of them) | microseconds per card per tick | share of the card time |
|---|---|---|---|---|
| gripper | 8 | 9.698 | 1212.3 | 34.7 % |
| zone | 16 | 7.542 | 471.4 | 27.0 % |
| line-sensor | 24 | 4.809 | 200.4 | 17.2 % |
| joint | 16 | 4.433 | 277.1 | 15.9 % |
| linear-actuator | 8 | 0.443 | 55.4 | 1.6 % |
| robot-body | 8 | 0.113 | 14.2 | 0.4 % |
| spawner | 8 | 0.100 | 12.6 | 0.4 % |
| link | 16 | 0.090 | 5.6 | 0.3 % |
| block | 48 | 0.089 | 1.8 | 0.3 % |
| map-range | 72 | 0.082 | 1.1 | 0.3 % |
| motor | 16 | 0.080 | 5.0 | 0.3 % |
| show-text | 32 | 0.063 | 2.0 | 0.2 % |

### CPU profile, 8x, 20 s simulated: wall 51.98 s, sampled 52.24 s (line numbers are those of the code vitest ran, check them against the source)

| self time ms | share | function @ file:line |
|---|---|---|
| 7740 | 14.8 % | toView @ src/world/entity.ts:17 |
| 3565 | 6.8 % | viewOf @ src/world/world.ts:214 |
| 2594 | 5.0 % | hull @ src/world/footprint-2d.ts:15 |
| 2374 | 4.5 % | test @ src/world/oriented-box.ts:171 |
| 2315 | 4.4 % | segmentDistance @ src/world/line-track.ts:100 |
| 1958 | 3.7 % | tick @ src/engine/runtime.ts:72 |
| 1750 | 3.3 % | obbSeparation @ src/world/oriented-box.ts:168 |
| 1554 | 3.0 % | distanceToTrack @ src/world/line-track.ts:121 |
| 1201 | 2.3 % | orientedBox @ src/world/collider.ts:81 |
| 1163 | 2.2 % | isTurnedBody @ src/world/collider.ts:13 |
| 1137 | 2.2 % | (garbage collector) @ (native):0 |
| 1113 | 2.1 % | axesOf @ src/world/oriented-box.ts:49 |
| 1095 | 2.1 % | touching @ src/world/physics.ts:68 |
| 1008 | 1.9 % | moveBlock @ src/world/world.ts:893 |
| 980 | 1.9 % | obbOf @ src/world/oriented-box.ts:101 |
| 951 | 1.8 % | (anonymous) @ tests/spike-w0/s4-where-the-time-goes.test.ts:40 |
| 842 | 1.6 % | halfAlong @ src/world/oriented-box.ts:126 |
| 816 | 1.6 % | obbCorners @ src/world/oriented-box.ts:146 |
| 790 | 1.5 % | boxOverlap @ src/world/collider.ts:114 |
| 775 | 1.5 % | restsTurned @ src/world/material.ts:82 |
| 734 | 1.4 % | supportPoint @ src/world/weighing.ts:67 |
| 695 | 1.3 % | overlapOn @ src/world/physics.ts:50 |
| 682 | 1.3 % | step @ src/world/world.ts:1010 |
| 676 | 1.3 % | shapeOf @ src/world/weighing.ts:55 |
| 642 | 1.2 % | moveBlockTo @ src/world/platforms.ts:128 |

| inclusive time ms | share | function @ file:line (only functions in src/) |
|---|---|---|
| 28408 | 54.4 % | tick @ src/engine/runtime.ts:72 |
| 21151 | 40.5 % | step @ src/world/world.ts:1010 |
| 13222 | 25.3 % | stepPhysics @ src/world/physics.ts:358 |
| 11849 | 22.7 % | stepRobot @ src/world/physics.ts:296 |
| 11611 | 22.2 % | listEntities @ src/world/world.ts:1047 |
| 11577 | 22.2 % | viewOf @ src/world/world.ts:214 |
| 9430 | 18.1 % | massOn @ src/world/material.ts:108 |
| 9422 | 18.0 % | evaluate @ src/nodes/gripper.ts:438 |
| 9178 | 17.6 % | massOnShared @ src/world/material.ts:118 |
| 8812 | 16.9 % | holds @ src/world/material.ts:130 |
| 8002 | 15.3 % | toView @ src/world/entity.ts:17 |
| 7188 | 13.8 % | computeContacts @ src/world/world.ts:136 |
| 7071 | 13.5 % | touching @ src/world/physics.ts:68 |
| 6962 | 13.3 % | evaluate @ src/nodes/zone-sensor.ts:244 |
| 5152 | 9.9 % | moveFingers @ src/nodes/gripper.ts:141 |
| 4944 | 9.5 % | obbSeparation @ src/world/oriented-box.ts:168 |
| 4812 | 9.2 % | moveBlock @ src/world/world.ts:893 |
| 4599 | 8.8 % | evaluate @ src/nodes/line-sensor.ts:146 |
| 4581 | 8.8 % | (anonymous) @ src/nodes/arm-parts.ts:127 |
| 4496 | 8.6 % | evaluate @ src/nodes/joint.ts:214 |
| 4422 | 8.5 % | trackCoverage @ src/world/line-track.ts:176 |
| 4181 | 8.0 % | supportPoint @ src/world/weighing.ts:67 |
| 3940 | 7.5 % | (anonymous) @ src/world/line-track.ts:193 |
| 3926 | 7.5 % | onTrack @ src/world/line-track.ts:163 |
| 3870 | 7.4 % | distanceToTrack @ src/world/line-track.ts:121 |
| 3839 | 7.3 % | orientedBox @ src/world/collider.ts:81 |
| 3804 | 7.3 % | moveBlockTo @ src/world/platforms.ts:128 |
| 3349 | 6.4 % | boxOverlap @ src/world/collider.ts:114 |
| 3197 | 6.1 % | test @ src/world/oriented-box.ts:171 |
| 3154 | 6.0 % | boundsBox @ src/world/collider.ts:100 |
| 2966 | 5.7 % | stepAxis @ src/world/platforms.ts:88 |
| 2726 | 5.2 % | hull @ src/world/footprint-2d.ts:15 |
| 2678 | 5.1 % | rests @ src/world/material.ts:93 |
| 2662 | 5.1 % | (anonymous) @ src/world/platforms.ts:121 |
| 2596 | 5.0 % | resolveTurn @ src/world/arm-solid.ts:239 |
| 2412 | 4.6 % | sweepCubes @ src/world/arm-solid.ts:136 |
| 2403 | 4.6 % | planPush @ src/world/linear-actuator.ts:278 |
| 2392 | 4.6 % | overlap @ src/world/platforms.ts:25 |
| 2317 | 4.4 % | distanceToPath @ src/world/line-track.ts:108 |
| 2315 | 4.4 % | segmentDistance @ src/world/line-track.ts:100 |
