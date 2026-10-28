/**
 * Contracts between UI-side modules: render (GameView) ↔ editor ↔ io.
 * Engine/world contracts live in src/engine/types.ts.
 */
import type { Board, Graph, InputSnapshot, Runtime, Vec3, ViewMode, GameResult } from './engine/types';

/** Implemented by src/render/game-view.ts → `createGameView(): GameView`. */
export interface GameView {
  mount(container: HTMLElement): void;
  /** Edit mode: spawn entities from the graph (create() only, no ticks) and render a static preview. */
  showPreview(graph: Graph, mode: ViewMode): void;
  /** Play mode: build world + runtime, run fixed 60 Hz loop until stop() or the game ends. */
  play(graph: Graph, mode: ViewMode, readInput: () => InputSnapshot): void;
  stop(): void;
  isPlaying(): boolean;
  /** Runtime of the current play session (for wire value inspection), null when not playing. */
  getRuntime(): Runtime | null;
  /** Graph node id owning the entity under the pointer, or null. */
  pickEntityOwner(clientX: number, clientY: number): string | null;
  /** Point on the mode's editing plane under the pointer (side: z=0 plane; top / 3d: y = planeY). */
  screenToPlane(clientX: number, clientY: number, planeY?: number): Vec3 | null;
  /** Fired once when win/lose triggers. The view shows its own overlay with a "Chơi lại" button. */
  onGameEnd(cb: (result: GameResult, message: string) => void): void;
  /** Fired when the user presses "Chơi lại" on the end overlay. */
  onRestartRequest(cb: () => void): void;
  /** Re-fit canvas after layout changes. */
  resize(): void;
}

/** Implemented by src/io (index.ts re-exports). */
export interface BoardIo {
  serializeBoard(board: Board): string;
  parseBoard(text: string): { ok: true; board: Board } | { ok: false; error: string };
  loadAutosave(): Board | null;
  /** Debounced (≈1 s) write to localStorage. */
  scheduleAutosave(board: Board): void;
  /** Download as `<name>.xuongnoi.json`. */
  downloadBoard(board: Board): void;
  /** Opens a file picker; resolves null if cancelled, throws Error(vi message) on invalid file. */
  pickBoardFile(): Promise<Board | null>;
  listSamples(): { id: string; label: string; board: Board }[];
  createEmptyBoard(mode: ViewMode): Board;
}
