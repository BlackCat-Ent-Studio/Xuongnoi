import type { NodeDef, Params } from '../engine/types';
import { UI_TEXT_MAX_LENGTH, uiText } from './ui-util';
import { asBool, risingEdge, strParam, type EdgeState } from './util';

interface DialogState {
  ask: EdgeState;
  open: boolean;
}

/** Answer buttons shown: the first two always, the third only when its text is not empty. */
export function dialogAnswers(params: Params): string[] {
  const text = (id: string): string => strParam(params, id, '').slice(0, UI_TEXT_MAX_LENGTH).trim();
  const answers = [text('answer1') || 'Có', text('answer2') || 'Không'];
  const third = text('answer3');
  if (third !== '') answers.push(third);
  return answers;
}

export const uiDialogNode: NodeDef<DialogState> = {
  kind: 'ui-dialog',
  label: 'Hộp hỏi',
  category: 'input',
  description:
    'Mỗi khi "Hỏi" bật lên, hiện một câu hỏi với 2 hoặc 3 nút trả lời. Người chơi bấm nút nào thì cổng "Chọn" tương ứng bật một nhịp rồi hộp đóng lại. Game vẫn chạy trong lúc hộp mở. Để trống "Câu trả lời 3" nếu chỉ cần 2 nút.',
  inputs: [{ id: 'ask', type: 'bool', label: 'Hỏi' }],
  outputs: [
    { id: 'a1', type: 'bool', label: 'Chọn 1' },
    { id: 'a2', type: 'bool', label: 'Chọn 2' },
    { id: 'a3', type: 'bool', label: 'Chọn 3' },
    { id: 'asking', type: 'bool', label: 'Đang hỏi' },
  ],
  params: [
    { id: 'question', label: 'Câu hỏi', kind: 'text', default: 'Bạn muốn làm gì?' },
    { id: 'answer1', label: 'Câu trả lời 1', kind: 'text', default: 'Có' },
    { id: 'answer2', label: 'Câu trả lời 2', kind: 'text', default: 'Không' },
    { id: 'answer3', label: 'Câu trả lời 3 (có thể để trống)', kind: 'text', default: '' },
  ],
  create: () => ({ ask: { prev: false }, open: false }),
  evaluate(ctx, i, params, s) {
    if (risingEdge(s.ask, asBool(i.ask))) s.open = true;
    const answers = dialogAnswers(params);
    const clicked = ctx.input.ui?.clicked;
    const chosen = s.open ? answers.findIndex((_, n) => clicked?.has(`${ctx.nodeId}#${n}`) === true) : -1;
    if (chosen >= 0) s.open = false;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: '',
      value: 0,
      corner: 'top-left',
      hidden: !s.open,
      widget: { type: 'dialog', question: uiText(params, 'question', 'Bạn muốn làm gì?'), answers },
    });
    return { a1: chosen === 0, a2: chosen === 1, a3: chosen === 2, asking: s.open };
  },
};
