import { MACHINE_DOOR_LABEL, SECOND_MACHINE_Y, SHARE_JOBS_SCENE_WIRES, shareJobsScene } from '../handbook/boards-memory-dispatch';
import type { Graph, GraphNode } from '../engine/types';
import type { Endpoint, NodeFilter } from './graph-checks';
import { paramOf } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot } from './types';

/**
 * "Chia việc cho hai máy": a job arrives every 2 seconds and two ready-made machines wait for work. The learner adds the
 * dispatcher, closes the "busy" loop of each machine, then adds a number memory so that machine 1 keeps the door number of
 * the job it took while the number of the newest job keeps changing.
 */

const T = {
  title: 'Chia việc cho hai máy',
  summary: 'Dùng Bộ điều phối chia việc cho hai máy, và Nhớ số để máy nhớ việc mình đang làm.',
  boardName: 'Chia việc cho hai máy',
  intro: {
    title: 'Hai máy, nhiều việc',
    text: 'Cứ 2 giây "Hẹn giờ" báo có một việc mới, kèm một số cửa ngẫu nhiên. Bên phải là hai máy: mỗi máy có một "Công tắc nhớ" bật khi máy đang làm và một đèn xanh sáng khi máy rảnh. Chưa có ai chia việc cho chúng.',
    explain: 'Trong nhà máy thật, một bộ điều phối quyết định xe nào, tay máy nào nhận việc kế tiếp.',
  },
  dispatcher: {
    title: 'Thêm Bộ điều phối',
    text: 'Kéo mảnh "Bộ điều phối" (nhóm Bộ não) vào bảng.',
    explain: 'Mỗi việc mới được giao cho đúng một máy đang rảnh. Máy nào cũng bận thì việc xếp hàng chờ.',
  },
  job: {
    title: 'Báo có việc',
    text: 'Nối "Hết giờ" của Hẹn giờ 2 giây (bên trái) sang "Có việc" của Bộ điều phối.',
    explain: 'Mỗi lần "Có việc" bật lên là một việc mới.',
  },
  give1: {
    title: 'Giao việc cho máy 1',
    text: 'Nối "Giao máy 1" sang "Bật" của Công tắc nhớ phía trên (máy 1).',
    explain: '"Giao máy 1" bật một nhịp; Công tắc nhớ giữ lại để máy làm cho tới khi xong.',
  },
  busy1: {
    title: 'Máy 1 báo bận',
    text: 'Nối "Đang bật" của Công tắc nhớ đó ngược về "Máy 1 đang bận" của Bộ điều phối.',
    explain: 'Nhờ sợi dây này Bộ điều phối không giao thêm việc cho máy đang làm.',
  },
  give2: { title: 'Giao việc cho máy 2', text: 'Nối "Giao máy 2" sang "Bật" của Công tắc nhớ phía dưới (máy 2).' },
  busy2: { title: 'Máy 2 báo bận', text: 'Nối "Đang bật" của Công tắc nhớ phía dưới về "Máy 2 đang bận".' },
  play1: {
    title: 'Xem chia việc',
    text: 'Bấm Chạy. Hai đèn xanh thay nhau tắt: việc được giao lần lượt cho máy 1 rồi máy 2.',
    explain: 'Thử đổi "Cách chọn" thành "Máy rảnh đầu tiên" sau bài học: máy 1 sẽ làm nhiều hơn.',
  },
  memory: {
    title: 'Thêm Nhớ số',
    text: 'Bấm Dừng. Kéo mảnh "Nhớ số" (nhóm Tính toán) vào bảng.',
    explain: 'Số cửa của việc mới đổi 2 giây một lần, nhưng máy 1 cần nhớ số cửa của việc nó đang làm.',
  },
  value: { title: 'Con số cần nhớ', text: 'Nối "Giá trị" của Số ngẫu nhiên sang "Giá trị" của Nhớ số.' },
  store: {
    title: 'Lưu lúc nhận việc',
    text: 'Nối "Giao máy 1" của Bộ điều phối sang "Lưu" của Nhớ số.',
    explain: 'Đúng lúc máy 1 nhận việc, Nhớ số chép số cửa và giữ nguyên.',
  },
  show: { title: 'Hiện số đã nhớ', text: `Nối "Số nhớ" sang "Giá trị" của Hiện số "${MACHINE_DOOR_LABEL}".` },
  play2: {
    title: 'Chạy lại',
    text: `Bấm Chạy. "${MACHINE_DOOR_LABEL}" chỉ đổi khi máy 1 nhận việc mới, còn số cửa của việc mới thì đổi liên tục.`,
    explain: 'Nếu việc phải xếp hàng chờ, hãy nối số cửa vào cổng "Mã việc" của Bộ điều phối để mỗi việc mang theo số của mình, rồi lấy số ở cổng "Mã vừa giao".',
  },
  done: {
    title: 'Xong rồi!',
    text: 'Bạn đã làm một bộ chia việc: không việc nào bị mất, không máy nào bị giao hai việc cùng lúc. Thử tăng "Số máy" lên 3 và làm thêm một máy nữa!',
  },
};

const isJobClock: NodeFilter = (n) => paramOf(n, 'repeat') === 'yes';
const isMachine = (k: 1 | 2): NodeFilter => (n) => (k === 1 ? n.pos.y < SECOND_MACHINE_Y : n.pos.y >= SECOND_MACHINE_Y);
const isMachineDoor: NodeFilter = (n) => paramOf(n, 'label') === MACHINE_DOOR_LABEL;

const CLOCK_DONE: Endpoint = { kind: 'timer', port: 'done', where: isJobClock };
const JOB: Endpoint = { kind: 'dispatcher', port: 'job' };
const GIVE_1: Endpoint = { kind: 'dispatcher', port: 'give1' };
const DOOR_VALUE: Endpoint = { kind: 'random', port: 'value' };
const MEMORY_VALUE: Endpoint = { kind: 'sample-hold', port: 'value' };
const MEMORY_STORE: Endpoint = { kind: 'sample-hold', port: 'store' };
const MEMORY_HELD: Endpoint = { kind: 'sample-hold', port: 'held' };
const SHOW_VALUE: Endpoint = { kind: 'show-number', port: 'value', where: isMachineDoor };

const kindOf = (g: Graph, id: string): string | undefined => g.nodes.find((n) => n.id === id)?.kind;
const wired = (g: Graph, from: string, fromPort: string, to: string, toPort: string): boolean =>
  g.wires.some((w) => w.from.node === from && w.from.port === fromPort && w.to.node === to && w.to.port === toPort);

/** Latches that "Giao máy k" switches on. */
function machineLatches(g: Graph, k: number): GraphNode[] {
  return g.nodes.filter(
    (n) => n.kind === 'latch' && g.wires.some((w) => kindOf(g, w.from.node) === 'dispatcher' && w.from.port === `give${k}` && w.to.node === n.id && w.to.port === 'set'),
  );
}

/** One of those latches also reports back on "Máy k đang bận": the loop of machine k is closed on the same card. */
function reportsBusy(g: Graph, k: number): boolean {
  return machineLatches(g, k).some((l) => g.nodes.some((d) => d.kind === 'dispatcher' && wired(g, l.id, 'on', d.id, `busy${k}`)));
}

export function createShareJobsLesson(kit: LessonKit): Lesson {
  const machineStep = (k: 1 | 2) => {
    const set: Endpoint = { kind: 'latch', port: 'set', where: isMachine(k) };
    const on: Endpoint = { kind: 'latch', port: 'on', where: isMachine(k) };
    const give: Endpoint = { kind: 'dispatcher', port: `give${k}` };
    const busy: Endpoint = { kind: 'dispatcher', port: `busy${k}` };
    return {
      // The highlight points at the latch drawn for machine k; the check accepts any latch, as long as the loop closes on it.
      give: { id: `wire-give-${k}`, target: kit.wireStep('', give, set).target, check: (s: Snapshot) => machineLatches(s.graph, k).length > 0 },
      busy: { id: `wire-busy-${k}`, target: kit.wireStep('', on, busy).target, check: (s: Snapshot) => reportsBusy(s.graph, k) },
    };
  };
  const m1 = machineStep(1);
  const m2 = machineStep(2);
  return {
    id: 'share-jobs',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, shareJobsScene(), SHARE_JOBS_SCENE_WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-dispatcher', 'dispatcher'), title: T.dispatcher.title, text: T.dispatcher.text, explain: T.dispatcher.explain },
      { ...kit.wireStep('wire-job', CLOCK_DONE, JOB), title: T.job.title, text: T.job.text, explain: T.job.explain },
      { ...m1.give, title: T.give1.title, text: T.give1.text, explain: T.give1.explain },
      { ...m1.busy, title: T.busy1.title, text: T.busy1.text, explain: T.busy1.explain },
      { ...m2.give, title: T.give2.title, text: T.give2.text },
      { ...m2.busy, title: T.busy2.title, text: T.busy2.text },
      { id: 'play-1', title: T.play1.title, text: T.play1.text, explain: T.play1.explain, target: () => [kit.playButton], check: (s) => s.playing },
      { ...kit.addStep('add-memory', 'sample-hold'), title: T.memory.title, text: T.memory.text, explain: T.memory.explain },
      { ...kit.wireStep('wire-value', DOOR_VALUE, MEMORY_VALUE), title: T.value.title, text: T.value.text },
      { ...kit.wireStep('wire-store', GIVE_1, MEMORY_STORE), title: T.store.title, text: T.store.text, explain: T.store.explain },
      { ...kit.wireStep('wire-show', MEMORY_HELD, SHOW_VALUE), title: T.show.title, text: T.show.text },
      { id: 'play-2', title: T.play2.title, text: T.play2.text, explain: T.play2.explain, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
