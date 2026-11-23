/** Linear undo/redo of immutable snapshots. Rapid edits sharing a key collapse into one entry. */
export interface History<T> {
  /** Call with the state as it was BEFORE a change. */
  record(before: T, key?: string, now?: number): void;
  undo(current: T): T | null;
  redo(current: T): T | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}

export const HISTORY_CAP = 100;
export const COALESCE_MS = 800;

export function createHistory<T>(cap = HISTORY_CAP, windowMs = COALESCE_MS): History<T> {
  let past: T[] = [];
  let future: T[] = [];
  let lastKey: string | undefined;
  let lastTime = 0;

  return {
    record(before, key, now = Date.now()) {
      if (key !== undefined && key === lastKey && now - lastTime < windowMs) {
        lastTime = now;
        return;
      }
      lastKey = key;
      lastTime = now;
      future = [];
      past.push(before);
      if (past.length > cap) past = past.slice(past.length - cap);
    },
    undo(current) {
      const prev = past.pop();
      lastKey = undefined;
      if (prev === undefined) return null;
      future.push(current);
      return prev;
    },
    redo(current) {
      const next = future.pop();
      lastKey = undefined;
      if (next === undefined) return null;
      past.push(current);
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past = [];
      future = [];
      lastKey = undefined;
    },
  };
}
