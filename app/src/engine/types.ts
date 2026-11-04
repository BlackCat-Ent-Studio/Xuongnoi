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
  /** Small standard English term shown next to the label (tooltip on cards). Optional. */
  labelEn?: string;
  /** Value used when the input port has no wire. Falls back to PORT_DEFAULTS[type]. */
  default?: PortValue;
  /** Input only: the node does nothing useful until this port is wired. The editor flags it when empty. */
  required?: boolean;
  /** Input only: kept so saved boards still work, but one input does two actions. New boards use the dedicated inputs. */
  legacy?: boolean;
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
  /** Fine-tuning setting: shown folded under "Nâng cao" in the properties panel. */
  advanced?: boolean;
}

/** Keyboard state for one tick. Keys are KeyboardEvent.code values, e.g. 'KeyW', 'ArrowLeft', 'Space'. */
export interface InputSnapshot {
  keysDown: ReadonlySet<string>;
  /** On-screen clicks and taps for this tick. Absent = none (older callers and headless sims never set it). */
  ui?: UiInput;
}

/**
 * Pointer events that reached the game for one tick. Widget keys are the graph node id of the UI node that drew
 * the widget; a dialog answer is `${nodeId}#${answerIndex}`.
 */
export interface UiInput {
  /** Widgets clicked since the previous tick (a one-tick pulse). */
  clicked: ReadonlySet<string>;
  /** Widgets whose button is held down right now. */
  held: ReadonlySet<string>;
  /** Entities under the pointer when the game view was clicked since the previous tick. */
  picked: ReadonlySet<EntityId>;
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
  /** Small standard English term shown under the Vietnamese name on cards, palette and handbook. */
  labelEn?: string;
  category: NodeCategory;
  /** Short Vietnamese help text for the palette tooltip. */
  description: string;
  inputs: PortDef[];
  /**
   * Inputs that exist only while a setting is on. `all` lists every id a saved wire may name (so a board saved with the
   * setting on still loads after it is switched off); `active(params)` is what the card shows and the node reads.
   * Absent = the node has just `inputs`.
   */
  optionalInputs?: { all: PortDef[]; active(params: Params): PortDef[] };
  /** Same idea for outputs: shown only while a setting is on. `evaluate` may always return them; only the active ones are read. */
  optionalOutputs?: { all: PortDef[]; active(params: Params): PortDef[] };
  outputs: PortDef[];
  params: ParamDef[];
  /** Modes where this node appears in the palette. Omit = all modes. */
  modes?: ViewMode[];
  /** Called once when a run starts (before tick 0). Object nodes spawn entities here. */
  create?(ctx: EvalCtx, params: Params): S;
  /** Called every tick in topological order. Must return a value for every output port. */
  evaluate(ctx: EvalCtx, inputs: PortValues, params: Params, state: S): PortValues;
  /**
   * Params that are only read inside create() (spawn position, size, ...). Changing one of these
   * while the game runs has no effect unless `liveApply` has a handler for it; otherwise it is rejected.
   * Params not listed here are re-read by evaluate() every tick, so they apply live automatically.
   */
  createOnly?: string[];
  /**
   * Handlers that push a changed create-only param into the running state / world.
   * `params` already holds the new value; `prev` is the old one.
   */
  liveApply?: Record<string, (ctx: EvalCtx, params: Params, state: S, prev: ParamValue) => void>;
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

/**
 * Editor-only grouping of nodes ("Nhóm mảnh ghép"). The engine ignores it: nodes and wires stay flat.
 * A node is in at most one group and groups never nest.
 */
export interface NodeGroup {
  id: string;
  name: string;
  /** `#rrggbb` accent, absent for the default. */
  color?: string;
  nodeIds: string[];
  /** Position of the collapsed block on the main board. */
  x: number;
  y: number;
}

/** Per-game switches saved with the board. A missing field (or a missing `settings`) means the old behaviour. */
export interface GraphSettings {
  /** "Va chạm thật": characters and loose items are solid bodies (see world/world-options.ts). Only ever stored as `true`. */
  solidBodies?: boolean;
  /**
   * Set once a board follows "every action needs its own wire" (inputs such as "Cho đi" are off until wired).
   * A board without it is an older one: loading it wires a "Khi bắt đầu" card into those inputs. Only ever stored as `true`.
   */
  wireRule?: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  wires: Wire[];
  /** Optional groups (absent in older files and whenever there are none). */
  groups?: NodeGroup[];
  /** Optional game settings (absent in older files and whenever every switch is off). */
  settings?: GraphSettings;
}

/** A saved board = one game. */
export type NoteColor = 'yellow' | 'green' | 'blue' | 'pink';

/** Sticky note on the wiring canvas. Editor-only: never affects the game. */
export interface Note {
  id: string;
  text: string;
  color: NoteColor;
  pos: { x: number; y: number };
  size: { w: number; h: number };
}

export interface Board {
  name: string;
  mode: ViewMode;
  graph: Graph;
  /** Optional sticky notes (absent in older files). */
  notes?: Note[];
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
  /**
   * Bool outputs (`${node}|${port}`) that went false -> true on any tick since the last call, even if they
   * fell back before it. Lets the editor show one-tick pulses. Clears on read.
   */
  takeRisen?(): ReadonlySet<string>;
  /** Bool outputs (`${node}|${port}`) that went false -> true during the most recent tick only. Does not clear anything. */
  lastTickRisen?(): ReadonlySet<string>;
  /**
   * Changes params of a running node. Applies every key it can; returns true only when all
   * of them took effect in the running game (false = unknown node / param, or needs a restart).
   */
  applyNodeParams(nodeId: string, params: Params): boolean;
}

// ---------- world API (implemented in src/world) ----------

export type EntityKind = 'character' | 'block' | 'item' | 'vehicle';

/** Optional cargo tuning a cargo node passes on: items per layer on the bed (1, 2, 4 or 6) and the gap left when unloading. */
export interface CargoLayout {
  cellsPerLayer?: number;
  unloadGap?: number;
}

/** Look and size class of a vehicle (built from boxes by the renderer). */
export type VehicleModel = 'car' | 'bike' | 'truck' | 'locomotive' | 'wagon';
export const VEHICLE_MODELS: readonly VehicleModel[] = ['car', 'bike', 'truck', 'locomotive', 'wagon'];

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
  /** false = passes through other vehicles. Omitted = true. */
  collide?: boolean;
  /** Braking strength as a multiple of `accel`. Omitted = 2. */
  brakeFactor?: number;
  /** Top reverse speed as a share of `maxSpeed` (throttle steering). Omitted = 0.4. */
  reverseShare?: number;
  /** Closing speed (units/s) above which a touch with another vehicle counts as a crash. Omitted = 1.5. */
  crashSpeed?: number;
  /** Share of the closing speed passed on to the vehicle that was hit. Omitted = 0.25. */
  shoveShare?: number;
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
  | 'lock'
  | 'veggie'
  | 'ore';
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
  'veggie',
  'ore',
];

/** How a character carries an item: balanced above the head, or as a tool in hand. */
export type HoldStyle = 'head' | 'hand';
export const HOLD_STYLES: readonly HoldStyle[] = ['head', 'hand'];

/** Who steers a character: the person playing (camera follows it) or a bot driven by brain nodes. */
export type CharacterRole = 'player' | 'bot';

/** Per-character hit reaction (see EntitySpec.hitReaction). */
export interface HitReaction {
  /** Seconds a character cannot be hurt again after a hit. */
  invulnSeconds?: number;
  /** Horizontal speed of the knockback push. */
  knockSpeed?: number;
  /** Upward hop of the knockback (ignored in the top-down view). */
  knockLift?: number;
}

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
  /** Characters only: hit-reaction tuning; each omitted field keeps the built-in value. */
  hitReaction?: HitReaction;
  /** Vehicles only (kind 'vehicle'). */
  vehicle?: VehicleSpec;
  /** Blocks only: a zone marker, drawn translucent so the area can be seen while editing. */
  zone?: boolean;
  /** Blocks only: how the block is drawn (a BlockStyle id). Omitted = plain box. Collision is unaffected. */
  blockStyle?: string;
  /** Blocks only: text shown on a sign-style block. */
  label?: string;
  /** Blocks only: makes the block a conveyor belt whose surface travels along `axis`; `walls` adds thin solid side walls. */
  belt?: { axis: 'x' | 'z'; walls: boolean };
  /** Items only: free-text goods type ("Loại hàng"); read back with WorldApi.tagOf. */
  tag?: string;
  /** True = the entity is dropped from the world for good once hidden (shots, spawner copies). */
  disposable?: boolean;

  // ---- collision and body tuning (all optional; omitted = the plain visual box and normal physics) ----
  /** Size of the collision box; an axis of 0 (or omitted) uses the same axis of `size`. */
  colliderSize?: Vec3;
  /** Collision box center relative to `position`. */
  colliderOffset?: Vec3;
  /** Multiplier on gravity: 1 / omitted = normal, 0 = floats, 2 = twice as heavy. */
  gravityScale?: number;
  /** Items only: how fast a sliding item loses speed on the ground (units/s of speed lost per unit of speed). Omitted = 10. */
  friction?: number;
  /** Items only: 0..1 share of the fall speed given back on landing. Omitted / 0 = no bounce. */
  bounce?: number;
}

/** How a shot leaves a shooter. */
export interface ShotSpec {
  ownerNodeId: string;
  /** Units per second. */
  speed: number;
  /** Seconds before the shot fades. */
  lifetime: number;
  damage: number;
  /** Edge length of the shot. */
  size: number;
  color: string;
  /** True = the shot arcs downward (ignored in the top-down view). */
  gravity: boolean;
  /** Aim at this entity instead of the shooter's facing. */
  aimAt?: EntityId | null;
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
  /** Blocks only; present when the block is drawn in a style other than the plain box. */
  blockStyle?: string;
  /** Blocks only; sign text, present when non-empty. */
  label?: string;
  /** Blocks only; conveyor surface: travel axis, signed speed (units/s) and signed distance travelled so far (for the scrolling stripes). */
  belt?: { axis: 'x' | 'z'; speed: number; phase: number };
  /** Items only; present as 'hand' for tools. */
  holdStyle?: HoldStyle;
  /** Items only; true while the item is in a character's hand (the renderer draws it on the figure). */
  inHand?: boolean;
  /** Items only; true while a character carries it, in worlds with solid bodies (puzzle 3D levels). Stores do not count it. */
  carried?: boolean;
  /** Characters only; the tool currently in hand. */
  tool?: { shape: ItemShape; color: string };
  /** Characters only; height of the item carried above the head (side and 3D views), absent when nothing rides there. */
  carriedHeight?: number;
  /** Characters only; unit direction on the ground plane the figure is facing. */
  facing?: { x: number; z: number };
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
  vehicle?: {
    model: VehicleModel;
    speed: number;
    wheelSpin: number;
    heading: number;
    driver: EntityId | null;
    /** Counts crashes with other vehicles (rises by one per crash). */
    hitSeq?: number;
    /** The vehicle hit in the latest crash. */
    hitWith?: EntityId | null;
    steerMode?: SteerMode;
  };
  /** Characters only; the vehicle this character is sitting in. */
  seatedIn?: EntityId;
  /** Blocks only; true for a zone marker (drawn translucent). */
  zone?: boolean;
  /**
   * Blocks only: extra turn in radians for the renderer (about Z in the side view, about the vertical axis elsewhere).
   * Solid blocks: how far the picture still lags behind the snapped quarter turn. Non-solid blocks: the full spin angle.
   */
  angle?: number;
  /** Collision box (center and full size), present only when it differs from `position` / `size`. */
  collider?: { position: Vec3; size: Vec3 };
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

/** An interactive or graphical widget drawn by the HUD instead of a plain text line. */
export type HudWidget =
  | { type: 'button'; text: string }
  /** `fraction` is 0..1. The row shows `label` and `value` next to the bar. */
  | { type: 'bar'; fraction: number }
  | { type: 'dialog'; question: string; answers: string[] }
  | { type: 'start'; title: string; buttonText: string; pauseMenu: boolean };

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
  /** Set = drawn as this widget (button, bar, dialog, start screen) rather than as text. */
  widget?: HudWidget;
  /** With `anchor`: draw an arrow floating above the anchor pointing to `to`, with `value` as the distance label. */
  guide?: HudGuide;
}

/** A direction arrow: from the item's `anchor` towards `to`. */
export interface HudGuide {
  to: EntityId;
  showDistance: boolean;
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
  /** Brings a hidden block or item back where it was (no effect on shots, copies that were dropped, or dead bodies). Anything standing there is not moved away. */
  show(id: EntityId): void;
  getEntity(id: EntityId): EntityView | undefined;
  /** Repaints a living entity: colour (any entity) and look (characters only). Unknown ids are ignored. */
  setEntityStyle(id: EntityId, style: { color?: string; look?: string }): void;
  /** Free-text goods type of an item ("Loại hàng"); '' when unset or the id is unknown. */
  tagOf(id: EntityId): string;
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
  /** Puts the held item down in front of the character (`distance` = center-to-center offset; omitted = just clear of the body). Returns the item, or null when nothing was held. */
  drop(character: EntityId, distance?: number): EntityId | null;
  /** Releases the held item with a forward-and-up velocity. Returns the item, or null when nothing was held. */
  throwHeld(character: EntityId, power: number, lift?: number): EntityId | null;
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
  setVehicleInput(vehicle: EntityId, moveX: number, moveY: number, stop?: boolean): void;
  /**
   * Puts a vehicle exactly on `pose` (ground-plane center, nose direction in radians, signed speed in units/s) on the
   * next physics step, instead of driving it by sticks; walls still block it. Valid for that one step only, so a node
   * repeats it every tick. A vehicle more than a few units away is moved straight onto the pose. Ignored for non-vehicles.
   */
  setVehicleTrack(vehicle: EntityId, pose: { x: number; z: number; heading: number; speed: number }): void;
  /**
   * Couples `vehicle` behind `leader` (null = uncouple; idempotent, repeated each tick): it then ignores its own sticks
   * and follows the trail the leader travelled, `distance` units center to center (0 = from both lengths plus a small gap).
   * Coupled vehicles never collide with each other. A vehicle whose leader is gone or hidden stops.
   */
  setVehicleTow(vehicle: EntityId, leader: EntityId | null, distance?: number): void;
  /**
   * The nearest visible solid block, vehicle or character in front of the entity (along its facing, as wide as the entity)
   * whose gap to the entity is at most `reach`. Items, zones and riders are ignored. Null when the way is clear.
   */
  probeAhead(id: EntityId, reach: number): { id: EntityId; distance: number } | null;
  /**
   * True when no visible solid block crosses the straight line between the centres of the two entities (their own
   * bodies never block). False when either one is unknown or hidden. Flat views ignore the axis they do not show.
   */
  lineOfSight(fromId: EntityId, toId: EntityId): boolean;
  /** Seats the character in the nearest free vehicle within `reach` (gap between their boxes). Null when none is near, it is already seated, or it is dead/hidden. */
  enterVehicle(character: EntityId, reach: number): EntityId | null;
  /** Gets the character out beside its vehicle on a spot free of solid blocks. Returns the vehicle left, or null when it was not seated. */
  exitVehicle(character: EntityId): EntityId | null;
  /**
   * Loads the nearest free carryable item within `reach` of the vehicle's edge onto its bed, unless it already
   * carries `capacity` items. Loaded items follow the vehicle and cannot be grabbed. Returns the item or null.
   */
  loadCargo(vehicle: EntityId, reach: number, capacity: number, tag?: string, layout?: CargoLayout): EntityId | null;
  /** Puts the most recently loaded item (of goods type `tag` when given and non-empty) down beside the vehicle (clear of solids). Null when none or no room. */
  unloadCargo(vehicle: EntityId, tag?: string, layout?: CargoLayout): EntityId | null;
  /** Items riding on the vehicle, oldest first. */
  cargoOf(vehicle: EntityId): readonly EntityId[];

  // ---- sensors and randomness ----

  /** Snapshot of every entity (including hidden ones; check `visible`). */
  listEntities(): readonly EntityView[];
  /** Seed picked once per run; nodes with seed 0 derive their random sequence from it. */
  runSeed(): number;
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
  // ---- moving objects: platforms, turning blocks, shots ----

  /**
   * Moves a block to `to` right away (axes the view mode does not have are ignored). Characters, items and vehicles standing on a
   * solid block ride along; others in the way are pushed. If that would squeeze anything into another solid, the block stays put
   * on that axis and false is returned. The first call makes the block a mover: it leaves the static list given by `solidBoxes`.
   */
  moveBlock(id: EntityId, to: Vec3): boolean;
  /**
   * Turns a block to `rad`. Solid blocks only take quarter turns (nearest multiple of 90 degrees; width and depth swap so collision
   * stays exact) and wait (false) while whoever is in the way has no free spot to be moved to. Non-solid blocks spin freely and
   * touch through their real rotated outline.
   */
  setBlockAngle(id: EntityId, rad: number): boolean;
  /** Sets the live signed surface speed (units/s along the belt axis) of a conveyor block; ignored for other entities. 0 = stopped. */
  setBeltSpeed(id: EntityId, speed: number): void;
  /** Fires a shot from the shooter along its facing (or at `spec.aimAt`). Returns the shot, or null when it cannot fire. */
  shoot(shooter: EntityId, spec: ShotSpec): EntityId | null;
  /** Characters this shooter's shots hit during the last physics step (a one-tick pulse). */
  shotHits(shooter: EntityId): readonly EntityId[];
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
  /** 3D only: fixed camera elevation in radians (0 = horizontal, ~1.5 = straight down). Omitted = the player's own orbit. */
  pitch?: number;
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
  /** Collision-level snapshot of every body for the physics checks (tests and the dev watcher); not used by the game. */
  debugBodies?(): readonly BodySnapshot[];
}

/** What the physics checks need to know about one body: its real collision box and whether it is being carried. */
export interface BodySnapshot {
  id: EntityId;
  kind: EntityKind;
  /** Level object name: the owner node's id. */
  owner: string;
  visible: boolean;
  /** Blocks: blocks movement. */
  solid: boolean;
  /** Blocks: a sensor marker, never an obstacle. */
  zone: boolean;
  /** The box that blocks others (position = centre). */
  box: { pos: Vec3; size: Vec3 };
  /** Entity position and base size (the box above may be bigger or offset). */
  pos: Vec3;
  size: Vec3;
  /** Items: riding above the head / in front of a character, or in a hand. */
  carried: boolean;
  /** Items: who carries it (character, or vehicle for loaded cargo). */
  holder: EntityId | null;
  /** A character sitting in a vehicle. */
  seated: boolean;
  /** Spawn tag of an item (goods type), else empty. */
  tag: string;
}

export const TICK_DT = 1 / 60;
