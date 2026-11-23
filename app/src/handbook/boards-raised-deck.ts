import type { Board } from '../engine/types';
import { build } from './boards-robot-arm';

/** "Thử ngay" board of "Sàn nâng có lỗ": a deck with two holes, a robot driving along it and a crate falling through a hole. */

/** Height of the deck's upper face above the ground block's top (y = 0). */
export const TRY_DECK_TOP = 2.6;
/** Where the robot is sent: the far end of the lane beside the holes. */
export const TRY_DECK_GOAL = { x: 2, y: 0, z: 1 };
/** The crate starts in the air above this hole. */
export const TRY_DECK_HOLE = { x: -1, z: 0 };

export const tryRaisedDeck = (): Board =>
  build(
    'Sàn nâng có lỗ',
    'Góc nhìn 3D. Sàn thép cao 2,6 m có 2 lỗ. Bấm Chạy: robot chạy dọc lối đi cạnh hai lỗ tới đầu bên kia rồi dừng; thùng hàng thả phía trên lỗ bên trái rơi xuyên qua lỗ xuống mặt đất. Bấm Dừng, chọn thẻ Sàn nâng có lỗ rồi đổi "Số lỗ theo trục X", "Cạnh lỗ" hoặc "Cao mặt sàn" và chạy lại. Viền vàng và viền xanh chỉ là hình vẽ; chân trụ ở bảng này để "Chỉ vẽ", chọn "Có, cột cứng" thì chân thành cột rắn, cản robot và đồ vật ở tầng dưới.',
    [
      { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 16, y: 1, z: 12 }, color: '#d6d3d1' } },
      { alias: 'deck', kind: 'raised-deck', x: 20, y: 376, params: { position: { x: 0, y: 0, z: 0 }, top: TRY_DECK_TOP, holeCols: 2, legs: 'yes' } },
      { alias: 'crate', kind: 'item', x: 1220, y: 20, params: { shape: 'crate', position: { x: TRY_DECK_HOLE.x, y: TRY_DECK_TOP + 0.8, z: TRY_DECK_HOLE.z }, size: { x: 0.4, y: 0.3, z: 0.4 }, color: '#f59e0b' } },
      { alias: 'start', kind: 'on-start', x: 320, y: 20 },
      { alias: 'body', kind: 'robot-body', x: 320, y: 220, params: { position: { x: -2, y: TRY_DECK_TOP + 0.15, z: 1 }, heading: 0 } },
      { alias: 'drive', kind: 'robot-goto', x: 620, y: 20, params: { targetFrom: 'point', targetPos: TRY_DECK_GOAL } },
      { alias: 'left', kind: 'motor', x: 920, y: 20, params: { side: -0.4 } },
      { alias: 'right', kind: 'motor', x: 920, y: 240, params: { side: 0.4 } },
    ],
    [
      ['body', 'self', 'left', 'body'],
      ['body', 'self', 'right', 'body'],
      ['body', 'self', 'drive', 'robot'],
      ['start', 'started', 'drive', 'go'],
      ['drive', 'left', 'left', 'power'],
      ['drive', 'right', 'right', 'power'],
    ],
    '3d',
  );
