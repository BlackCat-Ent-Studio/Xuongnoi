import { TRAFFIC_COLORS } from '../engine/block-styles';

/**
 * The six numbered colours shared by "Đọc màu" (Màu 1..6) and "Tạo đối tượng" (Màu loại 1..6): with both cards on their
 * defaults, an object of class k reads as colour index k. The first three are the "Màu 1..3" of a Vật thể.
 */
export const PALETTE_COLORS: readonly string[] = [...TRAFFIC_COLORS, '#3b82f6', '#a855f7', '#f97316'];
