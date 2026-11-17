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
import robotLineFollow from '../samples/robot-line-follow.json';
import robotSquare from '../samples/robot-square.json';
import robotAvoid from '../samples/robot-avoid.json';
import { createRobotArmBoard } from '../samples/robot-arm-board';
import { createAutoDoorBoard } from '../samples/auto-door-board';
import { createAutoArmBoard } from '../samples/auto-arm-board';
import { createWeightSorterBoard } from '../samples/weight-sorter-board';
import { createAgvBoard } from '../samples/agv-board';
import { parseBoard, serializeBoard } from './save-format';

/**
 * Samples shown in the menus and the launchpad: automation machines only. Append one line per new sample.
 */
const SAMPLES: { id: string; label: string; json: unknown }[] = [
  { id: 'robot-line-follow', label: 'Robot dò đường (3 mắt dò line, bộ PID, 2 động cơ, đường số 8, 3D)', json: robotLineFollow },
  { id: 'robot-avoid', label: 'Robot tránh vật cản (3 mắt dò phía trước, 2 động cơ, phòng có tường và hộp, 3D)', json: robotAvoid },
  { id: 'robot-square', label: 'Robot đi hình vuông (bộ đếm quãng đường và hướng, chuỗi bước, 3D)', json: robotSquare },
  { id: 'auto-door', label: 'Cửa tự động (người tới, cảm biến vùng, hẹn giờ, khớp xoay nâng thanh chắn)', json: JSON.parse(serializeBoard(createAutoDoorBoard())) },
  { id: 'auto-arm', label: 'Tay máy tự gắp và đặt (chuỗi bước, góc dạy sẵn, lực kẹp, thùng dễ vỡ)', json: JSON.parse(serializeBoard(createAutoArmBoard())) },
  { id: 'weight-sorter', label: 'Băng chuyền phân loại theo cân nặng (cân, so sánh, xi lanh đẩy)', json: JSON.parse(serializeBoard(createWeightSorterBoard())) },
  { id: 'agv-shuttle', label: 'Xe tự hành chở hàng (AGV: bám line, tay máy nạp hàng, xi lanh dỡ hàng, quá tải, 3D)', json: JSON.parse(serializeBoard(createAgvBoard())) },
];

/** The old game samples: out of the menus, still loadable by id so their engine tests keep running. */
const ARCHIVED_SAMPLES: { id: string; label: string; json: unknown }[] = [
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
  { id: 'robot-arm', label: 'Tay máy gắp thùng bằng phím (khớp, thanh nối, tay kẹp; 2D)', json: JSON.parse(serializeBoard(createRobotArmBoard())) },
];

type Sample = { id: string; label: string; board: Board };

function build(list: { id: string; label: string; json: unknown }[]): Sample[] {
  return list.map(({ id, label, json }) => {
    const res = parseBoard(JSON.stringify(json));
    if (!res.ok) throw new Error(`Bài mẫu "${id}" bị hỏng: ${res.error}`);
    return { id, label, board: res.board };
  });
}

/** Fresh copies on every call, so callers may mutate the boards freely. The menu list: automation samples only. */
export function listSamples(): Sample[] {
  return build(SAMPLES);
}

/** The archived game samples (not in any menu). */
export function listArchivedSamples(): Sample[] {
  return build(ARCHIVED_SAMPLES);
}

/** Every board in its original order (archived games, then the menu samples): for tests and tools. */
export function listAllSamples(): Sample[] {
  return [...listArchivedSamples(), ...listSamples()];
}
