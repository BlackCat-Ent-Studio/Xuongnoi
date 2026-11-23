import { HANDBOOK_ACTION_BRAIN } from './content-action-brain';
import { HANDBOOK_INPUT_LOGIC } from './content-input-logic';
import { HANDBOOK_MATH_OBJECT_OUTPUT } from './content-math-object-output';
import { HANDBOOK_ROBOT_DRIVE } from './content-robot-drive';
import { HANDBOOK_ROBOT_LINE } from './content-robot-line';
import { HANDBOOK_ROBOT_CTRL } from './content-robot-ctrl';
import { HANDBOOK_ROBOT_ARM } from './content-robot-arm';
import { HANDBOOK_LINEAR_ACTUATOR } from './content-linear-actuator';
import { HANDBOOK_LOGIC_EXTRAS } from './content-logic-extras';
import { HANDBOOK_MEMORY_DISPATCH } from './content-memory-dispatch';
import { HANDBOOK_ROBOT_NAV } from './content-robot-nav';
import { HANDBOOK_RAISED_DECK } from './content-raised-deck';
import { HANDBOOK_PARCEL_CODE } from './content-parcel-code';
import type { HandbookEntry } from './types';

export type { HandbookEntry } from './types';

/** Every handbook page, in no particular order (the handbook view sorts them). */
export const HANDBOOK: readonly HandbookEntry[] = [...HANDBOOK_INPUT_LOGIC, ...HANDBOOK_MATH_OBJECT_OUTPUT, ...HANDBOOK_ACTION_BRAIN, ...HANDBOOK_ROBOT_DRIVE, ...HANDBOOK_ROBOT_LINE, ...HANDBOOK_ROBOT_CTRL, ...HANDBOOK_ROBOT_ARM, ...HANDBOOK_LINEAR_ACTUATOR, ...HANDBOOK_LOGIC_EXTRAS, ...HANDBOOK_MEMORY_DISPATCH, ...HANDBOOK_ROBOT_NAV, ...HANDBOOK_RAISED_DECK, ...HANDBOOK_PARCEL_CODE];

/** The handbook page for a node kind, if written. */
export function handbookEntry(kind: string): HandbookEntry | undefined {
  return HANDBOOK.find((e) => e.kind === kind);
}
