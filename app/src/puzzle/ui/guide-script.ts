import { getNodeDef } from '../../engine/registry';
import type { GraphNode, ParamValue, Wire } from '../../engine/types';
import { PUZZLE_LEVELS } from '../levels';
import type { PuzzleLevel } from '../types';
import { defaultParams, paramValue, type BoardState } from './board-state';

/**
 * The tutorial guide's script: what Mèo Mun says, and the ordered steps generated from a level's reference
 * solution. Pure data and logic (no DOM) so the steps can be tested for every level.
 */

// ---------- words ----------

/** What each piece is for, finishing "<name>: ...". Lines stay short because the cat says them one at a time. */
const KIND_PURPOSE: Record<string, string> = {
  'go-to': 'cho bot tự đi tới đích.',
  'on-start': 'báo ngay khi trò chơi bắt đầu.',
  'nearest-item': 'tìm thùng nằm gần nhất.',
  touch: 'biết khi hai vật chạm nhau.',
  latch: 'nhớ mãi một tín hiệu.',
  or: 'bật khi một trong hai bật.',
  and: 'chỉ bật khi cả hai bật.',
  not: 'đảo bật thành tắt.',
  counter: 'đếm số lần có tín hiệu.',
  compare: 'so hai số với nhau.',
  const: 'giữ một con số cố định.',
  zone: 'đếm vật nằm trong một vùng.',
  distance: 'đo hai nhân vật cách nhau bao xa.',
  timer: 'đếm giờ, hết giờ thì báo.',
  'color-sensor': 'nhìn màu của ô dưới chân bot.',
  'route-follow': 'đi theo hàng ô.',
  carry: 'nhấc và thả thùng.',
  'next-free-slot': 'chỉ ô kho còn trống.',
  'sight-forecast': 'biết trước khi nào bị thấy.',
  math: 'cộng hai số lại.',
};

/** The cat's opening line per level. Levels 1, 2, 4 (new circuits built by the player), 5 (the first 3D level) and 7 (the last, built by the player alone) have the full guide; the others get one step per "?". */
const LEVEL_INTRO: Record<string, string> = {
  'bot-dau-tien': 'Chào bạn! Mình là Mèo Mun. Làm theo bàn tay nhé!',
  'cua-kho': 'Bot phải qua cửa kho. Bạn tự nối cả mạch. Mình chỉ từng bước nhé!',
  'hai-nut-mot-cua': 'Hai bot, hai nút, một cửa! Mình chỉ từng bước nhé!',
  'du-ba-thung': 'Ôi, màn này là 3D! Camera nhìn từ trên cao, hơi nghiêng. Mình cùng làm nhé!',
  'ne-linh-gac': 'Lính gác nhìn theo hướng đi! Bạn tự nối bộ não cho mèo nhỏ. Mình chỉ từng bước nhé!',
  'phan-loai-mau': 'Màn cuối! Bạn tự nối cả mạch cho rô-bốt. Mình chỉ từng bước nhé!',
};

/** Friendly lines for the wires, keyed by level id then solution wire id. Other wires get a generated line. */
const WIRE_LINES: Record<string, Record<string, string>> = {
  'bot-dau-tien': {
    s1: 'Nối Bot với mảnh Đi tới.',
    s2: 'Giờ nối Cờ làm chỗ cần tới.',
    s3: 'Cho mảnh Đi tới lái bot!',
    s4: 'Khi bắt đầu bật cho Đi tới đi.',
  },
  'cua-kho': {
    s1: 'Nối Bot vào mảnh Đi tới.',
    s2: 'Cờ là chỗ bot cần tới.',
    s3: 'Cho Đi tới lái bot!',
    s4: 'Nối Bot vào mảnh Chạm nhau.',
    s5: 'Nối Nút đỏ vào Chạm nhau luôn.',
    s6: 'Bot dẫm nút thì bật công tắc.',
    s7: 'Công tắc bật thì cửa ẩn đi.',
    s8: 'Khi bắt đầu bật cho Đi tới đi.',
  },
  'hai-nut-mot-cua': {
    s1: 'Nối Bot A vào mảnh Đi tới.',
    s2: 'Cờ là chỗ Bot A cần tới.',
    s3: 'Cho Đi tới lái Bot A.',
    s4: 'Nối Bot B vào mảnh Đi tới thứ hai.',
    s5: 'Nút 2 là chỗ Bot B cần tới.',
    s6: 'Cho Đi tới lái Bot B.',
    s7: 'Bot B tới nút 2 rồi, Bot A mới được đi.',
    s8: 'Nối Bot A vào mảnh Chạm nhau.',
    s9: 'Nối Nút 1 vào Chạm nhau luôn.',
    s10: 'Bot A đứng trên nút 1 thì báo cho Hoặc.',
    s11: 'Bot B tới nút 2 cũng báo cho Hoặc.',
    s12: 'Một trong hai bật thì cửa mở!',
    s13: 'Bot A đứng trên nút 1 thì Bot B được đi.',
  },
  'nhat-sao': {
    s1: 'Nối Mèo vào Chạy theo tuyến.',
    s2: 'Tuyến lái mèo đi ngang.',
    s3: 'Khi bắt đầu bật cho tuyến chạy.',
    t1a: 'Nối Mèo vào mảnh Chạm nhau cho Sao 1.',
    t1b: 'Sao 1 vào Chạm nhau luôn.',
    h1: 'Mèo mới chạm thì Sao 1 ẩn đi.',
    t2a: 'Nối Mèo vào mảnh Chạm nhau cho Sao 2.',
    t2b: 'Sao 2 vào Chạm nhau luôn.',
    h2: 'Mèo mới chạm thì Sao 2 ẩn đi.',
    t3a: 'Nối Mèo vào mảnh Chạm nhau cho Sao 3.',
    t3b: 'Sao 3 vào Chạm nhau luôn.',
    h3: 'Mèo mới chạm thì Sao 3 ẩn đi.',
    c1: 'Sao 1 chạm thì báo cho Hoặc thứ nhất.',
    c2: 'Sao 2 chạm cũng báo cho Hoặc đó.',
    c3: 'Hoặc thứ nhất báo tiếp cho Hoặc thứ hai.',
    c4: 'Sao 3 chạm cũng báo cho Hoặc thứ hai.',
    c5: 'Sao nào chạm thì bộ đếm cộng 1.',
    s4: 'Đếm đủ thì cổng ẩn đi!',
  },
  'du-ba-thung': {
    sw1: 'Nối Rô-bốt vào Tìm vật gần nhất để nó tìm thùng gần rô-bốt.',
    sw2: 'Ô kho 1 vào Tìm vật gần nhất: thùng đã cất rồi thì bỏ qua.',
    sw3: 'Ô kho 2 cũng vào đó.',
    sw4: 'Ô kho 3 cũng vào đó nốt.',
    sw5: 'Thùng gần nhất làm Đích cho Đi tới.',
    sw6: 'Nối Rô-bốt vào mảnh Đi tới.',
    sw7: 'Ô kho 1 vào mảnh Ô trống kế tiếp.',
    sw8: 'Ô kho 2 cũng vào đó.',
    sw9: 'Ô kho 3 cũng vào đó.',
    sw10: 'Ô trống kế tiếp làm Đích 2 cho Đi tới.',
    sw11: 'Nối Rô-bốt vào Khiêng đồ để có tay.',
    sw12: 'Đang khiêng thì Đi tới đổi sang Đích 2.',
    sw13: 'Tới chỗ thùng thì Khiêng đồ nhấc lên.',
    sw16: 'Tới ô kho thì Khiêng đồ thả xuống.',
    sw17: 'Khi bắt đầu bật cho Đi tới đi.',
    sw14: 'Lối đi ngang của Đi tới cho rô-bốt đi.',
    sw15: 'Lối đi dọc của Đi tới cũng cho rô-bốt.',
  },
  'ne-linh-gac': {
    sw1: 'Nối Mèo nhỏ vào mảnh Chạy theo tuyến.',
    sw2: 'Đi ngang của tuyến về cho mèo.',
    sw3: 'Đi dọc của tuyến cũng về cho mèo.',
    sw4: 'Lính gác là người nhìn của mảnh Dự đoán.',
    sw5: 'Mèo nhỏ là chỗ cần canh.',
    sw6: 'Số giây "Còn" vào So sánh, ô A.',
    sw7: 'Số giây "Cần" vào So sánh, ô B.',
    sw8: 'Còn đủ giây thì mèo chạy sang thùng kế!',
    sw9: 'Khi bắt đầu bật cho tuyến của mèo.',
    sw10: 'Đường đi tuần của lính gác vào mảnh Dự đoán.',
    sw11: 'Tuyến của mèo vào mảnh Dự đoán nữa.',
  },
  'phan-loai-mau': {
    sw1: 'Nối Rô-bốt vào Chạy theo tuyến để nó đi dọc các ô.',
    sw2: 'Lối đi ngang của tuyến vào mảnh Phép tính.',
    sw3: 'Phép tính cho rô-bốt đi ngang.',
    sw4: 'Cho Đọc màu nhìn màu dưới chân rô-bốt.',
    sw5: 'Thấy đúng màu thì báo cho mảnh Và.',
    sw6: 'Đã đứng yên ở ô thì cũng báo cho mảnh Và.',
    sw7: 'Nối Rô-bốt vào Khiêng đồ để có tay.',
    sw8: 'Đúng màu VÀ đã đứng yên ở ô thì Nhấc lên!',
    sw9: 'Đang đợi hoặc đang khiêng thì tuyến dừng.',
    sw10: 'Ô kho 1 vào mảnh Ô trống kế tiếp.',
    sw11: 'Ô kho 2 cũng vào đó.',
    sw12: 'Ô kho 3 cũng vào đó nữa.',
    sw13: 'Nối Rô-bốt vào mảnh Đi tới.',
    sw14: 'Ô trống kế tiếp làm đích cho Đi tới.',
    sw15: 'Đang khiêng thì mới cho Đi tới chạy.',
    sw16: 'Lối đi ngang của Đi tới vào Phép tính nữa.',
    sw17: 'Tới ô kho thì Thả thùng xuống!',
    sw18: 'Khi bắt đầu bật cho tuyến chạy.',
    sw19: 'Tới một ô thì Hẹn giờ đếm lại.',
    sw20: 'Khi bắt đầu bật cho Hẹn giờ chạy.',
    sw21: 'Số giây còn lại vào So sánh: còn lớn hơn 0 là đang đợi.',
    sw22: 'Còn giây nghĩa là đang đợi: báo cho mảnh Hoặc.',
    sw23: 'Đang khiêng cũng báo cho mảnh Hoặc.',
  },
};

export const GUIDE_TEXT = {
  newPiece: 'Mảnh mới!',
  tapToTake: 'Chạm để lấy.',
  takePiece: (name: string): string => `Lấy mảnh ${name} ra bàn.`,
  join: (a: string, b: string): string => `Nối ${a} với ${b}.`,
  setParam: (label: string, value: ParamValue): string => `Chạm ô, chỉnh ${label} thành ${String(value)}.`,
  run: 'Xong rồi! Bấm CHẠY xem bot đi nào!',
  win: 'Giỏi lắm! Mình biết bạn làm được mà!',
} as const;

/** Level-specific cheer after the win, else the generic one. */
const WIN_LINES: Record<string, string> = {
  'bot-dau-tien': 'Giỏi lắm! Bot tới cờ rồi!',
  'du-ba-thung': 'Giỏi quá! Rô-bốt tự cất đủ ba thùng rồi!',
  'ne-linh-gac': 'Giỏi quá! Mèo nhỏ lẻn qua mà không bị thấy!',
  'cua-kho': 'Giỏi lắm! Cửa mở mãi cho bot rồi!',
  'hai-nut-mot-cua': 'Giỏi lắm! Cả hai bot qua cửa rồi!',
  'phan-loai-mau': 'Giỏi quá! Bạn tự nối cả mạch rồi!',
};

export const winLine = (level: PuzzleLevel): string => WIN_LINES[level.id] ?? GUIDE_TEXT.win;

// ---------- steps ----------

export type GuideStep =
  | { type: 'intro'; text: string }
  | { type: 'piece'; text: string; solNode: string; kind: string; slot: number; ordinal: number; isNew: boolean }
  | { type: 'param'; text: string; solNode: string; paramId: string; value: ParamValue }
  | { type: 'wire'; text: string; wire: Wire }
  | { type: 'run'; text: string };

/** Does this level have the full guide? Levels 1, 2, 4, 5 and 7 do; the other levels give one step per "?". */
export const hasGuide = (level: PuzzleLevel): boolean => level.id in LEVEL_INTRO;

/** Stable identity of a solution step (not tied to positions), used to count each "?" reveal once. Null for steps that are not solution work. */
export function stepKey(step: GuideStep): string | null {
  switch (step.type) {
    case 'piece':
      return `piece:${step.solNode}`;
    case 'param':
      return `param:${step.solNode}:${step.paramId}`;
    case 'wire':
      return `wire:${step.wire.id}`;
    default:
      return null;
  }
}

/** The short line the cat says for a "?" step (the long "new piece" line is for the guide). */
export function hintLineOf(step: GuideStep): string {
  return step.type === 'piece' ? GUIDE_TEXT.takePiece(kindName(step.kind)) : step.text;
}

/** The step a "?" reveals: the first solution step the player has not done yet, or null when all are done. */
export function nextHintStep(level: PuzzleLevel, state: BoardState, levels: readonly PuzzleLevel[] = PUZZLE_LEVELS): GuideStep | null {
  return solutionSteps(level, levels).find((s) => !isStepDone(s, level, state, false)) ?? null;
}

/**
 * One short line per tray piece the player has not met in an earlier level (levels 2 and up), in tray order:
 * "<name>: <what it does>". Pieces without a known purpose line are left out.
 */
export function newPieceIntros(level: PuzzleLevel, levels: readonly PuzzleLevel[] = PUZZLE_LEVELS): string[] {
  if (level.order < 2) return [];
  const fresh = newKindsOf(level, levels);
  const lines: string[] = [];
  const done = new Set<string>();
  for (const t of level.tray) {
    const purpose = KIND_PURPOSE[t.kind];
    if (!fresh.has(t.kind) || done.has(t.kind) || !purpose) continue;
    done.add(t.kind);
    lines.push(`${kindName(t.kind)}: ${purpose}`);
  }
  return lines;
}

function kindName(kind: string): string {
  return getNodeDef(kind)?.label ?? kind;
}

function kindOfNode(level: PuzzleLevel, nodeId: string, solKinds: Map<string, string>): string {
  return level.base.nodes.find((n) => n.id === nodeId)?.kind ?? solKinds.get(nodeId) ?? '';
}

/** Name of a node as the player sees it: a locked object's own name, else the piece's label. */
function nodeName(level: PuzzleLevel, nodeId: string, kindOf: Map<string, string>): string {
  const base = level.base.nodes.find((n) => n.id === nodeId);
  const own = base?.params.name;
  if (typeof own === 'string' && own) return own;
  return kindName(kindOfNode(level, nodeId, kindOf));
}

function portLabel(kind: string, port: string, dir: 'in' | 'out'): string {
  const def = getNodeDef(kind);
  const list = dir === 'in' ? def?.inputs : def?.outputs;
  return list?.find((p) => p.id === port)?.label ?? port;
}

/** Tray kinds that no earlier level offers: the pieces this level teaches. */
export function newKindsOf(level: PuzzleLevel, levels: readonly PuzzleLevel[] = PUZZLE_LEVELS): Set<string> {
  const seen = new Set<string>();
  for (const l of levels) {
    if (l.order >= level.order) continue;
    for (const t of l.tray) seen.add(t.kind);
  }
  return new Set(level.tray.map((t) => t.kind).filter((k) => !seen.has(k)));
}

/** Value a tray piece starts with for a param (tray params over the node's defaults). */
function startValue(level: PuzzleLevel, kind: string, paramId: string): ParamValue | undefined {
  const piece = level.tray.find((t) => t.kind === kind);
  return { ...defaultParams(getNodeDef(kind)), ...(piece?.params ?? {}) }[paramId];
}

/** Params of a solution piece the player must change from the tray's starting value. */
function paramsToSet(level: PuzzleLevel, node: GraphNode): { paramId: string; value: ParamValue }[] {
  const out: { paramId: string; value: ParamValue }[] = [];
  for (const e of level.editable ?? []) {
    if (e.nodeId !== undefined || e.kind !== node.kind) continue;
    const want = node.params[e.paramId];
    if (want === undefined || out.some((o) => o.paramId === e.paramId)) continue;
    if (JSON.stringify(want) !== JSON.stringify(startValue(level, node.kind, e.paramId))) out.push({ paramId: e.paramId, value: want });
  }
  return out;
}

/**
 * Steps that rebuild the level's reference solution, no intro and no run step: for each wire in turn,
 * first take the pieces it needs from the tray (and set their numbers), then join it.
 */
export function solutionSteps(level: PuzzleLevel, levels: readonly PuzzleLevel[] = PUZZLE_LEVELS): GuideStep[] {
  const fresh = newKindsOf(level, levels);
  const sol = level.solution.nodes;
  const kindOf = new Map(sol.map((n) => [n.id, n.kind]));
  const steps: GuideStep[] = [];
  const taken = new Set<string>();

  const take = (nodeId: string): void => {
    const node = sol.find((n) => n.id === nodeId);
    if (!node || taken.has(nodeId)) return;
    taken.add(nodeId);
    const ordinal = sol.filter((n) => n.kind === node.kind).indexOf(node);
    const isNew = fresh.has(node.kind) && ordinal === 0;
    const name = kindName(node.kind);
    const purpose = KIND_PURPOSE[node.kind];
    const text = isNew && purpose ? `${GUIDE_TEXT.newPiece} ${name}: ${purpose} ${GUIDE_TEXT.tapToTake}` : GUIDE_TEXT.takePiece(name);
    steps.push({ type: 'piece', text, solNode: nodeId, kind: node.kind, slot: Math.max(0, level.tray.findIndex((t) => t.kind === node.kind)), ordinal, isNew });
    const def = getNodeDef(node.kind);
    for (const p of paramsToSet(level, node)) {
      const label = def?.params.find((d) => d.id === p.paramId)?.label ?? p.paramId;
      steps.push({ type: 'param', text: GUIDE_TEXT.setParam(`"${label}"`, p.value), solNode: nodeId, paramId: p.paramId, value: p.value });
    }
  };

  for (const wire of level.solution.wires) {
    take(wire.from.node);
    take(wire.to.node);
    const end = (node: string, port: string, dir: 'in' | 'out'): string =>
      `${nodeName(level, node, kindOf)} (${portLabel(kindOfNode(level, node, kindOf), port, dir)})`;
    const text = WIRE_LINES[level.id]?.[wire.id] ?? GUIDE_TEXT.join(end(wire.from.node, wire.from.port, 'out'), end(wire.to.node, wire.to.port, 'in'));
    steps.push({ type: 'wire', text, wire });
  }
  for (const n of sol) take(n.id);
  return steps;
}

/** The guide: an opening line, the solution steps, then "press RUN". Empty for levels without a guide. */
export function buildGuideSteps(level: PuzzleLevel, levels: readonly PuzzleLevel[] = PUZZLE_LEVELS): GuideStep[] {
  const intro = LEVEL_INTRO[level.id];
  if (!intro) return [];
  return [{ type: 'intro', text: intro }, ...solutionSteps(level, levels), { type: 'run', text: GUIDE_TEXT.run }];
}

// ---------- progress through the steps ----------

/** Maps a solution node id to the node on the board (locked nodes map to themselves; the n-th piece of a kind to the n-th placed one). */
export function resolveSolutionNode(level: PuzzleLevel, state: BoardState, solNodeId: string): string | null {
  const sol = level.solution.nodes.find((n) => n.id === solNodeId);
  if (!sol) return level.base.nodes.some((n) => n.id === solNodeId) ? solNodeId : null;
  const ordinal = level.solution.nodes.filter((n) => n.kind === sol.kind).indexOf(sol);
  return state.placed.filter((p) => p.node.kind === sol.kind)[ordinal]?.node.id ?? null;
}

/** Has the player done this step? `running` is true once the game has started. */
export function isStepDone(step: GuideStep, level: PuzzleLevel, state: BoardState, running: boolean): boolean {
  switch (step.type) {
    case 'intro':
      return false; // done by the "Tiếp" tap, tracked by the guide
    case 'run':
      return running;
    case 'piece':
      return resolveSolutionNode(level, state, step.solNode) !== null;
    case 'param': {
      const id = resolveSolutionNode(level, state, step.solNode);
      const node = state.placed.find((p) => p.node.id === id)?.node;
      return !!node && paramValue(state, node, step.paramId) === step.value;
    }
    case 'wire': {
      const from = resolveSolutionNode(level, state, step.wire.from.node);
      const to = resolveSolutionNode(level, state, step.wire.to.node);
      if (!from || !to) return false;
      return state.wires.some((w) => w.from.node === from && w.from.port === step.wire.from.port && w.to.node === to && w.to.port === step.wire.to.port);
    }
  }
}

/** Index of the first step still to do (steps.length when everything is done). The intro counts as done once `introDone`. */
export function currentStepIndex(steps: readonly GuideStep[], level: PuzzleLevel, state: BoardState, running: boolean, introDone: boolean): number {
  const i = steps.findIndex((s) => !(s.type === 'intro' ? introDone : isStepDone(s, level, state, running)));
  return i < 0 ? steps.length : i;
}

// ---------- "seen" memory ----------

export const GUIDE_SEEN_KEY = 'xuongnoi.puzzle.guideSeen';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked
  }
}

/** A guided level's guide is mandatory until the player has finished it once (it is marked seen on the first win). */
export const isGuideForced = (level: PuzzleLevel, storage?: StorageLike | null): boolean => hasGuide(level) && !hasSeenGuide(level.id, storage);

const INTRO_PREFIX = 'intro:';
/** The new-piece intros of a level are remembered in the same list, as `intro:<level id>`. */
export const hasSeenIntro = (levelId: string, storage?: StorageLike | null): boolean => hasSeenGuide(INTRO_PREFIX + levelId, storage);
export const markIntroSeen = (levelId: string, storage?: StorageLike | null): boolean => markGuideSeen(INTRO_PREFIX + levelId, storage);

/** Level ids whose guide has already been shown. Anything that is not a list of strings is ignored. */
export function loadGuideSeen(storage: StorageLike | null = defaultStorage()): Set<string> {
  if (!storage) return new Set();
  try {
    const data: unknown = JSON.parse(storage.getItem(GUIDE_SEEN_KEY) ?? 'null');
    return new Set(Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export const hasSeenGuide = (levelId: string, storage?: StorageLike | null): boolean => loadGuideSeen(storage).has(levelId);

export function markGuideSeen(levelId: string, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    const seen = loadGuideSeen(storage);
    seen.add(levelId);
    storage.setItem(GUIDE_SEEN_KEY, JSON.stringify([...seen]));
    return true;
  } catch {
    return false; // full or blocked: the guide then shows again next visit
  }
}
