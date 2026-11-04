import type { Graph, GraphNode } from '../engine/types';
import { nodesOfKind, numParam, paramOf, vecParam } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot, Step, TargetList } from './types';

/**
 * Lesson 13, "Máy quay và cổng": the hero stands on a cliff, the gap is too wide to jump and the goal flag sits on a far island.
 * The learner links two portals, adds a zooming camera with a shake, a teleport key back home, and a win rule.
 * Self-contained like lessons 9 and 10: shared builders arrive through `LessonKit`.
 */

const T = {
  title: '14. Máy quay và cổng',
  summary: 'Dùng cổng dịch chuyển để vượt vực, máy quay phóng to và rung, phím R để về nhà.',
  boardName: 'Bài 14 - Máy quay và cổng',
  intro: {
    title: 'Vực quá rộng để nhảy',
    text: 'Nhân vật đang đứng trên vách đá. Bên kia vực là một hòn đảo có lá cờ xanh, nhưng vực rộng quá, nhảy không tới. Ta sẽ dùng cổng dịch chuyển để sang đảo.',
    explain: 'Bảng này đã nối sẵn phím mũi tên để chạy và phím Space để nhảy. Nếu rơi xuống vực, cứ bấm Dừng rồi Chơi lại.',
  },
  watch: {
    title: 'Thử nhảy trước',
    text: 'Bấm "Chơi", chạy tới mép vực và thử nhảy. Bạn sẽ thấy không sang được.',
  },
  edit: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để làm tiếp.',
  },
  portals: {
    title: 'Thêm hai cổng',
    text: 'Kéo hai mảnh ghép "Cổng dịch chuyển" (nhóm Vật thể) vào bảng. Mỗi lần kéo một mảnh ghép, nên bạn kéo hai lần.',
    explain: 'Cổng là cánh cửa phát sáng. Ai chạm vào cổng này sẽ được đưa sang cổng kia của cặp.',
  },
  place: {
    title: 'Đặt một cổng sang đảo',
    text: 'Chọn một mảnh ghép Cổng. Ở Thuộc tính, đổi "Vị trí" thành X = 22 (giữ Y = 1). Cổng còn lại cứ để ở X = 0, ngay trên vách đá.',
    explain: 'X là chiều ngang: số càng lớn càng sang phải. Vách đá nằm bên trái, hòn đảo nằm từ X = 18 trở đi.',
  },
  pair: {
    title: 'Ghép hai cổng thành một cặp',
    text: 'Nối cổng "Đối tượng" của mảnh ghép Cổng này sang cổng "Cổng đối diện" của mảnh ghép Cổng kia.',
    explain: 'Chỉ cần nối một dây là đủ. Cách khác: gõ cùng một "Mã cặp" vào cả hai cổng, hai cổng có chung mã sẽ tự ghép đôi.',
  },
  tryPortals: {
    title: 'Đi qua cổng',
    text: 'Bấm "Chơi" và chạy sang phải, chạm vào cổng ở vách đá. Bạn sẽ xuất hiện bên cổng ở đảo!',
    explain: 'Muốn đi lại, bước ra khỏi cổng rồi chạm lại. Cổng nghỉ nửa giây giữa hai lần dùng.',
  },
  edit2: {
    title: 'Quay lại sửa',
    text: 'Bấm nút "Dừng" để thêm máy quay.',
  },
  distance: {
    title: 'Thêm mảnh ghép Đo khoảng cách',
    text: 'Kéo mảnh ghép "Đo khoảng cách" (nhóm Logic) vào bảng.',
    explain: 'Mảnh ghép này đo xem hai vật cách nhau bao xa, và bật "Trong tầm" khi chúng lại gần nhau. Ta dùng nó để biết nhân vật đã gần lá cờ.',
  },
  distanceWho: {
    title: 'Đo từ nhân vật tới cờ',
    text: 'Nối cổng "Đối tượng" của nhân vật sang "Đối tượng A", và cổng "Đối tượng" của lá cờ xanh (hộp nhặt được) sang "Đối tượng B" của mảnh ghép Đo khoảng cách.',
  },
  threshold: {
    title: 'Gần là bao nhiêu?',
    text: 'Chọn mảnh ghép Đo khoảng cách. Ở Thuộc tính, đổi "Ngưỡng đủ gần" thành 8.',
    explain: 'Cách cờ không quá 8 mảnh ghép thì "Trong tầm" bật. Vừa sang đảo là đã đủ gần rồi.',
  },
  camera: {
    title: 'Thêm Máy quay',
    text: 'Kéo mảnh ghép "Máy quay" (nhóm Hành động) vào bảng.',
    explain: 'Máy quay điều khiển góc nhìn khi chơi. Khi nó bật, nó quyết định phóng to hay thu nhỏ; khi tắt, góc nhìn trở lại như thường.',
  },
  cameraOn: {
    title: 'Gần cờ thì bật máy quay',
    text: 'Nối "Trong tầm" của mảnh ghép Đo khoảng cách sang cổng "Bật" của Máy quay.',
    explain: 'Xa cờ thì máy quay tắt, bạn thấy cảnh bình thường. Tới gần cờ thì máy quay bật.',
  },
  zoom: {
    title: 'Phóng to',
    text: 'Chọn Máy quay. Ở Thuộc tính, đổi "Phóng to mặc định" thành 1.8.',
    explain: '1 là bình thường, số lớn hơn là nhìn gần hơn, số nhỏ hơn là nhìn xa hơn. Máy quay phóng dần dần chứ không giật.',
  },
  shake: {
    title: 'Rung khi qua cổng',
    text: 'Nối cổng "Khi có người vào" của một mảnh ghép Cổng sang cổng "Rung" của Máy quay.',
    explain: 'Mỗi lần có người bước vào cổng, màn hình rung nhẹ một chút. Độ mạnh và thời gian rung chỉnh được trong Thuộc tính của Máy quay.',
  },
  key: {
    title: 'Thêm phím R',
    text: 'Kéo thêm một mảnh ghép "Phím bấm" vào bảng. Ở Thuộc tính, bấm vào ô "Phím" rồi nhấn phím R.',
  },
  teleport: {
    title: 'Thêm Dịch chuyển',
    text: 'Kéo mảnh ghép "Dịch chuyển" (nhóm Hành động) vào bảng.',
    explain: 'Mỗi khi nhận một nhịp ở "Dịch chuyển", nó đưa một vật tới chỗ khác ngay lập tức, không cần cổng.',
  },
  teleportWire: {
    title: 'Bấm R để về nhà',
    text: 'Nối "Đối tượng" của nhân vật sang "Đối tượng" của mảnh ghép Dịch chuyển. Rồi nối "Khi nhấn phím" của phím R sang "Dịch chuyển".',
    explain: '"Khi nhấn phím" chỉ bật một nhịp mỗi lần nhấn, nên mỗi lần nhấn R là dịch chuyển một lần.',
  },
  home: {
    title: 'Chọn nơi về',
    text: 'Chọn mảnh ghép Dịch chuyển. Ở Thuộc tính, đổi "Vị trí đến" thành X = -8 (giữ Y = 1), đúng chỗ nhân vật xuất phát.',
    explain: 'Khi không nối "Điểm đến", mảnh ghép dùng toạ độ này làm nơi về.',
  },
  winNodes: {
    title: 'Thêm mảnh ghép thắng',
    text: 'Kéo mảnh ghép "Va chạm" (nhóm Logic) và mảnh ghép "Thắng / Thua" (nhóm Kết quả) vào bảng.',
  },
  winWire: {
    title: 'Chạm cờ là thắng',
    text: 'Nối "Đối tượng" của nhân vật sang "Đối tượng A" và "Đối tượng" của lá cờ sang "Đối tượng B" của Va chạm. Rồi nối "Đang chạm" sang "Thắng".',
  },
  play: {
    title: 'Chạy thử',
    text: 'Bấm "Chơi". Chạy vào cổng, xem màn hình rung rồi phóng to khi tới đảo. Bấm R nếu muốn về nhà thử lại.',
  },
  won: {
    title: 'Chạm lá cờ',
    text: 'Chạy tới chạm lá cờ xanh trên đảo để thắng.',
  },
  done: {
    title: 'Bạn qua vực rồi!',
    text: 'Bạn đã dùng cổng để vượt vực, máy quay để phóng to và rung, và dịch chuyển để về nhà. Hãy thử đặt cổng ở chỗ khác, đổi mức phóng to hoặc cho máy quay nhìn từ xa (thu nhỏ dưới 1).',
  },
} as const;

type Pick2 = Pick<Step, 'id' | 'target' | 'check'>;

// ---------- finding the nodes of this board ----------

const isFlag = (n: GraphNode): boolean => n.kind === 'block' && paramOf(n, 'type') === 'pickup';
const first = (graph: Graph, kind: string, where?: (n: GraphNode) => boolean): GraphNode | undefined =>
  nodesOfKind(graph, kind, where)[0];

type Resolve = (g: Graph) => GraphNode | undefined;
const hero: Resolve = (g) => first(g, 'character');
const flag: Resolve = (g) => first(g, 'block', isFlag);
const distance: Resolve = (g) => first(g, 'distance');
const camera: Resolve = (g) => first(g, 'camera');
const teleport: Resolve = (g) => first(g, 'teleport');
const touch: Resolve = (g) => first(g, 'touch');
const end: Resolve = (g) => first(g, 'win-lose');
/** The key that is meant for R: the one set to R, else the newest key (the starter keeps only the jump key). */
const keyR: Resolve = (g) => {
  const keys = nodesOfKind(g, 'key');
  return keys.find((k) => paramOf(k, 'key') === 'KeyR') ?? (keys.length > 1 ? keys[keys.length - 1] : undefined);
};

function wired(graph: Graph, from: GraphNode | undefined, fromPort: string, to: GraphNode | undefined, toPort: string): boolean {
  if (!from || !to) return false;
  return graph.wires.some((w) => w.from.node === from.id && w.from.port === fromPort && w.to.node === to.id && w.to.port === toPort);
}

interface Link {
  ends(graph: Graph): { from?: GraphNode; fromPort: string; to?: GraphNode; toPort: string };
}
const link = (from: Resolve, fromPort: string, to: Resolve, toPort: string): Link => ({
  ends: (g) => ({ from: from(g), fromPort, to: to(g), toPort }),
});
const linkDone = (graph: Graph, l: Link): boolean => {
  const e = l.ends(graph);
  return wired(graph, e.from, e.fromPort, e.to, e.toPort);
};

function wiresStep(id: string, links: Link[]): Pick2 {
  return {
    id,
    target: (snap: Snapshot): TargetList => {
      const missing = links.find((l) => !linkDone(snap.graph, l)) ?? links[0]!;
      const e = missing.ends(snap.graph);
      const out: string[] = [];
      if (e.from) out.push(`.wc-port[data-node="${e.from.id}"][data-port="${e.fromPort}"][data-dir="out"]`);
      if (e.to) out.push(`.wc-port[data-node="${e.to.id}"][data-port="${e.toPort}"][data-dir="in"]`);
      return out;
    },
    check: (snap) => links.every((l) => linkDone(snap.graph, l)),
  };
}

const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;
const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;
const nodeSel = (n: GraphNode): string => `.wc-node[data-id="${n.id}"]`;

/** Portals: the island one (x >= 18) and the cliff one (x <= 4). */
const ISLAND_X = 18;
const CLIFF_X = 4;
const portalX = (n: GraphNode): number => vecParam(n, 'position')?.x ?? 0;

/** Two portals are a pair by a wire in either direction, or by the same non-empty pair code. */
function portalsPaired(graph: Graph): boolean {
  const ps = nodesOfKind(graph, 'portal');
  for (const a of ps) {
    for (const b of ps) {
      if (a === b) continue;
      if (wired(graph, a, 'self', b, 'partner')) return true;
      const code = paramOf(a, 'pair');
      if (typeof code === 'string' && code.trim() !== '' && code === paramOf(b, 'pair')) return true;
    }
  }
  return false;
}

/** A portal that has no partner wire yet gets the hint on its output; otherwise the first two portals. */
function pairTarget(snap: Snapshot): TargetList {
  const ps = nodesOfKind(snap.graph, 'portal');
  const a = ps[0];
  const b = ps[1];
  if (!a || !b) return [paletteSel('portal')];
  return [
    `.wc-port[data-node="${a.id}"][data-port="self"][data-dir="out"]`,
    `.wc-port[data-node="${b.id}"][data-port="partner"][data-dir="in"]`,
  ];
}

/** The portal whose used pulse should shake the camera: tolerant of either portal. */
function shakeWired(graph: Graph): boolean {
  const cam = camera(graph);
  return nodesOfKind(graph, 'portal').some((p) => wired(graph, p, 'used', cam, 'shake'));
}

/** The lesson board: a cliff, a gap too wide to jump, a far island with the flag, and a ready-wired hero. */
export function createCameraPortalsLesson(kit: LessonKit): Lesson {
  const floor = (alias: string, y: number, x: number, sx: number, color: string, py: number, sy = 1) => ({
    alias,
    kind: 'block',
    x: 300,
    y,
    params: { type: 'solid', position: { x, y: py, z: 0 }, size: { x: sx, y: sy, z: 1 }, color },
  });
  const nodes: Parameters<LessonKit['buildBoard']>[1] = [
    { alias: 'stick', kind: 'stick', x: 20, y: 20, params: { scheme: 'arrows' } },
    { alias: 'jump', kind: 'key', x: 20, y: 190, params: { key: 'Space' } },
    { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -8, y: 1, z: 0 }, speed: 5, jumpPower: 10, color: '#3b82f6', look: 'human' } },
    floor('cliff', 300, -4, 16, '#65a30d', -0.5),
    floor('island', 380, 24, 14, '#65a30d', -0.5),
    floor('pit', 460, 10, 14, '#78716c', -8.5),
    { alias: 'flag', kind: 'block', x: 300, y: 540, params: { type: 'pickup', position: { x: 27, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#22c55e' } },
  ];
  const wires: Parameters<LessonKit['buildBoard']>[2] = [
    ['stick', 'x', 'hero', 'moveX'],
    ['jump', 'held', 'hero', 'jump'],
  ];

  return {
    id: 'camera-portals',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, nodes, wires), mode: '2d-side' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { id: 'watch', title: T.watch.title, text: T.watch.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'back-to-edit', title: T.edit.title, text: T.edit.text, target: () => [kit.playButton], check: (s) => !s.playing },
      { ...kit.addStep('add-portals', 'portal', 2), title: T.portals.title, text: T.portals.text, explain: T.portals.explain },
      {
        id: 'place-portal',
        title: T.place.title,
        text: T.place.text,
        explain: T.place.explain,
        target: (s) => {
          const ps = nodesOfKind(s.graph, 'portal');
          const n = ps.find((p) => portalX(p) < ISLAND_X) ?? ps[0];
          return [n ? [paramSel('position'), nodeSel(n)] : paramSel('position')];
        },
        check: (s) => {
          const ps = nodesOfKind(s.graph, 'portal');
          return ps.length >= 2 && ps.some((p) => portalX(p) >= ISLAND_X) && ps.some((p) => portalX(p) <= CLIFF_X);
        },
      },
      { id: 'pair-portals', title: T.pair.title, text: T.pair.text, explain: T.pair.explain, target: pairTarget, check: (s) => portalsPaired(s.graph) },
      { id: 'try-portals', title: T.tryPortals.title, text: T.tryPortals.text, explain: T.tryPortals.explain, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'back-to-edit-2', title: T.edit2.title, text: T.edit2.text, target: () => [kit.playButton], check: (s) => !s.playing },
      { ...kit.addStep('add-distance', 'distance'), title: T.distance.title, text: T.distance.text, explain: T.distance.explain },
      {
        ...wiresStep('wire-distance', [link(hero, 'self', distance, 'a'), link(flag, 'self', distance, 'b')]),
        title: T.distanceWho.title,
        text: T.distanceWho.text,
      },
      {
        id: 'distance-threshold',
        title: T.threshold.title,
        text: T.threshold.text,
        explain: T.threshold.explain,
        target: (s) => {
          const d = distance(s.graph);
          return [d ? [paramSel('threshold'), nodeSel(d)] : paramSel('threshold')];
        },
        check: (s) => {
          const d = distance(s.graph);
          const v = d ? numParam(d, 'threshold') : null;
          return v !== null && v >= 6;
        },
      },
      { ...kit.addStep('add-camera', 'camera'), title: T.camera.title, text: T.camera.text, explain: T.camera.explain },
      {
        ...wiresStep('wire-camera-on', [link(distance, 'within', camera, 'on')]),
        title: T.cameraOn.title,
        text: T.cameraOn.text,
        explain: T.cameraOn.explain,
      },
      {
        id: 'camera-zoom',
        title: T.zoom.title,
        text: T.zoom.text,
        explain: T.zoom.explain,
        target: (s) => {
          const c = camera(s.graph);
          return [c ? [paramSel('zoom'), nodeSel(c)] : paramSel('zoom')];
        },
        check: (s) => {
          const c = camera(s.graph);
          const v = c ? numParam(c, 'zoom') : null;
          return v !== null && v >= 1.4;
        },
      },
      {
        id: 'wire-shake',
        title: T.shake.title,
        text: T.shake.text,
        explain: T.shake.explain,
        target: (s) => {
          const cam = camera(s.graph);
          const p = nodesOfKind(s.graph, 'portal').find((n) => portalX(n) <= CLIFF_X) ?? nodesOfKind(s.graph, 'portal')[0];
          const out: string[] = [];
          if (p) out.push(`.wc-port[data-node="${p.id}"][data-port="used"][data-dir="out"]`);
          if (cam) out.push(`.wc-port[data-node="${cam.id}"][data-port="shake"][data-dir="in"]`);
          return out;
        },
        check: (s) => shakeWired(s.graph),
      },
      {
        id: 'add-key-r',
        title: T.key.title,
        text: T.key.text,
        target: (s) => {
          const k = keyR(s.graph);
          return k && paramOf(k, 'key') !== 'KeyR' ? [[paramSel('key'), nodeSel(k)]] : [paletteSel('key')];
        },
        check: (s) => nodesOfKind(s.graph, 'key').some((k) => paramOf(k, 'key') === 'KeyR'),
      },
      { ...kit.addStep('add-teleport', 'teleport'), title: T.teleport.title, text: T.teleport.text, explain: T.teleport.explain },
      {
        ...wiresStep('wire-teleport', [link(hero, 'self', teleport, 'who'), link(keyR, 'pressed', teleport, 'go')]),
        title: T.teleportWire.title,
        text: T.teleportWire.text,
        explain: T.teleportWire.explain,
      },
      {
        id: 'teleport-home',
        title: T.home.title,
        text: T.home.text,
        explain: T.home.explain,
        target: (s) => {
          const t = teleport(s.graph);
          return [t ? [paramSel('position'), nodeSel(t)] : paramSel('position')];
        },
        check: (s) => {
          const t = teleport(s.graph);
          const v = t ? vecParam(t, 'position') : null;
          return v !== null && v.x <= -4;
        },
      },
      {
        id: 'add-win-nodes',
        title: T.winNodes.title,
        text: T.winNodes.text,
        target: (s) => [!touch(s.graph) ? paletteSel('touch') : paletteSel('win-lose')],
        check: (s) => touch(s.graph) !== undefined && end(s.graph) !== undefined,
      },
      {
        ...wiresStep('wire-win', [link(hero, 'self', touch, 'a'), link(flag, 'self', touch, 'b'), link(touch, 'touching', end, 'win')]),
        title: T.winWire.title,
        text: T.winWire.text,
      },
      { id: 'play-all', title: T.play.title, text: T.play.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
