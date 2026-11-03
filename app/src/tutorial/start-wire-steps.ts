import { addStartCard } from '../editor/graph/wire-rule-migration';
import type { Graph, GraphNode } from '../engine/types';
import { nodesOfKind, paramOf, type NodeFilter } from './graph-checks';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * "Every action needs its own wire": a piece such as "Đi tới" or "Đi tuần" does nothing until a signal reaches its
 * "Cho đi" / "Hoạt động" / "Bật" / "Chạy" / "Hiện" input. Lessons that make the learner place such a piece get one
 * extra step right after the step that wires it: connect "Đã bắt đầu" of a "Khi bắt đầu" card (put on the starting board)
 * to that input. The table lives here, away from the lessons, so each lesson file stays about its own idea.
 */

interface Piece {
  /** How the lessons call the piece. */
  name: string;
  /** Label of the input in the card. */
  input: string;
}

/** The pieces whose input needs the start signal, with the names the learner sees on the cards. */
const PIECES: Record<string, Piece> = {
  'go-to': { name: 'Đi tới', input: 'Cho đi' },
  patrol: { name: 'Đi tuần', input: 'Hoạt động' },
  'route-follow': { name: 'Chạy theo tuyến', input: 'Bật' },
  chase: { name: 'Đuổi / Trốn', input: 'Cho đi' },
  fight: { name: 'Đánh địch', input: 'Cho đi' },
  timer: { name: 'Hẹn giờ', input: 'Chạy' },
  'moving-platform': { name: 'Bệ di chuyển', input: 'Chạy' },
  'rotating-platform': { name: 'Bệ xoay', input: 'Chạy' },
  portal: { name: 'Cổng dịch chuyển', input: 'Bật' },
  camera: { name: 'Máy quay', input: 'Bật' },
  'show-text': { name: 'Hiện chữ', input: 'Hiện' },
  'guide-arrow': { name: 'Mũi tên chỉ đường', input: 'Hiện' },
  'ui-button': { name: 'Nút trên màn hình', input: 'Hiện' },
  'ui-meter': { name: 'Thanh trên màn hình', input: 'Hiện' },
  block: { name: 'Băng chuyền', input: 'Chạy băng chuyền' },
};

/** The blocks that are a conveyor belt (the others have nothing to start). */
const isBelt: NodeFilter = (n) => paramOf(n, 'style') === 'conveyor' || Number(paramOf(n, 'beltSpeed') ?? 0) !== 0;

export interface StartWire {
  kind: string;
  port: string;
  /** Id of the lesson step after which the learner connects the start signal. */
  after: string;
  /** Only the nodes of the kind that pass this filter need the wire. */
  where?: NodeFilter;
}

/** Which lessons make the learner place such a piece (by lesson id), and where. */
export const START_WIRES: Record<string, readonly StartWire[]> = {
  'make-bot': [{ kind: 'patrol', port: 'on', after: 'wire-bot-move' }],
  'chase-game': [{ kind: 'chase', port: 'go', after: 'wire-runner' }],
  'tidy-bot': [
    { kind: 'route-follow', port: 'on', after: 'wire-route' },
    { kind: 'go-to', port: 'go', after: 'wire-go' },
  ],
  'two-goals-bot': [{ kind: 'go-to', port: 'go', after: 'wire-go' }],
  combat: [{ kind: 'fight', port: 'go', after: 'wire-fight-attack' }],
  'route-traffic': [{ kind: 'route-follow', port: 'on', after: 'wire-route-move' }],
  train: [
    { kind: 'route-follow', port: 'on', after: 'wire-route-who' },
    { kind: 'timer', port: 'run', after: 'timer-seconds' },
  ],
  'platforms-shooting': [
    { kind: 'moving-platform', port: 'run', after: 'platform-b' },
    { kind: 'timer', port: 'run', after: 'add-timer' },
  ],
  'camera-portals': [{ kind: 'portal', port: 'on', after: 'pair-portals' }],
  'ui-chest': [
    { kind: 'timer', port: 'run', after: 'add-timer' },
    { kind: 'ui-meter', port: 'show', after: 'wire-meter' },
  ],
  conveyor: [{ kind: 'block', port: 'run', after: 'belt-direction', where: isBelt }],
  'start-screen': [{ kind: 'ui-button', port: 'show', after: 'wire-door' }],
  'health-color': [{ kind: 'ui-meter', port: 'show', after: 'wire-map-meter' }],
};

const startPort = (g: Graph): GraphNode | undefined => nodesOfKind(g, 'on-start')[0];
const wiredInto = (g: Graph, n: GraphNode, port: string): boolean => g.wires.some((w) => w.to.node === n.id && w.to.port === port);

function startStep(w: StartWire): Step {
  const piece = PIECES[w.kind];
  if (!piece) throw new Error(`No name for the piece "${w.kind}" in the start-wire table`);
  const missing = (g: Graph): GraphNode[] => nodesOfKind(g, w.kind, w.where).filter((n) => !wiredInto(g, n, w.port));
  return {
    id: `start-${w.kind}-${w.port}`,
    title: `Bật "${piece.name}" lên`,
    text: `Mảnh "${piece.name}" chỉ làm việc khi có một dây bật nó lên. Nối cổng "Đã bắt đầu" của mảnh "Khi bắt đầu" (có sẵn bên trái bảng) sang cổng "${piece.input}" của "${piece.name}".`,
    explain: 'Mỗi việc cần dây riêng của nó: không có dây thì mảnh ghép đứng yên. "Khi bắt đầu" bật ngay khi bấm Chơi và giữ bật suốt trò chơi.',
    target: (snap: Snapshot): TargetList => {
      const start = startPort(snap.graph);
      const node = missing(snap.graph)[0] ?? nodesOfKind(snap.graph, w.kind, w.where)[0];
      const out: string[] = [];
      if (start) out.push(`.wc-port[data-node="${start.id}"][data-port="started"][data-dir="out"]`);
      if (node) out.push(`.wc-port[data-node="${node.id}"][data-port="${w.port}"][data-dir="in"]`);
      return out;
    },
    check: (snap) => nodesOfKind(snap.graph, w.kind, w.where).length > 0 && missing(snap.graph).length === 0,
  };
}

/** The lesson with its start-wire steps inserted and a "Khi bắt đầu" card on its starting board; unchanged when it has none. */
export function withStartWireSteps(lesson: Lesson): Lesson {
  const wanted = START_WIRES[lesson.id];
  if (!wanted) return lesson;
  const steps = [...lesson.steps];
  for (const w of wanted) {
    const at = steps.findIndex((s) => s.id === w.after);
    if (at < 0) throw new Error(`Lesson ${lesson.id} has no step "${w.after}" to put the start wire after`);
    steps.splice(at + 1, 0, startStep(w));
  }
  return { ...lesson, steps, createBoard: () => addStartCard(lesson.createBoard()) };
}
