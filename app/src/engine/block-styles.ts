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
  | 'rail'
  | 'belt-frame'
  | 'scan-gate'
  | 'chute'
  | 'arm-base'
  | 'code-display'
  | 'roll-cage'
  | 'signal-tower'
  | 'hole-cover'
  | 'truck-flatbed'
  | 'dock-door'
  | 'dock-door-open'
  | 'scan-gate-sheet'
  | 'warehouse'
  | 'floor-lane'
  | 'floor-frame';

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
  'belt-frame': 'Băng chuyền khung xanh (chân hở)',
  'scan-gate': 'Cổng quét (khung vàng, đèn theo màu)',
  chute: 'Cửa thả + túi vải (số ghi ở "Chữ trên biển")',
  'arm-base': 'Đế tay máy',
  'code-display': 'Màn hình hiện mã (hộp đen, số ghi ở "Chữ trên biển")',
  'roll-cage': 'Lồng lưới có bánh (thành lưới, bốn bánh nhỏ)',
  'signal-tower': 'Đèn tháp ba tầng (sáng theo "Đặt màu": 1 đỏ, 2 vàng, 3 xanh lá)',
  'hole-cover': 'Nắp trượt sọc đỏ trắng (đậy lỗ thả; đặt thêm một nắp cạnh lỗ cho lúc mở)',
  'truck-flatbed': 'Xe tải thùng phẳng thành thấp (mặt hộp là sàn thùng, đầu xe ở đầu hộp)',
  'dock-door': 'Cửa cuốn bến, đang đóng (khung vàng, hộp cuốn phía trên)',
  'dock-door-open': 'Cửa cuốn bến, đang mở (cửa cuộn lên hộp cuốn)',
  'scan-gate-sheet': 'Cổng quét có tấm sáng (vạch quét chạy; đổi màu là lúc vừa đọc)',
  warehouse: 'Cảnh nhà kho (tường bến có cửa, cột, kèo mái, đèn, kệ hàng; chỉ để ngắm)',
  'floor-lane': 'Vạch làn xe trên sàn (mũi tên dọc cạnh dài; ghi "-" ở "Chữ trên biển" để đảo chiều)',
  'floor-frame': 'Ô vạch sơn trên sàn (viền quanh hộp)',
};

export const BLOCK_STYLES = Object.keys(BLOCK_STYLE_LABELS) as readonly BlockStyle[];

/** Unknown / missing values fall back to the plain box. */
export function blockStyleOf(raw: unknown): BlockStyle {
  return typeof raw === 'string' && (BLOCK_STYLES as readonly string[]).includes(raw) ? (raw as BlockStyle) : 'box';
}

/** Lamp colours of a traffic light, in cycling order (index 0..2 = "Màu 1".."Màu 3"). */
export const TRAFFIC_COLORS = ['#ef4444', '#facc15', '#22c55e'] as const;
