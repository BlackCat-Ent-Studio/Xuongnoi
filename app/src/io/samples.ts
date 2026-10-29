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
import portalCamera from '../samples/portal-camera.json';
import { parseBoard } from './save-format';

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
  { id: 'portal-camera', label: 'Cổng dịch chuyển (qua vực bằng cổng, camera zoom và rung, 2D)', json: portalCamera },
];

/** Fresh copies on every call, so callers may mutate the boards freely. */
export function listSamples(): { id: string; label: string; board: Board }[] {
  return SAMPLES.map(({ id, label, json }) => {
    const res = parseBoard(JSON.stringify(json));
    if (!res.ok) throw new Error(`Game mẫu "${id}" bị hỏng: ${res.error}`);
    return { id, label, board: res.board };
  });
}
