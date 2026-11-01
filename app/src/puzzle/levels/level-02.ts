import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/**
 * Level 2 (cua-kho): a door that must stay open. The door's "Ẩn khi bật" follows its signal and closes again as soon
 * as the signal drops, so a plain touch signal is not enough: the bot steps off the button, so the signal needs a latch.
 */
export const level02: PuzzleLevel | null = {
  id: 'cua-kho',
  order: 2,
  title: 'Cửa kho',
  task: 'Bot đang tự đi tới cờ nhưng cửa kho đóng. Hãy nối sao cho bot dẫm nút đỏ thì cửa mở và mở mãi.',
  hint: 'Cảm biến chạm báo khi bot dẫm nút. Cửa mở khi "Ẩn khi bật" bật, nên cần Công tắc nhớ giữ tín hiệu dù bot đã đi khỏi nút.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs],
  base: {
    nodes: [
      {
        id: 'bot',
        kind: 'character',
        params: { name: 'Rô-bốt chân ngắn', position: { x: -10, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 30, y: 30 },
      },
      {
        id: 'button',
        kind: 'block',
        params: { name: 'Nút đỏ', position: { x: -5, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#ef4444', type: 'pickup' },
        pos: { x: 30, y: 170 },
      },
      {
        id: 'door',
        kind: 'block',
        params: { name: 'Cửa kho', position: { x: 3, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 800, y: 30 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { name: 'Cờ', position: { x: 10, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' },
        pos: { x: 30, y: 300 },
      },
      { id: 'go-flag', kind: 'go-to', params: {}, pos: { x: 230, y: 30 } },
      { id: 'touch-flag', kind: 'touch', params: {}, pos: { x: 430, y: 400 } },
      {
        id: 'end',
        kind: 'win-lose',
        params: { winMessage: 'Bot qua cửa tới cờ rồi!', loseMessage: 'Thua mất rồi!' },
        pos: { x: 800, y: 440 },
      },
      {
        id: 'ground',
        kind: 'block',
        params: { name: 'Mặt đất', position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d', type: 'solid' },
        pos: { x: 230, y: 480 },
      },
    ],
    wires: [
      { id: 'b1', from: { node: 'bot', port: 'self' }, to: { node: 'go-flag', port: 'self' } },
      { id: 'b2', from: { node: 'flag', port: 'self' }, to: { node: 'go-flag', port: 'target' } },
      { id: 'b3', from: { node: 'go-flag', port: 'moveX' }, to: { node: 'bot', port: 'moveX' } },
      { id: 'b4', from: { node: 'go-flag', port: 'jump' }, to: { node: 'bot', port: 'jump' } },
      { id: 'b5', from: { node: 'bot', port: 'self' }, to: { node: 'touch-flag', port: 'a' } },
      { id: 'b6', from: { node: 'flag', port: 'self' }, to: { node: 'touch-flag', port: 'b' } },
      { id: 'b7', from: { node: 'touch-flag', port: 'touching' }, to: { node: 'end', port: 'win' } },
    ],
  },
  shownPorts: {
    bot: { in: [], out: ['self'] },
    button: { in: [], out: ['self'] },
    door: { in: ['hiddenWhile'], out: [] },
    flag: { in: [], out: [] },
    'go-flag': { in: [], out: [] },
    'touch-flag': { in: [], out: [] },
    end: { in: [], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [
    { kind: 'touch', count: 2 },
    { kind: 'latch', count: 1 },
  ],
  par: 2,
  freeHints: 1,
  timeLimit: 25,
  solution: {
    nodes: [
      { id: 'p-touch', kind: 'touch', params: {}, pos: { x: 230, y: 150 } },
      { id: 'p-latch', kind: 'latch', params: {}, pos: { x: 430, y: 150 } },
    ],
    wires: [
      { id: 's1', from: { node: 'bot', port: 'self' }, to: { node: 'p-touch', port: 'a' } },
      { id: 's2', from: { node: 'button', port: 'self' }, to: { node: 'p-touch', port: 'b' } },
      { id: 's3', from: { node: 'p-touch', port: 'touching' }, to: { node: 'p-latch', port: 'set' } },
      { id: 's4', from: { node: 'p-latch', port: 'on' }, to: { node: 'door', port: 'hiddenWhile' } },
    ],
  },
};
