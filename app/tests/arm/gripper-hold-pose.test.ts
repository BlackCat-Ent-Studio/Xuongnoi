import { beforeAll, describe, expect, it } from 'vitest';
import { tryGripper } from '../../src/handbook/boards-robot-arm';
import { createAutoArmBoard } from '../../src/samples/auto-arm-board';
import { loadRapier } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { holdMetrics } from '../helpers/grip-metrics';
import { loadEngine, playReal } from '../helpers/cell-run-real';

/**
 * With "Vật lý thật" on, a crate the gripper holds is clamped between the two pads: centred across the closing direction,
 * not sunk into a finger, the palm or the link, and only taken when the hand really stands round it.
 *
 * Hand: a link pointing straight down from a joint 3 m up; the palm is 0.15 m deep, the fingers 0.3 m long, the grasp point
 * 0.3 m ahead of the wrist (wrist at y = 2). The palm's front face is 0.15 m above the grasp point. Tolerances: overlap
 * 1 mm, centring 1 cm.
 */
const OVERLAP_MM = 0.001;
const CENTRE_CM = 0.01;
const GRASP_Y = 1.7;

beforeAll(async () => {
  await loadRapier();
  await loadEngine();
});

interface CrateAt {
  /** Centre of the crate; the grasp point is at x = 0, z = 0, y = 1.7. */
  x?: number;
  y: number;
  z?: number;
  size?: number;
}

async function hand(crate: CrateAt, gripper: Record<string, number | string> = {}, crateExtra: Record<string, number | string> = {}) {
  const rapier = await loadRapier();
  const s = crate.size ?? 0.6;
  const cx = crate.x ?? 0;
  const cz = crate.z ?? 0;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
    ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
    // The shelf top is exactly the crate's bottom: it rests there.
    ['shelf', 'block', { position: { x: cx, y: crate.y - s / 2 - 0.25, z: cz }, size: { x: 2, y: 0.5, z: 3 } }],
    ['go', 'on-start'],
    ['ang', 'const', { value: -90 }],
    ['j', 'joint', { axis: 'pitch', start: -90, min: -90, max: 90, maxTorque: 100, mount: { x: 0, y: 2.5, z: 0 } }],
    ['l', 'link', { length: 1, mass: 0 }],
    ['g', 'gripper', { width: 1, grip: 'between', mass: 0, defaultForce: 25, maxForce: 120, ...gripper }],
    ['c', 'item', { shape: 'crate', position: { x: cx, y: crate.y, z: cz }, size: { x: s, y: s, z: s }, mass: 2, ...crateExtra }],
    ['k', 'key', { key: 'Space' }],
  ];
  const wires: WireSpec[] = [
    ['ped', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['ang', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
    ['l', 'tip', 'g', 'base'],
    ['k', 'held', 'g', 'close'],
  ];
  const r = rig(nodes, wires, '3d', false, true, rapier);
  r.tick(40);
  return r;
}

/** Turns the resting crate about the vertical: it is lifted a hair (out of the engine for a tick) and comes back turned. */
async function turnAboutVertical(r: Awaited<ReturnType<typeof hand>>, deg: number): Promise<void> {
  const c = r.entity('c')!;
  const h = (deg * Math.PI) / 360;
  r.world.teleport(c.id, { x: c.position.x, y: c.position.y + 0.002, z: c.position.z }, false);
  r.world.setItemRotation(c.id, { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) });
  r.tick(30);
  const q = r.entity('c')!.rotation!;
  expect(2 * Math.asin(Math.abs(q.y)) * (180 / Math.PI)).toBeGreaterThan(deg - 1);
}

function metrics(r: Awaited<ReturnType<typeof hand>>) {
  return holdMetrics(r.world, 'l', 'g', r.entity('c')!)!;
}

function expectClamped(r: Awaited<ReturnType<typeof hand>>): void {
  const m = metrics(r);
  expect(m.overlap.palm).toBeLessThan(OVERLAP_MM);
  expect(m.overlap.finger1).toBeLessThan(OVERLAP_MM);
  expect(m.overlap.finger2).toBeLessThan(OVERLAP_MM);
  expect(m.overlap.link).toBeLessThan(OVERLAP_MM);
  // Both pads sit on opposite faces (the crate is centred between them): no daylight between a finger and the crate.
  expect(Math.abs(m.faceGap[0])).toBeLessThan(OVERLAP_MM);
  expect(Math.abs(m.faceGap[1])).toBeLessThan(OVERLAP_MM);
}

describe('gripper clamps a crate between the pads (Vật lý thật)', () => {
  it('the palm face meets the crate top: the crate is held, centred, clear of finger, palm and link', async () => {
    // Crate centre 0.2 m below the grasp point: its top is 0.1 m above it and clears the palm face (0.15 above it).
    const r = await hand({ y: GRASP_Y - 0.2 });
    expect(r.out('g', 'inReach')).toBe(true);
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(true);
    expectClamped(r);
  });

  it('a crate 0.15 m off the middle across the fingers is clamped where it lies: each finger closes until it touches, the crate is not moved', async () => {
    const r = await hand({ y: GRASP_Y - 0.2, z: 0.15 });
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(true);
    expectClamped(r);
    expect(Math.abs(Math.abs(metrics(r).across) - 0.15)).toBeLessThan(CENTRE_CM);
  });

  it('the owner symptom: the grasp point only just inside the crate edge, the palm sunk into the crate: not taken, nothing is carried sunk in the hand', async () => {
    // Centre at the grasp point: the palm (0.15 above the grasp point) is inside the crate (top 0.3 above it).
    const r = await hand({ y: GRASP_Y });
    expect(r.out('g', 'inReach')).toBe(false);
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(false);
  });

  it('a grasp point outside the crate (hand above it) does not take it', async () => {
    const r = await hand({ y: GRASP_Y - 0.5 });
    expect(r.out('g', 'inReach')).toBe(false);
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(false);
  });

  it('a crate outside the finger gap is not attached: 0.3 m off the middle does not fit the 1 m opening (needs <= 0.2)', async () => {
    const r = await hand({ y: GRASP_Y - 0.2, z: 0.3 });
    expect(r.out('g', 'inReach')).toBe(false);
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(false);
    expect(Math.abs(r.entity('c')!.position.z - 0.3)).toBeLessThan(CENTRE_CM);
  });

  it('a crate wider than the opening cannot be gripped', async () => {
    const r = await hand({ y: GRASP_Y - 0.2, size: 0.6 }, { width: 0.5 });
    expect(r.out('g', 'inReach')).toBe(false);
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(false);
  });

  it('a crate turned 6 degrees about the vertical is gripped on its real faces (the pads turn it flat); turned 30 degrees it is refused', async () => {
    const small = await hand({ y: GRASP_Y - 0.2 });
    await turnAboutVertical(small, 6);
    expect(small.out('g', 'inReach')).toBe(true);
    small.hold('Space');
    small.tick(20);
    expect(small.out('g', 'holding')).toBe(true);
    expectClamped(small);

    const big = await hand({ y: GRASP_Y - 0.2 });
    await turnAboutVertical(big, 30);
    expect(big.out('g', 'inReach')).toBe(false);
    big.hold('Space');
    big.tick(20);
    expect(big.out('g', 'holding')).toBe(false);
  });

  it('letting go leaves the crate free: it is not held, not grabbed back, and rests on the shelf', async () => {
    const r = await hand({ y: GRASP_Y - 0.2 });
    r.hold('Space');
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(true);
    r.hold();
    r.tick(120);
    expect(r.out('g', 'holding')).toBe(false);
    const c = r.entity('c')!;
    expect(Math.abs(c.position.y - (GRASP_Y - 0.2))).toBeLessThan(0.02);
    expect(c.carried).toBeFalsy();
  });
});

describe('auto-arm: every pick is a real clamp', () => {
  it('300 s: while held the crate is clamped on both pads, centred on the belt line and sunk into nothing; all crates placed, none dropped or crushed', () => {
    const p = playReal(createAutoArmBoard());
    let heldTicks = 0;
    let worstOverlap = -Infinity;
    let worstAcross = 0;
    let worstFace = 0;
    let picks = 0;
    let wasHeld: string | null = null;
    const made = new Set<string>();
    p.watch(300, () => {
      for (const e of p.world.entities()) if (e.ownerNodeId === 'maker') made.add(e.id);
      const held = p.out('gripper', 'held') as string | null;
      if (held !== null && held !== wasHeld) picks++;
      wasHeld = held;
      if (held === null) return;
      const c = p.world.entities().find((e) => e.id === held);
      const m = c ? holdMetrics(p.world, 'fore', 'gripper', c) : null;
      if (!m) return;
      heldTicks++;
      worstOverlap = Math.max(worstOverlap, m.overlap.palm, m.overlap.finger1, m.overlap.finger2, m.overlap.link);
      worstAcross = Math.max(worstAcross, Math.abs(m.across));
      worstFace = Math.max(worstFace, Math.abs(m.faceGap[0]), Math.abs(m.faceGap[1]));
    });
    // One crate every 8 s: 37 made in 300 s; all that had time to arrive are picked (the last ones are still on the way in).
    expect(made.size).toBeGreaterThanOrEqual(36);
    expect(picks).toBeGreaterThanOrEqual(made.size - 3);
    expect(heldTicks).toBeGreaterThan(0);
    expect(worstOverlap).toBeLessThan(OVERLAP_MM);
    expect(worstAcross).toBeLessThan(CENTRE_CM);
    expect(worstFace).toBeLessThan(OVERLAP_MM);
    expect(Number(p.out('slips', 'value'))).toBe(0);
    expect(Number(p.out('crushes', 'value'))).toBe(0);
    expect(Number(p.out('placed', 'value'))).toBeGreaterThanOrEqual(picks - 1);
    expect(Number(p.out('placed', 'value'))).toBeGreaterThanOrEqual(made.size - 3);
    p.dispose();
  }, 600000);
});

describe('handbook board "Tay kẹp"', () => {
  it('the down arrow brings the hand onto the 5 kg crate and Space clamps it', () => {
    const board = tryGripper();
    board.graph.settings = { ...board.graph.settings, realPhysics: true };
    const grip = board.graph.nodes.find((n) => n.kind === 'gripper')!.id;
    let keys = new Set<string>();
    const p = playReal(board, () => keys);
    keys = new Set(['ArrowDown']);
    p.seconds(3);
    expect(p.out(grip, 'inReach')).toBe(true);
    keys = new Set(['ArrowDown', 'Space']);
    p.seconds(0.5);
    expect(p.out(grip, 'holding')).toBe(true);
    p.dispose();
  });
});
