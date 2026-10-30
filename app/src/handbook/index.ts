import { HANDBOOK_ACTION_BRAIN } from './content-action-brain';
import { HANDBOOK_INPUT_LOGIC } from './content-input-logic';
import { HANDBOOK_MATH_OBJECT_OUTPUT } from './content-math-object-output';
import type { HandbookEntry } from './types';

export type { HandbookEntry } from './types';

/** Every handbook page, in no particular order (the handbook view sorts them). */
export const HANDBOOK: readonly HandbookEntry[] = [...HANDBOOK_INPUT_LOGIC, ...HANDBOOK_MATH_OBJECT_OUTPUT, ...HANDBOOK_ACTION_BRAIN];

/** The handbook page for a node kind, if written. */
export function handbookEntry(kind: string): HandbookEntry | undefined {
  return HANDBOOK.find((e) => e.kind === kind);
}
