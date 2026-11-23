# Puzzle levels 1-4 report

Branch feat/puzzle-levels-a. Files: level-01..04.ts, tests/puzzle/levels-1-4.test.ts. vitest tests/puzzle: 51 pass; tsc clean.

| # | solution | par | tested variants |
|---|---|---|---|
| 1 bot-dau-tien | go-to; wires Bot->Bot, Cờ->Đích, Đi ngang->Bot.moveX (3 wires, not 1-2: character needs moveX wired by player) | 1 | no answer; each wire removed; piece removed |
| 2 cua-kho | touch(bot,button) -> latch.set; latch.on -> locked "Hoặc".a (feeds door hide) | 2 | empty; each wire/piece removed; touch straight to door (no latch) = bot stuck |
| 3 nhat-sao | locked star touches give "Vừa chạm"; 2x Hoặc -> counter.up; counter.value + const -> compare(eq) -> gate | 5 | empty; each wire/piece removed; const 5(default),0,1,2,4 all fail, only 3 wins |
| 4 hai-nut-mot-cua | touch(botA,btnA), touch(botB,btnB) -> Và -> door.hide | 3 | empty; each wire/piece removed; And with one input only |

Generic per level: win before timeLimit, empty no win, tray kinds within counts, wires use shown ports, no key/stick, base cards do not overlap/in 1000x560.

## Engine limits / design notes
- Block "Ẩn đi" is edge-triggered and never re-shows by itself, so a plain touch -> hide already keeps a door open (latch would be pointless). Levels 2 and 3 add a locked "Hoặc"+"Không" pair (ids door-in/door-back, gate-in/gate-back): door.hide = or.out, door.show = not(or.out). Player wires into the Hoặc "A" port (shown) instead of the door itself. Makes the door follow its signal, so latch is truly needed in L2 and exact value 3 needed in L3 (eq).
- Level 3 stars are pickup blocks (not item nodes); stars/touches locked in base (stars vanish alone). Tray has Hoặc x2 (counter has one up input), const (editable value, tray default 5). Compare is "bằng"; the const piece is the editable param. Player-visible deviation: "touch sensors" are not in L3 tray.
- route-follow lookAhead set 0 in L3: probeAhead counts a long closed gate as in front on diagonals and froze the cat.
- Level 4: AND cannot be forced by physics (solo wire is always a superset). Wiring touchA alone or touchB alone to the door also wins (bot B waits against door on pad B; A arrives and stays on pad A). Not tested as a failure. Fix would need a lose-penalty rule.
- L1/L4 pre-wire go-to jump etc. in base; L2/L3/L4 base has locked go-to/route-follow so no player brain piece except L1.
- Locked nodes with no player ports use shownPorts {in:[],out:[]}; they still have pre-wired base wires.
- Looks cat-chibi/robot-wheel/robot-legs used by string via PUZZLE_LOOKS.
