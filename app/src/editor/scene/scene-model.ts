import type { Graph, GraphNode, NodeDef, Params } from '../../engine/types';
import type { IconName } from '../icons';
import { SCENE_TEXT } from './scene-text-vi';

export type SceneGroupId = 'characters' | 'objects' | 'zones' | 'cameras' | 'hud';
export type SceneRootId = 'level' | 'ui';

export interface SceneItem {
  nodeId: string;
  kind: string;
  label: string;
  hint: string;
  icon: IconName;
  /** Palette category, used for the tile colour token. */
  category: string;
}

export interface SceneGroup {
  id: SceneGroupId;
  label: string;
  items: SceneItem[];
}

export interface SceneRoot {
  id: SceneRootId;
  label: string;
  groups: SceneGroup[];
}

interface KindInfo {
  group: SceneGroupId;
  icon: IconName;
}

/** Node kinds that appear in the scene tree, and where. */
const KIND_INFO: Record<string, KindInfo> = {
  character: { group: 'characters', icon: 'user' },
  block: { group: 'objects', icon: 'box' },
  item: { group: 'objects', icon: 'coin' },
  vehicle: { group: 'objects', icon: 'object' },
  'moving-platform': { group: 'objects', icon: 'ground' },
  'rotating-platform': { group: 'objects', icon: 'ground' },
  portal: { group: 'objects', icon: 'flag' },
  spawner: { group: 'objects', icon: 'layers' },
  'raised-deck': { group: 'objects', icon: 'ground' },
  container: { group: 'objects', icon: 'box' },
  zone: { group: 'zones', icon: 'expand' },
  camera: { group: 'cameras', icon: 'camera' },
  'show-number': { group: 'hud', icon: 'output' },
  'show-text': { group: 'hud', icon: 'output' },
  'win-lose': { group: 'hud', icon: 'flag' },
};

const GROUP_LABELS: Record<SceneGroupId, string> = {
  characters: SCENE_TEXT.groupCharacters,
  objects: SCENE_TEXT.groupObjects,
  zones: SCENE_TEXT.groupZones,
  cameras: SCENE_TEXT.groupCameras,
  hud: SCENE_TEXT.groupHud,
};

const LEVEL_GROUPS: SceneGroupId[] = ['characters', 'objects', 'zones', 'cameras'];
const UI_GROUPS: SceneGroupId[] = ['hud'];

export function isSceneKind(kind: string): boolean {
  return kind in KIND_INFO;
}

function selectLabel(def: NodeDef | undefined, params: Params, id: string): string {
  const raw = params[id];
  const opt = def?.params.find((p) => p.id === id)?.options?.find((o) => o.value === raw);
  return opt ? opt.label : '';
}

/** Short per-instance hint, e.g. "Bot" for a character. Empty when nothing useful. */
function hintFor(node: GraphNode, def: NodeDef | undefined): string {
  if (node.kind === 'character') {
    return node.params.role === 'bot' ? SCENE_TEXT.roleBot : SCENE_TEXT.rolePlayer;
  }
  if (node.kind === 'item') return selectLabel(def, node.params, 'shape');
  if (node.kind === 'show-text') {
    const t = typeof node.params.text === 'string' ? node.params.text.trim() : '';
    return t.length > 18 ? `${t.slice(0, 17)}…` : t;
  }
  return '';
}

/**
 * Pure graph to tree model. Only nodes that spawn entities or draw on screen are listed.
 * Same-kind nodes get " #n" so they can be told apart. Empty groups/roots are dropped.
 */
export function buildSceneModel(graph: Graph, lookup: (kind: string) => NodeDef | undefined): SceneRoot[] {
  const totals = new Map<string, number>();
  for (const n of graph.nodes) if (isSceneKind(n.kind)) totals.set(n.kind, (totals.get(n.kind) ?? 0) + 1);

  const seen = new Map<string, number>();
  const byGroup = new Map<SceneGroupId, SceneItem[]>();
  for (const n of graph.nodes) {
    const info = KIND_INFO[n.kind];
    if (!info) continue;
    const def = lookup(n.kind);
    const idx = (seen.get(n.kind) ?? 0) + 1;
    seen.set(n.kind, idx);
    const base = def?.label ?? n.kind;
    const item: SceneItem = {
      nodeId: n.id,
      kind: n.kind,
      label: (totals.get(n.kind) ?? 0) > 1 ? `${base} #${idx}` : base,
      hint: hintFor(n, def),
      icon: info.icon,
      category: def?.category ?? 'object',
    };
    const list = byGroup.get(info.group) ?? [];
    list.push(item);
    byGroup.set(info.group, list);
  }

  const build = (id: SceneRootId, label: string, ids: SceneGroupId[]): SceneRoot => ({
    id,
    label,
    groups: ids
      .filter((g) => byGroup.has(g))
      .map((g) => ({ id: g, label: GROUP_LABELS[g], items: byGroup.get(g) ?? [] })),
  });
  return [build('level', SCENE_TEXT.groupLevel, LEVEL_GROUPS), build('ui', SCENE_TEXT.groupUi, UI_GROUPS)].filter(
    (r) => r.groups.length > 0,
  );
}
