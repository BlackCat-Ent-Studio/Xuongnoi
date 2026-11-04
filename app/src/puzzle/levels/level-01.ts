import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { groundParams, sceneryMaker, wire } from './player-built-kit';

const scenery = sceneryMaker();

/**
 * Level 1 (bot-dau-tien): the first wires. The board shows only the bot and the flag; the player takes "Di chuyển" from the
 * tray and joins it to both and to the bot's walking input. The ground and the win rule (bot touches the flag) are scenery.
 */
export const level01: PuzzleLevel | null = {
  id: 'bot-dau-tien',
  order: 1,
  title: 'Bot đầu tiên',
  task: 'Bot muốn đi tới lá cờ. Hãy kéo mảnh "Di chuyển" vào, rồi nối dây cho bot và lá cờ.',
  hint: 'Nối 3 dây: Bot vào "Bot", Cờ vào "Điểm đến", và "Đi ngang" của mảnh đi vào "Đi ngang" của bot.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs],
  base: {
    nodes: [
      {
        id: 'bot',
        kind: 'character',
        params: { name: 'Bot', position: { x: -9, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 10, y: 20 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { name: 'Cờ', position: { x: 9, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#ef4444', type: 'pickup' },
        pos: { x: 10, y: 150 },
      },
      scenery('touch-flag', 'touch', {}),
      scenery('end', 'win-lose', { winMessage: 'Bot tới cờ rồi!', loseMessage: 'Thua mất rồi!' }),
      scenery('ground', 'block', groundParams(30)),
    ],
    wires: [
      wire('b1', ['bot', 'self'], ['touch-flag', 'a']),
      wire('b2', ['flag', 'self'], ['touch-flag', 'b']),
      wire('b3', ['touch-flag', 'touching'], ['end', 'win']),
    ],
  },
  shownPorts: {
    bot: { in: ['moveX'], out: ['self'] },
    flag: { in: [], out: ['self'] },
    'touch-flag': { in: [], out: [] },
    end: { in: [], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [
    { kind: 'go-to', count: 1 },
    // Nothing acts without a wire: "Di chuyển" walks only while a signal reaches its "Bật", and this one is on from the first moment.
    { kind: 'on-start', count: 1 },
    // Spare piece: "Và" looks useful but nothing here needs it. (Not "Đảo ngược": left alone it gives a steady "bật", the same as "Khi bắt đầu".)
    { kind: 'and', count: 1 },
  ],
  par: 2,
  freeHints: 1,
  timeLimit: 15,
  solution: {
    nodes: [
      { id: 'p-goto', kind: 'go-to', params: {}, pos: { x: 400, y: 150 } },
      { id: 'p-start', kind: 'on-start', params: {}, pos: { x: 160, y: 300 } },
    ],
    wires: [
      wire('s1', ['bot', 'self'], ['p-goto', 'self']),
      wire('s2', ['flag', 'self'], ['p-goto', 'target']),
      wire('s3', ['p-goto', 'moveX'], ['bot', 'moveX']),
      wire('s4', ['p-start', 'started'], ['p-goto', 'go']),
    ],
  },
};
