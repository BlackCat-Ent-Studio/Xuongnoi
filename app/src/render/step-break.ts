import type { StepBreak } from '../app-contracts';
import type { Runtime } from '../engine/types';

/** `${node}|moveX` and `${node}|moveY` for each node: the pins a brain moves its character with. */
export function moveKeysOf(nodeIds: Iterable<string>): string[] {
  const out: string[] = [];
  for (const id of nodeIds) out.push(`${id}|moveX`, `${id}|moveY`);
  return out;
}

/**
 * The outputs that make the game stop after the runtime's last tick, or null when there are none. Two kinds:
 * - bool outputs that rose in that tick and that the step rule accepts;
 * - when the rule lists `moveKeys`: those pins whose number went from 0 to moving (a brain starts moving its character).
 * `moving` is the per-run memory of which move pins were moving after the previous tick; pass the same set every tick.
 * One set per tick, so several outputs together are one break.
 */
export function stepBreakKeys(rule: Pick<StepBreak, 'accepts' | 'moveKeys'>, rt: Runtime, moving?: Set<string>): ReadonlySet<string> | null {
  const out = new Set<string>();
  for (const key of rt.lastTickRisen?.() ?? []) if (rule.accepts(key)) out.add(key);
  if (rule.moveKeys && moving) {
    for (const key of rule.moveKeys) {
      const cut = key.indexOf('|');
      const v = rt.getOutput(key.slice(0, cut), key.slice(cut + 1));
      const now = typeof v === 'number' && Number.isFinite(v) && v !== 0;
      if (now && !moving.has(key) && rule.accepts(key)) out.add(key);
      if (now) moving.add(key);
      else moving.delete(key);
    }
  }
  return out.size > 0 ? out : null;
}
