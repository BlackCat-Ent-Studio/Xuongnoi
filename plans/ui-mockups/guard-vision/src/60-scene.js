
/* ================= scene: tray floor, goal, crates, guard + hero, vision fan ================= */
function baseScene() {
  const three = new THREE.Scene();
  three.add(new THREE.HemisphereLight(0xfff3dc, 0xa7753f, 1.7));
  const k = new THREE.DirectionalLight(0xffe2b8, 1.6); k.position.set(-4, 9, 8); three.add(k);
  return three;
}
function trayHost(parent, opts) {
  const h = new THREE.Group(); parent.add(h); let style = 'plank';
  const rebuild = () => { while (h.children.length) { const c = h.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } h.add(makeTray({ ...opts, style }).g); };
  rebuild();
  return { setStyle(s) { if (s !== style) { style = s; rebuild(); } } };
}
const FAN_YELLOW = new THREE.Color('#ffe033'), FAN_RED = new THREE.Color('#ff3a2a');
const EXCL_TEX = canvasTex(128, (g, s) => {
  g.fillStyle = '#e0301f'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#fff1d0'; g.stroke();
  g.fillStyle = '#fff1d0'; g.font = '800 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', s / 2, s / 2 + 6);
});

const laneMat = (hex) => toonNew(hex, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
function buildScene() {
  const three = baseScene(), root = new THREE.Group(); three.add(root);
  const host = trayHost(root, { x0: -11.8, x1: 11.8, z0: -5.0, z1: 4.7, seed: 21 });
  const goal = makeGoalPad(); at(goal.g, GVSim.GOAL.x, 0, GVSim.GOAL.z); goal.g.scale.setScalar(1.15); root.add(goal.g);
  const plant = makePlant(); at(plant.g, -11.0, 0, -4.2); plant.g.scale.setScalar(1.3); root.add(plant.g);

  // painted route: dashes between hiding spots + a mark on every spot; guard lane
  const lanes = new THREE.Group(); root.add(lanes);
  const routeG = new THREE.Group(); lanes.add(routeG);
  function buildRoute(route) {
    while (routeG.children.length) routeG.remove(routeG.children[0]);
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.floor(len / 0.9), ang = Math.atan2(b.x - a.x, b.z - a.z);
      for (let k = 1; k < n; k++) {
        const d = paint(rrShape(0.2, 0.5, 0.09), 0.02, laneMat(PAL.cream3), 0.0); d.rotation.y = ang + Math.PI / 2 * 0; d.position.set(a.x + (b.x - a.x) * k / n, 0.006, a.z + (b.z - a.z) * k / n); routeG.add(d);
      }
    }
    route.forEach((r, i) => { if (i === 0 || i === route.length - 1) return; const m = paint(ringShape(1.2, 1.2, 0.55, 0.12), 0.02, laneMat(PAL.honey), 0.0); m.position.set(r.x, 0.007, r.z); routeG.add(m); });
    const st = paint(ringShape(1.4, 1.4, 0.65, 0.12), 0.02, laneMat(PAL.cream), 0.0); st.position.set(route[0].x, 0.007, route[0].z); routeG.add(st);
  }
  const guardLane = new THREE.Group(); lanes.add(guardLane);
  function buildGuardLane(len) {
    while (guardLane.children.length) guardLane.remove(guardLane.children[0]);
    const z0 = GVSim.LANE_Z0, z1 = z0 + len;
    for (let z = z0; z <= z1 + 0.01; z += 0.7) { const d = paint(rrShape(0.2, 0.42, 0.08), 0.02, laneMat('#8d99ad'), 0.0); d.position.set(GVSim.GUARD_X, 0.006, z); guardLane.add(d); }
    for (const z of [z0, z1]) { const e = paint(ringShape(0.9, 0.9, 0.4, 0.1), 0.02, laneMat('#7b8798'), 0.0); e.position.set(GVSim.GUARD_X, 0.007, z); guardLane.add(e); }
  }

  // crates (taller than the cats so they really hide them)
  const crateGroup = new THREE.Group(); root.add(crateGroup);
  function buildCrates(list) {
    while (crateGroup.children.length) crateGroup.remove(crateGroup.children[0]);
    const k = GVSim.CRATE_SIZE;
    for (const [x, z] of list) { const c = makeCrate({ s: 1 }); c.g.scale.set(k, k * 1.25, k); at(c.g, x, 0, z); crateGroup.add(c.g); }
  }

  // vision fan: translucent triangle fan on the floor, fading towards the far edge, cut short by crates
  const MAXV = 2 + 73;
  const fanGeo = new THREE.BufferGeometry();
  fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3));
  fanGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXV * 4), 4));
  fanGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(MAXV * 3), 1));
  const fanMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: FAN_YELLOW, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const fan = new THREE.Mesh(fanGeo, fanMat); fan.renderOrder = 3; fan.frustumCulled = false; root.add(fan);
  const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXV * 3), 3));
  const edge = new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({ color: FAN_YELLOW, transparent: true, opacity: 0.95, depthWrite: false })); edge.renderOrder = 4; edge.frustumCulled = false; root.add(edge);
  function updateFan(P, g, crates, seen) {
    const pts = GVSim.fanOutline(P, g, crates), n = pts.length;
    const pos = fanGeo.attributes.position.array, col = fanGeo.attributes.color.array, idx = fanGeo.index.array, ep = edgeGeo.attributes.position.array, Y = 0.08;
    pos.set([g.x, Y, g.z], 0); col.set([1, 1, 1, 0.8], 0); ep.set([g.x, Y + 0.01, g.z], 0);
    pts.forEach((p, i) => { pos.set([p.x, Y, p.z], 3 * (i + 1)); col.set([1, 1, 1, 0.42], 4 * (i + 1)); ep.set([p.x, Y + 0.01, p.z], 3 * (i + 1)); });
    ep.set([g.x, Y + 0.01, g.z], 3 * (n + 1));
    for (let i = 0; i < n - 1; i++) idx.set([0, i + 1, i + 2], 3 * i);
    fanGeo.setDrawRange(0, 3 * (n - 1)); edgeGeo.setDrawRange(0, n + 2);
    fanGeo.attributes.position.needsUpdate = fanGeo.attributes.color.needsUpdate = fanGeo.index.needsUpdate = edgeGeo.attributes.position.needsUpdate = true;
    const c = seen ? FAN_RED : FAN_YELLOW; fanMat.color.copy(c); edge.material.color.copy(c);
  }

  // actors (cat hero, legs-robot guard) and the loss marker
  const hero = makeActor('chibi'), guard = makeActor('legs'); root.add(hero.g, hero.shadow, guard.g, guard.shadow);
  const excl = new THREE.Sprite(new THREE.SpriteMaterial({ map: EXCL_TEX, transparent: true, depthTest: false })); excl.scale.set(1.1, 1.1, 1); excl.renderOrder = 10; excl.visible = false; root.add(excl);

  const rt = {
    mode: '3d', three, lanes, viewH: 15.6, pitch: 0.82, yaw: 0.3, shift: 0.02, fov: 26, actors: [hero, guard], hero, setFloor: host.setStyle, buildCrates, buildRoute, buildGuardLane, T: 0, heroYaw: 1.2,
    sync(sim, dt) {
      rt.T += dt; const g = sim.g, h = sim.h;
      guard.place(g.x, g.z); guard.state = g.walking ? 'walk' : 'idle'; guard.speed = g.walking ? sim.P.guardSpeed : 0; guard.yawT = guard.yaw = g.face;
      if (h.v > 0.3) rt.heroYaw = Math.atan2(h.dx, h.dz);
      hero.place(h.x, h.z); hero.speed = h.v; hero.yawT = rt.heroYaw;
      hero.state = sim.over && sim.over.win ? 'happy' : h.v > 0.3 ? 'walk' : 'idle';
      hero.step(rt.T, dt); guard.step(rt.T, dt);
      updateFan(sim.P, g, sim.crates, sim.seen);
      // "!" only at the moment of loss, slow gentle bob
      excl.visible = !!(sim.over && !sim.over.win && sim.seen); excl.position.set(h.x, 2.9 + 0.06 * Math.sin(rt.T * 2), h.z);
    },
  };
  return rt;
}
