import type { Params, PortValue, Vec3 } from '../engine/types';

export function numParam(params: Params, id: string, fallback: number): number {
  const v = params[id];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function strParam(params: Params, id: string, fallback: string): string {
  const v = params[id];
  return typeof v === 'string' ? v : fallback;
}

export function vec3Param(params: Params, id: string, fallback: Vec3): Vec3 {
  const v = params[id];
  if (v && typeof v === 'object') {
    return {
      x: Number.isFinite(v.x) ? v.x : fallback.x,
      y: Number.isFinite(v.y) ? v.y : fallback.y,
      z: Number.isFinite(v.z) ? v.z : fallback.z,
    };
  }
  return { ...fallback };
}

export function asBool(v: PortValue | undefined): boolean {
  return v === true;
}

export function asNum(v: PortValue | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function asObject(v: PortValue | undefined): string | null {
  return typeof v === 'string' ? v : null;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Tracks a bool input and reports rising edges (false -> true). */
export interface EdgeState {
  prev: boolean;
}

export function risingEdge(s: EdgeState, now: boolean): boolean {
  const edge = now && !s.prev;
  s.prev = now;
  return edge;
}
