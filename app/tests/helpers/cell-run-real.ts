import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView } from '../../src/engine/types';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, loadedRapier } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';

/** Loads the rigid-body engine once (call from `beforeAll`). */
export async function loadEngine(): Promise<void> {
  await loadRapier();
}

/**
 * A board played headless the way the app plays it: the world options come from the board's own settings
 * ("Vật lý thật" included) and the engine is the loaded one. Nobody touches a key unless `keys` says so.
 */
export function playReal(board: Board, keysDown: () => ReadonlySet<string> = () => new Set()) {
  const rapier = loadedRapier();
  if (board.graph.settings?.realPhysics === true && !rapier) throw new Error('call loadEngine() in beforeAll first');
  const options = worldOptionsForGraph(board.graph);
  const world = createWorld(board.mode, options ? { ...options, ...(rapier ? { rapier } : {}) } : undefined);
  const rt = createRuntime(board.graph, world, board.mode);
  const tick = (): void => {
    rt.tick({ keysDown: new Set(keysDown()) });
    world.step(TICK_DT);
  };
  return {
    world,
    rt,
    tick,
    ticks(n: number): void {
      for (let i = 0; i < n; i++) tick();
    },
    seconds(s: number): void {
      for (let i = 0; i < Math.round(s / TICK_DT); i++) tick();
    },
    /** Runs `s` seconds and calls `each` after every tick. */
    watch(s: number, each: (t: number) => void): void {
      const n = Math.round(s / TICK_DT);
      for (let i = 0; i < n; i++) {
        tick();
        each((i + 1) * TICK_DT);
      }
    },
    out: (id: string, port: string) => rt.getOutput(id, port),
    entity: (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!,
    dispose: () => world.dispose?.(),
  };
}

export type PlayedReal = ReturnType<typeof playReal>;
