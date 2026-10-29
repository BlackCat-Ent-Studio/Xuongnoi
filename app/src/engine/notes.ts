import type { Note, NoteColor } from './types';

export const NOTE_COLORS: readonly NoteColor[] = ['yellow', 'green', 'blue', 'pink'];
export const NOTE_MIN_W = 120;
export const NOTE_MIN_H = 70;
export const NOTE_MAX_W = 800;
export const NOTE_MAX_H = 600;
export const NOTE_DEFAULT_SIZE = { w: 180, h: 110 };
export const NOTE_MAX_TEXT = 2000;
export const NOTE_MAX_COUNT = 200;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function clampNoteSize(size: { w: number; h: number }): { w: number; h: number } {
  return { w: Math.round(clamp(size.w, NOTE_MIN_W, NOTE_MAX_W)), h: Math.round(clamp(size.h, NOTE_MIN_H, NOTE_MAX_H)) };
}

export function isNoteColor(v: unknown): v is NoteColor {
  return typeof v === 'string' && (NOTE_COLORS as readonly string[]).includes(v);
}

export function nextNoteId(notes: readonly Note[]): string {
  const used = new Set(notes.map((n) => n.id));
  let i = notes.length + 1;
  while (used.has(`note${i}`)) i++;
  return `note${i}`;
}

export function createNote(notes: readonly Note[], pos: { x: number; y: number }): Note {
  return {
    id: nextNoteId(notes),
    text: '',
    color: 'yellow',
    pos: { x: Math.round(pos.x), y: Math.round(pos.y) },
    size: { ...NOTE_DEFAULT_SIZE },
  };
}
