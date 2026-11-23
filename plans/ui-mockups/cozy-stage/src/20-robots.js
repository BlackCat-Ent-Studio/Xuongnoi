/* ================= characters: robots (copied from cozy-robot, look unchanged) ================= */
const makeWheelRobot = (() => {
  const GRAD = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  const toon = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: GRAD });
  const flat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const P = { body: '#7cc4f0', accent: '#ffcc3d', face: '#f6f1e4' };
  const C = { shade: '#4a8fd0', ink: '#2a2350', cheek: '#ff8fa8', metal: '#c9d2dc', tire: '#3b3f5c' };
  const sph = (r, mat, sx = 1, sy = 1, sz = 1, ws = 24, hs = 16) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat); m.scale.set(sx, sy, sz); return m; };
  const smooth = (x) => x * x * (3 - 2 * x);

  return function make() {
    const mats = {
      body: toon(P.body), shade: toon(C.shade), face: toon(P.face), accent: toon(P.accent),
      metal: toon(C.metal), tire: toon(C.tire), cheek: flat(C.cheek), ink: flat(C.ink), white: flat('#ffffff'),
    };
    const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot);
    const wheel = new THREE.Group(), spin = new THREE.Group(); wheel.add(spin);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.25, 18, 48), mats.tire); tire.rotation.y = Math.PI / 2; spin.add(tire);
    for (const s of [-1, 1]) {
      const hub = sph(0.25, mats.accent, 0.5, 1, 1, 24, 14); hub.position.x = s * 0.22; spin.add(hub);
      const bar = new RoundedBoxGeometry(0.06, 0.08, 0.36, 3, 0.03);
      const b1 = new THREE.Mesh(bar, mats.metal); b1.position.x = s * 0.29; spin.add(b1);
      const b2 = b1.clone(); b2.rotation.x = Math.PI / 2; spin.add(b2);
    }
    root.add(wheel);

    const torso = new THREE.Group();
    torso.add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.5, 0.56, 4, 0.2), mats.shade));
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 16, 40), mats.metal); neck.rotation.x = Math.PI / 2; neck.position.y = 0.24; torso.add(neck);
    const chest = sph(0.08, mats.accent, 1, 1, 0.5, 18, 12); chest.position.set(0, -0.02, 0.29); torso.add(chest);
    pivot.add(torso);

    const arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 6, 16), mats.body); limb.position.y = -0.14; arm.add(limb);
      const hand = sph(0.1, mats.metal, 1, 1, 1, 18, 12); hand.position.y = -0.27; arm.add(hand);
      arm.userData.side = s; pivot.add(arm); arms.push(arm);
    }

    const head = new THREE.Group();
    head.add(sph(0.6, mats.body, 1.1, 1, 1, 44, 28));
    for (const s of [-1, 1]) { const ear = sph(0.12, mats.accent, 0.55, 1.2, 1.2, 18, 12); ear.position.set(s * 0.65, -0.02, 0); head.add(ear); }
    const face = new THREE.Group();
    const screen = sph(1, mats.face, 0.5, 0.38, 0.14, 40, 24); screen.position.z = 0.52; face.add(screen);
    const eyes = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(s * 0.17, 0.06, 0.635);
      const open = new THREE.Group();
      const ballM = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.09, 6, 16), mats.ink); ballM.scale.z = 0.5; open.add(ballM);
      const hl = sph(0.024, mats.white, 1, 1, 1, 8, 6); hl.position.set(0.02, 0.07, 0.04); open.add(hl);
      const happy = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 12, 28, Math.PI), mats.ink); happy.position.y = -0.03; happy.scale.z = 0.6; happy.visible = false;
      eye.add(open, happy); eye.userData = { s, open, happy }; face.add(eye); eyes.push(eye);
    }
    const mouth = new THREE.Group();
    const mArc = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 12, 32, Math.PI), mats.ink); mArc.rotation.z = Math.PI; mArc.position.y = 0.04; mouth.add(mArc);
    mouth.position.set(0, -0.1, 0.645); face.add(mouth);
    for (const s of [-1, 1]) { const ch = sph(1, mats.cheek, 0.07, 0.045, 0.03, 20, 14); ch.position.set(s * 0.3, -0.1, 0.605); face.add(ch); }
    head.add(face);
    const antenna = new THREE.Group(); antenna.position.y = 0.56;
    antenna.add(sph(0.07, mats.metal, 1, 0.5, 1, 20, 12));
    const stalkGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 16); stalkGeo.translate(0, 0.5, 0);
    const stalk = new THREE.Mesh(stalkGeo, mats.metal); antenna.add(stalk);
    const ballA = sph(0.095, mats.accent, 1, 1, 1, 28, 18); antenna.add(ballA);
    head.add(antenna); pivot.add(head);

    /* mudguard mount (the approved "Chắn bùn" style) */
    const guard = new THREE.Group();
    const ARC = Math.PI * 0.72, START = (Math.PI - ARC) / 2;
    const archWrap = new THREE.Group(); archWrap.rotation.y = Math.PI / 2; guard.add(archWrap);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.06, 12, 48, ARC), mats.shade); arch.rotation.z = START; arch.scale.z = 4.6; archWrap.add(arch);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.028, 8, 48, ARC), mats.accent); stripe.rotation.z = START; archWrap.add(stripe);
    for (const s of [-1, 1]) { const strut = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.62, 0.12, 3, 0.02), mats.metal); strut.position.set(s * 0.33, 0.3, 0); guard.add(strut); }
    for (const s of [-1, 1]) { const cap = sph(0.11, mats.accent, 0.45, 1, 1); cap.position.x = s * 0.4; guard.add(cap); }
    pivot.add(guard);

    /* layout with default sliders */
    const axle = 0.54, lift = 0.25, hs = 1.08;
    wheel.position.y = axle; pivot.position.y = axle;
    const torsoC = 1.08 - 0.1 + 0.25 + lift;
    torso.position.y = torsoC - axle;
    const headC = torsoC + 0.25 - 0.14 + 0.6 * hs;
    head.position.y = headC - axle; head.scale.setScalar(hs);
    for (const arm of arms) arm.position.set(arm.userData.side * 0.34, torsoC + 0.09 - axle, 0);
    stalk.scale.y = 0.3; ballA.position.y = 0.34;

    /* animation (idle / run / happy / sad) */
    const pose = { bob: 0, lean: 0, spin: 0, sy: 1, hop: 0, yaw: 0, armL: 0.3, armR: 0.3, happy: 0, sad: 0, droop: 0, headPitch: 0, headRoll: 0, wobble: 1 };
    let spinAngle = 0, blinkAt = 2.5, blinkT = -1;
    function target(state, t, spinRate) {
      const T = { bob: 0, lean: 0, spin: 0, sy: 1, hop: 0, yaw: 0, armL: 0.3, armR: 0.3, happy: 0, sad: 0, droop: 0, headPitch: 0, headRoll: 0, wobble: 1 };
      if (state === 'idle') {
        T.bob = Math.sin(t * 2) * 0.012; T.sy = 1 + Math.sin(t * 2) * 0.012; T.armL = T.armR = 0.28 + Math.sin(t * 2) * 0.04; T.headRoll = Math.sin(t * 0.8) * 0.03;
      } else if (state === 'run') {
        T.spin = spinRate || 7; T.lean = 0.2; T.hop = Math.abs(Math.sin(t * 7)) * 0.035;
        T.armL = 0.7 + Math.sin(t * 7) * 0.35; T.armR = 0.7 - Math.sin(t * 7) * 0.35; T.headPitch = -0.05; T.happy = 0.15; T.wobble = 1.8;
      } else if (state === 'happy') {
        T.happy = 1; T.hop = Math.abs(Math.sin(t * 5)) * 0.2; T.yaw = Math.sin(t * 2.4) * 0.7;
        T.armL = 2.5 + Math.sin(t * 10) * 0.25; T.armR = 2.5 - Math.sin(t * 10) * 0.25;
        T.sy = 1 + (Math.abs(Math.sin(t * 5)) - 0.5) * 0.04; T.headRoll = Math.sin(t * 5) * 0.07; T.spin = Math.sin(t * 2.4) * 3; T.wobble = 2.2;
      } else if (state === 'sad') {
        T.sad = 1; T.droop = 1; T.headPitch = 0.3; T.lean = -0.04; T.sy = 0.93 + Math.sin(t * 1.2) * 0.008; T.armL = T.armR = 0.05; T.headRoll = 0.05; T.wobble = 0.2;
      }
      return T;
    }
    function update(state, t, dt, o = {}) {
      const st = state === 'walk' ? 'run' : state;
      const T = target(st, t, o.spin);
      const k = 1 - Math.exp(-dt * 8);
      for (const key in pose) pose[key] += (T[key] - pose[key]) * k;
      spinAngle += pose.spin * dt;
      spin.rotation.x = -spinAngle;
      root.position.y = pose.hop + pose.bob;
      root.scale.set(1 / Math.sqrt(pose.sy), pose.sy, 1 / Math.sqrt(pose.sy));
      root.rotation.y = pose.yaw; pivot.rotation.x = pose.lean;
      head.rotation.x = pose.headPitch; head.rotation.z = pose.headRoll;
      arms[0].rotation.z = -pose.armL; arms[1].rotation.z = pose.armR;
      const w = pose.wobble;
      antenna.rotation.z = Math.sin(t * 3.1) * 0.13 * w * (1 - pose.droop) + pose.droop * 1.15 - pose.lean * 0.5;
      antenna.rotation.x = Math.cos(t * 2.3) * 0.09 * w * (1 - pose.droop) - pose.lean * 0.8 + pose.droop * 0.35;
      if (blinkT < 0 && t > blinkAt) blinkT = 0;
      let blink = 1;
      if (blinkT >= 0) { blinkT += dt; blink = 1 - Math.sin(Math.min(1, blinkT / 0.16) * Math.PI) * 0.92; if (blinkT > 0.16) { blinkT = -1; blinkAt = t + 2.5 + Math.random() * 2.5; } }
      const hp = pose.happy, sd = pose.sad;
      for (const eye of eyes) {
        const { s, open, happy } = eye.userData;
        open.visible = hp < 0.6; happy.visible = hp >= 0.6;
        open.scale.set(1 + sd * 0.05, Math.max(0.05, (1 - sd * 0.5) * blink * (1 - hp * 0.6)), 1);
        open.rotation.z = -s * sd * 0.4; open.position.y = -sd * 0.025;
        const h2 = clamp((hp - 0.6) / 0.4, 0, 1) * 0.35 + 0.65; happy.scale.set(h2, h2, 0.6);
      }
      mouth.scale.y = 1 + hp * 0.5 - sd * 1.55; mouth.scale.x = 1 + hp * 0.35 - sd * 0.1;
      return { hop: pose.hop };
    }
    return { root, fit: 1.8 / 2.9, shadowR: 0.62, h: 1.8, update };
  };
})();

const makeLegsRobot = (() => {
  const ramp = new THREE.DataTexture(new Uint8Array([130, 195, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
  const INK = '#2a2350', CHEEK = '#ff8fa8', METAL = '#c9d2dc';
  const mesh = (geo, mat, pos, scl) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (scl) m.scale.set(...scl); return m; };
  const sph = (w = 20, h = 14) => new THREE.SphereGeometry(1, w, h);
  const P = { body: '#7cc4f0', accent: '#ffcc3d', face: '#f6f1e4', head: 1, bodySize: 1, leg: 0.35, antenna: 0.35 };

  return function make() {
    const M = {
      body: toon(P.body), shade: toon('#4a8fd0'), accent: toon(P.accent), face: toon(P.face),
      ink: toon(INK), cheek: toon(CHEEK), metal: toon(METAL), white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    };
    const R = {};
    R.root = new THREE.Group(); R.bob = new THREE.Group(); R.root.add(R.bob);
    R.upper = new THREE.Group(); R.bob.add(R.upper);
    R.torso = new THREE.Group(); R.upper.add(R.torso);
    R.torso.add(mesh(new RoundedBoxGeometry(0.74, 0.66, 0.6, 4, 0.26), M.shade, [0, 0.33, 0]));
    R.torso.add(mesh(sph(14, 10), M.accent, [0, 0.33, 0.29], [0.1, 0.1, 0.045]));
    R.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.46, 0.5, 0);
      a.add(mesh(new THREE.CapsuleGeometry(0.075, 0.14, 2, 6), M.body, [0, -0.13, 0]));
      a.add(mesh(sph(8, 6), M.body, [0, -0.27, 0], [0.105, 0.105, 0.105]));
      a.userData.side = s; R.torso.add(a); R.arms.push(a);
    }
    R.head = new THREE.Group(); R.upper.add(R.head);
    R.head.add(mesh(sph(28, 18), M.body, [0, 0, 0], [0.75, 0.65, 0.68]));
    for (const s of [-1, 1]) R.head.add(mesh(sph(8, 6), M.metal, [s * 0.74, -0.02, 0], [0.07, 0.17, 0.17]));
    R.face = new THREE.Group(); R.head.add(R.face);
    R.face.add(mesh(sph(24, 14), M.face, [0, -0.02, 0.59], [0.57, 0.41, 0.14]));
    const sz = (x, y) => 0.59 + 0.14 * Math.sqrt(Math.max(0, 1 - (x / 0.57) ** 2 - ((y + 0.02) / 0.41) ** 2));
    R.eyes = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.25, 0.1, sz(0.25, 0.1) - 0.01); g.rotation.y = s * 0.25;
      const n = mesh(sph(12, 8), M.ink), hl = mesh(sph(8, 6), M.white);
      const arc = mesh(new THREE.TorusGeometry(0.085, 0.03, 6, 10, Math.PI), M.ink, [0, -0.04, 0]);
      g.add(n, hl, arc); g.userData = { n, hl, arc, s }; R.face.add(g); R.eyes.push(g);
    }
    for (const s of [-1, 1]) { const c = mesh(sph(10, 8), M.cheek, [s * 0.4, -0.1, sz(0.4, -0.1) + 0.005], [0.075, 0.05, 0.03]); c.rotation.y = s * 0.3; R.face.add(c); }
    R.mouthG = new THREE.Group(); R.mouthG.position.set(0, -0.1, sz(0, -0.1) + 0.012);
    R.mouth = mesh(new THREE.TorusGeometry(0.085, 0.024, 6, 10, Math.PI), M.ink); R.mouth.rotation.z = Math.PI;
    R.mouthG.add(R.mouth); R.face.add(R.mouthG);
    R.antBase = new THREE.Group(); R.antBase.position.set(0, 0.62, 0); R.head.add(R.antBase);
    R.antBase.add(mesh(sph(10, 8), M.metal, [0, 0, 0], [0.09, 0.06, 0.09]));
    R.stalk = new THREE.Mesh(new THREE.BufferGeometry(), M.metal);
    R.ball = mesh(sph(14, 10), M.accent, null, [0.1, 0.1, 0.1]);
    R.antBase.add(R.stalk, R.ball);
    R.legs = [];
    for (const s of [-1, 1]) {
      const l = new THREE.Group(); l.userData.side = s;
      l.userData.stalk = new THREE.Mesh(new THREE.BufferGeometry(), M.shade); l.add(l.userData.stalk);
      l.userData.foot = new THREE.Group();
      l.userData.foot.add(mesh(sph(12, 8), M.body, [0, 0, 0.04], [0.19, 0.12, 0.25]));
      l.userData.foot.add(mesh(new THREE.SphereGeometry(1, 12, 3, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), M.accent, [0, 0, 0.04], [0.195, 0.125, 0.255]));
      l.add(l.userData.foot); R.bob.add(l); R.legs.push(l);
    }
    /* layout with default sliders */
    const layout = {};
    const legLen = P.leg, footH = 0.12, hipY = footH + legLen; layout.hipY = hipY;
    R.upper.position.y = hipY;
    const torsoTop = 0.66 * P.bodySize; layout.headY = torsoTop + 0.5 * P.head;
    R.head.scale.setScalar(P.head); R.head.position.y = layout.headY;
    R.stalk.geometry = new THREE.CapsuleGeometry(0.035, P.antenna, 2, 6); R.stalk.position.y = P.antenna / 2; R.ball.position.y = P.antenna + 0.07;
    for (const l of R.legs) {
      const s = l.userData.side;
      l.position.set(s * 0.21 * Math.max(P.bodySize, 0.9), hipY, 0);
      l.userData.stalk.geometry = new THREE.CapsuleGeometry(0.135, legLen, 2, 8);
      l.userData.stalk.position.y = -legLen / 2; l.userData.foot.position.y = -hipY + footH;
    }

    const W = { walk: 0, happy: 0, sad: 0 };
    let walkPh = 0, nextBlink = 2.2, blinkT = -1, antZ = 0, antZv = 0, antX = 0, antXv = 0, prevY = 0;
    function update(state, t, dt, o = {}) {
      const k = 1 - Math.exp(-dt * 7);
      for (const key of Object.keys(W)) W[key] += ((state === key ? 1 : 0) - W[key]) * k;
      walkPh += dt * 9;
      const sw = Math.sin(walkPh);
      const breathe = Math.sin(t * 2.2), hop = Math.abs(Math.sin(t * 6)) * 0.16;
      const bobY = Math.abs(sw) * 0.05 * W.walk + hop * W.happy;
      const sy = (1 + 0.016 * breathe) * lerp(1, 0.93, W.sad), sxz = 1 / Math.sqrt(sy);
      R.bob.position.y = bobY; R.bob.scale.set(sxz, sy, sxz);
      R.root.rotation.y = Math.sin(t * 2.6) * 0.55 * W.happy;
      R.upper.rotation.z = sw * 0.13 * W.walk + 0.05 * W.sad;
      R.upper.position.x = sw * 0.05 * W.walk;
      for (const l of R.legs) {
        const ph = sw * l.userData.side;
        l.rotation.x = -ph * 0.7 * W.walk;
        l.position.y = layout.hipY + Math.max(0, -ph) * 0.07 * W.walk;
        l.rotation.z = -l.userData.side * 0.06 * W.sad;
      }
      R.head.position.y = layout.headY + breathe * 0.012 * P.head - 0.04 * W.sad;
      R.head.rotation.x = 0.3 * W.sad + 0.05 * Math.sin(t * 6) * W.happy;
      R.head.rotation.z = -sw * 0.07 * W.walk + 0.1 * W.sad + Math.sin(t * 6) * 0.05 * W.happy;
      const vy = (bobY - prevY) / Math.max(dt, 1e-3); prevY = bobY;
      const tz = 0.95 * W.sad - R.upper.rotation.z * 1.3 - R.head.rotation.z * 0.6;
      const tx = -vy * 0.1 + Math.sin(t * 2.2) * 0.02;
      const h = Math.min(dt, 0.03);
      antZv += (-70 * (antZ - tz) - 6 * antZv) * h; antZ += antZv * h;
      antXv += (-70 * (antX - tx) - 6 * antXv) * h; antX += antXv * h;
      R.antBase.rotation.set(antX, 0, antZ + Math.sin(t * 4) * 0.03 * (1 - W.sad));
      const raise = Math.max(W.happy * (0.85 + 0.15 * Math.sin(t * 10)), 0);
      for (const a of R.arms) { const s = a.userData.side; a.rotation.z = s * (0.32 + raise * 2.2 - 0.22 * W.sad); a.rotation.x = s * sw * 0.9 * W.walk; if (o.carry) { a.rotation.z = s * 0.28; a.rotation.x = -1.35; } }
      if (blinkT < 0 && t > nextBlink) blinkT = 0;
      let blink = 0;
      if (blinkT >= 0) { blinkT += dt; const q = blinkT / 0.16; blink = q < 1 ? Math.sin(q * Math.PI) : 0; if (q >= 1) { blinkT = -1; nextBlink = t + 2.5 + Math.random() * 2.5; } }
      const open = (1 - 0.5 * W.sad) * (1 - 0.92 * blink);
      const nVis = Math.max(0, 1 - W.happy * 2), aVis = Math.max(0, W.happy * 2 - 1);
      for (const g of R.eyes) {
        const { n, hl, arc, s } = g.userData;
        g.rotation.z = -s * 0.38 * W.sad;
        n.scale.set(0.105 * nVis, 0.15 * open * nVis, 0.055 * nVis);
        n.visible = nVis > 0.02; hl.visible = n.visible && open > 0.5;
        hl.position.set(0.035, 0.05 * open, 0.045); hl.scale.setScalar(0.03 * nVis);
        arc.visible = aVis > 0.02; arc.scale.setScalar(Math.max(aVis, 0.001));
      }
      R.mouth.scale.set(1 + 0.45 * W.happy + 0.1 * W.sad, 1 - 2 * W.sad + 0.3 * W.happy, 1);
      R.mouthG.position.y = -0.1 - 0.03 * W.sad;
      return { hop: bobY };
    }
    return { root: R.root, fit: 1.8 / 2.28, shadowR: 0.5, h: 1.8, update };
  };
})();
