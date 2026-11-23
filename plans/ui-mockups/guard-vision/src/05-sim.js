/* ================= pure simulation (no THREE): guard patrol, vision fan, cover-to-cover cat, win/lose. Shared by the page and sim-check.mjs ================= */
const GVSim = (() => {
  const DT = 1 / 60;
  const TIME_LIMIT = 60;
  const HERO_ACCEL = 28;       // ô/s^2 speeding up / braking at a cover
  const TURN_RATE = 5;         // rad/s the guard swings at each end (a slow, visible sweep)
  const LANE_Z0 = -4.1;        // guard lane starts here and runs towards the cat route
  const GUARD_X = 0.5;
  const HERO_START = { x: -9.8, z: 2.7 }, GOAL = { x: 9.8, z: 2.7 };
  const MARGIN = 0.5;          // spare seconds the cat wants on top of the dash time
  const DIST_THRESHOLD = 6;    // old answer: run when the guard is at least this far (ô)
  const COVER_BACK = 1.55;     // how far behind the crate (away from the lane) the cat hides
  const HORIZON = 12;          // how far ahead the cat can predict the guard (s)
  const LOOK_STEP = 1 / 30;
  const GRAZE = 0.02;
  const CRATE_SIZE = 1.7;
  const MID = { x: GUARD_X, z: LANE_Z0 + 1.6 };   // the cat hides on the far side of the crate seen from here

  const PRESETS = {
    A: [[-5.0, 1.0], [0.8, 1.0], [5.2, 0.2]],
    B: [[-5.6, 0.2], [0.9, 0.6], [4.4, 0.8]],
    C: [[-5.4, 0.4], [0.9, 0.7], [5.7, 0.4]],
  };

  const defaults = () => ({ patrolLen: 3.2, guardSpeed: 1.3, range: 10, angle: 90, heroSpeed: 3.4, preset: 'A' });
  const crateList = (P) => PRESETS[P.preset] || PRESETS.A;
  /* hiding spot of every crate: just behind it as seen from the middle of the guard lane */
  function coverSpots(crates) {
    return crates.map(([cx, cz]) => {
      const dx = cx - MID.x, dz = cz - MID.z, l = Math.hypot(dx, dz) || 1;
      return { x: cx + (dx / l) * COVER_BACK, z: cz + (dz / l) * COVER_BACK };
    });
  }
  const routeOf = (crates) => [HERO_START, ...coverSpots(crates), GOAL];

  const wrap = (a) => { let d = a % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const lookVec = (face) => ({ x: Math.sin(face), z: Math.cos(face) });

  function segHitsCrate(ax, az, bx, bz, c) {
    const half = Math.max(0, CRATE_SIZE / 2 - GRAZE);
    let t0 = 0, t1 = 1;
    for (const [a, b, lo, hi] of [[ax, bx, c[0] - half, c[0] + half], [az, bz, c[1] - half, c[1] + half]]) {
      const d = b - a;
      if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return false; continue; }
      let n = (lo - a) / d, f = (hi - a) / d; if (n > f) [n, f] = [f, n];
      t0 = Math.max(t0, n); t1 = Math.min(t1, f); if (t0 > t1) return false;
    }
    return true;
  }
  function rayCrate(ox, oz, dx, dz, c) {
    const half = CRATE_SIZE / 2;
    let t0 = 0, t1 = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, c[0] - half, c[0] + half], [oz, dz, c[1] - half, c[1] + half]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
      let n = (lo - o) / d, f = (hi - o) / d; if (n > f) [n, f] = [f, n];
      t0 = Math.max(t0, n); t1 = Math.min(t1, f); if (t0 > t1) return Infinity;
    }
    return t0;
  }

  /* real vision-sensor rule: range, cone angle, crates block the line */
  function sees(P, g, h, crates) {
    const dx = h.x - g.x, dz = h.z - g.z, dist = Math.hypot(dx, dz);
    if (dist > P.range) return false;
    const look = lookVec(g.face);
    const off = dist < 1e-6 ? 0 : Math.acos(Math.max(-1, Math.min(1, (dx * look.x + dz * look.z) / dist)));
    if (off > (P.angle / 2) * Math.PI / 180 + 1e-6) return false;
    for (const c of crates) if (segHitsCrate(g.x, g.z, h.x, h.z, c)) return false;
    return true;
  }
  function fanOutline(P, g, crates) {
    const n = Math.max(8, Math.min(72, Math.round(P.angle / 2.5)));
    const half = (P.angle / 2) * Math.PI / 180, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = g.face - half + (2 * half * i) / n, dx = Math.sin(a), dz = Math.cos(a);
      let r = P.range;
      if (dz < -1e-6) r = Math.min(r, (g.z + 4.85) / -dz);
      for (const c of crates) r = Math.min(r, rayCrate(g.x, g.z, dx, dz, c));
      pts.push({ x: g.x + dx * r, z: g.z + dz * r });
    }
    return pts;
  }

  /* one guard tick (patrol along the lane, wait + swing the head at each end) */
  function guardStep(P, g, dt) {
    const laneEnd = LANE_Z0 + P.patrolLen;
    if (g.wait > 0) { g.wait -= dt; g.walking = false; }
    else {
      g.walking = true; g.z += g.dir * P.guardSpeed * dt;
      const end = g.dir > 0 ? laneEnd : LANE_Z0;
      if ((g.dir > 0 && g.z >= end) || (g.dir < 0 && g.z <= end)) { g.z = end; g.dir = -g.dir; g.wait = 0.4; g.walking = false; }
    }
    const want = g.dir > 0 ? 0 : Math.PI, d = wrap(want - g.face), st = TURN_RATE * dt;
    g.face = Math.abs(d) <= st ? want : g.face + Math.sign(d || 1) * st;
  }
  const newGuard = (P) => ({ x: GUARD_X, z: LANE_Z0 + (P.startFrac ?? 0.5) * P.patrolLen, dir: 1, wait: 0, face: 0, walking: true });

  /* seconds until the guard's fan will cover any point of the open stretch a->b (simulating the guard forward) */
  function windowFor(P, g0, a, b, crates) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.ceil(len / 0.4));
    const pts = []; for (let i = 0; i <= n; i++) pts.push({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n });
    const g = { ...g0 };
    for (let t = 0; t <= HORIZON; t += LOOK_STEP) {
      for (const p of pts) if (sees(P, g, p, crates)) return t;
      guardStep(P, g, LOOK_STEP);
    }
    return Infinity;
  }

  function makeSim(P, mode) {
    const crates = crateList(P);
    const route = routeOf(crates);
    const s = { P, crates, route, mode: mode || null, t: 0, over: null };
    s.reset = (m) => {
      s.mode = m === undefined ? s.mode : m;
      s.t = 0; s.over = null; s.seen = false; s.idx = 1; s.dashing = false; s.arrivalDone = false;
      s.g = newGuard(P);
      s.h = { x: route[0].x, z: route[0].z, v: 0, dx: 1, dz: 0 };
      s.info = null; s.tick = 0; s.starts = 0; s.stopsInOpen = 0; s.stops = 0; s.waits = 0; s.chains = 0; s.dashes = 0; s.lastMoving = false;
      s.seen = sees(P, s.g, s.h, crates);
    };
    /* the cat's thinking for the stretch route[from] -> route[from+1]; `ahead` = distance still to run before it is at route[from] */
    s.think = (from, ahead) => {
      const a = route[from], b = route[from + 1];
      const gap = Math.hypot(b.x - a.x, b.z - a.z), need = (ahead + gap) / P.heroSpeed;
      const W = s.mode === 'correct' || s.mode === 'rash' ? windowFor(P, s.g, a, b, crates) : Infinity;
      let go = false, text = '';
      if (s.mode === 'correct') { go = W >= need + MARGIN; text = `Còn ${W === Infinity ? '∞' : W.toFixed(1)}s · Cần ${need.toFixed(1)}+${MARGIN}s`; }
      else if (s.mode === 'distance') { const d = Math.hypot(s.g.x - s.h.x, s.g.z - s.h.z); go = d >= DIST_THRESHOLD; text = `Lính cách ${d.toFixed(1)} ô (xa từ ${DIST_THRESHOLD} ô thì chạy)`; }
      else if (s.mode === 'rash') { go = W > 0; text = go ? 'Lính chưa nhìn đoạn kế lúc này' : 'Lính đang nhìn đoạn kế'; }
      else text = 'Chưa nối gì: đứng yên';
      s.info = { W, need, go, text, mode: s.mode, gap };
      return go;
    };
    s.step = (dt = DT) => {
      if (s.over) return;
      s.t += dt; s.tick++;
      const g = s.g, h = s.h;
      guardStep(P, g, dt);
      const T = route[s.idx];
      if (!s.dashing && s.mode && (s.tick % 3 === 0 || !s.info)) {
        if (s.think(s.idx - 1, 0)) { s.dashing = true; s.arrivalDone = false; s.dashes++; }
        else s.waits += s.lastDecisionWait ? 0 : 1, s.lastDecisionWait = true;
      }
      if (s.dashing) {
        s.lastDecisionWait = false;
        let dist = Math.hypot(T.x - h.x, T.z - h.z);
        if (!s.arrivalDone && dist <= 0.5) {                      // last half ô before the cover: decide chain or hide, for good
          s.arrivalDone = true;
          s.chain = s.idx < route.length - 1 && s.think(s.idx, dist);
          if (s.idx >= route.length - 1) s.chain = false;
        }
        const slow = s.arrivalDone && !s.chain;
        const vT = slow ? Math.min(P.heroSpeed, Math.sqrt(2 * HERO_ACCEL * Math.max(0, dist - 0.01)) * 0.9) : P.heroSpeed;
        h.v += Math.max(-HERO_ACCEL * dt, Math.min(HERO_ACCEL * dt, vT - h.v));
        const ux = (T.x - h.x) / (dist || 1), uz = (T.z - h.z) / (dist || 1);
        if (dist > 1e-6) { h.dx = ux; h.dz = uz; }
        const step = h.v * dt;
        if (step >= dist || dist < 0.02) {                         // reached the cover
          h.x = T.x; h.z = T.z; s.idx++; s.arrivalDone = false;
          if (s.idx >= route.length) { h.v = 0; s.finished = true; }
          else if (!s.chain) { h.v = 0; s.dashing = false; s.info = null; }
          else s.chains++;
        } else { h.x += ux * step; h.z += uz * step; }
      }
      // jitter bookkeeping: count stops in the open and go/stop toggles
      const moving = h.v > 0.05;
      if (moving && !s.lastMoving) s.starts++;
      if (!moving && s.lastMoving) { s.stops++; const atCover = route.some((r) => Math.hypot(r.x - h.x, r.z - h.z) < 0.1); if (!atCover) s.stopsInOpen++; }
      s.lastMoving = moving;
      s.moving = moving;
      s.seen = sees(P, g, h, crates);
      if (!s.mode) return;
      if (s.seen) s.over = { win: false, t: s.t, reason: 'Lính gác thấy mèo nhỏ ngoài chỗ nấp!' };
      else if (s.finished) s.over = { win: true, t: s.t, reason: 'Mèo nhỏ tới đích an toàn!' };
      else if (s.t >= TIME_LIMIT) s.over = { win: false, t: s.t, reason: s.mode === 'none' ? 'Hết giờ: mèo nhỏ không dám rời chỗ nấp.' : 'Hết giờ rồi, mèo nhỏ chưa tới đích.' };
    };
    s.reset();
    return s;
  }

  function run(P, mode) {
    const s = makeSim(P, mode); s.reset(mode);
    let maxV = 0;
    while (!s.over) { s.step(); maxV = Math.max(maxV, s.h.v); }
    return { win: s.over.win, t: +s.over.t.toFixed(2), reason: s.over.reason, x: +s.h.x.toFixed(1), idx: s.idx, dashes: s.dashes, chains: s.chains, starts: s.starts, stops: s.stops, stopsInOpen: s.stopsInOpen, waitEvents: s.waits };
  }
  function runAll(P) { return { correct: run(P, 'correct'), distance: run(P, 'distance'), rash: run(P, 'rash'), none: run(P, 'none') }; }

  /* is a hiding spot out of sight for every guard position and facing (pure line of sight)? */
  function coverHidden(P, crates, spot) {
    for (let z = LANE_Z0; z <= LANE_Z0 + P.patrolLen + 1e-6; z += 0.1) {
      const g = { x: GUARD_X, z, face: Math.atan2(spot.x - GUARD_X, spot.z - z) };
      if (sees({ ...P, range: 99, angle: 360 }, g, spot, crates)) return false;
    }
    return true;
  }

  return { DT, TIME_LIMIT, MARGIN, LANE_Z0, GUARD_X, HERO_START, GOAL, CRATE_SIZE, DIST_THRESHOLD, PRESETS, defaults, crateList, coverSpots, routeOf, sees, fanOutline, windowFor, guardStep, makeSim, run, runAll, coverHidden };
})();
