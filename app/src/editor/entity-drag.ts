import type { GameView } from '../app-contracts';
import type { Vec3, ViewMode } from '../engine/types';
import { readPosition, snapHalf, type EditorState } from './editor-state';

/**
 * New entity position while dragging. Side view edits X/Y (keeps Z); top and 3D edit X/Z (keep Y).
 * `point` is the pointer's point on the editing plane, `offset` = position − point at grab time.
 */
export function positionOnPlane(mode: ViewMode, current: Vec3, point: Vec3, offset: Vec3): Vec3 {
  // An axis the pointer has not moved along keeps its value, so a drag on one axis
  // does not snap an off-grid coordinate on the other axis.
  const axis = (k: 'x' | 'y' | 'z'): number => {
    const raw = point[k] + offset[k];
    return Math.abs(raw - current[k]) < 1e-9 ? current[k] : snapHalf(raw);
  };
  if (mode === '2d-side') {
    return { x: axis('x'), y: axis('y'), z: current.z };
  }
  return { x: axis('x'), y: current.y, z: axis('z') };
}

/** Lets the user drag entities in the game view (edit mode) to set their `position` param. */
export function installEntityDrag(container: HTMLElement, gameView: GameView, state: EditorState): void {
  let active: { pointerId: number; nodeId: string; offset: Vec3; planeY: number; moved: boolean } | null = null;

  const planePoint = (e: PointerEvent, planeY: number): Vec3 | null =>
    gameView.screenToPlane(e.clientX, e.clientY, planeY);

  const onMove = (e: PointerEvent): void => {
    if (!active || e.pointerId !== active.pointerId) return;
    const cur = readPosition(state.getGraph(), active.nodeId);
    const p = planePoint(e, active.planeY);
    if (!cur || !p) return;
    const next = positionOnPlane(state.getMode(), cur, p, active.offset);
    if (next.x === cur.x && next.y === cur.y && next.z === cur.z) return;
    active.moved = true;
    state.setParam(active.nodeId, 'position', next);
  };

  const end = (e: PointerEvent): void => {
    if (!active || e.pointerId !== active.pointerId) return;
    active = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };

  // Capture phase so the 3D orbit controls never see a drag that starts on an entity.
  container.addEventListener(
    'pointerdown',
    (e) => {
      if (state.isPlaying() || e.button !== 0) return;
      const nodeId = gameView.pickEntityOwner(e.clientX, e.clientY);
      if (!nodeId) return;
      const cur = readPosition(state.getGraph(), nodeId);
      if (!cur) return;
      const planeY = cur.y;
      const p = planePoint(e, planeY);
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      state.select({ kind: 'node', id: nodeId });
      active = {
        pointerId: e.pointerId,
        nodeId,
        planeY,
        offset: { x: cur.x - p.x, y: cur.y - p.y, z: cur.z - p.z },
        moved: false,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
    true,
  );
}
