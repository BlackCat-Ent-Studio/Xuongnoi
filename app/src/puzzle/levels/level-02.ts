import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/**
 * Level 2 (cua-kho): a door that must stay open. The locked "Hoặc" / "Không" pair makes the door close again as soon
 * as its signal drops (the block's "Hiện lại" follows the opposite of "Ẩn đi"), so a plain touch signal is not enough.
 */
export const level02: PuzzleLevel | null = {
  id: 'cua-kho',
  order: 2,
  title: 'Cửa kho',
  task: 'Bot đang tự đi tới cờ nhưng cửa kho đóng. Hãy nối sao cho bot dẫm nút đỏ thì cửa mở và mở mãi.',
  hint: 'Cảm biến chạm báo khi bot dẫm nút. Công tắc nhớ giữ cửa mở dù bot đã đi khỏi nút.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs],
  base: {
    nodes: [
      {
        id: 'bot',
        kind: 'character',
        params: { position: { x: -10, y: 1, z: 0 }, speed: 4, color: '#f59e0b', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 30, y: 30 },
      },
      {
        id: 'button',
        kind: 'block',
        params: { position: { x: -5, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#ef4444', type: 'pickup' },
        pos: { x: 30, y: 170 },
      },
      {
        id: 'door',
        kind: 'block',
        params: { position: { x: 3, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 800, y: 30 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { position: { x: 10, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' },
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
      { id: 'door-in', kind: 'or', params: {}, pos: { x: 620, y: 30 } },
      { id: 'door-back', kind: 'not', params: {}, pos: { x: 620, y: 160 } },
      {
        id: 'ground',
        kind: 'block',
        params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d', type: 'solid' },
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
      { id: 'b8', from: { node: 'door-in', port: 'out' }, to: { node: 'door', port: 'hide' } },
      { id: 'b9', from: { node: 'door-in', port: 'out' }, to: { node: 'door-back', port: 'in' } },
      { id: 'b10', from: { node: 'door-back', port: 'out' }, to: { node: 'door', port: 'show' } },
    ],
  },
  shownPorts: {
    bot: { in: [], out: ['self'] },
    button: { in: [], out: ['self'] },
    door: { in: [], out: [] },
    flag: { in: [], out: [] },
    'go-flag': { in: [], out: [] },
    'touch-flag': { in: [], out: [] },
    end: { in: [], out: [] },
    'door-in': { in: ['a'], out: [] },
    'door-back': { in: [], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [
    { kind: 'touch', count: 1 },
    { kind: 'latch', count: 1 },
  ],
  par: 2,
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
      { id: 's4', from: { node: 'p-latch', port: 'on' }, to: { node: 'door-in', port: 'a' } },
    ],
  },
};
