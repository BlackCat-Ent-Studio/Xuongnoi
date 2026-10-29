/** Appearance of a block ("Kiểu dáng"). The collision box is always the block's own box; this only changes how it is drawn. */
export type BlockStyle =
  | 'box'
  | 'house'
  | 'shop'
  | 'stall'
  | 'factory'
  | 'tree'
  | 'lamppost'
  | 'trafficlight'
  | 'road'
  | 'sidewalk'
  | 'field'
  | 'rock'
  | 'fence'
  | 'sign'
  | 'conveyor'
  | 'rail';

export const BLOCK_STYLE_LABELS: Record<BlockStyle, string> = {
  box: 'Hộp',
  house: 'Nhà ở',
  shop: 'Cửa hàng',
  stall: 'Sạp chợ',
  factory: 'Nhà xưởng',
  tree: 'Cây xanh',
  lamppost: 'Cột đèn',
  trafficlight: 'Đèn giao thông',
  road: 'Mặt đường',
  sidewalk: 'Vỉa hè',
  field: 'Ruộng rau',
  rock: 'Núi đá',
  fence: 'Hàng rào',
  sign: 'Biển tên',
  conveyor: 'Băng chuyền',
  rail: 'Đường ray',
};

export const BLOCK_STYLES = Object.keys(BLOCK_STYLE_LABELS) as readonly BlockStyle[];

/** Unknown / missing values fall back to the plain box. */
export function blockStyleOf(raw: unknown): BlockStyle {
  return typeof raw === 'string' && (BLOCK_STYLES as readonly string[]).includes(raw) ? (raw as BlockStyle) : 'box';
}

/** Lamp colours of a traffic light, in cycling order (index 0..2 = "Màu 1".."Màu 3"). */
export const TRAFFIC_COLORS = ['#ef4444', '#facc15', '#22c55e'] as const;
