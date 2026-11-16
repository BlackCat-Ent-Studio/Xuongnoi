import type { Board } from '../engine/types';
import side from '../samples/side-stars.json';
import top from '../samples/top-collect.json';
import hop from '../samples/3d-hop.json';
import keyDoor from '../samples/key-door.json';
import pickaxeRock from '../samples/pickaxe-rock.json';
import guardPatrol from '../samples/guard-patrol.json';
import cleanerBot from '../samples/cleaner-bot.json';
import mazeChase from '../samples/maze-chase.json';
import platformBot from '../samples/platform-bot.json';
import arena from '../samples/arena.json';
import race from '../samples/race.json';
import diceZones from '../samples/dice-zones.json';
import portalCamera from '../samples/portal-camera.json';
import dodgeShoot from '../samples/dodge-shoot.json';
import cityDelivery from '../samples/city-delivery.json';
import cityDelivery3d from '../samples/city-delivery-3d.json';
import { createRobotArmBoard } from '../samples/robot-arm-board';
import { parseBoard, serializeBoard } from './save-format';

const SAMPLES: { id: string; label: string; json: unknown }[] = [
  { id: 'side-stars', label: 'Nhặt sao (nhảy 2D)', json: side },
  { id: 'top-collect', label: 'Thu thập (nhìn từ trên)', json: top },
  { id: '3d-hop', label: 'Nhảy cóc 3D', json: hop },
  { id: 'key-door', label: 'Chìa khoá và cánh cửa (2D)', json: keyDoor },
  { id: 'pickaxe-rock', label: 'Cuốc đá mở đường (2D)', json: pickaxeRock },
  { id: 'guard-patrol', label: 'Lính gác (bot tuần tra, nhìn từ trên)', json: guardPatrol },
  { id: 'cleaner-bot', label: 'Bot dọn dẹp (xem bot tự làm việc)', json: cleanerBot },
  { id: 'maze-chase', label: 'Mê cung (bot đuổi qua các lối đi, nhìn từ trên)', json: mazeChase },
  { id: 'platform-bot', label: 'Bot leo bục (bot tự nhảy lên lấy sao, 2D)', json: platformBot },
  { id: 'arena', label: 'Võ đài (đấu tay đôi với bot, 2D)', json: arena },
  { id: 'race', label: 'Đua xe về đích (lái xe thi với bot, nhìn từ trên)', json: race },
  { id: 'dice-zones', label: 'Xúc xắc và vùng (đổ xúc xắc, mở cổng, 2D)', json: diceZones },
  { id: 'portal-camera', label: 'Cổng dịch chuyển (qua vực bằng cổng, camera zoom và rung, 2D)', json: portalCamera },
  { id: 'dodge-shoot', label: 'Né và bắn (bệ di chuyển, bệ xoay, bắn đạn, đá rơi, 2D)', json: dodgeShoot },
  { id: 'city-delivery', label: 'Thành phố giao hàng (lái xe tải giao hàng, nhìn từ trên)', json: cityDelivery },
  { id: 'city-delivery-3d', label: 'Thành phố giao hàng 3D (nhiều khu, xe cộ, đèn giao thông)', json: cityDelivery3d },
  { id: 'robot-arm', label: 'Tay máy gắp thùng (khớp, thanh nối, tay kẹp; kg, N, mô-men, 2D)', json: JSON.parse(serializeBoard(createRobotArmBoard())) },
];

/** Fresh copies on every call, so callers may mutate the boards freely. */
export function listSamples(): { id: string; label: string; board: Board }[] {
  return SAMPLES.map(({ id, label, json }) => {
    const res = parseBoard(JSON.stringify(json));
    if (!res.ok) throw new Error(`Game mẫu "${id}" bị hỏng: ${res.error}`);
    return { id, label, board: res.board };
  });
}
