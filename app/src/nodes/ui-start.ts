import type { NodeDef } from '../engine/types';
import { uiText } from './ui-util';
import { strParam } from './util';

export const uiStartNode: NodeDef<{ started: boolean }> = {
  kind: 'ui-start',
  label: 'Màn hình mở đầu',
  category: 'input',
  description:
    'Hiện màn hình mở đầu có tên game và nút "Bấm để chơi". "Đã bắt đầu" tắt cho tới khi người chơi bấm nút, rồi bật mãi. Nối nó vào các mảnh ghép khác để game chỉ chạy sau khi bắt đầu. Có thể bật menu tạm dừng: nhấn Esc khi đang chạy để hiện "Tiếp tục" và "Chạy lại".',
  inputs: [],
  outputs: [{ id: 'started', type: 'bool', label: 'Đã bắt đầu' }],
  params: [
    { id: 'title', label: 'Tên game', kind: 'text', default: 'Trò chơi của tôi' },
    { id: 'buttonText', label: 'Chữ trên nút', kind: 'text', default: 'Bấm để chơi' },
    {
      id: 'pauseMenu',
      label: 'Menu tạm dừng (nhấn Esc)',
      kind: 'select',
      default: 'yes',
      options: [
        { value: 'yes', label: 'Có' },
        { value: 'no', label: 'Không' },
      ],
    },
  ],
  create: () => ({ started: false }),
  evaluate(ctx, _i, params, s) {
    if (!s.started && ctx.input.ui?.clicked.has(ctx.nodeId) === true) s.started = true;
    ctx.world.setHud({
      key: ctx.nodeId,
      label: '',
      value: 0,
      corner: 'top-left',
      hidden: s.started,
      widget: {
        type: 'start',
        title: uiText(params, 'title', 'Trò chơi của tôi'),
        buttonText: uiText(params, 'buttonText', 'Bấm để chơi'),
        pauseMenu: strParam(params, 'pauseMenu', 'yes') !== 'no',
      },
    });
    return { started: s.started };
  },
};
