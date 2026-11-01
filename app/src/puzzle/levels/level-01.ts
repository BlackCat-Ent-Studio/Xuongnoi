import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/** Level 1 (bot-dau-tien): the first wires. The bot walks by itself once "Đi tới" is joined to it and to the flag. */
export const level01: PuzzleLevel | null = {
  id: 'bot-dau-tien',
  order: 1,
  title: 'Bot đầu tiên',
  task: 'Bot muốn đi tới lá cờ. Hãy kéo mảnh "Đi tới" vào, rồi nối dây cho bot và lá cờ.',
  hint: 'Nối 3 dây: Bot vào "Bot", Cờ vào "Đích", và "Đi ngang" của mảnh đi vào "Đi ngang" của bot.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.robotLegs],
  base: {
    nodes: [
      {
        id: 'bot',
        kind: 'character',
        params: { position: { x: -9, y: 1, z: 0 }, speed: 4, color: '#f59e0b', look: PUZZLE_LOOKS.robotLegs, role: 'bot' },
        pos: { x: 30, y: 40 },
      },
      {
        id: 'flag',
        kind: 'block',
        params: { position: { x: 9, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#ef4444', type: 'pickup' },
        pos: { x: 800, y: 40 },
      },
      { id: 'touch-flag', kind: 'touch', params: {}, pos: { x: 410, y: 380 } },
      {
        id: 'end',
        kind: 'win-lose',
        params: { winMessage: 'Bot tới cờ rồi!', loseMessage: 'Thua mất rồi!' },
        pos: { x: 790, y: 400 },
      },
      {
        id: 'ground',
        kind: 'block',
        params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 1 }, color: '#65a30d', type: 'solid' },
        pos: { x: 30, y: 400 },
      },
    ],
    wires: [
      { id: 'b1', from: { node: 'bot', port: 'self' }, to: { node: 'touch-flag', port: 'a' } },
      { id: 'b2', from: { node: 'flag', port: 'self' }, to: { node: 'touch-flag', port: 'b' } },
      { id: 'b3', from: { node: 'touch-flag', port: 'touching' }, to: { node: 'end', port: 'win' } },
    ],
  },
  shownPorts: {
    bot: { in: ['moveX'], out: ['self'] },
    flag: { in: [], out: ['self'] },
    'touch-flag': { in: ['a', 'b'], out: ['touching'] },
    end: { in: ['win'], out: [] },
    ground: { in: [], out: [] },
  },
  tray: [{ kind: 'go-to', count: 1 }],
  par: 1,
  timeLimit: 15,
  solution: {
    nodes: [{ id: 'p-goto', kind: 'go-to', params: {}, pos: { x: 400, y: 150 } }],
    wires: [
      { id: 's1', from: { node: 'bot', port: 'self' }, to: { node: 'p-goto', port: 'self' } },
      { id: 's2', from: { node: 'flag', port: 'self' }, to: { node: 'p-goto', port: 'target' } },
      { id: 's3', from: { node: 'p-goto', port: 'moveX' }, to: { node: 'bot', port: 'moveX' } },
    ],
  },
};
