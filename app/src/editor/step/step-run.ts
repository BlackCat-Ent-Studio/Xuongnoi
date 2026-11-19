import type { GameView } from '../../app-contracts';
import type { Graph } from '../../engine/types';
import { isObjectKind } from '../../puzzle/ui/object-cards';
import { stepLight } from '../../puzzle/ui/step-light';
import type { StepLightSet } from './step-light-layer';
import './step.css';

export interface StepRunState {
  /** A step run is on: the game freezes whenever a shown piece with a wire fires. */
  stepping: boolean;
  /** Frozen at a step, waiting for "Tiếp". */
  waiting: boolean;
}

interface Deps {
  isPlaying(): boolean;
  startPlay(): void;
  getGraph(): Graph;
  /**
   * The game names an output `${node}|${port}` by the card that runs. With circuits that card may sit inside a copy: this
   * gives the same output as the board on screen draws it (a pin of the copy, or the card inside an entered copy), or null
   * when it is not on screen. Absent = the running names are the names on screen.
   */
  shownKey?(key: string): string | null;
  /** Ids to glow on the stage when nothing is lit by a step (the selection). */
  restingHighlight(): ReadonlySet<string>;
  view: Pick<GameView, 'isPlaying' | 'isPaused' | 'resume' | 'setStepBreak' | 'setHighlight'>;
  board: {
    hasOutPin(nodeId: string, portId: string): boolean;
    setStepLight(light: StepLightSet | null): void;
  };
  onChange(state: StepRunState): void;
}

export interface StepRun {
  /** The 🐢 button: starts a step run, or (while frozen at a step) goes on to the next one. */
  press(): void;
  /** The play session ended or restarted. */
  reset(): void;
  /** The game was paused or resumed from anywhere; resuming drops the light. */
  noteResume(): void;
  state(): StepRunState;
}

/** The step run of the editor: same break rule as the puzzle (a wired, shown output rises), same light helper. */
export function createStepRun(deps: Deps): StepRun {
  let stepping = false;
  let waiting = false;
  const emit = (): void => deps.onChange({ stepping, waiting });

  function clearLight(): void {
    waiting = false;
    deps.board.setStepLight(null);
    deps.view.setHighlight(deps.restingHighlight());
  }

  /** A running output as the board on screen names it; null when that board does not show it. */
  const shown = (key: string): string | null => (deps.shownKey ? deps.shownKey(key) : key);

  function onBreak(risen: ReadonlySet<string>): void {
    if (!stepping) return;
    waiting = true;
    const fired = new Set([...risen].flatMap((key) => shown(key) ?? []));
    const graph = deps.getGraph();
    const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]));
    const wires = graph.wires.map((w) => ({ id: w.id, from: w.from.node, fromPort: w.from.port, to: w.to.node }));
    const light = stepLight(fired, wires, (id) => isObjectKind(kindOf.get(id) ?? ''));
    deps.board.setStepLight({ cards: light.cards, wires: light.wires, pins: light.pins });
    deps.view.setHighlight(light.objects);
    emit();
  }

  function arm(): void {
    stepping = true;
    deps.view.setStepBreak({
      accepts(running) {
        const key = shown(running);
        if (key === null) return false;
        const cut = key.indexOf('|');
        const node = key.slice(0, cut);
        const port = key.slice(cut + 1);
        return deps.board.hasOutPin(node, port) && deps.getGraph().wires.some((w) => w.from.node === node && w.from.port === port);
      },
      onBreak,
    });
    emit();
  }

  return {
    press() {
      if (!deps.isPlaying()) {
        deps.startPlay();
        if (!deps.view.isPlaying()) return;
        arm();
        return;
      }
      if (!stepping) {
        arm();
        if (deps.view.isPaused()) deps.view.resume();
        return;
      }
      if (waiting) {
        clearLight();
        emit();
        deps.view.resume();
      }
    },
    reset() {
      if (!stepping && !waiting) return;
      stepping = false;
      clearLight();
      emit();
    },
    noteResume() {
      if (!waiting) return;
      clearLight();
      emit();
    },
    state: () => ({ stepping, waiting }),
  };
}
