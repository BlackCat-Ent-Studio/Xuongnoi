import type { Params } from '../engine/types';
import { nodesOfKind, paramOf, type NodeFilter } from './graph-checks';
import type { Snapshot, Step, TargetList } from './types';

/** Helpers shared by the lessons of course pack C. */

export type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
export type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

export const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;
export const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;

export const isBot: NodeFilter = (n) => paramOf(n, 'role') === 'bot';
export const isPlayer: NodeFilter = (n) => !isBot(n);

/** The property row of the first node of `kind` (when selected), else the node itself. */
export function paramTarget(snap: Snapshot, kind: string, id: string): TargetList {
  const node = nodesOfKind(snap.graph, kind)[0];
  return [node ? [paramSel(id), `.wc-node[data-id="${node.id}"]`] : paramSel(id)];
}

/** A step that finishes once `done` holds for a node of `kind`; it points at the palette first, then at the parameter row. */
export function setParamStep(
  id: string,
  kind: string,
  param: string,
  done: (snap: Snapshot) => boolean,
): Pick<Step, 'id' | 'target' | 'check'> {
  return {
    id,
    target: (s) => (nodesOfKind(s.graph, kind).length > 0 ? paramTarget(s, kind, param) : [paletteSel(kind)]),
    check: (s) => nodesOfKind(s.graph, kind).length > 0 && done(s),
  };
}

/** True when a text parameter of some node of `kind` was changed to something non-empty. */
export function textChanged(snap: Snapshot, kind: string, param: string, defaultText: string): boolean {
  return nodesOfKind(snap.graph, kind).some((n) => {
    const v = paramOf(n, param);
    return typeof v === 'string' && v.trim() !== '' && v.trim() !== defaultText;
  });
}
