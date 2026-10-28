import type {
  CharacterIntent,
  EntityId,
  EntitySpec,
  EntityView,
  GameResult,
  HudItem,
  ViewMode,
  World,
} from '../engine/types';
import { toView, type Entity } from './entity';
import { stepPhysics, touching } from './physics';

function pairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function createWorld(mode: ViewMode): World {
  const list: Entity[] = [];
  const byId = new Map<EntityId, Entity>();
  const hud = new Map<string, HudItem>();
  let contacts = new Set<string>();
  let ended: { result: GameResult; message: string } | null = null;
  let yaw = 0;
  let nextId = 1;

  function computeContacts(): void {
    const next = new Set<string>();
    const live = list.filter((e) => e.visible);
    for (let i = 0; i < live.length; i++) {
      const a = live[i]!;
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j]!;
        if (a.kind !== 'character' && b.kind !== 'character') continue;
        if (touching(a, b)) next.add(pairKey(a.id, b.id));
      }
    }
    contacts = next;
  }

  return {
    mode,
    get ended() {
      return ended;
    },
    spawn(spec: EntitySpec): EntityId {
      const id = `e${nextId++}`;
      const e: Entity = {
        id,
        kind: spec.kind,
        ownerNodeId: spec.ownerNodeId,
        pos: { ...spec.position },
        size: { ...spec.size },
        vel: { x: 0, y: 0, z: 0 },
        color: spec.color,
        solid: spec.solid,
        visible: true,
        onGround: false,
        intent: null,
      };
      if (mode === '2d-side') e.pos.z = 0;
      list.push(e);
      byId.set(id, e);
      return id;
    },
    setCharacterIntent(id: EntityId, intent: CharacterIntent): void {
      const e = byId.get(id);
      if (e && e.kind === 'character') e.intent = { ...intent };
    },
    hide(id: EntityId): void {
      const e = byId.get(id);
      if (!e) return;
      e.visible = false;
      e.onGround = false;
      for (const k of [...contacts]) if (k.split('|').includes(id)) contacts.delete(k);
    },
    getEntity(id: EntityId): EntityView | undefined {
      const e = byId.get(id);
      return e ? toView(e) : undefined;
    },
    isOnGround(id: EntityId): boolean {
      const e = byId.get(id);
      return !!e && e.visible && e.onGround;
    },
    isTouching(a: EntityId, b: EntityId): boolean {
      return contacts.has(pairKey(a, b));
    },
    setHud(item: HudItem): void {
      hud.set(item.key, { ...item });
    },
    endGame(result: GameResult, message: string): void {
      if (!ended) ended = { result, message };
    },
    step(dt: number): void {
      if (ended) return;
      stepPhysics(list, dt, mode, yaw);
      computeContacts();
    },
    entities(): readonly EntityView[] {
      return list.map(toView);
    },
    hudItems(): readonly HudItem[] {
      return [...hud.values()].map((h) => ({ ...h }));
    },
    setCameraYaw(rad: number): void {
      yaw = Number.isFinite(rad) ? rad : 0;
    },
  };
}
