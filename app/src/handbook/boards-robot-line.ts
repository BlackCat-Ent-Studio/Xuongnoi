import { createNode } from '../editor/editor-state';
import { migrateBoardWireRule } from '../editor/graph/wire-rule-migration';
import { addWire } from '../engine/wiring';
import type { Board, Graph, Note, Params, ViewMode } from '../engine/types';

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

function build(label: string, mode: ViewMode, note: string, nodes: NodeSpec[], wires: WireSpec[]): Board {
  let graph: Graph = { nodes: [], wires: [] };
  const ids = new Map<string, string>();
  for (const spec of nodes) {
    const node = createNode(graph, spec.kind, { x: spec.x, y: spec.y });
    if (!node) throw new Error(`Unknown node kind in handbook board: ${spec.kind}`);
    node.params = { ...node.params, ...spec.params };
    ids.set(spec.alias, node.id);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  for (const [fa, fp, ta, tp] of wires) {
    const from = ids.get(fa);
    const to = ids.get(ta);
    if (!from || !to) throw new Error(`Unknown alias in handbook wire: ${fa} -> ${ta}`);
    const res = addWire(graph, { node: from, port: fp }, { node: to, port: tp });
    if (!('nodes' in res)) throw new Error(`Cannot wire ${fa}.${fp} -> ${ta}.${tp}: ${res.reason}`);
    graph = res;
  }
  const notes: Note[] = [{ id: 'note-1', text: note, color: 'yellow', pos: { x: 20, y: 420 }, size: { w: 320, h: 130 } }];
  return migrateBoardWireRule({ name: `Thử: ${label}`, mode, graph, notes });
}

/**
 * A character you steer with the stick over an oval line. Two sensors look down at the line from either side of the nose
 * (0,2 m left and right) and show how much of their spot is on the line.
 */
function ovalWithTwoEyes(label: string, mode: ViewMode, note: string): Board {
  const flat3d: NodeSpec[] =
    mode === '3d' ? [{ alias: 'floor', kind: 'block', x: 20, y: 560, params: { position: { x: 0, y: 0, z: 0 }, size: { x: 24, y: 1, z: 16 }, color: '#d6d3d1' } }] : [];
  return build(
    label,
    mode,
    note,
    [
      { alias: 'stick', kind: 'stick', x: 20, y: 20 },
      { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: 0, y: mode === '3d' ? 1 : 0.5, z: 3 }, speed: 3, color: '#ef4444', look: 'robot-wheel' } },
      { alias: 'track', kind: 'line-track', x: 300, y: 330, params: { shape: 'oval', center: { x: 0, y: 0.5, z: 0 }, length: 12, breadth: 6, width: 0.4 } },
      { alias: 'eyeL', kind: 'line-sensor', x: 620, y: 20, params: { side: -0.25, forward: 0.6, spot: 0.3 } },
      { alias: 'eyeR', kind: 'line-sensor', x: 620, y: 330, params: { side: 0.25, forward: 0.6, spot: 0.3 } },
      { alias: 'numL', kind: 'show-number', x: 940, y: 20, params: { label: 'Mắt trái', corner: 'top-left' } },
      { alias: 'numR', kind: 'show-number', x: 940, y: 200, params: { label: 'Mắt phải', corner: 'top-right' } },
      { alias: 'seeL', kind: 'show-text', x: 940, y: 380, params: { text: 'Mắt trái thấy line', corner: 'bottom-left' } },
      { alias: 'seeR', kind: 'show-text', x: 940, y: 520, params: { text: 'Mắt phải thấy line', corner: 'bottom-right' } },
      ...flat3d,
    ],
    [
      ['stick', 'x', 'hero', 'moveX'],
      ['stick', 'y', 'hero', 'moveY'],
      ['hero', 'self', 'eyeL', 'who'],
      ['hero', 'self', 'eyeR', 'who'],
      ['track', 'self', 'eyeL', 'track'],
      ['track', 'self', 'eyeR', 'track'],
      ['eyeL', 'level', 'numL', 'value'],
      ['eyeR', 'level', 'numR', 'value'],
      ['eyeL', 'onLine', 'seeL', 'show'],
      ['eyeR', 'onLine', 'seeR', 'show'],
    ],
  );
}

const TRY_NOTE =
  'Bấm Chơi, rồi lái nhân vật bằng phím mũi tên hoặc WASD và đi dọc theo vạch đen. Hai mắt nằm lệch trái và phải mũi nhân vật: mắt nào bắt đầu chạm vạch thì Độ đậm tăng từ 0 lên 1 và chữ của mắt đó sáng lên. Chấm nhỏ dưới chân nhân vật là chỗ mắt đang đọc, sáng xanh khi thấy line.';

export const tryLineTrack = (): Board => ovalWithTwoEyes('Đường line', '2d-top', TRY_NOTE);

export const tryLineSensor = (): Board => ovalWithTwoEyes('Cảm biến dò line', '2d-top', TRY_NOTE);

export const tryLineSensor3d = (): Board =>
  ovalWithTwoEyes('Cảm biến dò line (3D)', '3d', 'Giống bảng chính nhưng chơi trong 3D: vạch được sơn trên sàn. Lái nhân vật dọc theo vạch và nhìn hai số Độ đậm đổi.');
