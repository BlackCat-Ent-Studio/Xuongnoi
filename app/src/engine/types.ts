/**
 * Shared contracts for every module (engine, nodes, world, render, editor, io).
 * Change only with agreement across modules — everything else builds on these shapes.
 */

// ---------- basic values ----------

export type ViewMode = '2d-side' | '2d-top' | '3d';
export const VIEW_MODES: readonly ViewMode[] = ['2d-side', '2d-top', '3d'];

/** Y is up. 1 unit = 1 block. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type EntityId = string;

/** Wire value types. Strict: a wire only connects ports of the same type. */
export type PortType = 'bool' | 'number' | 'object';

/** bool → boolean, number → number, object → EntityId or null (nothing connected/spawned). */
export type PortValue = boolean | number | EntityId | null;

export const PORT_DEFAULTS: Record<PortType, PortValue> = {
  bool: false,
  number: 0,
  object: null,
};

// ---------- node definitions ----------

export type NodeCategory = 'input' | 'logic' | 'math' | 'object' | 'action' | 'brain' | 'output';

export interface PortDef {
  id: string;
  type: PortType;
  /** Vietnamese label shown on the port. */
  label: string;
  /** Value used when the input port has no wire. Falls back to PORT_DEFAULTS[type]. */
  default?: PortValue;
}

export type ParamKind = 'number' | 'select' | 'key' | 'color' | 'vec3' | 'text';
export type ParamValue = number | string | Vec3;
export type Params = Record<string, ParamValue>;

export interface ParamDef {
  id: string;
  label: string;
  kind: ParamKind;
  default: ParamValue;
  /** For kind 'select'. */
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

/** Keyboard state for one tick. Keys are KeyboardEvent.code values, e.g. 'KeyW', 'ArrowLeft', 'Space'. */
export interface InputSnapshot {
  keysDown: ReadonlySet<string>;
}

export interface EvalCtx {
  /** Fixed step in seconds (1/60). */
  dt: number;
  /** 0 on the first tick of a run. */
  tick: number;
  mode: ViewMode;
  input: InputSnapshot;
  world: WorldApi;
  /** Id of the graph node being evaluated. */
  nodeId: string;
}

export type PortValues = Record<string, PortValue>;

export interface NodeDef<S = unknown> {
  kind: string;
  label: string;
  category: NodeCategory;
  /** Short Vietnamese help text for the palette tooltip. */
  description: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  /** Modes where this node appears in the palette. Omit = all modes. */
  modes?: ViewMode[];
  /** Called once when a run starts (before tick 0). Object nodes spawn entities here. */
  create?(ctx: EvalCtx, params: Params): S;
  /** Called every tick in topological order. Must return a value for every output port. */
  evaluate(ctx: EvalCtx, inputs: PortValues, params: Params, state: S): PortValues;
}

// ---------- graph (what the user builds) ----------

export interface GraphNode {
  id: string;
  kind: string;
  params: Params;
  /** Position on the wiring canvas (px, canvas space). */
  pos: { x: number; y: number };
}

export interface PortRef {
  node: string;
  port: string;
}

export interface Wire {
  id: string;
  from: PortRef; // output port
  to: PortRef; // input port
}

export interface Graph {
  nodes: GraphNode[];
  wires: Wire[];
}

/** A saved board = one game. */
export interface Board {
  name: string;
  mode: ViewMode;
  graph: Graph;
}

// ---------- engine API (implemented in src/engine) ----------

export type ConnectResult =
  | { ok: true }
  | { ok: false; reason: ConnectFailReason };

export type ConnectFailReason =
  | 'unknown-node'
  | 'unknown-port'
  | 'type-mismatch'
  | 'input-taken'
  | 'same-node'
  | 'wrong-direction';

export interface Runtime {
  readonly tickIndex: number;
  /** Advance one fixed tick: evaluate every node once. Does NOT step physics. */
  tick(input: InputSnapshot): void;
  getOutput(nodeId: string, portId: string): PortValue;
  /** Value currently travelling on a wire (= its source output). */
  getWireValue(wire: Wire): PortValue;
}

// ---------- world API (implemented in src/world) ----------

export type EntityKind = 'character' | 'block' | 'item' | 'vehicle';

/** Look and size class of a vehicle (built from boxes by the renderer). */
export type VehicleModel = 'car' | 'bike' | 'truck';
export const VEHICLE_MODELS: readonly VehicleModel[] = ['car', 'bike', 'truck'];

/** 'direction' = the vehicle turns toward where the stick points; 'throttle' = stick up/down is gas/brake, left/right steers. */
export type SteerMode = 'direction' | 'throttle';

/** How a vehicle drives; set when it spawns. */
export interface VehicleSpec {
  model: VehicleModel;
  steerMode: SteerMode;
  /** Units per second at full throttle. */
  maxSpeed: number;
  /** Units per second gained per second. */
  accel: number;
}

/** Look of an item entity (built from boxes by the renderer). */
export type ItemShape =
  | 'box'
  | 'key'
  | 'ball'
  | 'crate'
  | 'sword'
  | 'pickaxe'
  | 'hammer'
  | 'torch'
  | 'wand'
  | 'bucket'
  | 'lock';
export const ITEM_SHAPES: readonly ItemShape[] = [
  'box',
  'key',
  'ball',
  'crate',
  'sword',
  'pickaxe',
  'hammer',
  'torch',
  'wand',
  'bucket',
  'lock',
];

/** How a character carries an item: balanced above the head, or as a tool in hand. */
export type HoldStyle = 'head' | 'hand';
export const HOLD_STYLES: readonly HoldStyle[] = ['head', 'hand'];

/** Who steers a character: the person playing (camera follows it) or a bot driven by brain nodes. */
export type CharacterRole = 'player' | 'bot';

export interface EntitySpec {
  kind: EntityKind;
  /** Graph node that owns this entity — lets the editor map clicks in the game view back to nodes. */
  ownerNodeId: string;
  /** Center position. */
  position: Vec3;
  /** Full size (width x height x depth). */
  size: Vec3;
  /** CSS hex color, e.g. '#ff8800'. */
  color: string;
  /** Character look id (e.g. 'robot'); omitted = the default human. Ignored for blocks. */
  look?: string;
  /** Characters only: omitted = 'player'. */
  role?: CharacterRole;
  /** Solid entities block movement; non-solid ones (pickups) only produce contacts. */
  solid: boolean;
  /** Items only: look of the item. Omitted = 'box'. */
  shape?: ItemShape;
  /** Items only: false = can be touched and used, but never picked up. Omitted = true. */
  carryable?: boolean;
  /** Items only: which slot picks it up. Omitted = 'head'. */
  holdStyle?: HoldStyle;
  /** Items only: damage dealt as a tool or when thrown. 0 / omitted = by shape (sword 3, hammer 2, pickaxe 2, else 1). */
  damage?: number;
  /** Vehicles only (kind 'vehicle'). */
  vehicle?: VehicleSpec;
}

export interface CharacterIntent {
  /** −1..1 from a stick or math. */
  moveX: number;
  moveY: number;
  jump: boolean;
  /** Units per second. */
  speed: number;
  /** Initial upward velocity in units per second. */
  jumpPower: number;
}

export interface EntityView {
  id: EntityId;
  kind: EntityKind;
  ownerNodeId: string;
  position: Vec3;
  size: Vec3;
  color: string;
  look?: string;
  /** Characters only; 'bot' characters are skipped by the follow camera while a player exists. */
  role?: CharacterRole;
  /** Items only. */
  shape?: ItemShape;
  /** Items only; present as 'hand' for tools. */
  holdStyle?: HoldStyle;
  /** Items only; true while the item is in a character's hand (the renderer draws it on the figure). */
  inHand?: boolean;
  /** Characters only; the tool currently in hand. */
  tool?: { shape: ItemShape; color: string };
  /** Characters only; height of the item carried above the head (side and 3D views), absent when nothing rides there. */
  carriedHeight?: number;
  /** Characters only; 0..1 progress of a swing in progress, absent otherwise. */
  swing?: number;
  /** Characters only; run speed and jump power from the latest intent (absent before the first one). Lets a bot plan its jumps. */
  drive?: { speed: number; jumpPower: number };
  /** Characters only; present once a health node registered it. `bar` = draw the bar above the head. */
  health?: { hp: number; max: number; bar: boolean };
  /** Characters only; 0..1 red-flash strength right after a hit, absent otherwise. */
  hurt?: number;
  /** Characters only; 0..1 progress of tipping over after running out of health, absent while alive. */
  fallen?: number;
  /** Vehicles only: look, signed forward speed (units/s), how far the wheels have turned and which way the nose points (radians), and who sits in it. */
  vehicle?: { model: VehicleModel; speed: number; wheelSpin: number; heading: number; driver: EntityId | null };
  /** Characters only; the vehicle this character is sitting in. */
  seatedIn?: EntityId;
  visible: boolean;
}

/** An axis-aligned solid block as the pathfinder sees it. */
export interface SolidBox {
  /** Center. */
  position: Vec3;
  /** Full size. */
  size: Vec3;
}

export type HudCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface HudItem {
  key: string;
  label: string;
  value: number;
  corner: HudCorner;
  /** Free text: when set the corner shows `text` alone (no "label: value"). */
  text?: string;
  /** CSS color of the text. */
  color?: string;
  /** With `text`: draw the text floating above this entity instead of in the corner. */
  anchor?: EntityId;
  /** True = kept in the list but not drawn. */
  hidden?: boolean;
}

export type GameResult = 'win' | 'lose';

/** What nodes may do to the world during create()/evaluate(). */
export interface WorldApi {
  readonly mode: ViewMode;
  spawn(spec: EntitySpec): EntityId;
  /** Applied on the next physics step. Ignored for non-characters. */
  setCharacterIntent(id: EntityId, intent: CharacterIntent): void;
  /** Removes the entity for the rest of the run (no rendering, no contacts, no collision). */
  hide(id: EntityId): void;
  getEntity(id: EntityId): EntityView | undefined;
  isOnGround(id: EntityId): boolean;
  /** Contact state from the last physics step (works for solid and non-solid). */
  isTouching(a: EntityId, b: EntityId): boolean;
  setHud(item: HudItem): void;
  /** First call wins; later calls ignored. */
  endGame(result: GameResult, message: string): void;
  readonly ended: { result: GameResult; message: string } | null;

  // ---- items: carry / drop / throw / interact (applied immediately, positions settle on the next step) ----

  /** Picks up the nearest free carryable item within `reach` (prefers the facing side). One item per character. */
  grab(character: EntityId, reach: number): EntityId | null;
  /** Puts the held item down in front of the character. Returns the item, or null when nothing was held. */
  drop(character: EntityId): EntityId | null;
  /** Releases the held item with a forward-and-up velocity. Returns the item, or null when nothing was held. */
  throwHeld(character: EntityId, power: number): EntityId | null;
  heldItem(character: EntityId): EntityId | null;
  isHeld(item: EntityId): boolean;
  /** Marks the nearest item within `reach` (not the one in hand) as used; its pulse shows on the next tick. */
  interact(character: EntityId, reach: number): EntityId | null;
  /** True for exactly one tick after the item was interacted with. */
  wasInteracted(item: EntityId): boolean;

  // ---- hand-held tools: a second slot, independent of the above-head one ----

  /** Takes the nearest free carryable `hand` item within `reach` into the hand. One tool per character. */
  equip(character: EntityId, reach: number): EntityId | null;
  /** Puts the tool in hand down in front of the character. Returns it, or null when the hand was empty. */
  unequip(character: EntityId): EntityId | null;
  handItem(character: EntityId): EntityId | null;
  isInHand(item: EntityId): boolean;
  /**
   * Swings (with or without a tool) and marks the nearest visible block/item/character in front within `reach`
   * as used. Returns null while a swing is still in progress (cooldown) or for a bad character.
   */
  useTool(character: EntityId, reach: number): { target: EntityId | null } | null;
  /** True for exactly one tick after something was used on this entity. */
  wasUsedOn(id: EntityId): boolean;

  // ---- combat: health, damage from tool swings and thrown items ----

  /** Gives a character health (full). Characters without it cannot be hurt. Calling again only updates max / bar. */
  setHealth(id: EntityId, maxHp: number, showBar: boolean): void;
  /** Adds health (not above max). Ignored for the dead and for characters without health. */
  heal(id: EntityId, amount: number): void;
  /** Current health, or null when the entity has none. `dead` stays true even after the body is hidden. */
  healthOf(id: EntityId): { hp: number; max: number; dead: boolean } | null;
  /** True for exactly one tick after the character took a hit. */
  wasHurt(id: EntityId): boolean;

  // ---- read-only probes for brain nodes ----

  /** True when the point lies inside a visible solid block (the ground, a wall...). */
  solidAt(point: Vec3): boolean;
  /** Every visible solid block right now. */
  solidBoxes(): readonly SolidBox[];
  /** Changes whenever the set of visible solid blocks changes (one spawns or is hidden); lets callers cache what they derive. */
  solidRevision(): number;
  /** Camera yaw last given to the world (3D stick input is relative to it). */
  cameraYaw(): number;

  // ---- vehicles ----

  /** Stick values for a vehicle this tick (-1..1); applied on the next physics step. Ignored for non-vehicles. */
  setVehicleInput(vehicle: EntityId, moveX: number, moveY: number): void;
  /** Seats the character in the nearest free vehicle within `reach` (gap between their boxes). Null when none is near, it is already seated, or it is dead/hidden. */
  enterVehicle(character: EntityId, reach: number): EntityId | null;
  /** Gets the character out beside its vehicle on a spot free of solid blocks. Returns the vehicle left, or null when it was not seated. */
  exitVehicle(character: EntityId): EntityId | null;

  // ---- play camera, teleport and portals ----

  /**
   * Sets (or, with null, clears) the play-camera request of one camera node. When several are set the one
   * that became active most recently wins. Never touches the edit camera.
   */
  setCamera(owner: string, command: PlayCameraCommand | null): void;
  /**
   * Moves a character, item or vehicle so its center is at `to`, or at the nearest spot clear of solid blocks.
   * Held items travel with their holder; a seated driver moves its vehicle (and stays seated). Returns the final
   * center, or null when nothing moved (unknown / hidden / dead / a block / an item in someone's hand / no free spot).
   */
  teleport(id: EntityId, to: Vec3, keepVelocity: boolean): Vec3 | null;
  /** Declares (each tick, idempotent) a portal entity and who it leads to; see PortalLink. */
  setPortal(id: EntityId, link: PortalLink): void;
  /** The entity that stepped into this portal on the last physics step, else null (one tick). */
  portalUser(id: EntityId): EntityId | null;
}

/** What a camera node asks of the play camera. */
export interface PlayCameraCommand {
  /** 'follow' tracks `target` (else the usual follow subject) shifted by `point`; 'fixed' looks at `point`. */
  mode: 'follow' | 'fixed';
  target: EntityId | null;
  point: Vec3;
  /** Magnification, 1 = default framing. */
  zoom: number;
  /** 0 = instant; larger = slower, softer motion. */
  smoothness: number;
  /** Current shake strength, 0 = still. */
  shake: number;
}

/** A portal entity's link: partner by wire, or any other portal with the same non-empty `pair`. */
export interface PortalLink {
  partner: EntityId | null;
  pair: string;
  enabled: boolean;
  /** Seconds an entity that just came through cannot be sent again. */
  cooldown: number;
}

/** Full world used by the game loop and renderer. */
export interface World extends WorldApi {
  /** Physics step with fixed dt. No-op after endGame. */
  step(dt: number): void;
  entities(): readonly EntityView[];
  hudItems(): readonly HudItem[];
  /** 3D mode: stick input is relative to this camera yaw (radians, 0 = looking toward −Z). */
  setCameraYaw(rad: number): void;
  /** The play-camera request that applies right now (most recently activated camera node), or null. */
  cameraCommand(): PlayCameraCommand | null;
}

export const TICK_DT = 1 / 60;
