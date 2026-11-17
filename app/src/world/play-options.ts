import { loadRapier, loadedRapier } from './rapier-loader';
import type { WorldOptions } from './world-options';

/** True when running with these options needs the rigid-body engine (and so a download the first time). */
export function needsPhysicsEngine(options: WorldOptions | undefined): boolean {
  return options?.realPhysics === true && options.rapier === undefined;
}

/** Same options with the engine already loaded (null when it is not loaded yet). Never starts a download. */
export function withLoadedEngine(options: WorldOptions | undefined): WorldOptions | null {
  if (!needsPhysicsEngine(options)) return options ?? null;
  const rapier = loadedRapier();
  return rapier ? { ...options, rapier } : null;
}

/**
 * Loads the engine when the options ask for "Vật lý thật", and returns the options to play with. A failed load does not
 * stop the game: `failed` is true and the options carry no engine, so loose items keep the old rules.
 */
export async function prepareWorldOptions(options: WorldOptions | undefined): Promise<{ options: WorldOptions | undefined; failed: boolean }> {
  if (!needsPhysicsEngine(options)) return { options, failed: false };
  try {
    const rapier = await loadRapier();
    return { options: { ...options, rapier }, failed: false };
  } catch (err) {
    console.error(err);
    return { options, failed: true };
  }
}
