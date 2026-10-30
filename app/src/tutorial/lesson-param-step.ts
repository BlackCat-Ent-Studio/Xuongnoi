import type { GraphNode } from '../engine/types';
import { nodesOfKind, type NodeFilter } from './graph-checks';
import type { Snapshot, Step, TargetList } from './types';

/** Selector of a row in the properties panel. */
export const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;
/** Selector of a palette tile. */
export const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;
/** The folded "Nâng cao" heading of the properties panel. */
const ADVANCED_HEADING = '.pn-adv-h';

export interface ParamStepSpec {
  id: string;
  kind: string;
  /** Narrows which node of `kind` the step is about. */
  where?: NodeFilter;
  param: string;
  /** True when the setting sits under the folded "Nâng cao" section. */
  advanced?: boolean;
  /** True when the node's setting is the one the step asks for. */
  done: (node: GraphNode) => boolean;
}

/**
 * A step that finishes when some node of `kind` has the wanted setting. Points at the property row (when the node is
 * selected) or the node itself; for an advanced setting it also points at the "Nâng cao" heading so the folded section is easy to open.
 */
export function paramStep(spec: ParamStepSpec): Pick<Step, 'id' | 'target' | 'check'> {
  return {
    id: spec.id,
    check: (s: Snapshot) => nodesOfKind(s.graph, spec.kind, spec.where).some(spec.done),
    target: (s: Snapshot): TargetList => {
      const node = nodesOfKind(s.graph, spec.kind, spec.where)[0];
      const row: string[] = [paramSel(spec.param)];
      if (node) row.push(`.wc-node[data-id="${node.id}"]`);
      const out: TargetList = [row];
      if (spec.advanced) out.push(ADVANCED_HEADING);
      return out;
    },
  };
}

/** Several wires (or other sub-steps) drawn in one step: finishes when all are in place, and points at all of them. */
export function allOf(steps: Pick<Step, 'target' | 'check'>[]): Pick<Step, 'target' | 'check'> {
  return {
    check: (s) => steps.every((st) => st.check?.(s) === true),
    target: (s) => steps.flatMap((st) => st.target?.(s) ?? []),
  };
}
