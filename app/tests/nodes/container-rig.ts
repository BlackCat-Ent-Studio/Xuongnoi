import { TICK_DT, type EntityId, type EntityView, type ParamValue, type ViewMode, type World } from '../../src/engine/types';
import { CONTAINER_THICK, containerBlocks, containerParts, containerShape } from '../../src/nodes/container';
import type { RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import type { Cage } from '../perf/cage-rig';

/**
 * A "Lồng chứa" card on a floor, with cartons let go above it by "Tạo đối tượng" cards on one shared beat, played
 * headless. Everything the tests read comes from the card's own outputs and from the entity views.
 */

/** The carton the factory stations make (m). */
export const CARTON = { x: 0.32, y: 0.26, z: 0.28 } as const;
/** Top of the floor block: the ground the cage stands on. */
export const GROUND = 0;

export interface Drop {
  /** Where the cartons of this maker are let go, measured from the middle of the cage (m). */
  x: number;
  z: number;
  /** How many it makes, one per beat. */
  count: number;
}

export interface CageRigOptions {
  mode?: ViewMode;
  /** "Vật lý thật" with the crate engine loaded. Absent = the plain item rules. */
  rapier?: RapierModule;
  cage?: Record<string, ParamValue>;
  drops?: Drop[];
  /** Seconds between two beats. */
  everyS?: number;
  /** Height the cartons are let go at, above the ground (m). */
  dropY?: number;
}

export function cageRig(o: CageRigOptions = {}) {
  const mode = o.mode ?? '3d';
  const drops = o.drops ?? [];
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: GROUND - 0.5, z: 0 }, size: { x: 40, y: 1, z: mode === '2d-side' ? 1 : 40 } }],
    ['cage', 'container', { position: { x: 0, y: GROUND, z: 0 }, ...(o.cage ?? {}) }],
    ['start', 'on-start'],
    ['beat', 'timer', { seconds: o.everyS ?? 1, repeat: 'yes' }],
  ];
  const wires: WireSpec[] = [['start', 'started', 'beat', 'run']];
  drops.forEach((d, k) => {
    nodes.push([`maker${k}`, 'spawner', { template: 'item', shape: 'crate', position: { x: d.x, y: o.dropY ?? 2, z: d.z }, size: { ...CARTON }, maxAlive: d.count, lifetime: 0 }]);
    wires.push(['beat', 'done', `maker${k}`, 'spawn']);
  });
  const r = rig(nodes, wires, mode, false, o.rapier !== undefined, o.rapier);
  const self = (): EntityId => r.out('cage', 'self') as EntityId;
  return {
    ...r,
    self,
    cartons: (): EntityView[] => r.world.entities().filter((e) => e.kind === 'item' && e.visible),
    count: (): number => r.out('cage', 'count') as number,
    /** Plays `seconds` and returns, tick by tick, what the card said. */
    watch(seconds: number): { count: number; took: boolean; full: boolean; first: EntityId | null }[] {
      const out = [];
      for (let t = 0; t < Math.round(seconds / TICK_DT); t++) {
        r.tick();
        out.push({ count: r.out('cage', 'count') as number, took: r.out('cage', 'took') === true, full: r.out('cage', 'full') === true, first: (r.out('cage', 'first') as EntityId | null) ?? null });
      }
      return out;
    },
  };
}

/** The cage of a card as the measuring helpers of the cage rig read it (floor plate first). */
export function measuredCage(world: World, self: EntityId, params: Record<string, ParamValue> = {}): Cage {
  const shape = containerShape(params);
  const ids = containerBlocks(world, self);
  const floor = world.getEntity(ids[0]!)!.position;
  const ground = floor.y - shape.clearance - CONTAINER_THICK / 2;
  const floorTop = ground + shape.clearance + CONTAINER_THICK;
  return {
    spec: { x: floor.x, z: floor.z, inside: shape.inside, wall: shape.wall, clearance: shape.clearance, thick: CONTAINER_THICK },
    ids,
    offsets: containerParts(shape, world.mode).map((p) => ({ x: p.at.x, y: ground + p.at.y, z: p.at.z })),
    floorTop,
    rim: floorTop + shape.wall,
  };
}

/** Speed (m/s) at `t` seconds into a move of `distance` that speeds up and slows down at `accel` and never passes `cruise`. */
export function rampSpeed(t: number, distance: number, cruise: number, accel: number): number {
  const peak = Math.min(cruise, Math.sqrt(distance * accel));
  const tUp = peak / accel;
  const tCruise = (distance - peak * tUp) / peak;
  if (t < tUp) return accel * t;
  if (t < tUp + tCruise) return peak;
  return Math.max(0, peak - accel * (t - tUp - tCruise));
}
