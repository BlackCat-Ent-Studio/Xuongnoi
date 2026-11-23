/* ================= characters: cats (copied from black-cat, default look; hidden expression extras left out) ================= */
const makeCatChibi = (() => {
  const PINK_EAR = '#f2a1a8', PINK = '#ff8fa0', NAVY = '#232a5a';
  const RX = 1.15, RY = 0.95, RZ = 1.0;
  const gradientMap = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter; gradientMap.generateMipmaps = false; gradientMap.needsUpdate = true;
  const SPH_HI = new THREE.SphereGeometry(1, 24, 16), SPH_MD = new THREE.SphereGeometry(1, 12, 9), SPH_LO = new THREE.SphereGeometry(1, 9, 6);
  const RIM = '0.62,0.55,1.0';
  function toon(color, rim = 0.6, extra = {}) {
    const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap, ...extra });
    if (rim > 0) {
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
          `outgoingLight += vec3(${RIM}) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4) * ${rim.toFixed(2)};
#include <opaque_fragment>`);
      };
      m.customProgramCacheKey = () => 'toonrim' + rim.toFixed(2);
    }
    return m;
  }
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  function onHead(x, y, off = 0) {
    const z = RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - (y / RY) ** 2));
    const n = new THREE.Vector3(x / (RX * RX), y / (RY * RY), z / (RZ * RZ)).normalize();
    return { pos: new THREE.Vector3(x, y, z).addScaledVector(n, off), quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, n), z };
  }
  function place(obj, x, y, off = 0) { const p = onHead(x, y, off); obj.position.copy(p.pos); obj.quaternion.copy(p.quat); return obj; }
  function addM(parent, geo, mat, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (o.s) m.scale.set(...o.s); if (o.p) m.position.set(...o.p); if (o.r) m.rotation.set(...o.r);
    parent.add(m); return m;
  }
  function grp(parent, p = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; }
  function earShape(R, h, rt, seg) {
    const pts = [new THREE.Vector2(0, -0.12), new THREE.Vector2(R, -0.12), new THREE.Vector2(R, 0)];
    pts.push(new THREE.Vector2(rt, h));
    for (let a = 1; a <= 4; a++) { const an = a / 4 * Math.PI / 2; pts.push(new THREE.Vector2(rt * Math.cos(an), h + rt * Math.sin(an))); }
    return new THREE.LatheGeometry(pts, seg);
  }
  function taperTube(curve, rFn, colFn, tubular, radial) {
    const fr = curve.computeFrenetFrames(tubular, false);
    const pos = [], nor = [], col = [], idx = [];
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular, Pt = curve.getPointAt(t), r = rFn(t), c = colFn(t);
      for (let j = 0; j <= radial; j++) {
        const v = j / radial * Math.PI * 2, cs = -Math.cos(v), sn = Math.sin(v);
        const nx = cs * fr.normals[i].x + sn * fr.binormals[i].x, ny = cs * fr.normals[i].y + sn * fr.binormals[i].y, nz = cs * fr.normals[i].z + sn * fr.binormals[i].z;
        pos.push(Pt.x + r * nx, Pt.y + r * ny, Pt.z + r * nz); nor.push(nx, ny, nz); col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 1; i <= tubular; i++) for (let j = 1; j <= radial; j++) {
      const a = (radial + 1) * (i - 1) + (j - 1), b = (radial + 1) * i + (j - 1), c = (radial + 1) * i + j, d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
  }
  const P = { fur: '#2b2733', white: '#f7f1ee', eyes: '#4aa8f0', collar: '#d8323c', head: 1, ear: 1, tail: 1, body: 1 };

  function buildCat() {
    const cFur = new THREE.Color(P.fur), cShade = cFur.clone().multiplyScalar(0.65), cWhite = new THREE.Color(P.white);
    const cEye = new THREE.Color(P.eyes), cRing = cEye.clone().multiplyScalar(0.58); cRing.b = Math.min(1, cRing.b + 0.07);
    const cGlow = cEye.clone().lerp(new THREE.Color('#ffffff'), 0.45);
    const M = {
      fur: toon(cFur, 0.95), shade: toon(cShade, 0.85), white: toon(cWhite, 0.4), earPink: toon(PINK_EAR, 0.25), pink: toon(PINK, 0.2),
      eye: toon(cEye, 0.1), ring: toon(cRing, 0.1), glow: toon(cGlow, 0), pupil: toon('#14183a', 0), hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      collar: toon(P.collar, 0.5), navy: toon(NAVY, 0.5), whisker: toon('#d9d2e3', 0.2), mouth: toon('#ff9fb0', 0.1),
      vcol: toon('#ffffff', 0.9, { vertexColors: true }),
    };
    const root = new THREE.Group();
    const motion = grp(root); const parts = { root, motion };
    const bs = P.body;
    const torso = grp(motion, [0, 0.3 + 0.65 * bs, 0]); torso.scale.setScalar(bs);
    addM(torso, SPH_HI, M.shade, { s: [0.65, 0.65, 0.58] });
    addM(torso, new THREE.SphereGeometry(1, 28, 18), M.white, { s: [0.5, 0.56, 0.34], p: [0, -0.1, 0.33] });
    const collarW = grp(torso, [0, 0.33, 0.0]); collarW.scale.set(1, 1, 0.9);
    addM(collarW, new THREE.TorusGeometry(0.575, 0.075, 6, 22), M.collar, { r: [Math.PI / 2, 0, 0] });
    const pend = grp(torso, [0, 0.3, 0.6]); pend.rotation.x = -0.25;
    addM(pend, new THREE.TorusGeometry(0.045, 0.014, 6, 12), M.navy, { p: [0, -0.02, 0] });
    const xg = grp(pend, [0, -0.22, 0.03]); const capG = new THREE.CapsuleGeometry(0.036, 0.26, 3, 8);
    addM(xg, capG, M.navy, { r: [0, 0, Math.PI / 4] }); addM(xg, capG, M.navy, { r: [0, 0, -Math.PI / 4], p: [0, 0, 0.012] });
    parts.arms = [];
    for (const side of [-1, 1]) {
      const a = grp(torso, [side * 0.58, 0.17, 0.12]); a.rotation.z = side * 0.42; a.userData.side = side;
      addM(a, new THREE.CapsuleGeometry(0.125, 0.26, 2, 7), M.shade, { p: [0, -0.2, 0] });
      const paw = grp(a, [0, -0.47, 0.02]);
      addM(paw, SPH_MD, M.white, { s: [0.165, 0.16, 0.16] });
      addM(paw, SPH_LO, M.pink, { s: [0.065, 0.05, 0.03], p: [0, -0.03, 0.145] });
      for (const dx of [-0.07, 0, 0.07]) addM(paw, SPH_LO, M.pink, { s: [0.028, 0.03, 0.02], p: [dx, 0.05, 0.14 - Math.abs(dx) * 0.6] });
      parts.arms.push(a);
    }
    parts.torso = torso; parts.bodyScale = bs;
    parts.legs = [];
    for (const side of [-1, 1]) {
      const l = grp(motion, [side * 0.3, 0.46, 0.08]); l.userData.side = side;
      addM(l, new THREE.CapsuleGeometry(0.17, 0.1, 2, 8), M.shade, { p: [0, -0.1, 0] });
      const foot = grp(l, [0, -0.32, 0.08]); addM(foot, SPH_MD, M.white, { s: [0.215, 0.14, 0.3] });
      parts.legs.push(l);
    }
    const tailPivot = grp(motion, [0, 0.55, -0.4]); const L = P.tail;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.28 * L, -0.02, -0.3 * L), new THREE.Vector3(0.72 * L, 0.3 * L, -0.4 * L),
      new THREE.Vector3(0.95 * L, 0.9 * L, -0.38 * L), new THREE.Vector3(0.9 * L, 1.5 * L, -0.28 * L)]);
    const cBlack = cFur.clone(), cTip = cWhite.clone();
    const colFn = (t) => t < 0.78 ? cBlack : t > 0.85 ? cTip : cBlack.clone().lerp(cTip, (t - 0.78) / 0.07);
    const rBase = (t) => { const cap = t > 0.93 ? Math.sqrt(Math.max(0, 1 - ((t - 0.93) / 0.07) ** 2)) : 1; return (0.13 + 0.07 * t) * cap; };
    addM(tailPivot, taperTube(curve, rBase, colFn, 20, 8), M.vcol);
    parts.tail = tailPivot;
    const hs = P.head, headY = (0.3 + 1.3 * bs) - 0.25 + RY * hs;
    const head = grp(motion, [0, headY, 0.1]); head.scale.setScalar(hs);
    addM(head, SPH_HI, M.fur, { s: [RX, RY, RZ] });
    parts.head = head; parts.headY = headY;
    parts.ears = [];
    for (const side of [-1, 1]) {
      const pivot = grp(head, [side * 0.68, 0.6, -0.02]); pivot.userData.side = side; pivot.scale.setScalar(P.ear);
      const shape = grp(pivot); shape.scale.z = 0.55;
      addM(shape, earShape(0.5, 0.82, 0.09, 12), M.fur); addM(shape, earShape(0.33, 0.58, 0.06, 10), M.earPink, { p: [0, 0.08, 0.2] });
      parts.ears.push(pivot);
    }
    parts.eyes = [];
    for (const side of [-1, 1]) {
      const anchor = new THREE.Group(); head.add(anchor); place(anchor, side * 0.5, -0.04, 0.0);
      const eg = grp(anchor); eg.userData.side = side; const ballG = grp(eg);
      addM(ballG, SPH_MD, M.ring, { s: [0.31, 0.38, 0.1] }); addM(ballG, SPH_MD, M.eye, { s: [0.27, 0.34, 0.11], p: [0, 0, 0.014] });
      addM(ballG, SPH_LO, M.glow, { s: [0.19, 0.14, 0.11], p: [0, -0.14, 0.03] }); addM(ballG, SPH_LO, M.pupil, { s: [0.115, 0.21, 0.11], p: [0, 0.0, 0.045] });
      addM(ballG, SPH_LO, M.hi, { s: [0.085, 0.095, 0.05], p: [-0.09, 0.13, 0.115] }); addM(ballG, SPH_LO, M.hi, { s: [0.04, 0.04, 0.03], p: [0.09, -0.15, 0.115] });
      parts.eyes.push({ eg, side });
    }
    const nose = new THREE.Group(); head.add(nose); place(nose, 0, -0.27, 0.0); addM(nose, SPH_LO, M.pink, { s: [0.095, 0.07, 0.07], p: [0, 0, 0.02] });
    const mouth = new THREE.Group(); head.add(mouth); place(mouth, 0, -0.43, 0.012);
    const arcGeo = new THREE.TorusGeometry(0.075, 0.019, 6, 10, Math.PI);
    for (const s of [-1, 1]) addM(mouth, arcGeo, M.mouth, { p: [s * 0.075, 0, 0], r: [0, 0, Math.PI] });
    addM(mouth, new THREE.CapsuleGeometry(0.017, 0.07, 2, 5), M.mouth, { p: [0, 0.1, 0] });
    const wGeo = new THREE.CylinderGeometry(0.012, 0.01, 0.75, 4); wGeo.translate(0, 0.31, 0);
    for (const side of [-1, 1]) for (const [ang, dy] of [[0.24, 0.0], [0.0, -0.07], [-0.24, -0.14]]) {
      const w = new THREE.Group(); head.add(w); place(w, side * 0.64, -0.38 + dy, 0.0);
      const m = addM(w, wGeo, M.whisker); m.rotation.set(0, side * 0.12, -side * (Math.PI / 2 - ang));
    }
    return parts;
  }

  return function make() {
    const p = buildCat();
    let nextBlink = 1.5, blinkT = -1, wasDouble = false;
    function update(state, t, dt) {
      if (blinkT < 0 && t > nextBlink) blinkT = 0;
      let blink = 0;
      if (blinkT >= 0) {
        blinkT += dt; blink = Math.sin(Math.min(1, blinkT / 0.14) * Math.PI);
        if (blinkT > 0.14) { blinkT = -1; if (Math.random() < 0.3 && !wasDouble) { wasDouble = true; nextBlink = t + 0.09; } else { wasDouble = false; nextBlink = t + 2 + Math.random() * 3; } }
      }
      let bob = 0, sx = 1, sy = 1, rz = 0, headRz = 0, armUp = 0, swing = 0, legSw = 0;
      const breath = Math.sin(t * 2.2) * 0.02;
      let tailY = Math.sin(t * 1.3) * 0.3;
      if (state === 'walk') {
        const w = Math.sin(t * 7); bob = Math.abs(w) * 0.09; rz = w * 0.07; swing = w * 0.8; legSw = w * 0.7; headRz = -w * 0.04; tailY = Math.sin(t * 3.5) * 0.35;
      } else if (state === 'air') {
        armUp = 0.9; legSw = 0.35; tailY = Math.sin(t * 6) * 0.3; sy = 1.06; sx = 1 / Math.sqrt(sy);
      } else if (state === 'happy') {
        const u = (t % 1.1) / 1.1; let h = 0, sq = 0;
        if (u < 0.2) sq = Math.sin(u / 0.2 * Math.PI) * -0.18;
        else if (u < 0.9) { const v = (u - 0.2) / 0.7; h = Math.sin(v * Math.PI) * 0.9; sq = Math.sin(v * Math.PI) * 0.12; }
        else sq = Math.sin((u - 0.9) / 0.1 * Math.PI) * -0.12;
        sy = 1 + sq; sx = 1 / Math.sqrt(sy); bob = h; armUp = Math.min(1, h * 1.4) * 0.9; legSw = h > 0.02 ? 0.35 : 0; tailY = Math.sin(t * 15) * 0.8;
      }
      p.motion.position.y = bob; p.motion.scale.set(sx, sy, sx); p.motion.rotation.z = rz;
      p.torso.scale.set(p.bodyScale, p.bodyScale * (1 + breath), p.bodyScale);
      p.head.position.y = p.headY + breath * 1.4 * 0.6; p.head.rotation.z = headRz;
      p.arms.forEach((a) => { const sd = a.userData.side; a.rotation.z = sd * (0.42 + armUp * 1.2); a.rotation.x = state === 'walk' ? (sd > 0 ? 1 : -1) * swing : 0; });
      p.legs.forEach((l) => { l.rotation.x = (l.userData.side > 0 ? -1 : 1) * legSw; });
      p.tail.rotation.y = tailY; p.tail.rotation.x = -0.05;
      p.ears.forEach((e) => { e.rotation.z = -e.userData.side * 0.38; e.rotation.x = 0.1; });
      p.eyes.forEach((e) => { e.eg.scale.set(1, Math.max(0.08, 1 - 0.9 * blink), 1); });
      return { hop: bob };
    }
    return { root: p.root, fit: 1.62 / 3.25, shadowR: 0.62, h: 1.62, update };
  };
})();

const makeCatQuad = (() => {
  const GRAD = new THREE.DataTexture(new Uint8Array([85, 170, 255]), 3, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true;
  function toon(color, rim = 0, opts = {}) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...opts });
    if (rim > 0) {
      m.onBeforeCompile = (s) => {
        s.uniforms.rimColor = { value: new THREE.Color('#8e9bff') }; s.uniforms.rimK = { value: rim };
        s.fragmentShader = s.fragmentShader
          .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimK;\nvoid main() {')
          .replace('#include <opaque_fragment>',
            'float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.4);\n' +
            'outgoingLight += rimColor * rimF * rimK;\n#include <opaque_fragment>');
      };
      m.customProgramCacheKey = () => 'rim' + rim;
    }
    return m;
  }
  const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
  function ell(parent, mat, r, pos, seg = [14, 10]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg[0], seg[1]), mat);
    m.scale.set(r[0], r[1], r[2]); m.position.set(pos[0], pos[1], pos[2]); parent.add(m); return m;
  }
  const HR = { a: 0.67, b: 0.575, c: 0.6 };
  const _n = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  function onHead(x, y, off = 0, outPos = new THREE.Vector3(), outQ = null) {
    const t = 1 - (x / HR.a) ** 2 - (y / HR.b) ** 2;
    const z = HR.c * Math.sqrt(Math.max(0.0001, t));
    _n.set(x / (HR.a * HR.a), y / (HR.b * HR.b), z / (HR.c * HR.c)).normalize();
    outPos.set(x, y, z).addScaledVector(_n, off);
    if (outQ) outQ.setFromUnitVectors(_z, _n);
    return outPos;
  }
  const C = { shadeK: 0.65, earPink: '#f2a1a8', pink: '#ff8fa0', ring: '#2a5fb0', navy: '#232a5a', pupil: '#10153a', brow: '#7a7092', mouth: '#f7a6b4' };
  const P = { fur: '#2b2733', white: '#f7f1ee', eyes: '#4aa8f0', collar: '#d8323c', head: 1, ear: 1, tail: 1, leg: 1, ringSize: 0.9, ringThick: 0.085, ringY: 0.17, ringZ: 0, ringTilt: -6, xSize: 0.92 };

  function buildCat(p) {
    const furC = new THREE.Color(p.fur), shadeC = furC.clone().multiplyScalar(C.shadeK);
    const M = {
      fur: toon(furC, 0.55), shade: toon(shadeC, 0.55), white: toon(p.white, 0.12), pink: toon(C.pink), earPink: toon(C.earPink),
      eyeRing: toon(C.ring), iris: toon(p.eyes), pupil: toon(C.pupil), glint: basic('#ffffff'), brow: toon(C.brow), nose: toon(C.pink),
      mouth: toon(C.mouth), collar: toon(p.collar, 0.1), navy: toon(C.navy), whisk: basic('#f1ebf5'),
    };
    const root = new THREE.Group();
    const L = p.leg, BY = 0.4 + 0.5 * L, legH = BY - 0.3;
    const body = new THREE.Group(); body.position.y = BY; root.add(body);
    const torso = new THREE.Group(); body.add(torso);
    ell(torso, M.fur, [0.72, 0.68, 0.95], [0, 0, -0.1], [24, 16]);
    const bib = new THREE.Group(); torso.add(bib);
    ell(bib, M.white, [0.36, 0.42, 0.3], [0, -0.3, 0.58], [14, 10]);
    ell(bib, M.white, [0.2, 0.24, 0.2], [-0.22, -0.4, 0.54], [8, 6]); ell(bib, M.white, [0.2, 0.24, 0.2], [0.22, -0.4, 0.54], [8, 6]);
    const collar = new THREE.Group(); torso.add(collar);
    const ringR = 0.56 * p.ringSize;
    collar.position.set(0, 0.14 + p.ringY, 0.5 + p.ringZ);
    const band = new THREE.Mesh(new THREE.TorusGeometry(ringR, p.ringThick, 8, 40), M.collar); band.rotation.x = -0.55; collar.add(band);
    const pendant = new THREE.Group(); torso.add(pendant);
    const barG = new RoundedBoxGeometry(0.4, 0.085, 0.07, 1, 0.03);
    for (const a of [0.72, -0.72]) { const b = new THREE.Mesh(barG, M.navy); b.rotation.z = a; b.position.set(0, -0.25, 0.17); pendant.add(b); }
    const ringT = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 5, 10), M.collar); ringT.position.set(0, -0.06, 0.04); pendant.add(ringT);

    const head = new THREE.Group(); body.add(head); head.scale.setScalar(p.head);
    ell(head, M.fur, [HR.a, HR.b, HR.c], [0, 0, 0], [24, 16]);
    const earRig = { L: null, R: null };
    const outerG = new THREE.ExtrudeGeometry(roundedPoly([new THREE.Vector2(-0.27, 0), new THREE.Vector2(0.27, 0), new THREE.Vector2(0.03, 0.66)], 0.13),
      { depth: 0.07, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2, curveSegments: 4 });
    outerG.translate(0, 0, -0.035);
    const innerG = new THREE.ExtrudeGeometry(roundedPoly([new THREE.Vector2(-0.16, 0.07), new THREE.Vector2(0.16, 0.07), new THREE.Vector2(0.02, 0.49)], 0.09),
      { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 });
    innerG.translate(0, 0, -0.015);
    for (const side of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(side * 0.4, 0.38, 0.17); e.scale.setScalar(p.ear);
      e.add(new THREE.Mesh(outerG, M.shade));
      const inner = new THREE.Mesh(innerG, M.earPink); inner.position.z = 0.075; e.add(inner);
      head.add(e); earRig[side < 0 ? 'L' : 'R'] = e;
    }
    const face = new THREE.Group(); head.add(face);
    const eyes = [];
    const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    for (const side of [-1, 1]) {
      const anchor = new THREE.Group(); onHead(side * 0.285, -0.03, -0.005, tmpP, tmpQ); anchor.position.copy(tmpP); anchor.quaternion.copy(tmpQ); face.add(anchor);
      const rig = new THREE.Group(); anchor.add(rig);
      ell(rig, M.eyeRing, [0.18, 0.235, 0.045], [0, 0, 0], [14, 8]); ell(rig, M.iris, [0.15, 0.2, 0.04], [0, 0, 0.014], [14, 8]);
      const pupilG = new THREE.Group(); pupilG.position.z = 0.03; rig.add(pupilG); ell(pupilG, M.pupil, [0.075, 0.125, 0.04], [0, 0, 0], [8, 6]);
      ell(rig, M.glint, [0.052, 0.052, 0.03], [-0.058, 0.075, 0.058], [8, 5]); ell(rig, M.glint, [0.026, 0.026, 0.02], [0.065, -0.085, 0.052], [6, 4]);
      const browA = new THREE.Group(); onHead(side * 0.27, 0.31, 0, tmpP, tmpQ); browA.position.copy(tmpP); browA.quaternion.copy(tmpQ); face.add(browA);
      ell(browA, M.brow, [0.1, 0.026, 0.02], [0, 0, 0.004], [6, 4]);
      eyes.push({ side, rig });
    }
    const nose = ell(face, M.nose, [0.058, 0.045, 0.04], onHead(0, -0.17, 0.005).toArray(), [10, 8]); nose.quaternion.setFromUnitVectors(_z, _n);
    const mouthPts = [[-0.125, -0.252], [-0.095, -0.283], [-0.05, -0.29], [-0.012, -0.262], [0, -0.24], [0.012, -0.262], [0.05, -0.29], [0.095, -0.283], [0.125, -0.252]];
    const tube = (pts, radius, mat, seg) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2] || 0)), false, 'centripetal');
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, 5, false), mat); face.add(m); return m;
    };
    tube(mouthPts.map((a) => onHead(a[0], a[1], 0.006).toArray()), 0.0095, M.mouth, 18);
    tube([onHead(0, -0.205, 0.006).toArray(), onHead(0, -0.24, 0.006).toArray()], 0.0095, M.mouth, 2);
    const whG = new THREE.CylinderGeometry(0.0065, 0.0035, 0.4, 4, 1);
    for (const side of [-1, 1]) for (const vy of [0.24, 0, -0.22]) {
      const d = new THREE.Vector3(side * 0.95, vy, 0.28).normalize();
      const base = onHead(side * 0.2, -0.17 + vy * 0.06, 0);
      const w = new THREE.Mesh(whG, M.whisk); w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      w.position.copy(base).addScaledVector(d, 0.19); face.add(w);
    }
    const legs = [];
    const legCaps = new THREE.CapsuleGeometry(0.17, Math.max(0.05, legH - 0.34), 2, 7); legCaps.translate(0, -legH / 2, 0);
    const sockG = new THREE.SphereGeometry(1, 10, 7), pawG = new THREE.SphereGeometry(1, 10, 7), padG = new THREE.SphereGeometry(1, 6, 4);
    const defs = [{ f: true, x: -0.36, z: 0.45, ph: 0 }, { f: true, x: 0.36, z: 0.45, ph: Math.PI }, { f: false, x: -0.42, z: -0.62, ph: Math.PI }, { f: false, x: 0.42, z: -0.62, ph: 0 }];
    for (const d of defs) {
      const g = new THREE.Group(); const hipY = d.f ? -0.3 : -0.28; g.position.set(d.x, hipY, d.z); body.add(g);
      g.add(new THREE.Mesh(legCaps, M.fur));
      const sock = new THREE.Mesh(sockG, M.white); sock.scale.set(0.185, 0.22, 0.19); sock.position.set(0, -legH + 0.23, 0.02); g.add(sock);
      const paw = new THREE.Mesh(pawG, M.white); paw.scale.set(0.185, 0.11, 0.23); paw.position.set(0, -legH + 0.1, 0.07); g.add(paw);
      const pad = new THREE.Mesh(padG, M.pink); pad.scale.set(0.06, 0.03, 0.05); pad.position.set(0, -legH + 0.04, 0.22); g.add(pad);
      legs.push({ g, front: d.f, phase: d.ph, hip: new THREE.Vector3(d.x, hipY, d.z) });
    }
    const tailRoot = new THREE.Group(); tailRoot.position.set(0.1, -0.1, -1.0); body.add(tailRoot);
    const N = 7, segLen = (1.25 * p.tail) / N, tailSegs = []; let parent = tailRoot;
    for (let i = 0; i < N; i++) {
      const g = new THREE.Group(); g.position.y = i === 0 ? 0 : segLen; parent.add(g);
      const r = lerp(0.135, 0.09, i / (N - 1));
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, segLen, 2, 7), i >= N - 2 ? M.white : M.fur); m.position.y = segLen / 2; g.add(m); tailSegs.push({ g, m }); parent = g;
    }
    return { root, dims: { BY, legH }, body, torso, head, earRig, eyes, legs, tail: { root: tailRoot, segs: tailSegs }, collar, pendant, ringR, cpos: [0.14 + p.ringY, 0.5 + p.ringZ], tilt: p.ringTilt * Math.PI / 180, xSize: p.xSize };
  }

  return function make() {
    const c = buildCat(P);
    let blinkAt = 2, blinkT = -1;
    function update(state, t, dt) {
      const D = c.dims, eff = state === 'walk' ? 'walk' : 'idle';
      let dy = 0, pitch = 0, sx = 1, sy = 1, sz = 1, headNod = 0, tailAmp = 0.12, tailSpd = 1.5;
      const lift = [0, 0, 0, 0], legSwing = [0, 0, 0, 0];
      const breath = Math.sin(t * 1.9);
      if (eff === 'idle') { sy += breath * 0.02; sx -= breath * 0.008; headNod = breath * 0.012; }
      if (eff === 'walk') {
        const w = t * 9;
        c.legs.forEach((l, i) => { const s = Math.sin(w + l.phase); legSwing[i] = -s * 0.55; lift[i] = Math.max(0, Math.cos(w + l.phase)) * 0.13; });
        dy = Math.abs(Math.sin(w)) * 0.05; pitch = Math.sin(w * 2) * 0.025; headNod = Math.sin(w * 2) * 0.03; tailAmp = 0.2; tailSpd = 4;
      }
      const by = D.BY;
      c.body.position.y = by + dy; c.body.rotation.x = pitch;
      c.torso.scale.set(sx, sy, sz);
      c.pendant.scale.setScalar(c.xSize);
      const psi = c.tilt;
      c.collar.rotation.x = psi;
      const yb = -c.ringR * Math.cos(0.55), zb = c.ringR * Math.sin(0.55);
      c.pendant.position.set(0, c.cpos[0] + yb * Math.cos(psi) - zb * Math.sin(psi), c.cpos[1] + yb * Math.sin(psi) + zb * Math.cos(psi));
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      c.legs.forEach((l, i) => {
        const hipY = by + l.hip.y * cp - l.hip.z * sp;
        const sw = legSwing[i];
        if (l.front) {
          l.g.rotation.x = -pitch + sw;
          l.g.scale.set(1, clamp((hipY - lift[i]) / D.legH, 0.35, 1.45), 1);
        } else {
          l.g.rotation.x = -pitch + sw;
          l.g.scale.set(1, clamp((hipY - lift[i]) / D.legH, 0.35, 1.45), 1);
        }
        l.g.position.x = l.hip.x;
      });
      c.head.position.set(0, 0.58 - 0.0, 0.78);
      c.head.rotation.x = -pitch * 0.9 + headNod;
      c.head.rotation.z = 0;
      c.head.rotation.y = eff === 'walk' ? Math.sin(t * 4.5) * 0.06 : Math.sin(t * 0.7) * 0.04;
      c.earRig.L.rotation.z = 0.3 + 0.03 * Math.sin(t * 2.3); c.earRig.R.rotation.z = -(0.3) - 0.03 * Math.sin(t * 2.3 + 1);
      c.earRig.L.rotation.x = c.earRig.R.rotation.x = 0.15;
      if (blinkT < 0 && t > blinkAt) blinkT = 0;
      let blinkMul = 1;
      if (blinkT >= 0) { blinkT += dt; const q = blinkT / 0.15; if (q >= 1) { blinkT = -1; blinkAt = t + 2.2 + Math.random() * 3; } else blinkMul = 1 - 0.93 * Math.sin(q * Math.PI); }
      for (const e of c.eyes) e.rig.scale.set(1, Math.max(0.05, blinkMul), 1);
      const tl = c.tail;
      tl.root.rotation.x = -0.6; tl.root.position.y = -0.1; tl.root.rotation.z = -0.28;
      tl.segs.forEach((s, i) => { s.g.rotation.x = 0.17; s.g.rotation.z = Math.sin(t * tailSpd - i * 0.55) * tailAmp * (0.3 + i * 0.13); });
      return { hop: dy };
    }
    return { root: c.root, fit: 1.5 / 2.05, shadowR: 0.85, h: 1.5, update };
  };
})();

const CHAR = { chibi: makeCatChibi, quad: makeCatQuad, legs: makeLegsRobot };

/* actor wrapper: position / facing / scale / contact shadow */
function makeActor(kind) {
  const f = CHAR[kind]();
  const g = new THREE.Group(); g.add(f.root);
  const shadow = blobShadow(1);
  const a = {
    g, f, kind, shadow, x: 0, y: 0, z: 0, yaw: 0, yawT: 0, state: 'idle', speed: 0, charScale: 1, h: f.h,
    setScale(s) { a.charScale = s; g.scale.setScalar(f.fit * s); },
    place(x, z, y = 0) { a.x = x; a.z = z; a.y = y; },
    snap() { a.yaw = a.yawT; },
    step(t, dt) {
      a.yaw += angDiff(a.yaw, a.yawT) * (1 - Math.exp(-dt * 9));
      g.rotation.y = a.yaw; g.position.set(a.x, a.y, a.z);
      f.update(a.state, t, dt, { carry: a.carry, speed: a.speed, spin: a.speed / (0.55 * f.fit * a.charScale) });
      const r = f.shadowR * f.fit * a.charScale * (1 - clamp(a.y * 0.12, 0, 0.35));
      shadow.position.set(a.x, 0.02, a.z); shadow.scale.setScalar(r * 2 * 1.5);
      shadow.material.opacity = 1 - clamp(a.y * 0.25, 0, 0.5);
    },
  };
  a.setScale(1);
  return a;
}
