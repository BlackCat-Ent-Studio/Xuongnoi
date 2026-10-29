import type { PortType } from '../../engine/types';

/** Vietnamese strings owned by the wiring graph. */
export const GRAPH_TEXT = {
  zoomOut: 'Thu nhỏ',
  zoomIn: 'Phóng to',
  zoomReset: 'Về 100%',
  fit: 'Vừa màn hình',
  arrange: 'Sắp xếp gọn',
  arrangeTitle: 'Xếp các mảnh ghép thành cột theo chiều dây nối, không chồng nhau',
  legendLabel: 'Các loại dây',
  minimap: 'Bản đồ nhỏ của bảng nối',
  coach: 'Kéo nền để di chuyển. Lăn chuột để phóng to.',
  coachClose: 'Đã hiểu, ẩn gợi ý',
  zoomLabel: 'Thu phóng',
  needWire: 'cần nối',
  unknownNode: 'Mảnh ghép lạ',
  typeName: { bool: 'Đúng/Sai', number: 'Số', object: 'Vật thể' } satisfies Record<PortType, string>,
} as const;

export const missingBadge = (n: number): string => `Thiếu ${n} dây`;

/** Shown when two ports of different types are wired together. Names both types. */
export function typeMismatchText(fromLabel: string, fromType: PortType, toLabel: string, toType: PortType): string {
  const t = GRAPH_TEXT.typeName;
  return `Không nối được: "${fromLabel}" là ${t[fromType]} nhưng "${toLabel}" cần ${t[toType]}. Chỉ nối cùng loại.`;
}
