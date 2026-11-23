/* ================= props (all from primitives) ================= */
function clipMat(hex, plane = GROUND_CLIP) { return toonNew(hex, { clippingPlanes: plane }); }

/* wooden door in a frame; the panel sinks into the floor when open */
function makeDoor({ h = 3.6, L = 1.5 } = {}) {
  /* side view: hinge post + thin leaf seen edge-on; leaf swings about the vertical hinge toward the viewer */
  const g = new THREE.Group(), hz = -0.7;
  g.add(at(rbox(0.3, h + 0.1, 0.3, PAL.wood3, 0.1), 0, (h + 0.1) / 2, hz));
  g.add(at(ball(0.2, PAL.honey, 1, 0.8, 1, 12, 8), 0, h + 0.14, hz));
  const panel = new THREE.Group(); panel.position.set(0, 0, hz); g.add(panel);
  panel.add(at(rbox(0.14, h, L, PAL.wood4, 0.06), 0, h / 2, L / 2 + 0.12));
  for (const f of [0.2, 0.78]) panel.add(at(rbox(0.06, 0.26, L - 0.2, PAL.wood3, 0.03, 1), -0.09, h * f, L / 2 + 0.12));
  for (let i = 1; i <= 2; i++) panel.add(at(rbox(0.03, h - 0.4, 0.04, PAL.wood3, 0.012, 1), -0.075, h / 2, 0.12 + i * L / 3));
  panel.add(at(ball(0.1, PAL.honey, 1, 1, 1, 12, 8), -0.12, h * 0.47, L - 0.12));
  for (const f of [0.2, 0.78]) panel.add(at(rbox(0.2, 0.12, 0.1, PAL.honey, 0.04, 1), 0.0, h * f, 0.06));
  return { g, panel, h, set(open) { panel.rotation.y = open * 1.5; } };
}

/* round red floor button with a wooden ring */
function makeButton() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.86, 0], [0.9, 0.05], [0.9, 0.12], [0.84, 0.18], [0.74, 0.18], [0.7, 0.14], [0.68, 0.08], [0, 0.08]], PAL.wood3, 28));
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(at(ball(0.07, PAL.honey, 1, 0.7, 1, 8, 6), Math.cos(a) * 0.8, 0.17, Math.sin(a) * 0.8)); }
  const capMat = toonNew('#e0553f');
  const cap = new THREE.Group(); g.add(cap);
  const dome = lathe([[0, 0], [0.6, 0], [0.64, 0.05], [0.64, 0.11], [0.57, 0.2], [0.4, 0.25], [0, 0.27]], capMat, 28); cap.add(dome);
  cap.add(at(ball(0.15, '#ffd2c4', 1, 0.25, 0.7, 10, 6), -0.2, 0.265, 0.16));
  cap.position.y = 0.12;
  const up = new THREE.Color('#e0553f'), down = new THREE.Color('#bf3f2b');
  return { g, set(v) { cap.position.y = 0.12 - 0.11 * v; capMat.color.copy(up).lerp(down, v); } };
}

/* goal flag on a small round base; the cloth waves */
function makeFlag() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.38, 0], [0.42, 0.04], [0.4, 0.12], [0.3, 0.18], [0.1, 0.2], [0, 0.2]], PAL.wood3, 24));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 10), toonM(PAL.cream3)); pole.position.y = 1.35; g.add(pole);
  g.add(at(ball(0.11, PAL.honey, 1, 1, 1, 14, 10), 0, 2.6, 0));
  const N = 10, L = 1.25, H = 0.85, yc = 2.05;
  const pos = new Float32Array((N + 1) * 2 * 3), idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const cloth = new THREE.Mesh(geo, toonNew(PAL.red, { side: THREE.DoubleSide })); g.add(cloth);
  function wave(t, boost) {
    const p = geo.attributes.position;
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = 0.06 + u * L, half = (H / 2) * (1 - 0.8 * u), z = Math.sin(u * 5 - t * (4 + boost * 3)) * (0.07 + boost * 0.05) * u * 2.2, sag = -u * u * 0.1;
      p.setXYZ(i * 2, x, yc + half + sag, z); p.setXYZ(i * 2 + 1, x, yc - half + sag, z);
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  }
  wave(0, 0);
  return { g, update: (t, boost = 0) => wave(t, boost) };
}

/* hanging lamp; origin = ceiling anchor, swings gently */
function makeLamp({ len = 2.4 } = {}) {
  const g = new THREE.Group(), sw = new THREE.Group(); g.add(sw);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), toonM(PAL.wood1)); cord.position.y = -len / 2; sw.add(cord);
  sw.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.2, 12), toonM(PAL.wood2)), 0, -len - 0.02, 0));
  const shade = lathe([[0.14, 0], [0.2, -0.08], [0.34, -0.3], [0.52, -0.52], [0.7, -0.7]].reverse(), PAL.amber, 28, THREE.DoubleSide);
  shade.position.y = -len - 0.1; sw.add(shade);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.055, 8, 28), toonM(PAL.cream)); rim.rotation.x = Math.PI / 2; rim.position.y = -len - 0.8; sw.add(rim);
  sw.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), basicM('#fff1c0')), 0, -len - 0.62, 0));
  const glow = glowSprite(5.2, 0.85); glow.position.set(0, -len - 0.85, -0.3); glow.renderOrder = -1; sw.add(glow);
  return { g, glow, update: (t, ph = 0) => { sw.rotation.z = Math.sin(t * 0.95 + ph) * 0.06; glow.material.opacity = 0.78 + 0.08 * Math.sin(t * 1.7 + ph); } };
}

/* wooden crate: rounded body, darker corner posts and rims */
function makeCrate({ s = 1 } = {}) {
  const g = new THREE.Group();
  g.add(at(rbox(1, 1, 1, PAL.crate, 0.12), 0, 0.5, 0));
  for (const y of [0.13, 0.87]) g.add(at(rbox(1.06, 0.18, 1.06, PAL.crateDark, 0.07, 1), 0, y, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(rbox(0.15, 1.04, 0.15, PAL.crateDark, 0.06, 1), sx * 0.46, 0.52, sz * 0.46));
  for (const x of [-0.18, 0.18]) g.add(at(rbox(0.04, 0.02, 0.8, '#8a5430', 0.01, 1), x, 1.012, 0));
  g.scale.setScalar(s); return { g };
}

/* chunky rounded gold star */
function makeStar({ s = 1 } = {}) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.27 : 0.52; pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r)); }
  const geo = new THREE.ExtrudeGeometry(roundedPoly(pts, 0.085), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 5 });
  geo.center();
  const body = new THREE.Mesh(geo, toonNew('#ffc93c', { emissive: '#8a5a00', emissiveIntensity: 0.55 }));
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(body); g.add(inner);
  const glow = glowSprite(2.2, 0.6); glow.position.z = -0.35; glow.renderOrder = -1; g.add(glow);
  g.scale.setScalar(s);
  return { g, inner, glow, update: (t) => { inner.rotation.y = t * 2.1; inner.position.y = Math.sin(t * 2.6) * 0.06; glow.material.opacity = 0.5 + 0.15 * Math.sin(t * 3); } };
}

/* painted storage zone: sage paint, cream border, honey corner dots, box icon */
function makeZonePad({ w = 3.4 } = {}) {
  const g = new THREE.Group();
  g.add(paint(rrShape(w, w, 0.34), 0.05, '#9cc194', 0));
  g.add(paint(ringShape(w - 0.3, w - 0.3, 0.26, 0.1), 0.02, PAL.cream, 0.05));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(paint(rrShape(0.5, 0.5, 0.17), 0.03, PAL.honey, 0.05).translateX(sx * (w / 2 - 0.5)).translateZ(sz * (w / 2 - 0.5)));
  g.add(paint(ringShape(1.0, 1.0, 0.2, 0.13), 0.03, PAL.honey, 0.05));
  const ch = roundedPoly([new THREE.Vector2(-0.42, 0.18), new THREE.Vector2(0, -0.14), new THREE.Vector2(0.42, 0.18), new THREE.Vector2(0.42, 0.42), new THREE.Vector2(0, 0.1), new THREE.Vector2(-0.42, 0.42)], 0.07);
  for (const z of [-1.0, -0.62]) g.add(paint(ch, 0.025, PAL.cream, 0.05).translateZ(z));
  return { g };
}

/* round goal pad: sage disc, cream ring, honey star */
function makeGoalPad() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.98, 0], [1.02, 0.03], [1.02, 0.07], [0.96, 0.1], [0, 0.1]], '#9cc194', 32));
  g.add(lathe([[0.66, 0.1], [0.68, 0.125], [0.8, 0.125], [0.82, 0.1]], PAL.cream, 32));
  const pts = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.17 : 0.36; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  g.add(paint(roundedPoly(pts, 0.06), 0.035, PAL.honey, 0.1));
  return { g };
}

/* plank bridge over a gap (planks laid across the walking direction) */
function makeBridge({ len = 4, wid = 7.6 } = {}) {
  const g = new THREE.Group(), n = 9, pw = len / n, planks = [];
  const mats = [clipMat('#b87a40', WATER_CLIP), clipMat('#a86c35', WATER_CLIP)];
  for (let i = 0; i < n; i++) {
    const p = rbox(pw - 0.07, 0.18, wid, mats[i % 2], 0.07, 1); const x = -len / 2 + pw * (i + 0.5);
    p.position.set(x, -0.09, 0); g.add(p); planks.push({ p, x });
  }
  const beams = new THREE.Group(); g.add(beams);
  for (const s of [-1, 1]) beams.add(at(rbox(len + 0.3, 0.26, 0.28, PAL.wood3, 0.1), 0, -0.14, s * (wid / 2 + 0.02)));
  const rails = new THREE.Group(); g.add(rails);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    rails.add(at(rbox(0.22, 0.85, 0.22, PAL.wood3, 0.09), sx * (len / 2 + 0.05), 0.42, sz * (wid / 2 + 0.02)));
    rails.add(at(ball(0.13, PAL.honey, 1, 1, 1, 10, 8), sx * (len / 2 + 0.05), 0.92, sz * (wid / 2 + 0.02)));
  }
  for (const sz of [-1, 1]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len + 0.1, 8), toonM(PAL.cream3)); rope.rotation.z = Math.PI / 2; rope.position.set(0, 0.68, sz * (wid / 2 + 0.02)); rails.add(rope); }
  function set(v) {
    const stag = 0.55;
    planks.forEach(({ p, x }, i) => {
      const k = clamp((v - (i / (n - 1)) * stag) / (1 - stag), 0, 1), e = outBack(k) ;
      p.visible = k > 0.01; p.position.y = -0.09 - (1 - Math.min(1, e)) * 1.1; p.rotation.z = (1 - k) * 0.5 * (i % 2 ? 1 : -1); p.position.x = x;
    });
    const r = sm01((v - 0.35) / 0.65); rails.scale.y = Math.max(0.001, r); rails.visible = r > 0.01; beams.visible = v > 0.2;
  }
  set(1);
  return { g, set };
}

/* fence-style gate: pickets sink into the floor when open */
function makeGate({ h = 1.9, L = 1.5 } = {}) {
  /* side view: hinge post + thin picket leaf seen edge-on; leaf swings about the vertical hinge toward the viewer */
  const g = new THREE.Group(), hz = -0.7;
  g.add(at(rbox(0.3, h + 0.1, 0.3, PAL.wood3, 0.1), 0, (h + 0.1) / 2, hz));
  g.add(at(ball(0.2, PAL.honey, 1, 0.8, 1, 12, 8), 0, h + 0.14, hz));
  const leaves = new THREE.Group(); leaves.position.set(0, 0, hz); g.add(leaves);
  for (const y of [0.4, h - 0.4]) leaves.add(at(rbox(0.1, 0.18, L, PAL.wood3, 0.04, 1), 0, y, L / 2 + 0.12));
  const n = 6;
  for (let i = 0; i < n; i++) leaves.add(at(rbox(0.12, h - 0.1, 0.17, PAL.wood4, 0.05), -0.07, (h - 0.1) / 2 + 0.05, 0.3 + i * (L - 0.3) / (n - 1)));
  for (const y of [0.4, h - 0.4]) leaves.add(at(rbox(0.2, 0.12, 0.1, PAL.honey, 0.04, 1), 0, y, 0.06));
  return { g, leaves, h, set(open) { leaves.rotation.y = open * 1.5; } };
}

/* planks floor chunk / tile chunk with rounded slab */
function makeFloorChunk({ w = 3.2, d = 3.2, style = 'plank', seed = 4 } = {}) {
  const g = new THREE.Group();
  g.add(at(rbox(w, 0.5, d, '#8a5a34', 0.14), 0, -0.25, 0));
  const q = style === 'tile'
    ? tilesTop({ x0: -w / 2 + 0.1, x1: w / 2 - 0.1, y: 0.004, z0: -d / 2 + 0.1, z1: d / 2 - 0.1, s: 1.0, seed })
    : rowsTop({ x0: -w / 2 + 0.1, x1: w / 2 - 0.1, y: 0.004, zBack: -d / 2 + 0.1, zFront: d / 2 - 0.1, rowW: 0.62, minL: 1.2, maxL: 2.2, cols: FLOOR_COLS, seed });
  g.add(boardMesh(q));
  g.add(boardMesh(rowsFront({ x0: -w / 2 + 0.14, x1: w / 2 - 0.14, y0: -0.4, y1: -0.12, z: d / 2 + 0.004, courseH: 0.28, minL: 1.2, maxL: 2.4, cols: SIDE_COLS, seed: seed + 1 })));
  return { g };
}

/* back wall: cream boards above a wood wainscot, chair rail and skirting */
function makeBackWall({ x0 = -17, x1 = 17, h = 10, z = -1.6, thick = false } = {}) {
  const g = new THREE.Group(), W = x1 - x0, cx = (x0 + x1) / 2;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, h), toonM('#b98a55')); back.position.set(cx, h / 2, z); g.add(back);
  g.add(boardMesh(colsFront({ x0, x1, y0: 1.55, y1: h, z: z + 0.008, w: 1.1, cols: WALL_COLS, seed: 5 })));
  g.add(boardMesh(rowsFront({ x0, x1, y0: 0.32, y1: 1.42, z: z + 0.008, courseH: 0.55, minL: 2.5, maxL: 4.5, cols: WAIN_COLS, seed: 6 })));
  g.add(at(rbox(W, 0.18, 0.26, PAL.wood3, 0.07, 1), cx, 1.48, z + 0.12));
  g.add(at(rbox(W, 0.34, 0.22, PAL.wood2, 0.08, 1), cx, 0.17, z + 0.1));
  if (thick) g.add(at(rbox(W + 0.2, h + 0.2, 0.3, PAL.wood2, 0.1, 1), cx, h / 2, z - 0.17));
  return { g };
}

/* chunky wooden floor strip seen from the side (stage floor) */
function makeSideFloor({ x0 = -17, x1 = 17 } = {}) {
  const g = new THREE.Group(), W = x1 - x0, cx = (x0 + x1) / 2, D = 2.8, T = 3.8;
  g.add(at(rbox(W, T, D, '#8a5a34', 0.22), cx, -T / 2, 0));
  g.add(boardMesh(rowsTop({ x0, x1, y: 0.006, zBack: -D / 2 + 0.24, zFront: D / 2 - 0.24, rowW: 0.58, minL: 2.2, maxL: 4, cols: FLOOR_COLS, seed: 7 })));
  g.add(boardMesh(rowsFront({ x0, x1, y0: -T + 0.24, y1: -0.24, z: D / 2 + 0.006, courseH: 0.94, minL: 2.4, maxL: 4.5, cols: SIDE_COLS, seed: 8 })));
  return { g };
}

/* raised tray for the 3D stages: floor slab + planks/tiles + low walls */
function makeTray({ x0 = -12.5, x1 = 12.5, z0 = -5.5, z1 = 5.5, style = 'plank', skip = null, seed = 11 } = {}) {
  const g = new THREE.Group(), W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, T = 0.9;
  const seg = (a, b) => {
    const w = b - a, c = (a + b) / 2;
    g.add(at(rbox(w, T, D, '#8a5a34', 0.16), c, -T / 2, cz));
    const q = style === 'tile'
      ? tilesTop({ x0: a + 0.12, x1: b - 0.12, y: 0.004, z0: z0 + 0.12, z1: z1 - 0.12, s: 0.9, gap: 0.05, seed })
      : rowsTop({ x0: a + 0.12, x1: b - 0.12, y: 0.004, zBack: z0 + 0.12, zFront: z1 - 0.12, rowW: 0.6, gap: 0.04, minL: 2.4, maxL: 4.2, cols: FLOOR_COLS, seed });
    g.add(boardMesh(q));
    g.add(boardMesh(rowsFront({ x0: a + 0.2, x1: b - 0.2, y0: -T + 0.14, y1: -0.14, z: z1 + 0.004, courseH: 0.62, minL: 2.6, maxL: 4.4, cols: SIDE_COLS, seed: seed + 3 })));
  };
  if (skip) { seg(x0, skip[0]); seg(skip[1], x1); } else seg(x0, x1);
  const wall = (w, h, d, x, z) => { g.add(at(rbox(w, h, d, PAL.wood3, 0.17), x, h / 2, z)); g.add(at(rbox(w + 0.06, 0.16, d + 0.16, PAL.wood5, 0.07, 1), x, h + 0.02, z)); };
  wall(W + 0.8, 0.95, 0.55, cx, z0 - 0.28);
  wall(0.55, 0.95, D + 0.55, x0 - 0.28, cz);
  wall(0.55, 0.95, D + 0.55, x1 + 0.28, cz);
  g.add(at(rbox(W + 0.8, 0.3, 0.4, PAL.wood3, 0.12, 1), cx, 0.15, z1 + 0.2));
  g.add(boardMesh(rowsFront({ x0: x0 + 0.1, x1: x1 - 0.1, y0: 0.14, y1: 0.8, z: z0 + 0.004, courseH: 0.33, minL: 2.6, maxL: 4.4, cols: WAIN_COLS, seed: seed + 5 })));
  return { g };
}

function makePlant() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.17, 0], [0.25, 0.26], [0.29, 0.28], [0.29, 0.36], [0.24, 0.36], [0, 0.32]], '#c06a3a', 18));
  const R = rng(9);
  for (let i = 0; i < 7; i++) {
    const leaf = ball(1, PAL.sage, 0.075, 0.34 + R() * 0.18, 0.04, 8, 6), a = i / 7 * Math.PI * 2;
    const holder = new THREE.Group(); holder.rotation.set(0, a, 0.22 + R() * 0.5); leaf.position.y = 0.45; holder.add(leaf); holder.position.y = 0.3; g.add(holder);
  }
  return { g };
}

function makeWindow() {
  const g = new THREE.Group();
  const w = 2.2, h = 1.8;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 4), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const cols = [], gp = glass.geometry.attributes.position, c = new THREE.Color();
  for (let i = 0; i < gp.count; i++) { c.set('#bfe3ee').lerp(new THREE.Color('#f7f1d6'), 1 - (gp.getY(i) + h / 2) / h); cols.push(c.r, c.g, c.b); }
  glass.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); glass.position.z = -0.02; g.add(glass);
  g.add(at(rbox(w + 0.4, 0.22, 0.26, PAL.wood3, 0.09), 0, h / 2 + 0.1, 0.05), at(rbox(w + 0.4, 0.22, 0.26, PAL.wood3, 0.09), 0, -h / 2 - 0.1, 0.05));
  for (const s of [-1, 1]) g.add(at(rbox(0.22, h + 0.44, 0.26, PAL.wood3, 0.09), s * (w / 2 + 0.1), 0, 0.05));
  g.add(at(rbox(0.08, h, 0.12, PAL.wood3, 0.03, 1), 0, 0, 0.05), at(rbox(w, 0.08, 0.12, PAL.wood3, 0.03, 1), 0, 0.05, 0.05));
  g.add(at(rbox(w + 0.9, 0.14, 0.5, PAL.wood4, 0.06), 0, -h / 2 - 0.3, 0.2));
  const pl = makePlant(); at(pl.g, 0.55, -h / 2 - 0.23, 0.22); pl.g.scale.setScalar(0.85); g.add(pl.g);
  return { g };
}

function makeShelf() {
  const g = new THREE.Group();
  g.add(at(rbox(2.8, 0.16, 0.7, PAL.wood4, 0.06), 0, 0, 0.35));
  for (const s of [-1, 1]) g.add(at(rbox(0.14, 0.5, 0.5, PAL.wood3, 0.05), s * 1.0, -0.3, 0.27));
  [['#e0553f', 0.5, -1.05], ['#93b58c', 0.44, -0.86], ['#ffb938', 0.52, -0.67]].forEach(([c, hh, x]) => g.add(at(rbox(0.16, hh, 0.4, c, 0.05, 1), x, 0.08 + hh / 2, 0.4)));
  g.add(at(lathe([[0, 0], [0.24, 0], [0.28, 0.1], [0.26, 0.44], [0.2, 0.5], [0, 0.5]], '#e9f1e6', 18), 0.35, 0.08, 0.38));
  g.add(at(lathe([[0, 0], [0.2, 0], [0.2, 0.08], [0, 0.08]], PAL.honey, 14), 0.35, 0.58, 0.38));
  const pl = makePlant(); at(pl.g, 1.0, 0.08, 0.36); pl.g.scale.setScalar(0.6); g.add(pl.g);
  return { g };
}
