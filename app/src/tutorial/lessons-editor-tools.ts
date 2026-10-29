import type { Board, Params } from '../engine/types';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot, TargetList } from './types';

/**
 * Lesson 14, "Công cụ bảng nối": undo/redo, multi-select with copy/paste/duplicate, and sticky notes.
 * Every check reads editor state (node counts, selection, redo availability, notes) so nothing depends on
 * how the learner got there: keyboard shortcut or button both count.
 */

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

const T = {
  title: '14. Công cụ bảng nối',
  summary: 'Chọn nhiều mảnh ghép, sao chép, hoàn tác và ghi chú để sửa bảng nhanh hơn.',
  boardName: 'Bài 14 - Công cụ bảng nối',
  intro: {
    title: 'Sửa bảng thật nhanh',
    text: 'Bảng này có sẵn một nhóm nhỏ: Phím bấm nối với Nhân vật (để nhảy), và một mảnh ghép Sàn. Bài này dạy vài công cụ giúp bạn làm nhanh và không sợ làm hỏng.',
    explain: 'Ai cũng có lúc xóa nhầm. Đã có nút Hoàn tác, nên cứ thoải mái thử.',
  },
  select: {
    title: 'Chọn cả nhóm bằng một khung',
    text: 'Giữ phím Shift, rồi bấm và kéo chuột trên chỗ trống để vẽ một khung bao quanh Phím bấm và Nhân vật. Mảnh ghép Sàn nằm ngoài khung.',
    explain: 'Mảnh ghép nào chạm vào khung sẽ được chọn. Nếu chọn thừa, bấm vào chỗ trống rồi thử lại. Giữ Shift rồi bấm vào một mảnh ghép cũng thêm hoặc bỏ mảnh ghép đó.',
  },
  copy: {
    title: 'Sao chép rồi dán',
    text: 'Bấm Ctrl+C để sao chép nhóm đang chọn, rồi bấm Ctrl+V để dán ra một bản mới.',
    explain: 'Dây nối giữa hai mảnh ghép cũng được chép theo. Bản dán nằm lệch một chút để bạn dễ thấy.',
  },
  paste: {
    title: 'Dán thêm một lần nữa',
    text: 'Bấm Ctrl+V lần nữa. Mỗi lần dán ra một bản mới, lệch xa hơn bản trước. Bây giờ bạn có 3 nhóm.',
  },
  duplicate: {
    title: 'Nhân đôi nhanh',
    text: 'Bản vừa dán đang được chọn. Bấm Ctrl+D để nhân đôi nó ngay, không cần sao chép trước.',
    explain: 'Ctrl+D là đường tắt: sao chép và dán trong một lần bấm.',
  },
  remove: {
    title: 'Lỡ tay xóa nhầm',
    text: 'Hai mảnh ghép mới đang được chọn. Bấm phím Delete để xóa chúng, coi như bạn xóa nhầm.',
    explain: 'Phím Backspace cũng xóa được mảnh ghép đang chọn.',
  },
  undo: {
    title: 'Hoàn tác để lấy lại',
    text: 'Bấm Ctrl+Z hoặc nút "Hoàn tác" trên thanh trên cùng. Hai mảnh ghép vừa xóa sẽ quay về. Chỉ cần bấm một lần.',
    explain: 'Hoàn tác lùi từng bước một: bao gồm cả thêm mảnh ghép, kéo mảnh ghép, nối và xóa dây.',
  },
  redo: {
    title: 'Làm lại',
    text: 'Đổi ý, vẫn muốn xóa? Bấm Ctrl+Y hoặc nút "Làm lại" để làm lại việc vừa hoàn tác.',
    explain: 'Làm lại chỉ dùng được ngay sau khi hoàn tác. Làm thêm việc mới thì bước làm lại sẽ biến mất.',
  },
  undoAgain: {
    title: 'Lấy lại lần nữa',
    text: 'Hoàn tác thêm một lần nữa bằng Ctrl+Z (hoặc nút "Hoàn tác") để hai mảnh ghép quay về.',
  },
  addNote: {
    title: 'Dán tờ ghi chú',
    text: 'Bấm nút "📝 Ghi chú" (ở thanh trên cùng hoặc đầu danh sách mảnh ghép bên trái) để thêm một tờ giấy ghi chú vào bảng.',
    explain: 'Ghi chú không phải là mảnh ghép và không ảnh hưởng đến game. Nó chỉ để bạn nhắc mình biết nhóm mảnh ghép này làm gì.',
  },
  noteText: {
    title: 'Viết vào ghi chú',
    text: 'Bấm vào tờ giấy vừa thêm rồi gõ vài chữ, ví dụ "Nhóm nhảy".',
  },
  noteColor: {
    title: 'Đổi màu ghi chú',
    text: 'Bấm một chấm màu ở đầu tờ giấy (khác màu vàng) để đổi màu. Kéo tờ giấy để di chuyển, kéo góc dưới phải để đổi cỡ.',
  },
  done: {
    title: 'Bạn dùng công cụ như thợ rồi!',
    text: 'Bạn đã biết chọn nhiều mảnh ghép, sao chép, nhân đôi, hoàn tác, làm lại và ghi chú. Ghi chú được lưu cùng game của bạn.',
  },
} as const;

const NODES: NodeSpec[] = [
  { alias: 'key', kind: 'key', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
];
const WIRES: WireSpec[] = [['key', 'held', 'hero', 'jump']];

/** Nodes in the starter board; the copy steps count in multiples of the two selected ones. */
const BASE_NODES = NODES.length;
const GROUP_SIZE = 2;
const AFTER_FIRST_PASTE = BASE_NODES + GROUP_SIZE;
const AFTER_SECOND_PASTE = AFTER_FIRST_PASTE + GROUP_SIZE;
const AFTER_DUPLICATE = AFTER_SECOND_PASTE + GROUP_SIZE;

const UNDO_BTN = '[data-act="undo"]';
const REDO_BTN = '[data-act="redo"]';

const nodeSel = (kind: string): string => `.wc-node[data-kind="${kind}"]`;
const countOf = (s: Snapshot): number => s.graph.nodes.length;

/** Exactly the Phím bấm and the Nhân vật that start the board, and nothing else. */
function groupSelected(s: Snapshot): boolean {
  const ids = s.selectedIds ?? [];
  if (ids.length !== GROUP_SIZE) return false;
  const kinds = ids.map((id) => s.graph.nodes.find((n) => n.id === id)?.kind);
  return kinds.includes('key') && kinds.includes('character');
}

/** True right after an undo restored the duplicated pair (and nothing new was done since). */
const restored = (s: Snapshot): boolean => (s.canRedo ?? false) && countOf(s) >= AFTER_DUPLICATE;

function noteTarget(s: Snapshot, inner: string): TargetList {
  const note = (s.notes ?? [])[0];
  return note ? [`.wc-note[data-id="${note.id}"] ${inner}`] : [];
}

export function createEditorToolsLesson(kit: Pick<LessonKit, 'buildBoard'>): Lesson {
  const createBoard = (): Board => kit.buildBoard(T.boardName, NODES, WIRES);
  return {
    id: 'editor-tools',
    title: T.title,
    summary: T.summary,
    createBoard,
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      {
        id: 'select-group',
        title: T.select.title,
        text: T.select.text,
        explain: T.select.explain,
        target: () => [nodeSel('key'), nodeSel('character')],
        check: groupSelected,
      },
      {
        id: 'copy-paste',
        title: T.copy.title,
        text: T.copy.text,
        explain: T.copy.explain,
        check: (s) => countOf(s) >= AFTER_FIRST_PASTE,
      },
      { id: 'paste-again', title: T.paste.title, text: T.paste.text, check: (s) => countOf(s) >= AFTER_SECOND_PASTE },
      {
        id: 'duplicate',
        title: T.duplicate.title,
        text: T.duplicate.text,
        explain: T.duplicate.explain,
        check: (s) => countOf(s) >= AFTER_DUPLICATE,
      },
      {
        id: 'delete-by-mistake',
        title: T.remove.title,
        text: T.remove.text,
        explain: T.remove.explain,
        check: (s) => countOf(s) < AFTER_DUPLICATE,
      },
      {
        id: 'undo',
        title: T.undo.title,
        text: T.undo.text,
        explain: T.undo.explain,
        target: () => [UNDO_BTN],
        check: restored,
      },
      {
        id: 'redo',
        title: T.redo.title,
        text: T.redo.text,
        explain: T.redo.explain,
        target: () => [REDO_BTN],
        check: (s) => !(s.canRedo ?? false) && countOf(s) < AFTER_DUPLICATE,
      },
      { id: 'undo-again', title: T.undoAgain.title, text: T.undoAgain.text, target: () => [UNDO_BTN], check: restored },
      {
        id: 'add-note',
        title: T.addNote.title,
        text: T.addNote.text,
        explain: T.addNote.explain,
        target: () => ['[data-act="add-note"]', '.palette-item[data-kind="note"]'],
        check: (s) => (s.notes ?? []).length >= 1,
      },
      {
        id: 'note-text',
        title: T.noteText.title,
        text: T.noteText.text,
        target: (s) => noteTarget(s, '.wc-note-text'),
        check: (s) => (s.notes ?? []).some((n) => n.text.trim().length > 0),
      },
      {
        id: 'note-color',
        title: T.noteColor.title,
        text: T.noteColor.text,
        target: (s) => noteTarget(s, '.wc-note-colors'),
        check: (s) => (s.notes ?? []).some((n) => n.color !== 'yellow'),
      },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
