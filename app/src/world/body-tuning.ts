import type { EntitySpec } from '../engine/types';
import { normalizeCollider, sanitizeGravityScale } from './collider';
import type { Entity } from './entity';

const MAX_FRICTION = 100;

/** The optional collision / body-tuning fields of a new entity; empty for a default body so nothing extra is carried. */
export function bodyTuning(spec: EntitySpec): Partial<Pick<Entity, 'collider' | 'gravityScale' | 'friction' | 'bounce'>> {
  const out: Partial<Pick<Entity, 'collider' | 'gravityScale' | 'friction' | 'bounce'>> = {};
  const collider = normalizeCollider(spec.colliderSize, spec.colliderOffset);
  if (collider) out.collider = collider;
  if (spec.gravityScale !== undefined) {
    const g = sanitizeGravityScale(spec.gravityScale);
    if (g !== 1) out.gravityScale = g;
  }
  if (spec.kind === 'item') {
    if (typeof spec.friction === 'number' && Number.isFinite(spec.friction)) {
      out.friction = Math.min(MAX_FRICTION, Math.max(0, spec.friction));
    }
    if (typeof spec.bounce === 'number' && Number.isFinite(spec.bounce) && spec.bounce > 0) {
      out.bounce = Math.min(1, spec.bounce);
    }
  }
  return out;
}
