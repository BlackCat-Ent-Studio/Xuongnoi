import { getNodeDef, registerNode } from '../engine/registry';
import type { NodeCategory, NodeDef } from '../engine/types';
import { andNode, notNode, orNode } from './bool-gates';
import { blockNode } from './block';
import { characterNode } from './character';
import { chaseNode } from './chase';
import { compareNode } from './compare';
import { carryNode } from './carry';
import { constNode } from './const';
import { counterNode } from './counter';
import { fightNode } from './fight';
import { goToNode } from './go-to';
import { handToolNode } from './hand-tool';
import { healthNode } from './health';
import { interactNode } from './interact';
import { itemNode } from './item';
import { keyNode } from './key';
import { mathNode } from './math';
import { onStartNode } from './on-start';
import { patrolNode } from './patrol';
import { routeFollowNode } from './route-follow';
import { selectNumberNode } from './select-number';
import { sequenceNode } from './sequence';
import { showNumberNode } from './show-number';
import { showTextNode } from './show-text';
import { guideArrowNode } from './guide-arrow';
import { stickNode } from './stick';
import { timerNode } from './timer';
import { touchNode } from './touch';
import { winLoseNode } from './win-lose';
import { enterExitNode } from './enter-exit';
import { vehicleNode } from './vehicle';
import { randomNode } from './random';
import { latchNode } from './latch';
import { nextFreeSlotNode } from './next-free-slot';
import { nearestItemNode } from './nearest-item';
import { mapRangeNode } from './map-range';
import { zoneSensorNode } from './zone-sensor';
import { cargoNode } from './cargo';
import { distanceNode } from './distance';
import { forceSensorNode } from './force-sensor';
import { boolToNumberNode } from './bool-to-number';
import { valueTableNode } from './value-table';
import { angleDiffNode } from './angle-diff';
import { sampleHoldNode } from './sample-hold';
import { dispatcherNode } from './dispatcher';
import { gripperNode } from './gripper';
import { jointNode } from './joint';
import { linkNode } from './link';
import { linearActuatorNode } from './linear-actuator';
import { speedSensorNode } from './speed-sensor';
import { aheadSensorNode } from './ahead-sensor';
import { visionSensorNode } from './vision-sensor';
import { sightForecastNode } from './sight-forecast';
import { colorSensorNode } from './color-sensor';
import { cameraNode } from './camera';
import { teleportNode } from './teleport';
import { portalNode } from './portal';
import { movingPlatformNode } from './moving-platform';
import { rotatingPlatformNode } from './rotating-platform';
import { shooterNode } from './shooter';
import { spawnerNode } from './spawner';
import { uiButtonNode } from './ui-button';
import { uiDialogNode } from './ui-dialog';
import { uiMeterNode } from './ui-meter';
import { uiPickNode } from './ui-pick';
import { uiStartNode } from './ui-start';
import { robotBodyNode } from './robot-body';
import { motorNode } from './motor';
import { lineSensorNode } from './line-sensor';
import { lineTrackNode } from './line-track';
import { pidNode } from './pid';
import { signalPlotNode } from './signal-plot';
import { applyNodeNames } from './node-names';

export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Đầu vào',
  logic: 'Logic',
  math: 'Tính toán',
  object: 'Vật thể',
  action: 'Hành động',
  brain: 'Bộ não',
  output: 'Kết quả',
};

// Per-node state types differ; they are erased at the registry boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STEP_1_NODES: NodeDef<any>[] = [
  keyNode,
  stickNode,
  onStartNode,
  andNode,
  orNode,
  notNode,
  constNode,
  mathNode,
  compareNode,
  counterNode,
  timerNode,
  characterNode,
  blockNode,
  touchNode,
  winLoseNode,
  showNumberNode,
  showTextNode,
  guideArrowNode,
  itemNode,
  carryNode,
  interactNode,
  handToolNode,
  patrolNode,
  goToNode,
  routeFollowNode,
  chaseNode,
  sequenceNode,
  selectNumberNode,
  healthNode,
  fightNode,
  vehicleNode,
  enterExitNode,
  cargoNode,
  randomNode,
  latchNode,
  mapRangeNode,
  zoneSensorNode,
  distanceNode,
  speedSensorNode,
  forceSensorNode,
  aheadSensorNode,
  visionSensorNode,
  sightForecastNode,
  colorSensorNode,
  nextFreeSlotNode,
  nearestItemNode,
  cameraNode,
  teleportNode,
  portalNode,
  movingPlatformNode,
  rotatingPlatformNode,
  jointNode,
  linkNode,
  gripperNode,
  linearActuatorNode,
  shooterNode,
  spawnerNode,
  uiButtonNode,
  uiPickNode,
  uiMeterNode,
  uiDialogNode,
  uiStartNode,
  robotBodyNode,
  motorNode,
  lineTrackNode,
  lineSensorNode,
  pidNode,
  signalPlotNode,
  boolToNumberNode,
  valueTableNode,
  angleDiffNode,
  sampleHoldNode,
  dispatcherNode,
];

// Approved display names (Vietnamese label + English term); ids stay as defined in each node file.
for (const def of STEP_1_NODES) applyNodeNames(def);

/** Registers all step-1 nodes. Safe to call repeatedly. */
export function registerAllNodes(): void {
  for (const def of STEP_1_NODES) {
    if (!getNodeDef(def.kind)) registerNode(def);
  }
}
