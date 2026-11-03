import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { groundParams, sceneryMaker, wire } from './player-built-kit';

const scenery = sceneryMaker();

/**
 * Level 4 (hai-nut-mot-cua): OR. One door, two buttons, two robots that must both get through. Bot A stands on button 1
 * (before the door) from the start; bot B starts just behind the door. The door follows the player's signal "bot A on
 * button 1 OR bot B has arrived at button 2". A waits until B has arrived, then walks to the flag. Neither signal alone
 * is enough: if only A's button counted, the door shuts the moment A steps off it; if only B's counted, B could never
 * get through the shut door in the first place. Nobody ever passes anybody: the bodies are solid and A ends behind B.
 * The ground and the win rule (A touches the flag and B stands on button 2) are scenery.
 */
export const level04: PuzzleLevel | null = {
  id: 'hai-nut-mot-cua',
  order: 4,
  title: 'Hai nút một cửa',
  task: 'Bot A đứng trên nút 1. Bot B phải qua cửa tới nút 2. Rồi bot A đi tới cờ. Cửa phải mở khi bot A đang đứng trên nút 1 HOẶC bot B đã tới nút 2. Bạn tự nối cả mạch.',
  hint: '"Đi tới" cho B tới nút 2 và cho A tới cờ. A chỉ được đi khi B "Đã tới": nối vào "Cho đi". "Chạm nhau" báo A đứng trên nút 1. "Hoặc" gom hai tín hiệu rồi nối vào "Ẩn suốt lúc bật" của cửa.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs, PUZZLE_LOOKS.robotWheel],
  base: {
    nodes: [
      {
        id: 'bot-a',
        kind: 'character',
        params: { name: 'Bot A', position: { x: -9, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 10, y: 10 },
      },
      {
        id: 'bot-b',
        kind: 'character',
        params: { name: 'Bot B', position: { x: -5.5, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotWheel, role: 'bot' },
        pos: { x: 10, y: 110 },
      },
      {
        id: 'button-a',
        kind: 'block',
        params: { name: 'Nút 1', position: { x: -9, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#f59e0b', type: 'pickup' },
        pos: { x: 200, y: 10 },
      },
      {
        id: 'button-b',
        kind: 'block',
        params: { name: 'Nút 2', position: { x: 8.5, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#3b82f6', type: 'pickup' },
        pos: { x: 200, y: 110 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { name: 'Cờ', position: { x: 6, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' },
        pos: { x: 200, y: 210 },
      },
      {
        id: 'door',
        kind: 'block',
        params: { name: 'Cửa', position: { x: -1, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 200, y: 300 },
      },
      scenery('touch-a-flag', 'touch', {}),
      scenery('touch-b-button', 'touch', {}),
      scenery('both', 'and', {}),
      scenery('end', 'win-lose', { winMessage: 'Cả hai bot đã qua cửa!', loseMessage: 'Thua mất rồi!' }),
      scenery('ground', 'block', groundParams(32)),
    ],
    wires: [
      wire('b1', ['bot-a', 'self'], ['touch-a-flag', 'a']),
      wire('b2', ['flag', 'self'], ['touch-a-flag', 'b']),
      wire('b3', ['bot-b', 'self'], ['touch-b-button', 'a']),
      wire('b4', ['button-b', 'self'], ['touch-b-button', 'b']),
      wire('b5', ['touch-a-flag', 'touching'], ['both', 'a']),
      wire('b6', ['touch-b-button', 'touching'], ['both', 'b']),
      wire('b7', ['both', 'out'], ['end', 'win']),
    ],
  },
  shownPorts: {
    'bot-a': { in: ['moveX'], out: ['self'] },
    'bot-b': { in: ['moveX'], out: ['self'] },
    'button-a': { in: [], out: ['self'] },
    'button-b': { in: [], out: ['self'] },
    flag: { in: [], out: ['self'] },
    door: { in: ['hiddenWhile'], out: [] },
    'touch-a-flag': { in: [], out: [] },
    'touch-b-button': { in: [], out: [] },
    both: { in: [], out: [] },
    end: { in: [], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [
    { kind: 'go-to', count: 2 },
    { kind: 'touch', count: 2 },
    { kind: 'or', count: 1 },
  ],
  par: 4,
  freeHints: 5,
  timeLimit: 40,
  solution: {
    nodes: [
      { id: 'p-goto-a', kind: 'go-to', params: {}, pos: { x: 400, y: 10 } },
      { id: 'p-goto-b', kind: 'go-to', params: {}, pos: { x: 400, y: 200 } },
      { id: 'p-touch', kind: 'touch', params: {}, pos: { x: 400, y: 380 } },
      { id: 'p-or', kind: 'or', params: {}, pos: { x: 600, y: 380 } },
    ],
    wires: [
      wire('s1', ['bot-a', 'self'], ['p-goto-a', 'self']),
      wire('s2', ['flag', 'self'], ['p-goto-a', 'target']),
      wire('s3', ['p-goto-a', 'moveX'], ['bot-a', 'moveX']),
      wire('s4', ['bot-b', 'self'], ['p-goto-b', 'self']),
      wire('s5', ['button-b', 'self'], ['p-goto-b', 'target']),
      wire('s6', ['p-goto-b', 'moveX'], ['bot-b', 'moveX']),
      wire('s7', ['p-goto-b', 'arrived'], ['p-goto-a', 'go']),
      wire('s8', ['bot-a', 'self'], ['p-touch', 'a']),
      wire('s9', ['button-a', 'self'], ['p-touch', 'b']),
      wire('s10', ['p-touch', 'touching'], ['p-or', 'a']),
      wire('s11', ['p-goto-b', 'arrived'], ['p-or', 'b']),
      wire('s12', ['p-or', 'out'], ['door', 'hiddenWhile']),
      // Bot A stands on button 1 from the start, so the same signal that holds the door open also sends bot B off.
      wire('s13', ['p-or', 'out'], ['p-goto-b', 'go']),
    ],
  },
};
