/**
 * Drawing hints for the arm pieces. The arm nodes spawn plain blocks (collision and hashes stay as they were), so the
 * renderer cannot tell a joint from a wall by the entity alone; the nodes leave a note here and the scene reads it.
 * Hints never reach the world state: nothing in the simulation looks at them.
 */
/** 'body' is an invisible solid cube that makes a joint or link block things: it is not drawn. */
export type ArmPartKind = 'joint' | 'link' | 'palm' | 'finger' | 'housing' | 'rod' | 'head' | 'body';

export interface ArmHint {
  part: ArmPartKind;
  /** Joints: axis of the servo (decides how the motor cap is turned). */
  axis?: 'pitch' | 'yaw';
  /** Fingers: +1 for the finger on the positive side of the grip axis, -1 for the other (the pad faces the middle). */
  side?: 1 | -1;
  /** Joints: true while the servo cannot hold its load (drawn with a pulsing red ring). */
  overloaded?: boolean;
}

const hints = new Map<string, ArmHint>();
const keyOf = (ownerNodeId: string, entityId: string): string => `${ownerNodeId}|${entityId}`;

export function setArmHint(ownerNodeId: string, entityId: string, hint: ArmHint): void {
  hints.set(keyOf(ownerNodeId, entityId), hint);
}

/** Updates only the overload flag of a joint's hint (no-op when the joint has none). */
export function setArmOverload(ownerNodeId: string, entityId: string, overloaded: boolean): void {
  const h = hints.get(keyOf(ownerNodeId, entityId));
  if (h) h.overloaded = overloaded;
}

export function armHintOf(ownerNodeId: string, entityId: string): ArmHint | undefined {
  return hints.get(keyOf(ownerNodeId, entityId));
}
