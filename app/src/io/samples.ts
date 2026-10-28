import type { Board } from '../engine/types';
import side from '../samples/side-stars.json';
import top from '../samples/top-collect.json';
import hop from '../samples/3d-hop.json';
import keyDoor from '../samples/key-door.json';
import { parseBoard } from './save-format';

const SAMPLES: { id: string; label: string; json: unknown }[] = [
  { id: 'side-stars', label: 'Nhặt sao (nhảy 2D)', json: side },
  { id: 'top-collect', label: 'Thu thập (nhìn từ trên)', json: top },
  { id: '3d-hop', label: 'Nhảy cóc 3D', json: hop },
  { id: 'key-door', label: 'Chìa khoá và cánh cửa (2D)', json: keyDoor },
];

/** Fresh copies on every call, so callers may mutate the boards freely. */
export function listSamples(): { id: string; label: string; board: Board }[] {
  return SAMPLES.map(({ id, label, json }) => {
    const res = parseBoard(JSON.stringify(json));
    if (!res.ok) throw new Error(`Game mẫu "${id}" bị hỏng: ${res.error}`);
    return { id, label, board: res.board };
  });
}
