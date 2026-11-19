machine: 16 logical CPUs, 11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz; node v24.15.0; before: 5 node.exe alive (414 MB together)

| copies | switch | cards | wires | entities / crates at 60 s | compile ms (best of 5) | compile + create ms | per tick ms: mean | p50 | p95 | p99 | max | of which cards (mean) | world step (mean) | share of a 16.7 ms frame (mean / p95) | 60 s simulated in (s) | crates delivered per copy | laps per copy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Vật lý thật on | 81 | 116 | 37 / 3 | 0.466 | 1.13 | 0.936 | 0.898 | 1.319 | 1.463 | 2.84 | 0.543 | 0.394 | 5.6 % / 7.9 % | 3.37 | 2 | 2 |
| 4 | Vật lý thật on | 324 | 464 | 148 / 12 | 6.548 | 7.96 | 6.296 | 6.096 | 10.101 | 12.144 | 15.18 | 3.451 | 2.845 | 37.8 % / 60.6 % | 22.67 | 2 2 2 2 | 2 2 2 2 |
| 8 | Vật lý thật on | 648 | 928 | 296 / 24 | 27.803 | 30.05 | 21.186 | 21.169 | 33.519 | 41.418 | 53.98 | 10.794 | 10.392 | 127.1 % / 201.1 % | 76.27 | 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 |
| 8 | Vật lý thật on | 648 | 928 | 296 / 24 | 27.725 | 29.51 | 21.365 | 21.146 | 34.591 | 43.325 | 58.72 | 10.911 | 10.453 | 128.2 % / 207.5 % | 76.92 | 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 |
| 16 | Vật lý thật on | 1296 | 1856 | 592 / 48 | 110.668 | 118.83 | 103.531 | 91.953 | 213.090 | 268.326 | 325.70 | 48.318 | 55.213 | 621.2 % / 1278.5 % | 372.72 | 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 |
| 8 | off (crates by the old rules: not the same machine, cost reference only) | 648 | 928 | 208 / 24 | 24.559 | 26.11 | 8.154 | 7.882 | 10.447 | 13.214 | 18.50 | 6.366 | 1.788 | 48.9 % / 62.7 % | 29.36 | 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 |

after: 5 node.exe alive (666 MB together)
slowest ticks of the first 8x run: tick 3593 (59.88 s): 53.98 ms; tick 2050 (34.17 s): 50.51 ms; tick 3571 (59.52 s): 49.40 ms; tick 2048 (34.13 s): 49.02 ms; tick 2113 (35.22 s): 48.68 ms
8x without the first 10 s: mean 21.900 / p95 35.779 / max 53.98 ms
