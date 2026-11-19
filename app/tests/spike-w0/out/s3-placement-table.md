| node kind | param | param kind | class | note |
|---|---|---|---|---|
| ahead-sensor | mountSide .. lookAngle (3) | number | relative | sensor place / turn on the body |
| block | position | vec3 | world-position | where the body is created |
| block | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| block | beltDir | select | world-direction | select x / -x / z / -z: a world axis |
| block | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| camera | point | vec3 | world-position | absolute in mode "fixed"; an OFFSET from the target in mode "follow" |
| camera | view | select | other | camera pitch preset |
| cargo | loadType, unloadType | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |
| character | position | vec3 | world-position | where the body is created |
| character | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| go-to | targetPos | vec3 | world-position | absolute; ignored when input "target" is wired (go-to.ts:92) |
| item | position | vec3 | world-position | where the body is created |
| item | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| item | tag | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |
| item | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| joint | start .. max (3) | number | relative | joint angle against what it is mounted on |
| joint | mount | vec3 | relative | offset in the frame of what it is mounted on (along / up / sideways) |
| line-sensor | side, forward | number | relative | sensor place on the chassis |
| line-track | center | vec3 | world-position | x, z = middle of the preset shapes; y = floor height for every shape |
| line-track | length, breadth | number | relative | preset shape: length along world x, breadth along world z |
| line-track | p1 .. p16 (16) | vec3 | world-position | absolute x, z of a hand-drawn point (NOT relative to "Tâm") |
| linear-actuator | position | vec3 | world-position | absolute; ignored when input "base" is wired (linear-actuator.ts:226) |
| linear-actuator | direction | number | world-direction | degrees on the ground plane; relative to the mount frame when "base" is wired |
| linear-actuator | orient | select | world-direction | select ground / up / down (world vertical; unchanged by a move or a turn about the vertical) |
| linear-actuator | mount | vec3 | relative | offset in the frame of what it is mounted on (along / up / sideways) |
| motor | side, forward | number | relative | wheel place on the chassis |
| moving-platform | position, to | vec3 | world-position | end points A and B of the travel, both absolute |
| moving-platform | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| nearest-item | goods | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |
| patrol | pointA, pointB | vec3 | world-position | absolute patrol ends |
| portal | position | vec3 | world-position | where the body is created |
| portal | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| portal | pair | text | other | TEXT KEY: two portals with the same code are linked (world/teleport.ts:125); copies of a group would share the code |
| robot-body | position | vec3 | world-position | where the body is created |
| robot-body | heading | number | world-direction | degrees, 0 = +x, 90 = +z |
| robot-body | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| rotating-platform | position | vec3 | world-position | where the body is created |
| rotating-platform | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| route-follow | p1 .. p32 (32) | vec3 | world-position | absolute route point (fallback when "Lấy điểm từ vật" is on and the port is unwired) |
| spawner | position | vec3 | world-position | absolute; becomes an OFFSET from the object when input "at" is wired (spawner.ts:110-114) |
| spawner | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| teleport | position | vec3 | world-position | absolute; ignored when input "dest" is wired (teleport.ts:42) |
| vehicle | position | vec3 | world-position | where the body is created |
| vehicle | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| vision-sensor | angle | number | other | width of the view cone |
| zone | center | vec3 | world-position | absolute; becomes an OFFSET from the object when input "follow" is wired (zone-sensor.ts:146-156) |
| zone | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| zone | goods | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |

node kinds 71, params 423, by kind {"number":189,"vec3":85,"color":29,"select":95,"text":24,"key":1}, vec3 85, kinds without params 7: and angle-diff next-free-slot not on-start or ui-pick
classified params: {"relative":31,"world-position":66,"world-direction":4,"other":8}; of the 85 vec3 params: {"world-position":66,"relative":19}
node kinds with at least one world-position / world-direction param: 17 of 71: block, camera, character, go-to, item, line-track, linear-actuator, moving-platform, patrol, portal, robot-body, rotating-platform, route-follow, spawner, teleport, vehicle, zone
node kinds with no param that holds a place or direction: 54