import type { Vec3 } from '../engine/types';
import { localToWorld, type Frame } from './arm-kinematics';
import { planPush, type Box, type PushBody } from './linear-actuator';
import { torque } from './mechanics';

/**
 * Solid arm pieces (pure maths, no world access). A link is a chain of cubes laid along its length and a joint is one
 * cube at its hub; both are axis-aligned boxes like every other solid in the world, so characters, robots, vehicles and
 * loose items collide with them through the usual rules.
 *
 * A joint turning is a push: every cube beyond it moves along a short arc, which is taken as the straight step from its
 * old place to its new one (the step is a fraction of a degree per tick). Each cube pushes what it meets with the push
 * model of the piston (`planPush`: friction of every pushed body, lifting adds weight, a solid stops it). The force a
 * cube pushes with acts at its distance from the joint axis, so the joint needs   τ = Σ F · r   on top of the torque
 * that holds the arm up. If that is more than the servo has, or a solid is in the way, the joint does not make the step.
 */

/** Angle steps tried when a solid cuts a step short (each retry scales the step down to what the last try allowed). */
const RETRIES = 6;
/** Moves shorter than this are not worth planning (m). */
const TINY = 1e-9;
/** Rounding slack for "the whole step fits". */
const FULL = 1 - 1e-9;

/** Axis-aligned cubes covering a link of `length` and `thickness` that starts at `start` and points along it. */
export function linkCubes(start: Frame, length: number, thickness: number): Box[] {
  const t = Math.max(0.01, thickness);
  const size = { x: t, y: t, z: t };
  if (length <= t) return [{ pos: localToWorld(start, { x: length / 2, y: 0, z: 0 }), size }];
  const span = length - t;
  const n = Math.ceil(span / t - 1e-9) + 1;
  const step = n > 1 ? span / (n - 1) : 0;
  const out: Box[] = [];
  for (let k = 0; k < n; k++) out.push({ pos: localToWorld(start, { x: t / 2 + k * step, y: 0, z: 0 }), size });
  return out;
}

/** The cube of a joint's housing at its pivot. */
export function hubCube(pivot: Vec3, side: number): Box {
  return { pos: { ...pivot }, size: { x: side, y: side, z: side } };
}

export interface SweepInput {
  /** The cubes beyond the joint at the old angle and at the angle asked for (same order). */
  before: readonly Box[];
  after: readonly Box[];
  /** Distance (m) of each cube from the joint axis. */
  levers: readonly number[];
  bodies: readonly PushBody[];
  solids: readonly Box[];
  flat: 'y' | 'z' | null;
  /** Torque (N·m) the joint has left for pushing, after holding the arm up. */
  availableNm: number;
}

export interface SweepResult {
  /** Share (0..1) of the step the cubes can make before a solid (or a pushed body meeting one) stops them. */
  fraction: number;
  /** Torque (N·m) the full step needs to push what it meets. */
  requiredNm: number;
  /** True when that is more than `availableNm`: the joint cannot push, so it stays. */
  stalled: boolean;
  /** Where the bodies it pushes go, as a displacement from now, by id. */
  moves: Map<string, Vec3>;
}

/** One straight step of every cube: who is pushed, how much torque it takes, how much of it a solid allows. */
export function sweepCubes(input: SweepInput): SweepResult {
  const order = input.before.map((_, i) => i).sort((a, b) => (input.levers[b] ?? 0) - (input.levers[a] ?? 0));
  let bodies = input.bodies.map((b) => ({ ...b }));
  const moves = new Map<string, Vec3>();
  let requiredNm = 0;
  let fraction = 1;
  for (const i of order) {
    const from = input.before[i]!;
    const to = input.after[i]!;
    const d = { x: to.pos.x - from.pos.x, y: to.pos.y - from.pos.y, z: to.pos.z - from.pos.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < TINY) continue;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    const plan = planPush({ head: from, dir, step: len, bodies, solids: input.solids, flat: input.flat, lifting: dir.y > 0.5 });
    requiredNm += torque(plan.requiredN, input.levers[i] ?? 0);
    fraction = Math.min(fraction, plan.advance / len);
    if (plan.moves.length === 0) continue;
    const delta = new Map(plan.moves.map((m) => [m.id, m.delta]));
    bodies = bodies.map((b) => {
      const m = delta.get(b.id);
      return m ? { ...b, box: { pos: { x: b.box.pos.x + m.x, y: b.box.pos.y + m.y, z: b.box.pos.z + m.z }, size: b.box.size } } : b;
    });
    for (const m of plan.moves) {
      const was = moves.get(m.id) ?? { x: 0, y: 0, z: 0 };
      moves.set(m.id, { x: was.x + m.delta.x, y: was.y + m.delta.y, z: was.z + m.delta.z });
    }
  }
  return { fraction, requiredNm, stalled: requiredNm > Math.max(0, input.availableNm) + 1e-9, moves };
}

export interface ResolvedStep {
  /** Angle (same unit as the inputs) the joint ends the tick at. */
  angle: number;
  /** True when it is short of the angle asked for because of a solid or a load it cannot push. */
  blocked: boolean;
  moves: Map<string, Vec3>;
}

/**
 * The angle a joint can really turn to this tick: from `from` toward `to`, cut back until the cubes beyond it neither
 * enter a solid nor need more torque than the servo has left. `cubesAt(angle)` gives the cubes for a joint angle.
 */
export function resolveTurn(
  from: number,
  to: number,
  cubesAt: (angle: number) => readonly Box[],
  rest: Omit<SweepInput, 'before' | 'after'>,
): ResolvedStep {
  if (Math.abs(to - from) < TINY) return { angle: from, blocked: false, moves: new Map() };
  const before = cubesAt(from);
  let f = 1;
  for (let k = 0; k < RETRIES; k++) {
    const angle = from + (to - from) * f;
    const r = sweepCubes({ ...rest, before, after: cubesAt(angle) });
    if (r.stalled) return { angle: from, blocked: true, moves: new Map() };
    if (r.fraction >= FULL) return { angle, blocked: f < FULL, moves: r.moves };
    f *= r.fraction;
    if (f < 1e-6) break;
  }
  return { angle: from, blocked: true, moves: new Map() };
}
