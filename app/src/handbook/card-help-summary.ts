import { getNodeDef } from '../engine/registry';
import type { PortDef } from '../engine/types';
import { handbookEntry } from './index';
import { HANDBOOK_TEXT as T } from './handbook-text-vi';

export interface CardHelpPortLine {
  dir: 'in' | 'out';
  id: string;
  label: string;
  labelEn: string;
  /** One plain sentence; empty when the handbook has no words for this port. */
  text: string;
}

export interface CardHelpSummary {
  kind: string;
  title: string;
  titleEn: string;
  purpose: string;
  ports: CardHelpPortLine[];
  example: string;
}

/** First sentence of a handbook paragraph, so the card popup stays short. */
export function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^(.+?[.!?…])(?:\s|$)/su.exec(t);
  return m?.[1] ? m[1].trim() : t;
}

/**
 * Short popup content for one node kind, from its handbook page (or the node's own description when there
 * is no page). `shown` limits the ports to the ones the card actually shows (`${dir}|${portId}` keys).
 * Null when the kind is not registered.
 */
export function cardHelpSummary(kind: string, shown?: ReadonlySet<string>): CardHelpSummary | null {
  const def = getNodeDef(kind);
  if (!def) return null;
  const entry = handbookEntry(kind);
  const line = (dir: 'in' | 'out', p: PortDef): CardHelpPortLine => ({
    dir,
    id: p.id,
    label: p.label,
    labelEn: p.labelEn ?? '',
    text: firstSentence(entry?.ports[p.id] ?? ''),
  });
  const keep = (dir: 'in' | 'out', p: PortDef): boolean => !shown || shown.has(`${dir}|${p.id}`);
  return {
    kind,
    title: def.label,
    titleEn: def.labelEn ?? '',
    purpose: firstSentence(entry?.purpose ?? def.description),
    ports: [...def.inputs.filter((p) => keep('in', p)).map((p) => line('in', p)), ...def.outputs.filter((p) => keep('out', p)).map((p) => line('out', p))],
    example: entry?.example ?? '',
  };
}

export const CARD_HELP_HEADINGS = { inputs: T.inputs, outputs: T.outputs, example: T.example } as const;
