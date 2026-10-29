import type { EditorState } from '../editor/editor-state';
import type { GameResult } from '../engine/types';
import type { Snapshot } from './types';

/** What step checks see: the editor's current state, read fresh each time. */
export function takeSnapshot(state: EditorState, ended: GameResult | null): Snapshot {
  return {
    graph: state.getGraph(),
    mode: state.getMode(),
    playing: state.isPlaying(),
    ended,
    selectedIds: [...state.getMulti()],
    notes: state.getNotes(),
    canRedo: state.canRedo(),
  };
}
