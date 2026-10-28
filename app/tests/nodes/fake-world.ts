import type {
  CharacterIntent,
  EntityId,
  EntitySpec,
  EntityView,
  EvalCtx,
  GameResult,
  HudItem,
  NodeDef,
  Params,
  PortValues,
  WorldApi,
} from '../../src/engine/types';

export interface FakeWorld extends WorldApi {
  spawned: EntitySpec[];
  intents: { id: EntityId; intent: CharacterIntent }[];
  hidden: EntityId[];
  huds: HudItem[];
  endCalls: { result: GameResult; message: string }[];
  touching: Set<string>;
  grounded: boolean;
  entities: Map<EntityId, EntityView>;
}

export function makeWorld(): FakeWorld {
  let n = 0;
  const w: FakeWorld = {
    mode: '2d-side',
    spawned: [],
    intents: [],
    hidden: [],
    huds: [],
    endCalls: [],
    touching: new Set(),
    grounded: false,
    entities: new Map(),
    ended: null,
    spawn(spec) {
      const id = `e${++n}`;
      w.spawned.push(spec);
      w.entities.set(id, { id, kind: spec.kind, ownerNodeId: spec.ownerNodeId, position: { ...spec.position }, size: spec.size, color: spec.color, visible: true });
      return id;
    },
    setCharacterIntent: (id, intent) => void w.intents.push({ id, intent }),
    hide: (id) => void w.hidden.push(id),
    getEntity: (id) => w.entities.get(id),
    isOnGround: () => w.grounded,
    isTouching: (a, b) => w.touching.has(`${a}|${b}`),
    setHud: (item) => void w.huds.push(item),
    endGame: (result, message) => void w.endCalls.push({ result, message }),
    grab: () => null,
    drop: () => null,
    throwHeld: () => null,
    heldItem: () => null,
    isHeld: () => false,
    interact: () => null,
    wasInteracted: () => false,
  };
  return w;
}

export function makeCtx(world: WorldApi, over: { tick?: number; keys?: string[]; nodeId?: string; dt?: number } = {}): EvalCtx {
  return {
    dt: over.dt ?? 1 / 60,
    tick: over.tick ?? 0,
    mode: world.mode,
    input: { keysDown: new Set(over.keys ?? []) },
    world,
    nodeId: over.nodeId ?? 'n1',
  };
}

/** Params with every declared default, overridden by `over`. */
export function defaultParams(def: NodeDef<any>, over: Params = {}): Params {
  const p: Params = {};
  for (const d of def.params) p[d.id] = d.default;
  return { ...p, ...over };
}

/** Drives one node over several ticks with per-tick inputs/keys. */
export function runNode<S>(
  def: NodeDef<S>,
  steps: { inputs?: PortValues; keys?: string[] }[],
  paramOver: Params = {},
  world: WorldApi = makeWorld(),
): PortValues[] {
  const params = defaultParams(def, paramOver);
  const state = def.create ? def.create(makeCtx(world), params) : (undefined as S);
  return steps.map((s, tick) => def.evaluate(makeCtx(world, { tick, keys: s.keys }), s.inputs ?? {}, params, state));
}
