/**
 * Loads the rigid-body engine (Rapier) on demand. Nothing here is imported at start-up: the engine is its own chunk,
 * fetched only when a game with "Vật lý thật" on is about to run, so every other board never downloads it.
 * The deterministic build is pinned (same numbers on every machine); see package.json.
 */

/** The engine's module object (types only: this import is erased by the compiler). */
export type RapierModule = typeof import('@dimforge/rapier3d-deterministic-compat');

let loaded: RapierModule | null = null;
let loading: Promise<RapierModule> | null = null;

/** The engine when it has finished loading, else null (never starts a download). */
export function loadedRapier(): RapierModule | null {
  return loaded;
}

/** Starts (or joins) the download and the engine's start-up. Rejects when either fails; a later call tries again. */
export function loadRapier(): Promise<RapierModule> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import('@dimforge/rapier3d-deterministic-compat')
    .then(async (mod) => {
      const rapier = (mod.default ?? mod) as RapierModule;
      await rapier.init();
      loaded = rapier;
      return rapier;
    })
    .catch((err: unknown) => {
      loading = null;
      throw err;
    });
  return loading;
}
