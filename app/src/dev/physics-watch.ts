import type { World } from '../engine/types';
import { checkBodies, checkContactClaims, describeViolation } from '../world/physics-check';

/**
 * Development-only runtime watcher for worlds with solid bodies. It runs the same invariants as the headless
 * test-suite after every physics step and prints each new violation once with console.warn. It draws nothing.
 * The only caller sits behind `import.meta.env.DEV`, so production builds drop this file.
 */

const MARKER = '[physics-watch]';
/** Stop printing after this many distinct violations in one run, so a broken level cannot flood the console. */
const MAX_REPORTS = 30;

export interface PhysicsWatch {
  check(world: World): void;
}

export function createPhysicsWatch(): PhysicsWatch {
  const seen = new Set<string>();
  let tick = 0;
  return {
    check(world) {
      tick++;
      const bodies = world.debugBodies?.();
      if (!bodies || seen.size >= MAX_REPORTS) return;
      const report = (key: string, text: string): void => {
        if (seen.has(key) || seen.size >= MAX_REPORTS) return;
        seen.add(key);
        console.warn(`${MARKER} tick ${tick}: ${text}`);
      };
      for (const v of checkBodies(bodies, { solidBodies: true })) report(`${v.code}|${v.who.join('|')}`, describeViolation(v));
      const live = bodies.filter((b) => b.visible && !b.seated && !b.zone && !b.carried);
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i]!;
          const b = live[j]!;
          if (a.kind === 'block' && b.kind === 'block') continue;
          for (const v of checkContactClaims(a, b, world.isTouching(a.id, b.id))) report(`${v.code}|${v.who.join('|')}`, describeViolation(v));
        }
      }
    },
  };
}
