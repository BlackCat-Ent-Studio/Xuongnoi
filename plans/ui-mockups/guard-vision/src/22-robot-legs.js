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
