import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The engine is a separate download that only a game with "Vật lý thật" on fetches. These tests load the modules afresh
 * each time (vi.resetModules) so the "already loaded" cache of one test cannot leak into the next.
 */

afterEach(() => {
  vi.doUnmock('@dimforge/rapier3d-deterministic-compat');
  vi.restoreAllMocks();
  vi.resetModules();
});

async function fresh() {
  vi.resetModules();
  const loader = await import('../../src/world/rapier-loader');
  const play = await import('../../src/world/play-options');
  const world = await import('../../src/world/world');
  return { loader, play, world };
}

describe('the engine is loaded on demand only', () => {
  it('worlds and options without the switch never touch it', async () => {
    const { loader, play, world } = await fresh();
    world.createWorld('3d');
    world.createWorld('3d', { solidBodies: true });
    expect(play.needsPhysicsEngine(undefined)).toBe(false);
    expect(play.needsPhysicsEngine({ solidBodies: true })).toBe(false);
    const res = await play.prepareWorldOptions({ solidBodies: true });
    expect(res).toEqual({ options: { solidBodies: true }, failed: false });
    expect(loader.loadedRapier()).toBeNull();
  });

  it('a world with the switch on but no engine yet plays on the plain rules', async () => {
    const { world } = await fresh();
    const w = world.createWorld('3d', { realPhysics: true });
    w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: false });
    w.step(1 / 60);
    expect(JSON.stringify(w.entities())).not.toContain('rotation');
  });

  it('the switch on loads it once, and the options then carry it', async () => {
    const { loader, play } = await fresh();
    expect(play.needsPhysicsEngine({ realPhysics: true })).toBe(true);
    expect(play.withLoadedEngine({ realPhysics: true })).toBeNull();
    const res = await play.prepareWorldOptions({ realPhysics: true });
    expect(res.failed).toBe(false);
    expect(res.options?.rapier).toBeDefined();
    expect(loader.loadedRapier()).toBe(res.options?.rapier);
    expect(play.withLoadedEngine({ realPhysics: true })?.rapier).toBe(res.options?.rapier);
    expect(await loader.loadRapier()).toBe(res.options?.rapier);
    expect(play.needsPhysicsEngine(res.options)).toBe(false);
  });

  it('a failed load is reported, the options stay without an engine, and a later try can succeed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.resetModules();
    vi.doMock('@dimforge/rapier3d-deterministic-compat', () => {
      throw new Error('offline');
    });
    const loader = await import('../../src/world/rapier-loader');
    const play = await import('../../src/world/play-options');
    const { createWorld } = await import('../../src/world/world');
    const res = await play.prepareWorldOptions({ realPhysics: true, gravity: 4 });
    expect(res.failed).toBe(true);
    expect(res.options).toEqual({ realPhysics: true, gravity: 4 });
    expect(loader.loadedRapier()).toBeNull();
    // The game still runs: items keep the plain rules, with the gravity the maker set.
    const w = createWorld('3d', res.options);
    const id = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0, y: 5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: false });
    w.step(1 / 60);
    expect(w.getEntity(id)!.rotation).toBeUndefined();
    expect(w.getEntity(id)!.position.y).toBeLessThan(5);
    // The package comes back: the same loader tries again and works.
    vi.doUnmock('@dimforge/rapier3d-deterministic-compat');
    vi.resetModules();
    const again = await import('../../src/world/rapier-loader');
    await expect(again.loadRapier()).resolves.toBeDefined();
  });

  it('the engine is only ever imported through the loader (a dynamic import), never statically', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const root = new URL('../../src/world/', import.meta.url);
    const hits: string[] = [];
    for (const f of readdirSync(root)) {
      if (!f.endsWith('.ts')) continue;
      const text = readFileSync(new URL(f, root), 'utf8');
      // `import type` is erased; anything else naming the package must be the loader's dynamic import().
      for (const line of text.split('\n')) {
        if (!line.includes('@dimforge/rapier3d-deterministic-compat')) continue;
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || /import type/.test(line) || /typeof import\(/.test(line)) continue;
        hits.push(`${f}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual(["rapier-loader.ts: loading ??= import('@dimforge/rapier3d-deterministic-compat')"]);
  });
});
