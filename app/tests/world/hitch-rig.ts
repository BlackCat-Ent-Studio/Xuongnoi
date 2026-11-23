import { TICK_DT, type EntityId, type EntityView, type ParamValue, type ViewMode } from '../../src/engine/types';
import { containerBlocks } from '../../src/nodes/container';
import type { RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { CARTON, type Drop } from '../nodes/container-rig';

/**
 * A two-motor chassis driven by "Đi tới điểm", a "Lồng chứa" it can drive under, and a "Chốt gài" between them, played
 * headless. The test is the hand on the switch (`latch`) and on where the tug is sent (`send`); everything it reads comes
 * from the entity views and from the outputs of the cards.
 */

/** The chassis the factory tugs use (m), 5 kg on two default motors. */
export const TUG = { length: 0.9, width: 0.7, height: 0.24, mass: 5 } as const;
/** Top of the floor block. */
export const GROUND = 0;

export interface HitchRigOptions {
  mode?: ViewMode;
  /** "Vật lý thật" with the crate engine loaded. Absent = the plain rules. */
  rapier?: RapierModule;
  /** Where the tug starts and which way it looks (degrees). */
  tug?: { x: number; z: number; heading?: number };
  /** Settings of the chassis card, of both motors, of "Đi tới điểm" and of the hitch. */
  body?: Record<string, ParamValue>;
  motor?: Record<string, ParamValue>;
  drive?: Record<string, ParamValue>;
  hitch?: Record<string, ParamValue>;
  /** Settings of the cage card (it stands at the origin unless they say otherwise). */
  cage?: Record<string, ParamValue>;
  /** Cartons let go above the cage, one per beat and maker. */
  drops?: Drop[];
  /** More cards and wires. */
  nodes?: NodeSpec[];
  wires?: WireSpec[];
  /** Leave the floor out (the test brings its own ground). */
  noFloor?: boolean;
}

export function hitchRig(o: HitchRigOptions = {}) {
  const mode = o.mode ?? '3d';
  const real = o.rapier !== undefined;
  const at = o.tug ?? { x: -3, z: 0 };
  const half = TUG.width / 2 - 0.05;
  const nodes: NodeSpec[] = [
    ...(o.noFloor ? [] : ([['floor', 'block', { position: { x: 0, y: GROUND - 0.5, z: 0 }, size: { x: 80, y: 1, z: mode === '2d-side' ? 1 : 80 } }]] as NodeSpec[])),
    ['cage', 'container', { position: { x: 0, y: GROUND, z: 0 }, ...(o.cage ?? {}) }],
    ['tug', 'robot-body', { position: { x: at.x, y: GROUND + TUG.height / 2, z: at.z }, heading: at.heading ?? 0, length: TUG.length, width: TUG.width, height: TUG.height, mass: TUG.mass, friction: 0.8, showPayload: 'yes', ...(o.body ?? {}) }],
    ['tug-ml', 'motor', { side: -half, ...(o.motor ?? {}) }],
    ['tug-mr', 'motor', { side: half, ...(o.motor ?? {}) }],
    ['tug-go', 'robot-goto', { targetFrom: 'point', targetPos: { x: at.x, y: 0, z: at.z }, ...(o.drive ?? {}) }],
    ['start', 'on-start'],
    // The switch: the test sets the number, the comparison turns it into "Gài".
    ['switch', 'const', { value: 0 }],
    ['half', 'const', { value: 0.5 }],
    ['latch-on', 'compare', { op: 'gt' }],
    ['hitch', 'hitch', o.hitch ?? {}],
    ['beat', 'timer', { seconds: 1, repeat: 'yes' }],
    ...(o.nodes ?? []),
  ];
  const wires: WireSpec[] = [
    ['tug', 'self', 'tug-ml', 'body'],
    ['tug', 'self', 'tug-mr', 'body'],
    ['tug', 'self', 'tug-go', 'robot'],
    ['tug-go', 'left', 'tug-ml', 'power'],
    ['tug-go', 'right', 'tug-mr', 'power'],
    ['start', 'started', 'tug-go', 'go'],
    ['start', 'started', 'beat', 'run'],
    ['switch', 'value', 'latch-on', 'a'],
    ['half', 'value', 'latch-on', 'b'],
    ['tug', 'self', 'hitch', 'carrier'],
    ['latch-on', 'out', 'hitch', 'on'],
    ...(o.wires ?? []),
  ];
  (o.drops ?? []).forEach((d, k) => {
    const cage = (o.cage?.position as { x: number; z: number } | undefined) ?? { x: 0, z: 0 };
    nodes.push([`maker${k}`, 'spawner', { template: 'item', shape: 'crate', position: { x: cage.x + d.x, y: 2, z: cage.z + d.z }, size: { ...CARTON }, maxAlive: d.count, lifetime: 0 }]);
    wires.push(['beat', 'done', `maker${k}`, 'spawn']);
  });
  const r = rig(nodes, wires, mode, false, real, o.rapier);
  const view = (id: EntityId): EntityView => {
    const v = r.world.getEntity(id);
    if (!v) throw new Error(`no entity ${id}`);
    return v;
  };
  const tugId = (): EntityId => r.out('tug', 'self') as EntityId;
  const cageId = (): EntityId => r.out('cage', 'self') as EntityId;
  return {
    ...r,
    tug: (): EntityView => view(tugId()),
    /** The floor plate of the cage. */
    cage: (): EntityView => view(cageId()),
    cageBlocks: (): EntityId[] => containerBlocks(r.world, cageId()),
    cartons: (): EntityView[] => r.world.entities().filter((e) => e.kind === 'item' && e.visible),
    latch(on: boolean): void {
      r.set('switch', { value: on ? 1 : 0 });
    },
    send(x: number, z: number): void {
      r.set('tug-go', { targetPos: { x, y: 0, z } });
    },
    holding: (): boolean => r.out('hitch', 'holding') === true,
    payload: (): number => r.out('tug', 'payload') as number,
    /** Plays until "Đi tới điểm" says it has arrived (at most `seconds`), calling `each` after every tick. False when it did not. */
    drive(seconds: number, each?: () => void): boolean {
      for (let t = 0; t < Math.round(seconds / TICK_DT); t++) {
        r.tick();
        each?.();
        if (r.out('tug-go', 'arrived') === true && t > 2) return true;
      }
      return false;
    },
    /** Plays `seconds`, calling `each` after every tick. */
    play(seconds: number, each?: () => void): void {
      for (let t = 0; t < Math.round(seconds / TICK_DT); t++) {
        r.tick();
        each?.();
      }
    },
  };
}

export type HitchRig = ReturnType<typeof hitchRig>;

/** Smallest turn between two headings in radians, as degrees. */
export function turnedDeg(a: number, b: number): number {
  const d = ((((a - b) * 180) / Math.PI) % 360 + 360) % 360;
  return d > 180 ? 360 - d : d;
}
