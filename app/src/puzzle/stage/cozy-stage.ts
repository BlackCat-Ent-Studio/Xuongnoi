import * as THREE from 'three';
import type { EntityView, ViewMode } from '../../engine/types';
import type { StageFigure, StageTheme } from '../../render/stage-theme';
import { PORTAL_LOOK } from '../../render/portal-model';
import { LEGS_FRONT_CARRY, PUZZLE_CHARACTER_SCALE, puzzleWorldOptions } from '../world-options';
import { clamp, disposeTree, paint, ringShape, rrShape, sm01, toonOwn } from './stage-kit';
import { approach, makeButton, makeCrate, makeDoor, makeFlag, makeGoalPad, makeStar, makeZonePad } from './stage-props';
import { makeSideRoom, makeTray } from './stage-scenery';

/**
 * "Xưởng gỗ ấm áp" look of the puzzle stage: which entity becomes which prop, and the props themselves.
 * The roles come from the shape of an entity (its size, colour and view mode) because level data has no art fields.
 */

/** Visual-only size of characters (collision boxes stay as they are). */
export const STAGE_CHARACTER_SCALE = PUZZLE_CHARACTER_SCALE;

/**
 * The props were designed around a robot 2.9 units tall; in the game a character is 1 unit tall and drawn 1.6 times
 * bigger, so everything built in design units is scaled by this factor to keep the approved proportions.
 */
export const STAGE_UNIT = STAGE_CHARACTER_SCALE / 2.9;

const FLAT = 0.25;
const FLOOR_MAX_THICKNESS = 1.2;

type Tone = 'red' | 'green' | 'yellow' | 'other';

/** Rough hue of a '#rrggbb' colour, from its plain 0..255 channels. */
function toneOf(hex: string): Tone {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  if (!Number.isFinite(n)) return 'other';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  if (r > 190 && g < 110 && b < 110) return 'red';
  if (g > 150 && r < 110 && b < 150) return 'green';
  if (r > 200 && g > 170 && b < 90) return 'yellow';
  return 'other';
}

/** Role of an entity in the workshop, or null when it keeps its plain drawing. */
export function stageRoleOf(e: EntityView, mode: ViewMode): string | null {
  if (mode !== '2d-side' && mode !== '3d') return null;
  const side = mode === '2d-side';
  // A sensor zone is only a marker on the floor of the 3D views (it stays a plain box in the side view).
  if (e.kind === 'block' && e.zone) return side ? null : 'zone-mark';
  if (e.kind === 'item') return e.shape === 'crate' ? 'crate' : null;
  if (e.kind !== 'block' || e.look === PORTAL_LOOK) return null;
  if (e.blockStyle !== undefined && e.blockStyle !== 'box') return null;
  const { x, y, z } = e.size;
  if (y > FLAT && y <= FLOOR_MAX_THICKNESS) {
    if (side && x >= 12) return 'floor-side';
    if (!side && x >= 5 && z >= 5) return x >= 12 ? 'floor-tray' : 'floor-bank';
  }
  if (y <= FLAT) {
    if (side) return 'button';
    const tone = toneOf(e.color);
    if (tone === 'red') return 'button';
    if (tone === 'green') return x >= 3 ? 'zone' : 'goal';
    return null;
  }
  if (side) {
    if (toneOf(e.color) === 'yellow' && Math.max(x, y, z) <= 1) return 'star';
    if (y >= 1.9) return 'door';
    if (y <= 1.5 && x <= 1.2) return 'flag';
    return null;
  }
  if (y >= 1.9 && Math.min(x, z) <= 1.5 && Math.max(x, z) >= 3) return 'door';
  return null;
}

/** Bottom of the entity's box: where its prop stands. */
const floorY = (e: EntityView): number => e.position.y - e.size.y / 2;

function markShadows(root: THREE.Object3D, cast: boolean): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
    }
  });
}

/** A figure that never changes after it is placed. */
function still(object: THREE.Object3D, place: (e: EntityView) => void, extra: Partial<StageFigure> = {}): StageFigure {
  return {
    object,
    update: (e) => place(e),
    dispose: () => disposeTree(object),
    ...extra,
  };
}

function doorFigure(e: EntityView, mode: ViewMode): StageFigure {
  const side = mode === '2d-side';
  const h = side ? 3.6 : Math.max(3, (e.size.y + 0.3) / STAGE_UNIT);
  const L = side ? 1.5 : (Math.max(e.size.z, 1) + 0.1) / STAGE_UNIT;
  const hz = side ? -0.7 : -e.size.z / 2 / STAGE_UNIT - 0.2;
  const door = makeDoor({ h, L, hz, t: side ? 0.14 : 0.18 });
  door.g.scale.setScalar(STAGE_UNIT);
  markShadows(door.g, true);
  let open = 0;
  return {
    object: door.g,
    update(view, dt) {
      door.g.position.set(view.position.x, floorY(view), side ? view.position.z - 0.45 : view.position.z);
      open = approach(open, 0, dt, 0.5);
      door.set(sm01(open));
    },
    // An opened door stays standing open beside its post; it only closes again if the signal drops.
    fadeOut(dt) {
      open = approach(open, 1, dt, 0.8);
      door.set(sm01(open));
      return false;
    },
    dispose: () => disposeTree(door.g),
  };
}

function buttonFigure(e: EntityView, mode: ViewMode, chars: () => readonly EntityView[]): StageFigure {
  const btn = makeButton(e.color);
  btn.g.scale.setScalar(STAGE_UNIT * 1.15);
  markShadows(btn.g, false);
  let v = 0;
  return {
    object: btn.g,
    update(view, dt) {
      btn.g.position.set(view.position.x, floorY(view), view.position.z + (mode === '2d-side' ? 0.35 : 0));
      const half = view.size.x / 2;
      const pressed = chars().some((c) => c.visible && Math.abs(c.position.x - view.position.x) < half && Math.abs(c.position.z - view.position.z) < Math.max(view.size.z / 2, 0.6) + 0.2 && c.position.y - c.size.y / 2 < floorY(view) + 0.6);
      v = approach(v, pressed ? 1 : 0, dt, 0.08);
      btn.set(v);
    },
    dispose() {
      btn.dispose();
      disposeTree(btn.g);
    },
  };
}

function flagFigure(): StageFigure {
  const flag = makeFlag();
  flag.g.scale.setScalar(STAGE_UNIT);
  markShadows(flag.g, true);
  let t = 0;
  return {
    object: flag.g,
    update(view, dt) {
      t += dt;
      flag.g.position.set(view.position.x, floorY(view), view.position.z + 0.3);
      flag.update(t, 0);
    },
    dispose: () => disposeTree(flag.g),
  };
}

function starFigure(e: EntityView): StageFigure {
  const star = makeStar();
  const s = STAGE_UNIT * 1.15;
  star.g.scale.setScalar(s);
  let t = e.position.x * 0.7;
  let collected = 0;
  let base = { x: 0, y: 0, z: 0 };
  return {
    object: star.g,
    update(view, dt) {
      t += dt;
      collected = 0;
      base = { x: view.position.x, y: view.position.y + 0.3, z: view.position.z };
      star.g.position.set(base.x, base.y, base.z + 0.3);
      star.g.scale.setScalar(s);
      star.update(t);
    },
    // A collected star pops: it grows, rises and fades out.
    fadeOut(dt) {
      collected = clamp(collected + (dt <= 0 ? 1 : dt / 0.45), 0, 1);
      star.g.position.y = base.y + collected * 1.1;
      star.g.scale.setScalar(s * (1 + collected * 0.9) * (1 - collected));
      star.update(t);
      return collected >= 1;
    },
    dispose: () => disposeTree(star.g),
  };
}

function crateFigure(e: EntityView): StageFigure {
  const crate = makeCrate();
  crate.scale.setScalar(e.size.x * 0.9);
  markShadows(crate, true);
  return still(crate, (view) => {
    crate.position.set(view.position.x, floorY(view), view.position.z);
    crate.rotation.y = 0;
  });
}

/** Flat outline and a faint fill on the floor where a sensor zone listens; the tall translucent box is not drawn. */
function zoneMarkFigure(e: EntityView): StageFigure {
  const group = new THREE.Group();
  const tint = toonOwn(e.color, { transparent: true, opacity: 0.85 });
  const fill = toonOwn(e.color, { transparent: true, opacity: 0.16, depthWrite: false });
  group.add(paint(ringShape(1, 1, 0.22, 0.045), 0.02, tint, 0.075));
  group.add(paint(rrShape(1, 1, 0.22), 0.01, fill, 0.07));
  return {
    object: group,
    update(view) {
      group.scale.set(view.size.x, 1, view.size.z);
      group.position.set(view.position.x, 0, view.position.z);
    },
    dispose() {
      tint.dispose();
      fill.dispose();
      disposeTree(group);
    },
  };
}

function padFigure(group: THREE.Group, scale: number): StageFigure {
  group.scale.setScalar(scale);
  markShadows(group, false);
  return still(group, (view) => group.position.set(view.position.x, floorY(view), view.position.z));
}

/** Room plus floor of a 2D side level. The room is built in world coordinates, so the figure itself stays at the origin. */
function sideRoomFigure(e: EntityView): StageFigure {
  const room = makeSideRoom((e.position.x - e.size.x / 2 - 1) / STAGE_UNIT, (e.position.x + e.size.x / 2 + 1) / STAGE_UNIT);
  room.g.scale.setScalar(STAGE_UNIT);
  room.g.position.y = e.position.y + e.size.y / 2;
  markShadows(room.g, false);
  let t = 0;
  return {
    object: room.g,
    update(_view, dt) {
      t += dt;
      room.update(t);
    },
    dispose: () => disposeTree(room.g),
  };
}

function trayFigure(e: EntityView, all: readonly EntityView[], walls: boolean): StageFigure {
  const u = STAGE_UNIT;
  const half = { x: e.size.x / 2, z: e.size.z / 2 };
  const busy = all
    .filter((o) => o.visible && o.id !== e.id && !(o.size.y <= FLOOR_MAX_THICKNESS && o.size.x >= 5 && o.size.z >= 5))
    .map((o) => ({ x: o.position.x / u, z: o.position.z / u }));
  const tray = makeTray({
    x0: (e.position.x - half.x) / u,
    x1: (e.position.x + half.x) / u,
    z0: (e.position.z - half.z) / u,
    z1: (e.position.z + half.z) / u,
    walls,
    busy,
    seed: 11 + Math.round(Math.abs(e.position.x) * 3),
  });
  tray.g.scale.setScalar(u);
  tray.g.position.y = e.position.y + e.size.y / 2;
  markShadows(tray.g, false);
  return still(tray.g, () => undefined);
}

export function createCozyStage(): StageTheme {
  let characters: readonly EntityView[] = [];
  return {
    characterScale: STAGE_CHARACTER_SCALE,
    carryOffset: LEGS_FRONT_CARRY,
    worldOptions: puzzleWorldOptions,
    light: { sky: 0xfff3dc, ground: 0xa7753f, sun: 0xffe2b8 },
    roleOf: stageRoleOf,
    observe(entities) {
      characters = entities.filter((x) => x.kind === 'character');
    },
    create(role, e, all, mode) {
      switch (role) {
        case 'floor-side':
          return sideRoomFigure(e);
        case 'floor-tray':
          return trayFigure(e, all, true);
        case 'floor-bank':
          return trayFigure(e, all, false);
        case 'door':
          return doorFigure(e, mode);
        case 'button':
          return buttonFigure(e, mode, () => characters);
        case 'flag':
          return flagFigure();
        case 'star':
          return starFigure(e);
        case 'crate':
          return crateFigure(e);
        case 'zone-mark':
          return zoneMarkFigure(e);
        case 'zone':
          return padFigure(makeZonePad(e.size.x), 1);
        case 'goal':
          return padFigure(makeGoalPad(), clamp(e.size.x / 1.8, 0.6, 1.4));
        default:
          return null;
      }
    },
  };
}
