import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/**
 * Level 4 (hai-nut-mot-cua): OR. One door, two buttons, two robots that must both get through. Robot A walks onto
 * button 1 (before the door) and waits there, which holds the door open for robot B. B walks through and stands on
 * button 2 (after the door); only then does A walk on through and reach the flag. The door's "Ẩn khi bật" follows the
 * player's answer: touch(A, nút 1) or touch(B, nút 2). Each button alone is not enough for both robots.
 */
export const level04: PuzzleLevel | null = {
  id: 'hai-nut-mot-cua',
  order: 4,
  title: 'Hai nút một cửa',
  task: 'Hai bot đều phải qua cửa để tới cờ. Bot đầu tiên đứng trên nút 1 để bot kia qua, rồi bot kia đứng trên nút 2 để bot đầu tiên qua. Hãy nối để cửa mở khi một trong hai nút đang được đè.',
  hint: 'Mỗi bot cần một Cảm biến chạm với nút của nó. Mảnh "Hoặc" bật khi có ít nhất một cảm biến bật. Nối kết quả vào "Ẩn khi bật" của cửa.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs, PUZZLE_LOOKS.robotWheel],
  base: {
    nodes: [
      {
        id: 'bot-a',
        kind: 'character',
        params: { name: 'Rô-bốt chân ngắn', position: { x: -12, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 30, y: 10 },
      },
      {
        id: 'bot-b',
        kind: 'character',
        params: { name: 'Rô-bốt bánh xe', position: { x: -3, y: 1, z: 0 }, speed: 4, color: '#7cc4f0', look: PUZZLE_LOOKS.robotWheel, role: 'bot' },
        pos: { x: 30, y: 85 },
      },
      {
        id: 'button-a',
        kind: 'block',
        params: { name: 'Nút 1', position: { x: -6, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#f59e0b', type: 'pickup' },
        pos: { x: 30, y: 160 },
      },
      {
        id: 'button-b',
        kind: 'block',
        params: { name: 'Nút 2', position: { x: 6, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#3b82f6', type: 'pickup' },
        pos: { x: 30, y: 235 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { name: 'Cờ', position: { x: 11, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' },
        pos: { x: 30, y: 310 },
      },
      {
        id: 'ground',
        kind: 'block',
        params: { name: 'Mặt đất', position: { x: 0, y: -0.5, z: 0 }, size: { x: 32, y: 1, z: 1 }, color: '#65a30d', type: 'solid' },
        pos: { x: 30, y: 385 },
      },
      {
        id: 'door',
        kind: 'block',
        params: { name: 'Cửa', position: { x: 2, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 800, y: 10 },
      },
      // Robot A: first to button 1, then (once B stands on button 2) on to the flag.
      { id: 'go-a1', kind: 'go-to', params: {}, pos: { x: 230, y: 10 } },
      { id: 'go-a2', kind: 'go-to', params: {}, pos: { x: 230, y: 85 } },
      { id: 'seq-a', kind: 'sequence', params: { stepCount: 2 }, pos: { x: 230, y: 160 } },
      { id: 'add-a', kind: 'math', params: { op: 'add' }, pos: { x: 430, y: 10 } },
      // Robot B: straight to button 2, through the door.
      { id: 'go-b', kind: 'go-to', params: {}, pos: { x: 230, y: 235 } },
      { id: 'touch-b-btn', kind: 'touch', params: {}, pos: { x: 430, y: 85 } },
      { id: 'touch-a-flag', kind: 'touch', params: {}, pos: { x: 430, y: 160 } },
      { id: 'both', kind: 'and', params: {}, pos: { x: 620, y: 160 } },
      {
        id: 'end',
        kind: 'win-lose',
        params: { winMessage: 'Cả hai bot đã qua cửa!', loseMessage: 'Thua mất rồi!' },
        pos: { x: 800, y: 160 },
      },
    ],
    wires: [
      { id: 'b1', from: { node: 'bot-a', port: 'self' }, to: { node: 'go-a1', port: 'self' } },
      { id: 'b2', from: { node: 'bot-a', port: 'self' }, to: { node: 'go-a2', port: 'self' } },
      { id: 'b3', from: { node: 'button-a', port: 'self' }, to: { node: 'go-a1', port: 'target' } },
      { id: 'b4', from: { node: 'flag', port: 'self' }, to: { node: 'go-a2', port: 'target' } },
      { id: 'b5', from: { node: 'seq-a', port: 'step1' }, to: { node: 'go-a1', port: 'go' } },
      { id: 'b6', from: { node: 'seq-a', port: 'step2' }, to: { node: 'go-a2', port: 'go' } },
      { id: 'b7', from: { node: 'go-a1', port: 'moveX' }, to: { node: 'add-a', port: 'a' } },
      { id: 'b8', from: { node: 'go-a2', port: 'moveX' }, to: { node: 'add-a', port: 'b' } },
      { id: 'b9', from: { node: 'add-a', port: 'out' }, to: { node: 'bot-a', port: 'moveX' } },
      { id: 'b10', from: { node: 'bot-b', port: 'self' }, to: { node: 'go-b', port: 'self' } },
      { id: 'b11', from: { node: 'button-b', port: 'self' }, to: { node: 'go-b', port: 'target' } },
      { id: 'b12', from: { node: 'go-b', port: 'moveX' }, to: { node: 'bot-b', port: 'moveX' } },
      { id: 'b13', from: { node: 'bot-b', port: 'self' }, to: { node: 'touch-b-btn', port: 'a' } },
      { id: 'b14', from: { node: 'button-b', port: 'self' }, to: { node: 'touch-b-btn', port: 'b' } },
      { id: 'b15', from: { node: 'touch-b-btn', port: 'began' }, to: { node: 'seq-a', port: 'next' } },
      { id: 'b16', from: { node: 'bot-a', port: 'self' }, to: { node: 'touch-a-flag', port: 'a' } },
      { id: 'b17', from: { node: 'flag', port: 'self' }, to: { node: 'touch-a-flag', port: 'b' } },
      { id: 'b18', from: { node: 'touch-a-flag', port: 'touching' }, to: { node: 'both', port: 'a' } },
      { id: 'b19', from: { node: 'touch-b-btn', port: 'touching' }, to: { node: 'both', port: 'b' } },
      { id: 'b20', from: { node: 'both', port: 'out' }, to: { node: 'end', port: 'win' } },
    ],
  },
  shownPorts: {
    'bot-a': { in: [], out: ['self'] },
    'bot-b': { in: [], out: ['self'] },
    'button-a': { in: [], out: ['self'] },
    'button-b': { in: [], out: ['self'] },
    door: { in: ['hiddenWhile'], out: [] },
    flag: { in: [], out: [] },
    ground: { in: [], out: [] },
    'go-a1': { in: [], out: [] },
    'go-a2': { in: [], out: [] },
    'seq-a': { in: [], out: [] },
    'add-a': { in: [], out: [] },
    'go-b': { in: [], out: [] },
    'touch-b-btn': { in: [], out: [] },
    'touch-a-flag': { in: [], out: [] },
    both: { in: [], out: [] },
    end: { in: [], out: [] },
  },
  tray: [
    { kind: 'touch', count: 2 },
    { kind: 'or', count: 1 },
  ],
  par: 3,
  freeHints: 2,
  timeLimit: 40,
  solution: {
    nodes: [
      { id: 'p-touch-a', kind: 'touch', params: {}, pos: { x: 230, y: 330 } },
      { id: 'p-touch-b', kind: 'touch', params: {}, pos: { x: 230, y: 450 } },
      { id: 'p-or', kind: 'or', params: {}, pos: { x: 500, y: 390 } },
    ],
    wires: [
      { id: 's1', from: { node: 'bot-a', port: 'self' }, to: { node: 'p-touch-a', port: 'a' } },
      { id: 's2', from: { node: 'button-a', port: 'self' }, to: { node: 'p-touch-a', port: 'b' } },
      { id: 's3', from: { node: 'bot-b', port: 'self' }, to: { node: 'p-touch-b', port: 'a' } },
      { id: 's4', from: { node: 'button-b', port: 'self' }, to: { node: 'p-touch-b', port: 'b' } },
      { id: 's5', from: { node: 'p-touch-a', port: 'touching' }, to: { node: 'p-or', port: 'a' } },
      { id: 's6', from: { node: 'p-touch-b', port: 'touching' }, to: { node: 'p-or', port: 'b' } },
      { id: 's7', from: { node: 'p-or', port: 'out' }, to: { node: 'door', port: 'hiddenWhile' } },
    ],
  },
};
