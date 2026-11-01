import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/**
 * Level 4 (hai-nut-mot-cua): AND. Bot A walks onto its button and stops there. Bot B walks to the flag but is held
 * against the door, standing on its own button. The door opens once both buttons are pressed together.
 */
export const level04: PuzzleLevel | null = {
  id: 'hai-nut-mot-cua',
  order: 4,
  title: 'Hai nút một cửa',
  task: 'Hai bot cùng làm việc. Cửa chỉ mở khi CẢ HAI bot đứng trên nút của mình. Hãy nối để cửa mở cho bot xanh qua.',
  hint: 'Mỗi bot cần một Cảm biến chạm với nút của nó. Mảnh "Và" chỉ bật khi cả hai cảm biến cùng bật.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs, PUZZLE_LOOKS.robotWheel],
  base: {
    nodes: [
      {
        id: 'bot-a',
        kind: 'character',
        params: { position: { x: -13, y: 1, z: 0 }, speed: 4, color: '#f59e0b', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 30, y: 30 },
      },
      {
        id: 'bot-b',
        kind: 'character',
        params: { position: { x: -7, y: 1, z: 0 }, speed: 4, color: '#3b82f6', look: PUZZLE_LOOKS.robotWheel, role: 'bot' },
        pos: { x: 30, y: 200 },
      },
      {
        id: 'button-a',
        kind: 'block',
        params: { position: { x: -4, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#f59e0b', type: 'pickup' },
        pos: { x: 800, y: 30 },
      },
      {
        id: 'button-b',
        kind: 'block',
        params: { position: { x: 2.6, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1 }, color: '#3b82f6', type: 'pickup' },
        pos: { x: 800, y: 170 },
      },
      {
        id: 'door',
        kind: 'block',
        params: { position: { x: 4, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 800, y: 310 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { position: { x: 11, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' },
        pos: { x: 30, y: 340 },
      },
      { id: 'go-a', kind: 'go-to', params: {}, pos: { x: 230, y: 30 } },
      { id: 'go-b', kind: 'go-to', params: {}, pos: { x: 230, y: 200 } },
      { id: 'touch-flag', kind: 'touch', params: {}, pos: { x: 430, y: 400 } },
      {
        id: 'end',
        kind: 'win-lose',
        params: { winMessage: 'Cả hai nút cùng bật, bot qua cửa rồi!', loseMessage: 'Thua mất rồi!' },
        pos: { x: 800, y: 440 },
      },
      {
        id: 'ground',
        kind: 'block',
        params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 32, y: 1, z: 1 }, color: '#65a30d', type: 'solid' },
        pos: { x: 230, y: 480 },
      },
    ],
    wires: [
      { id: 'b1', from: { node: 'bot-a', port: 'self' }, to: { node: 'go-a', port: 'self' } },
      { id: 'b2', from: { node: 'button-a', port: 'self' }, to: { node: 'go-a', port: 'target' } },
      { id: 'b3', from: { node: 'go-a', port: 'moveX' }, to: { node: 'bot-a', port: 'moveX' } },
      { id: 'b4', from: { node: 'bot-b', port: 'self' }, to: { node: 'go-b', port: 'self' } },
      { id: 'b5', from: { node: 'flag', port: 'self' }, to: { node: 'go-b', port: 'target' } },
      { id: 'b6', from: { node: 'go-b', port: 'moveX' }, to: { node: 'bot-b', port: 'moveX' } },
      { id: 'b7', from: { node: 'go-b', port: 'jump' }, to: { node: 'bot-b', port: 'jump' } },
      { id: 'b8', from: { node: 'bot-b', port: 'self' }, to: { node: 'touch-flag', port: 'a' } },
      { id: 'b9', from: { node: 'flag', port: 'self' }, to: { node: 'touch-flag', port: 'b' } },
      { id: 'b10', from: { node: 'touch-flag', port: 'touching' }, to: { node: 'end', port: 'win' } },
    ],
  },
  shownPorts: {
    'bot-a': { in: [], out: ['self'] },
    'bot-b': { in: [], out: ['self'] },
    'button-a': { in: [], out: ['self'] },
    'button-b': { in: [], out: ['self'] },
    door: { in: ['hide'], out: [] },
    flag: { in: [], out: [] },
    'go-a': { in: [], out: [] },
    'go-b': { in: [], out: [] },
    'touch-flag': { in: [], out: [] },
    end: { in: [], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [
    { kind: 'touch', count: 2 },
    { kind: 'and', count: 1 },
  ],
  par: 3,
  timeLimit: 30,
  solution: {
    nodes: [
      { id: 'p-touch-a', kind: 'touch', params: {}, pos: { x: 230, y: 130 } },
      { id: 'p-touch-b', kind: 'touch', params: {}, pos: { x: 230, y: 270 } },
      { id: 'p-and', kind: 'and', params: {}, pos: { x: 500, y: 200 } },
    ],
    wires: [
      { id: 's1', from: { node: 'bot-a', port: 'self' }, to: { node: 'p-touch-a', port: 'a' } },
      { id: 's2', from: { node: 'button-a', port: 'self' }, to: { node: 'p-touch-a', port: 'b' } },
      { id: 's3', from: { node: 'bot-b', port: 'self' }, to: { node: 'p-touch-b', port: 'a' } },
      { id: 's4', from: { node: 'button-b', port: 'self' }, to: { node: 'p-touch-b', port: 'b' } },
      { id: 's5', from: { node: 'p-touch-a', port: 'touching' }, to: { node: 'p-and', port: 'a' } },
      { id: 's6', from: { node: 'p-touch-b', port: 'touching' }, to: { node: 'p-and', port: 'b' } },
      { id: 's7', from: { node: 'p-and', port: 'out' }, to: { node: 'door', port: 'hide' } },
    ],
  },
};
