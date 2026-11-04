/**
 * Contracts between UI-side modules: render (GameView) ↔ editor ↔ io.
 * Engine/world contracts live in src/engine/types.ts.
 */
import type { Board, Graph, InputSnapshot, Runtime, Vec3, ViewMode, GameResult } from './engine/types';

/** See GameView.setStepBreak. */
export interface StepBreak {
  accepts(key: string): boolean;
  onBreak(keys: ReadonlySet<string>): void;
}

/** Implemented by src/render/game-view.ts → `createGameView(): GameView`. */
export interface GameView {
  mount(container: HTMLElement): void;
  /** Edit mode: spawn entities from the graph (create() only, no ticks) and render a static preview. */
  showPreview(graph: Graph, mode: ViewMode): void;
  /** Play mode: build world + runtime, run fixed 60 Hz loop until stop() or the game ends. */
  play(graph: Graph, mode: ViewMode, readInput: () => InputSnapshot): void;
  stop(): void;
  /** Edit camera returns to the default framing at the next preview (new / opened board). */
  resetCamera(): void;
  isPlaying(): boolean;
  /** Freezes the simulation; rendering (camera) keeps running. No-op when not playing. Stop works while paused. */
  pause(): void;
  /** Continues from where it froze; the time spent paused is not replayed. */
  resume(): void;
  /** While paused: advances exactly one fixed 60 Hz tick on the next frame, then renders. No-op otherwise. */
  stepFrame(): void;
  /**
   * Step run (puzzle): right after any tick in which a bool output accepted by `accepts` (key `${node}|${port}`) rose,
   * the game freezes exactly like pause() and `onBreak` gets every accepted key that rose in that tick (one break per tick).
   * Only the loop stops: the ticks, their order and the result are the same as without it. `resume()` continues.
   * A tick that ends the game never breaks. null turns it off; stop() and play() turn it off too.
   */
  setStepBreak(rule: StepBreak | null): void;
  /** True only while a play session is frozen. */
  isPaused(): boolean;
  /** Fired when pause state changes, including false when stop()/play() ends a paused session. */
  onPauseChange(cb: (paused: boolean) => void): void;
  /**
   * Live edit of a running node's params (play mode only). Returns true when every given param took effect
   * in the running game; false = not playing, unknown node/param, or it only applies on the next run.
   */
  applyNodeParams(nodeId: string, params: Record<string, unknown>): boolean;
  /** Edit mode: the graph nodes currently selected; the objects they own get a green collision-box frame. Hidden while playing. */
  setSelection(ownerNodeIds: ReadonlySet<string>): void;
  /**
   * Objects owned by these graph nodes pulse in yellow on the stage (a yellow shell with a thick outline, drawn over
   * everything), while editing and while playing; the pulse breathes for a few seconds, then holds steady. An empty set
   * clears it. Nodes that own no visible object (logic cards) show nothing.
   */
  setHighlight(ownerNodeIds: ReadonlySet<string>): void;
  /** Runtime of the current play session (for wire value inspection), null when not playing. */
  getRuntime(): Runtime | null;
  /**
   * Graph node id owning the entity under the pointer, or null. `ignore` = owners the ray passes through (a floor);
   * `slopPx` > 0 also looks that many px around the point when the exact spot holds nothing (thin objects, fingers).
   */
  pickEntityOwner(clientX: number, clientY: number, opts?: { slopPx?: number; ignore?: ReadonlySet<string> }): string | null;
  /** Point on the mode's editing plane under the pointer (side: z=0 plane; top / 3d: y = planeY). */
  screenToPlane(clientX: number, clientY: number, planeY?: number): Vec3 | null;
  /** Fired once when win/lose triggers. The view shows its own overlay with a "Chơi lại" button. */
  onGameEnd(cb: (result: GameResult, message: string) => void): void;
  /** Fired when the user presses "Chơi lại" on the end overlay. */
  onRestartRequest(cb: () => void): void;
  /**
   * Puzzle stage look: no editor grid, mint backdrop, and a fixed camera that frames the whole scene inside the
   * part of the canvas not covered by overlays (`top` / `bottom` = covered fractions of the height; `pitch` = fixed
   * 3D tilt). Same framing before and during play. Null returns to the editor look.
   */
  setStageFit(fit: { top: number; bottom: number; pitch?: number; sidePitch?: number; heroScale?: number; follow?: string | null } | null): void;
  /**
   * Puzzle stage player camera (view only, never touches the rules). Only works while a stage fit is set.
   * `panCamera`: drag by screen pixels; the camera stops following the character. `zoomCamera`: multiplies the
   * zoom around a screen point (clamped to the level and to 4x the default). `resetCamera` returns to the default
   * framing (follow while playing, whole scene while editing), easing there unless `animate` is false.
   */
  panCamera(dxPx: number, dyPx: number): void;
  zoomCamera(factor: number, clientX: number, clientY: number): void;
  resetStageCamera(animate?: boolean): void;
  /** Zoom of the player camera relative to the default framing, and whether it differs from the default. */
  cameraState(): { zoom: number; custom: boolean };
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
