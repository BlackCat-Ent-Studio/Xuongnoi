import type { HudCorner, Params } from '../engine/types';
import { strParam } from './util';

export const HUD_CORNERS: readonly HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const UI_TEXT_MAX_LENGTH = 80;

/** Palette options shared by every UI node that sits in a screen corner. */
export const CORNER_OPTIONS = [
  { value: 'top-left', label: 'Trên trái' },
  { value: 'top-right', label: 'Trên phải' },
  { value: 'bottom-left', label: 'Dưới trái' },
  { value: 'bottom-right', label: 'Dưới phải' },
];

export function cornerParam(params: Params, fallback: HudCorner): HudCorner {
  const c = strParam(params, 'corner', fallback);
  return HUD_CORNERS.find((x) => x === c) ?? fallback;
}

/** Text param capped to a sane length so a pasted essay cannot flood the screen. */
export function uiText(params: Params, id: string, fallback: string): string {
  return strParam(params, id, fallback).slice(0, UI_TEXT_MAX_LENGTH);
}
