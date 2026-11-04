import type { StepBreak } from '../app-contracts';
import type { Runtime } from '../engine/types';

/**
 * The bool outputs that rose in the runtime's last tick and that the step rule accepts, or null when there are none.
 * One set per tick, so several outputs rising together are one break.
 */
export function stepBreakKeys(rule: Pick<StepBreak, 'accepts'>, rt: Runtime): ReadonlySet<string> | null {
  const out = new Set<string>();
  for (const key of rt.lastTickRisen?.() ?? []) if (rule.accepts(key)) out.add(key);
  return out.size > 0 ? out : null;
}
