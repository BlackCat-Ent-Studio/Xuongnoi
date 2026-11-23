import type { ConnectFailReason } from './types';

/** Friendly Vietnamese explanations shown when a wire cannot be connected. */
export const CONNECT_FAIL_TEXT: Record<ConnectFailReason, string> = {
  'unknown-node': 'Không tìm thấy mảnh ghép để nối',
  'unknown-port': 'Không tìm thấy cổng để nối',
  'type-mismatch': 'Khác loại dây: chỉ nối được cùng màu',
  'input-taken': 'Cổng này đã có dây nối',
  'same-node': 'Không thể nối mảnh ghép với chính nó',
  'wrong-direction': 'Hãy nối từ cổng ra (bên phải) sang cổng vào (bên trái)',
};
