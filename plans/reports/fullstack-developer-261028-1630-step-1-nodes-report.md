# Step-1 nodes report

Files: `app/src/nodes/{util,key,stick,on-start,bool-gates,const,math,compare,counter,timer,character,block,touch,win-lose,show-number,index}.ts`; tests `app/tests/nodes/{fake-world,step-1-nodes.test}.ts`.

## Kinds (in -> out; params)
- key: - -> held, pressed (bool); key='Space'
- stick: - -> x, y (number); scheme arrows|wasd
- on-start: - -> fired
- and/or: a,b -> out; not: in -> out
- const: - -> value; value=1
- math: a,b -> out; op add|sub|mul|div
- compare: a,b -> out; op lt|le|eq|ne|ge|gt (default ge)
- counter: up,down,reset -> value, reached; start=0, target=5
- timer: run(default true), reset -> left, done; seconds=30
- character: moveX,moveY,jump -> self(object), onGround, x,y,z; position, speed, jumpPower, color
- block: hide -> self(object); position, size, color, type solid|pickup
- touch: a,b (object) -> touching, began
- win-lose: win,lose -> -; winMessage, loseMessage
- show-number: value -> -; label, corner

Categories: input(key, stick, on-start); logic(and, or, not, compare, touch); math(const, math, counter, timer); object(character, block); output(win-lose, show-number).
Exports: `registerAllNodes()` (idempotent via getNodeDef check), `NODE_CATEGORY_LABELS`, `STEP_1_NODES`.

## Results
- `npx vitest run tests/nodes`: 29/29 pass.
- `npx tsc --noEmit -p .`: no errors.

## Notes / contract observations (no changes required)
- timer treats missing `run` key as true as well as relying on PortDef default; works whether engine fills defaults or not.
- win-lose: if both win and lose true same tick, win wins (first endGame call wins anyway).
- Object-port values are EntityId strings; any non-string => null.
- Registry uses `any` in `NodeDef<any>`; `STEP_1_NODES` array has one commented `any` for erased state types.
