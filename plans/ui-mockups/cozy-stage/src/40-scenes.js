/* ================= scenes (each = sim + visuals, deterministic from reset + fixed steps) ================= */
function baseScene() {
  const three = new THREE.Scene();
  three.add(new THREE.HemisphereLight(0xfff3dc, 0xa7753f, 1.7));
  const k = new THREE.DirectionalLight(0xffe2b8, 1.6); k.position.set(-4, 9, 8); three.add(k);
  return three;
}
function headingYaw(dx, dz) {
  const sx = dx >= 0 ? 1 : -1;
  if (Math.abs(dx) >= Math.abs(dz) * 1.2) return sx * 0.95;
  return dz >= 0 ? sx * 0.25 : Math.PI - sx * 0.25;
}
function moveToward(a, tx, tz, speed, dt) {
  const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
  if (d < 0.03) return true;
  const st = Math.min(d, speed * dt);
  a.x += dx / d * st; a.z += dz / d * st; a.yawT = headingYaw(dx, dz);
  return d - st < 0.03;
}
function trayHost(parent, opts) {
  const h = new THREE.Group(); parent.add(h); let style = 'plank';
  const rebuild = () => { while (h.children.length) { const c = h.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } h.add(makeTray({ ...opts, style }).g); };
  rebuild();
  return { setStyle(s) { if (s !== style) { style = s; rebuild(); } } };
}
const SCENES = [];

/* ---------- Màn 2: Cửa kho (2D cạnh) ---------- */
SCENES.push({ id: 'l2', label: 'Màn 2 · Cửa kho', build() {
  const three = baseScene(), root = new THREE.Group(); three.add(root);
  root.add(makeBackWall().g, makeSideFloor().g);
  const win = makeWindow(); at(win.g, -9, 4.3, -1.45); root.add(win.g);
  const shelf = makeShelf(); at(shelf.g, -0.8, 3.7, -1.55); root.add(shelf.g);
  const lampA = makeLamp({ len: 3.3 }); at(lampA.g, -3.8, 8.2, -0.5); root.add(lampA.g);
  const lampB = makeLamp({ len: 3.3 }); at(lampB.g, 8.3, 8.2, -0.5); root.add(lampB.g);
  const btn = makeButton(); at(btn.g, -5, 0, 0.35); root.add(btn.g);
  const door = makeDoor(); at(door.g, 3, 0, 0.45); root.add(door.g);
  const flag = makeFlag(); at(flag.g, 10, 0, 0.3); root.add(flag.g);
  const bot = makeActor('legs'); root.add(bot.g, bot.shadow);
  let T, doorOpen, btnV, latch, won, hold;
  const rt = {
    id: 'l2', mode: 'side', three, x0: -15, x1: 15, viewH: 8, floorFrac: 0.68, pitch: 0.2, actors: [bot], focus: () => bot,
    title: 'Màn 2 · Cửa kho: bot dẫm nút đỏ, cửa gỗ trượt xuống sàn, bot đi tới cờ.',
    reset() { T = 0; doorOpen = 0; btnV = 0; latch = false; won = false; hold = 0; bot.place(-10, 0.35); bot.state = 'idle'; bot.speed = 0; bot.yawT = 0.5; bot.snap(); },
    step(dt) {
      T += dt; const V = 3.4;
      if (!won) {
        let move = T > 0.9;
        let nx = bot.x + V * dt;
        if (doorOpen < 0.92 && nx > 3 - 1.6) move = false;
        if (move) { bot.x = nx; bot.yawT = 1.05; }
        bot.state = move ? 'walk' : 'idle'; bot.speed = move ? V : 0;
        if (bot.x >= 9.3) { won = true; bot.state = 'happy'; bot.speed = 0; bot.yawT = 0.25; }
      } else { hold += dt; if (hold > 2.8) { rt.reset(); return; } }
      const on = Math.abs(bot.x + 5) < 0.75;
      if (on) latch = true;
      btnV += ((on ? 1 : 0) - btnV) * (1 - Math.exp(-dt * 14));
      if (latch) doorOpen = clamp(doorOpen + dt / 0.8, 0, 1);
      bot.y = 0.2 * Math.max(0, 1 - ((bot.x + 5) / 0.8) ** 2) * (1 - 0.5 * btnV);
      btn.set(btnV); door.set(sm01(doorOpen)); flag.update(T, won ? 1 : 0); lampA.update(T, 0); lampB.update(T, 1.7);
      bot.step(T, dt);
    },
  };
  rt.reset(); return rt;
} });

/* ---------- Màn 3: Nhặt sao (2D cạnh) ---------- */
SCENES.push({ id: 'l3', label: 'Màn 3 · Nhặt sao', build() {
  const three = baseScene(), root = new THREE.Group(); three.add(root);
  root.add(makeBackWall().g, makeSideFloor().g);
  const win = makeWindow(); at(win.g, -8.5, 4.4, -1.45); root.add(win.g);
  const shelf = makeShelf(); at(shelf.g, 11.6, 3.9, -1.55); root.add(shelf.g);
  const lampA = makeLamp({ len: 3.4 }); at(lampA.g, -2, 8.2, -0.5); root.add(lampA.g);
  const lampB = makeLamp({ len: 3.4 }); at(lampB.g, 5.8, 8.2, -0.5); root.add(lampB.g);
  const gate = makeDoor(); at(gate.g, 7.6, 0, 0.45); root.add(gate.g);
  const flag = makeFlag(); at(flag.g, 11, 0, 0.3); root.add(flag.g);
  const SX = [-4, 0, 4], SY = 2.55;
  const stars = SX.map((x) => { const s = makeStar({ s: 1.05 }); at(s.g, x, SY, 0.3); root.add(s.g); return { ...s, x, c: -1 }; });
  const cat = makeActor('chibi'); root.add(cat.g, cat.shadow);
  let T, open, count, won, hold;
  const rt = {
    id: 'l3', mode: 'side', three, x0: -15, x1: 15, viewH: 8, floorFrac: 0.68, pitch: 0.2, actors: [cat], focus: () => cat,
    title: 'Màn 3 · Nhặt sao: mèo nhảy nhặt 3 sao vàng, cổng rào hạ xuống, mèo chạy tới cờ.',
    reset() { T = 0; open = 0; count = 0; won = false; hold = 0; stars.forEach((s) => { s.c = -1; s.g.visible = true; s.g.scale.setScalar(1.05); }); cat.place(-10, 0.35); cat.state = 'idle'; cat.speed = 0; cat.yawT = 0.5; cat.snap(); },
    step(dt) {
      T += dt; const V = 3.3;
      if (!won) {
        let move = T > 0.9; const nx = cat.x + V * dt;
        if (open < 0.92 && nx > 7.6 - 1.7) move = false;
        if (move) { cat.x = nx; cat.yawT = 1.05; }
        let y = 0;
        for (const s of stars) {
          const u = (cat.x - (s.x - 1.15)) / 2.3;
          if (u > 0 && u < 1) y = Math.max(y, 0.9 * Math.sin(Math.PI * u));
          if (u >= 0.5 && s.c < 0) { s.c = 0; count++; }
        }
        cat.y = y;
        cat.state = y > 0.06 ? 'air' : move ? 'walk' : 'idle'; cat.speed = move ? V : 0;
        if (cat.x >= 10.2) { won = true; cat.state = 'happy'; cat.speed = 0; cat.yawT = 0.25; cat.y = 0; }
      } else { hold += dt; if (hold > 2.8) { rt.reset(); return; } }
      if (count >= 3) open = clamp(open + dt / 0.9, 0, 1);
      for (const s of stars) {
        s.update(T + s.x);
        if (s.c >= 0) { s.c += dt; const k = clamp(s.c / 0.5, 0, 1); s.g.visible = k < 1; s.g.scale.setScalar(1.05 * (1 + k * 0.9) * (1 - k)); s.g.position.y = SY + k * 1.1; }
      }
      gate.set(sm01(open)); flag.update(T, won ? 1 : 0); lampA.update(T, 0); lampB.update(T, 1.7);
      cat.step(T, dt);
    },
  };
  rt.reset(); return rt;
} });

/* ---------- Màn 5: Đủ ba thùng (3D) ---------- */
SCENES.push({ id: 'l5', label: 'Màn 5 · Đủ ba thùng', build() {
  const three = baseScene(), root = new THREE.Group(); three.add(root);
  const host = trayHost(root, { x0: -12.5, x1: 12.5, z0: -4.6, z1: 4.6 });
  const pad = makeZonePad({ w: 3.4 }); at(pad.g, 8, 0, 0); root.add(pad.g);
  const deco = [[-11, -3.4, 0], [-9.7, -3.5, 0.25], [-10.4, -3.45, 1]];
  deco.forEach(([x, z, up], i) => { const c = makeCrate({ s: 0.95 }); at(c.g, x, up ? 0.95 : 0, z); c.g.rotation.y = 0.2 * i; root.add(c.g); });
  const plant = makePlant(); at(plant.g, 11.2, 0, -3.5); plant.g.scale.setScalar(1.3); root.add(plant.g);
  const CZ = [-1.4, 0, 1.4], SLOT = [[7.4, -1.0], [7.4, 1.0], [8.8, 0]];
  const crates = CZ.map((z) => { const c = makeCrate({ s: 0.95 }); root.add(c.g); return c; });
  const bot = makeActor('legs'); root.add(bot.g, bot.shadow);
  let T, trip, phase, pt, from;
  const carryAt = (out) => { const d = 0.62 * bot.charScale + 0.2; out.x = bot.x + Math.sin(bot.yaw) * d; out.z = bot.z + Math.cos(bot.yaw) * d; return out; };
  const tmp = { x: 0, z: 0 };
  const rt = {
    id: 'l5', mode: '3d', three, x0: -12.5, x1: 12.5, viewH: 10.5, pitch: 0.6, yaw: 0.22, shift: 0.02, fov: 26, actors: [bot], focus: () => bot, setFloor: host.setStyle,
    title: 'Màn 5 · Đủ ba thùng: rô-bốt bánh xe chở từng thùng vào vùng kho sơn trên sàn.',
    reset() { T = 0; trip = 0; phase = 'wait'; pt = 0; crates.forEach((c, i) => { at(c.g, -8.4, 0, CZ[i]); c.g.rotation.y = 0.1 * i; }); bot.place(-4.5, 0); bot.state = 'idle'; bot.yawT = 0.5; bot.snap(); },
    step(dt) {
      T += dt; pt += dt; const V = 5;
      bot.state = 'idle'; bot.speed = 0; bot.carry = phase === 'grab' || phase === 'carry' || (phase === 'drop' && pt < 0.15);
      if (phase === 'wait') { if (pt > 0.8) { phase = 'pick'; pt = 0; } }
      else if (phase === 'pick') { if (moveToward(bot, -7.0, CZ[trip], V, dt)) { phase = 'grab'; pt = 0; bot.yawT = -1.0 + 0; } else { bot.state = 'walk'; bot.speed = V; } }
      else if (phase === 'grab') {
        bot.yawT = -Math.PI / 2 + 0.4;
        const k = sm01(pt / 0.45); carryAt(tmp); const c = crates[trip].g;
        c.position.set(lerp(-8.4, tmp.x, k), 0.55 * k + 0.0, lerp(CZ[trip], tmp.z, k));
        if (pt >= 0.45) { phase = 'carry'; pt = 0; }
      } else if (phase === 'carry') {
        const done = moveToward(bot, 5.6, SLOT[trip][1] * 0.6, V, dt);
        carryAt(tmp); crates[trip].g.position.set(tmp.x, 0.55, tmp.z);
        if (!done) { bot.state = 'walk'; bot.speed = V; } else { phase = 'drop'; pt = 0; from = { x: tmp.x, z: tmp.z }; }
      } else if (phase === 'drop') {
        bot.yawT = 0.95;
        const k = clamp(pt / 0.55, 0, 1), c = crates[trip].g;
        c.position.set(lerp(from.x, SLOT[trip][0], k), lerp(0.55, 0, k) + Math.sin(k * Math.PI) * 0.7, lerp(from.z, SLOT[trip][1], k));
        if (k >= 1) { trip++; pt = 0; phase = trip >= 3 ? 'cheer' : 'pick'; }
      } else if (phase === 'cheer') {
        bot.state = 'happy'; bot.yawT = 0.2;
        if (pt > 3) { rt.reset(); return; }
      }
      bot.step(T, dt);
    },
  };
  rt.reset(); return rt;
} });

/* ---------- Màn 6: Né lính gác (3D) ---------- */
SCENES.push({ id: 'l6', label: 'Màn 6 · Né lính gác', build() {
  const three = baseScene(), root = new THREE.Group(); three.add(root);
  const host = trayHost(root, { x0: -12.5, x1: 12.5, z0: -4.6, z1: 4.6, seed: 21 });
  const goal = makeGoalPad(); at(goal.g, 10, 0, 0); root.add(goal.g);
  for (let i = 0; i < 8; i++) { const dash = paint(rrShape(0.3, 0.8, 0.14), 0.02, i % 2 ? PAL.cream3 : PAL.honey, 0.0); dash.position.set(-1.25, 0.006, -3.85 + i * 1.1); const d2 = dash.clone(); d2.position.x = 1.25; root.add(dash, d2); }
  const plant = makePlant(); at(plant.g, -11.2, 0, -3.5); plant.g.scale.setScalar(1.3); root.add(plant.g);
  const cr = makeCrate({ s: 0.95 }); at(cr.g, 11.1, 0, -3.4); root.add(cr.g);
  const hero = makeActor('chibi'), guard = makeActor('quad'); root.add(hero.g, hero.shadow, guard.g, guard.shadow);
  let T, gdir, gwait, won, hold;
  const rt = {
    id: 'l6', mode: '3d', three, x0: -12.5, x1: 12.5, viewH: 9.5, pitch: 0.6, yaw: 0.3, shift: 0.05, fov: 26, actors: [hero, guard], focus: () => hero, setFloor: host.setStyle,
    title: 'Màn 6 · Né lính gác: mèo nhỏ chờ trước vạch khi mèo lính gác đi tuần, rồi chạy tới ô đích.',
    reset() { T = 0; gdir = 1; gwait = 0; won = false; hold = 0; hero.place(-10, 0); hero.state = 'idle'; hero.yawT = 0.5; hero.snap(); guard.place(0, -4); guard.state = 'walk'; guard.yawT = 0.25; guard.snap(); },
    step(dt) {
      T += dt; const V = 3.2, GV = 2.2;
      if (gwait > 0) { gwait -= dt; guard.state = 'idle'; guard.speed = 0; if (gwait <= 0) { guard.yawT = headingYaw(0.2, gdir); } }
      else {
        guard.z += gdir * GV * dt; guard.state = 'walk'; guard.speed = GV; guard.yawT = headingYaw(0.2, gdir);
        if (Math.abs(guard.z) >= 4) { guard.z = Math.sign(guard.z) * 4; gdir = -gdir; gwait = 0.5; }
      }
      if (!won) {
        let move = T > 0.8; const nx = hero.x + V * dt;
        if (hero.x < -3.3 && nx >= -3.3 && Math.abs(guard.z) < 3.0) { move = false; }
        if (move) { hero.x = nx; hero.yawT = 0.95; }
        hero.state = move ? 'walk' : 'idle'; hero.speed = move ? V : 0;
        if (hero.x >= 9.2) { won = true; hero.state = 'happy'; hero.speed = 0; hero.yawT = 0.2; }
      } else { hold += dt; if (hold > 3) { rt.reset(); return; } }
      hero.step(T, dt); guard.step(T, dt);
    },
  };
  rt.reset(); return rt;
} });

/* ---------- Màn 7: Cầu nhấp nháy (3D) ---------- */
SCENES.push({ id: 'l7', label: 'Màn 7 · Cầu nhấp nháy', build() {
  const three = baseScene(), root = new THREE.Group(); three.add(root);
  const host = trayHost(root, { x0: -12.5, x1: 12.5, z0: -4.2, z1: 4.2, skip: [-2.2, 2.2], seed: 31 });
  const gap = new THREE.Group(); root.add(gap);
  gap.add(at(rbox(4.6, 0.3, 8.4, '#6a4426', 0.1), 0, -1.0, 0));
  const wgeo = new THREE.PlaneGeometry(4.5, 8.4, 6, 12); wgeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wgeo, toonNew(PAL.water)); water.position.y = -0.4; gap.add(water);
  for (const s of [-1, 1]) gap.add(at(paint(rrShape(0.2, 8.0, 0.1), 0.01, '#e9f6f4', 0), s * 2.12, -0.385, 0));
  const streaks = [0, 1, 2, 3, 4].map((i) => { const m = paint(rrShape(1.0, 0.1, 0.05), 0.004, '#a9e0e4', -0.385); m.userData.o = i * 1.7; gap.add(m); return m; });
  const bridge = makeBridge({ len: 4.6, wid: 8.2 }); root.add(bridge.g);
  const flag = makeFlag(); at(flag.g, 9.4, 0, 0); root.add(flag.g);
  const plant = makePlant(); at(plant.g, -11.2, 0, 3.4); plant.g.scale.setScalar(1.3); root.add(plant.g);
  const cr = makeCrate({ s: 0.95 }); at(cr.g, 11.1, 0, -3.4); root.add(cr.g);
  const bot = makeActor('wheel'); root.add(bot.g, bot.shadow);
  let T, bv, won, hold, fall;
  const wp = wgeo.attributes.position;
  const rt = {
    id: 'l7', mode: '3d', three, x0: -12.5, x1: 12.5, viewH: 9.5, pitch: 0.6, yaw: 0.26, shift: 0.05, fov: 26, actors: [bot], focus: () => bot, setFloor: host.setStyle, bridgeMode: 'auto',
    title: 'Màn 7 · Cầu nhấp nháy: cầu ván hiện / ẩn theo giờ, rô-bốt chỉ lăn qua khi cầu hiện. Thử nút “Luôn ẩn”.',
    reset() { T = 0; bv = rt.bridgeMode === 'show' ? 1 : 0; won = false; hold = 0; fall = -1; bot.place(-5, 0); bot.y = 0; bot.state = 'idle'; bot.speed = 0; bot.yawT = 0.95; bot.snap(); },
    step(dt) {
      T += dt; const V = 3.1;
      const m = rt.bridgeMode; let want;
      if (m === 'show') want = 1; else if (m === 'hide') want = 0; else want = T >= 1.4 && ((T - 1.4) % 5.6) < 3.5 ? 1 : 0;
      bv = clamp(bv + (want ? dt / 0.7 : -dt / 0.5), 0, 1);
      if (fall >= 0) {
        fall += dt; bot.y = -Math.min(1.1, fall * fall * 6); bot.state = 'sad'; bot.speed = 0;
        if (fall > 1.3) { rt.reset(); return; }
      } else if (!won) {
        let move = T > 0.6; const nx = bot.x + V * dt;
        const inGap = bot.x > -2.45 && bot.x < 2.45;
        if (bv < 0.92 && nx > -2.9 && bot.x <= -2.9 + 0.05) move = false;
        if (move) { bot.x = nx; bot.yawT = 0.95; }
        bot.state = move ? 'walk' : 'idle'; bot.speed = move ? V : 0;
        if (inGap && bv < 0.5) { fall = 0; }
        if (bot.x >= 8.3) { won = true; bot.state = 'happy'; bot.speed = 0; bot.yawT = 0.2; }
      } else { hold += dt; if (hold > 2.6) { rt.reset(); return; } }
      bridge.set(sm01(bv));
      for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), z = wp.getZ(i); wp.setY(i, Math.sin(x * 2.2 + T * 2) * 0.03 + Math.cos(z * 1.4 - T * 1.6) * 0.03); }
      wp.needsUpdate = true; wgeo.computeVertexNormals();
      streaks.forEach((m, i) => { m.position.set(((i % 2) - 0.5) * 2.0, -0.385, ((T * 0.5 + m.userData.o) % 8.0) - 4.0); });
      flag.update(T, won ? 1 : 0);
      bot.step(T, dt);
    },
  };
  rt.reset(); return rt;
} });

/* ---------- Bộ đạo cụ (bàn xoay) ---------- */
const KIT = [
  { id: 'door-closed', label: 'Cửa gỗ · đóng', size: 4.0, make: () => { const d = makeDoor(); d.set(0); return { g: d.g }; } },
  { id: 'door-open', label: 'Cửa gỗ · mở', size: 4.0, make: () => { const d = makeDoor(); d.set(1); return { g: d.g }; } },
  { id: 'button-up', label: 'Nút đỏ · nhả', size: 1.9, make: () => { const b = makeButton(); b.set(0); return { g: b.g }; } },
  { id: 'button-down', label: 'Nút đỏ · nhấn', size: 1.9, make: () => { const b = makeButton(); b.set(1); return { g: b.g }; } },
  { id: 'flag', label: 'Cờ đích', size: 3.0, make: () => { const f = makeFlag(); return { g: f.g, update: (t) => f.update(t, 0) }; } },
  { id: 'lamp', label: 'Đèn treo', size: 2.4, lift: 2.1, make: () => { const l = makeLamp({ len: 1.1 }); return { g: l.g, update: (t) => l.update(t, 0) }; } },
  { id: 'crate', label: 'Thùng gỗ', size: 1.3, make: () => makeCrate() },
  { id: 'star', label: 'Ngôi sao', size: 1.4, lift: 0.9, make: () => { const s = makeStar(); return { g: s.g, update: (t) => s.update(t) }; } },
  { id: 'zone', label: 'Vùng kho (sơn sàn)', size: 3.6, make: () => makeZonePad() },
  { id: 'goal', label: 'Ô đích', size: 2.2, make: () => makeGoalPad() },
  { id: 'bridge', label: 'Cầu ván · hiện', size: 4.8, make: () => { const b = makeBridge({ len: 4.4, wid: 3.4 }); b.set(1); return { g: b.g }; } },
  { id: 'bridge-half', label: 'Cầu ván · đang hiện', size: 4.8, make: () => { const b = makeBridge({ len: 4.4, wid: 3.4 }); b.set(0.5); return { g: b.g }; } },
  { id: 'gate-closed', label: 'Cổng rào · đóng', size: 2.6, make: () => { const q = makeGate(); q.set(0); return { g: q.g }; } },
  { id: 'gate-open', label: 'Cổng rào · mở', size: 2.6, make: () => { const q = makeGate(); q.set(1); return { g: q.g }; } },
  { id: 'floor-plank', label: 'Sàn ván', size: 3.4, lift: 0.5, make: () => makeFloorChunk({ style: 'plank' }) },
  { id: 'floor-tile', label: 'Sàn gạch ấm', size: 3.4, lift: 0.5, make: () => makeFloorChunk({ style: 'tile' }) },
  { id: 'wall', label: 'Mảnh tường', size: 4.2, sway: true, make: () => { const w = makeBackWall({ x0: -1.7, x1: 1.7, h: 3.6, z: 0, thick: true }); return { g: w.g }; } },
  { id: 'window', label: 'Cửa sổ', size: 3.6, sway: true, lift: 1.4, make: () => makeWindow() },
  { id: 'shelf', label: 'Kệ gỗ', size: 3.0, sway: true, lift: 0.9, make: () => makeShelf() },
  { id: 'plant', label: 'Chậu cây', size: 1.4, make: () => makePlant() },
];
function makePedestal(r) {
  const g = new THREE.Group();
  g.add(lathe([[0, -0.26], [r, -0.26], [r + 0.06, -0.2], [r + 0.06, -0.06], [r, -0.01], [0, -0.01]], PAL.wood3, 40));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(r - 0.08, r - 0.08, 0.02, 40), toonM(PAL.cream2)), 0, -0.012, 0));
  return g;
}
SCENES.push({ id: 'kit', label: 'Bộ đạo cụ', build() {
  const three = baseScene();
  three.add(at(new THREE.Mesh(new THREE.PlaneGeometry(80, 80), basicM('#e9cf9a')), 0, -0.3, 0).rotateX(-Math.PI / 2));
  const items = KIT.map((it) => {
    const built = it.make(), holder = new THREE.Group(), inner = new THREE.Group();
    inner.add(built.g); inner.position.y = it.lift || 0; holder.add(inner);
    const sc = 2.1 / it.size; holder.scale.setScalar(sc);
    const ped = makePedestal(1.45); const pedBig = makePedestal(2.3);
    return { ...it, built, holder, ped, pedBig, sc };
  });
  const cell = new THREE.Group(); three.add(cell);
  const rt = {
    id: 'kit', mode: 'kit', three, actors: [], items, sel: 'all', cols: 5, focus: () => null,
    title: 'Bộ đạo cụ: mỗi món đặt riêng trên bàn xoay. Chọn “Tất cả” để xem cả bộ, hoặc bấm từng món.',
    reset() { rt.T = 0; },
    select(id, aspect) {
      rt.sel = id; while (cell.children.length) cell.remove(cell.children[0]);
      const list = id === 'all' ? items : items.filter((i) => i.id === id);
      rt.cols = id === 'all' ? (aspect > 1.7 ? 7 : aspect > 1.2 ? 5 : 3) : 1;
      list.forEach((it, i) => {
        const col = i % rt.cols, row = Math.floor(i / rt.cols), n = Math.min(rt.cols, list.length - row * rt.cols);
        const x = id === 'all' ? (col - (rt.cols - 1) / 2) * 3.2 : 0, z = id === 'all' ? row * 4.4 : 0;
        const pedestal = id === 'all' ? it.ped : it.pedBig;
        const hold = new THREE.Group(); hold.position.set(x, 0, z); hold.add(pedestal, it.holder); it.holder.scale.setScalar(it.sc * (id === 'all' ? 1 : 1.4)); it.cell = hold;
        cell.add(hold);
      });
      rt.list = list; rt.rows = Math.ceil(list.length / rt.cols);
    },
    step(dt) {
      rt.T = (rt.T || 0) + dt; const T = rt.T;
      for (const it of rt.list || []) { it.holder.rotation.y = it.sway ? Math.sin(T * 0.8) * 0.6 : T * 0.7; if (it.built.update) it.built.update(T); }
    },
    labelPoints() { return (rt.sel === 'all' ? rt.list : []).map((it) => ({ text: it.label, p: new THREE.Vector3(it.cell.position.x, -0.28, it.cell.position.z + 1.75) })); },
    frame(camera, aspect, zoom) {
      let viewH, tx = 0, ty = 1.1, tz = 0; const pitch = rt.sel === 'all' ? 0.85 : 0.36;
      if (rt.sel === 'all') {
        const gw = rt.cols * 3.2 + 1.6, gd = (rt.rows - 1) * 4.4;
        viewH = Math.max(gd * Math.sin(pitch) + 3.4 * Math.cos(pitch) + 3.0, gw / aspect * 1.2); tz = gd / 2; ty = 0.4;
      } else viewH = 4.6;
      viewH /= zoom;
      const dist = (viewH / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.set(tx, ty + Math.sin(pitch) * dist, tz + Math.cos(pitch) * dist); camera.lookAt(tx, ty, tz);
    },
  };
  rt.reset(); rt.select('all', 1.8); return rt;
} });
