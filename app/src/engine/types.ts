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

export type NodeCategory = 'input' | 'logic' | 'math' | 'object' | 'action' | 'output';

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

export type EntityKind = 'character' | 'block' | 'item';

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
  | 'bucket';
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
];

/** How a character carries an item: balanced above the head, or as a tool in hand. */
export type HoldStyle = 'head' | 'hand';
export const HOLD_STYLES: readonly HoldStyle[] = ['head', 'hand'];

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
  /** Solid entities block movement; non-solid ones (pickups) only produce contacts. */
  solid: boolean;
  /** Items only: look of the item. Omitted = 'box'. */
  shape?: ItemShape;
  /** Items only: false = can be touched and used, but never picked up. Omitted = true. */
  carryable?: boolean;
  /** Items only: which slot picks it up. Omitted = 'head'. */
  holdStyle?: HoldStyle;
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
  /** Items only. */
  shape?: ItemShape;
  /** Items only; present as 'hand' for tools. */
  holdStyle?: HoldStyle;
  /** Items only; true while the item is in a character's hand (the renderer draws it on the figure). */
  inHand?: boolean;
  /** Characters only; the tool currently in hand. */
  tool?: { shape: ItemShape; color: string };
  /** Characters only; 0..1 progress of a swing in progress, absent otherwise. */
  swing?: number;
  visible: boolean;
}

export type HudCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface HudItem {
  key: string;
  label: string;
  value: number;
  corner: HudCorner;
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
}

/** Full world used by the game loop and renderer. */
export interface World extends WorldApi {
  /** Physics step with fixed dt. No-op after endGame. */
  step(dt: number): void;
  entities(): readonly EntityView[];
  hudItems(): readonly HudItem[];
  /** 3D mode: stick input is relative to this camera yaw (radians, 0 = looking toward −Z). */
  setCameraYaw(rad: number): void;
}

export const TICK_DT = 1 / 60;
