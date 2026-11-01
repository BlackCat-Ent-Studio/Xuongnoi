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
  SolidBox,
  WorldApi,
} from '../../src/engine/types';

export interface FakeWorld extends WorldApi {
  spawned: EntitySpec[];
  intents: { id: EntityId; intent: CharacterIntent }[];
  hidden: EntityId[];
  shown: EntityId[];
  huds: HudItem[];
  endCalls: { result: GameResult; message: string }[];
  touching: Set<string>;
  grounded: boolean;
  entities: Map<EntityId, EntityView>;
  boxes: SolidBox[];
  revision: number;
}

export function makeWorld(): FakeWorld {
  let n = 0;
  const w: FakeWorld = {
    mode: '2d-side',
    spawned: [],
    intents: [],
    hidden: [],
    shown: [],
    huds: [],
    endCalls: [],
    touching: new Set(),
    grounded: false,
    entities: new Map(),
    boxes: [],
    revision: 0,
    ended: null,
    spawn(spec) {
      const id = `e${++n}`;
      w.spawned.push(spec);
      w.entities.set(id, { id, kind: spec.kind, ownerNodeId: spec.ownerNodeId, position: { ...spec.position }, size: spec.size, color: spec.color, visible: true });
      return id;
    },
    setEntityStyle(id, style) {
      const e = w.entities.get(id);
      if (e) w.entities.set(id, { ...e, ...(style.color !== undefined ? { color: style.color } : {}), ...(style.look !== undefined ? { look: style.look } : {}) });
    },
    tagOf: (id) => w.spawned.find((_, i) => `e${i + 1}` === id)?.tag ?? '',
    setCharacterIntent: (id, intent) => void w.intents.push({ id, intent }),
    hide: (id) => void w.hidden.push(id),
    show: (id) => void w.shown.push(id),
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
    equip: () => null,
    unequip: () => null,
    handItem: () => null,
    isInHand: () => false,
    useTool: () => null,
    wasUsedOn: () => false,
    setHealth: () => undefined,
    heal: () => undefined,
    healthOf: () => null,
    wasHurt: () => false,
    solidAt: () => false,
    solidBoxes: () => w.boxes,
    solidRevision: () => w.revision,
    cameraYaw: () => 0,
    setVehicleInput: () => undefined,
    setVehicleTrack: () => undefined,
    setVehicleTow: () => undefined,
    probeAhead: () => null,
    lineOfSight: () => true,
    enterVehicle: () => null,
    exitVehicle: () => null,
    loadCargo: () => null,
    unloadCargo: () => null,
    cargoOf: () => [],
    listEntities: () => [...w.entities.values()],
    runSeed: () => 12345,
    setCamera: () => undefined,
    teleport: () => null,
    setPortal: () => undefined,
    portalUser: () => null,
    setBeltSpeed: () => undefined,
    moveBlock: () => true,
    setBlockAngle: () => true,
    shoot: () => null,
    shotHits: () => [],
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
