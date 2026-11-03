import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { groundParams, sceneryMaker, wire } from './player-built-kit';

const scenery = sceneryMaker();

/**
 * Level 2 (cua-kho): a door that must stay open. The board shows the bot, the red button, the door and the flag. The
 * player makes the bot walk to the flag, notices when it steps on the button, and keeps that signal on with a memory
 * switch: the door's "Ẩn suốt lúc bật" follows its signal and would close again as soon as the bot steps off the button.
 * The ground and the win rule (bot touches the flag) are scenery.
 */
export const level02: PuzzleLevel | null = {
  id: 'cua-kho',
  order: 2,
  title: 'Cửa kho',
  task: 'Bot muốn đi tới cờ nhưng cửa kho đóng. Bạn tự nối: cho bot đi tới cờ, và khi bot dẫm nút đỏ thì cửa mở và mở mãi.',
  hint: '"Đi tới" lái bot tới cờ. "Chạm nhau" báo khi bot dẫm nút. Cửa mở khi "Ẩn suốt lúc bật" bật, nên cần "Công tắc nhớ" giữ tín hiệu dù bot đã đi khỏi nút.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs],
  base: {
    nodes: [
      {
        id: 'bot',
        kind: 'character',
        params: { name: 'Bot', position: { x: -10, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 10, y: 10 },
      },
      {
        id: 'button',
        kind: 'block',
        params: { name: 'Nút đỏ', position: { x: -5, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#ef4444', type: 'pickup' },
        pos: { x: 10, y: 130 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { name: 'Cờ', position: { x: 10, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' },
        pos: { x: 10, y: 215 },
      },
      {
        id: 'door',
        kind: 'block',
        params: { name: 'Cửa kho', position: { x: 3, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 10, y: 300 },
      },
      scenery('touch-flag', 'touch', {}),
      scenery('end', 'win-lose', { winMessage: 'Bot qua cửa tới cờ rồi!', loseMessage: 'Thua mất rồi!' }),
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
    button: { in: [], out: ['self'] },
    flag: { in: [], out: ['self'] },
    door: { in: ['hiddenWhile'], out: [] },
    'touch-flag': { in: [], out: [] },
    end: { in: [], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [
    { kind: 'go-to', count: 1 },
    { kind: 'touch', count: 2 },
    { kind: 'latch', count: 1 },
  ],
  par: 3,
  freeHints: 3,
  timeLimit: 25,
  solution: {
    nodes: [
      { id: 'p-goto', kind: 'go-to', params: {}, pos: { x: 400, y: 20 } },
      { id: 'p-touch', kind: 'touch', params: {}, pos: { x: 400, y: 200 } },
      { id: 'p-latch', kind: 'latch', params: {}, pos: { x: 600, y: 200 } },
    ],
    wires: [
      wire('s1', ['bot', 'self'], ['p-goto', 'self']),
      wire('s2', ['flag', 'self'], ['p-goto', 'target']),
      wire('s3', ['p-goto', 'moveX'], ['bot', 'moveX']),
      wire('s4', ['bot', 'self'], ['p-touch', 'a']),
      wire('s5', ['button', 'self'], ['p-touch', 'b']),
      wire('s6', ['p-touch', 'touching'], ['p-latch', 'set']),
      wire('s7', ['p-latch', 'on'], ['door', 'hiddenWhile']),
    ],
  },
};
