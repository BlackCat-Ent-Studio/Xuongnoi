/** Strings for the scene tree dock. */
export const SCENE_TEXT = {
  treeAria: 'Cây cảnh: các vật thể trong màn chơi',
  empty: 'Chưa có vật thể nào. Thêm mảnh ghép Nhân vật hoặc Vật thể từ tab Kho mảnh ghép.',
  groupLevel: 'Màn chơi',
  groupUi: 'Giao diện',
  groupCharacters: 'Nhân vật',
  groupObjects: 'Vật thể',
  groupZones: 'Vùng',
  groupCameras: 'Camera',
  groupHud: 'HUD',
  roleBot: 'Bot',
  rolePlayer: 'Người chơi',
  count: (n: number) => `${n}`,
  itemTip: 'Bấm để chọn mảnh ghép này',
} as const;
