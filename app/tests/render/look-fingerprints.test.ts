import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BlockStyle } from '../../src/engine/block-styles';
import { AGV_LOOK } from '../../src/engine/factory-looks';
import type { EntityView } from '../../src/engine/types';
import { buildBlockLook } from '../../src/render/block-looks';
import { SceneView } from '../../src/render/scene-view';

/**
 * The looks that existed before the warehouse looks were added, held to the exact shapes they had then: for every mesh
 * its vertex count, the sum of its vertex positions (in the place it is drawn) and its colour. A new look must never
 * move a vertex of an old one. The numbers were taken from the code as it was before the warehouse looks.
 */
function fingerprint(root: THREE.Object3D): string {
  root.updateMatrixWorld(true);
  const rows: string[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    let sum = 0;
    for (let i = 0; i < (pos?.count ?? 0); i++) {
      v.fromBufferAttribute(pos!, i).applyMatrix4(m.matrixWorld);
      sum += Math.abs(v.x) + 2 * Math.abs(v.y) + 3 * Math.abs(v.z);
    }
    const col = m.geometry.getAttribute('color');
    let tint = 0;
    for (let i = 0; i < (col?.count ?? 0); i++) tint += col!.getX(i) + 2 * col!.getY(i) + 3 * col!.getZ(i);
    const mat = m.material as THREE.MeshBasicMaterial;
    rows.push(`${pos?.count ?? 0}:${sum.toFixed(2)}:${tint.toFixed(1)}:${mat.color ? mat.color.getHexString() : '-'}:${m.visible ? 1 : 0}`);
  });
  return rows.sort().join(' ');
}

const BLOCKS: [BlockStyle, { x: number; y: number; z: number }, string, string][] = [
  ['sign', { x: 2, y: 1, z: 0.2 }, '#a3a3a3', ''],
  ['conveyor', { x: 4, y: 0.5, z: 1 }, '#a3a3a3', ''],
  ['rail', { x: 4, y: 0.3, z: 1 }, '#a3a3a3', ''],
  ['belt-frame', { x: 2.4, y: 0.5, z: 0.6 }, '#a3a3a3', ''],
  ['belt-frame', { x: 0.6, y: 0.5, z: 4 }, '#22c55e', ''],
  ['scan-gate', { x: 0.14, y: 1.17, z: 0.79 }, '#a3a3a3', ''],
  ['scan-gate', { x: 0.14, y: 0.72, z: 0.79 }, '#45e07a', ''],
  ['chute', { x: 0.94, y: 0.75, z: 0.94 }, '#a3a3a3', '1'],
  ['chute', { x: 0.94, y: 0.75, z: 0.94 }, '#ef4444', ''],
  ['arm-base', { x: 0.48, y: 0.3, z: 0.48 }, '#a3a3a3', ''],
  ['code-display', { x: 0.22, y: 0.18, z: 0.22 }, '#a3a3a3', '7'],
];

const BEFORE: Record<string, string> = {
  'sign 2x1x0.2 #a3a3a3 ""':
    '36:55.08:216.0:a3a3a3:1 72:89.57:38.2:ffffff:1',
  'conveyor 4x0.5x1 #a3a3a3 ""':
    '108:406.08:604.8:a3a3a3:1 276:943.80:571.1:ffffff:1',
  'rail 4x0.3x1 #a3a3a3 ""':
    '324:868.36:292.8:ffffff:1 36:133.56:129.6:a3a3a3:1',
  'belt-frame 2.4x0.5x0.6 #a3a3a3 ""':
    '3636:7966.79:4674.6:ffffff:1 4:9.68:0.0:2f333b:1',
  'belt-frame 0.6x0.5x4 #22c55e ""':
    '4932:23243.66:5256.5:ffffff:1 4:26.64:0.0:2f333b:1',
  'scan-gate 0.14x1.17x0.79 #a3a3a3 ""':
    '1296:2549.19:2091.8:ffffff:1 180:224.58:1080.0:2b6f86:1',
  'scan-gate 0.14x0.72x0.79 #45e07a ""':
    '1296:1965.99:2091.8:ffffff:1 180:143.58:1080.0:45e07a:1',
  'chute 0.94x0.75x0.94 #a3a3a3 "1"':
    '2436:5918.51:3979.4:ffffff:1 384:409.54:1104.5:ffffff:1',
  'chute 0.94x0.75x0.94 #ef4444 ""':
    '2436:5918.51:3418.1:ffffff:1 384:409.54:442.1:ffffff:1',
  'arm-base 0.48x0.3x0.48 #a3a3a3 ""':
    '1056:656.82:1222.6:ffffff:1',
  'code-display 0.22x0.18x0.22 #a3a3a3 "7"':
    '324:178.40:40.9:ffffff:1',
  'robot classic':
    '112:637.46:0.0:23252b:1 112:745.15:0.0:23252b:1 112:859.14:0.0:23252b:1 112:966.82:0.0:23252b:1 24:136.79:0.0:23252b:1 24:159.87:0.0:23252b:1 24:174.36:0.0:4a4f58:1 24:184.29:0.0:23252b:1 24:194.52:0.0:ffd23f:1 24:207.37:0.0:23252b:1 324:2602.13:0.0:23252b:1 76:432.68:0.0:ffd23f:1 76:505.75:0.0:ffd23f:1 76:583.10:0.0:ffd23f:1 76:656.18:0.0:ffd23f:1 900:6465.60:0.0:ff9f2e:1',
  'robot agv':
    '336:2522.30:1355.0:ffffff:1 3372:24946.22:3372.3:ffffff:1 360:2051.87:783.4:ffffff:1 360:2397.99:783.4:ffffff:1 360:2764.41:783.4:ffffff:1 360:3110.53:783.4:ffffff:1 660:4817.36:3960.0:39c6ff:1',
  'robot agv green':
    '336:2522.30:1355.0:ffffff:1 3372:24946.22:2764.6:ffffff:1 360:2051.87:761.3:ffffff:1 360:2397.99:761.3:ffffff:1 360:2764.41:761.3:ffffff:1 360:3110.53:761.3:ffffff:1 660:4817.36:3960.0:39c6ff:1',
};

function all(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [style, size, color, label] of BLOCKS) {
    const fig = buildBlockLook(style, color, size, label, 'n');
    fig.object.scale.set(size.x, size.y, size.z);
    fig.update?.({ id: 'e', kind: 'block', ownerNodeId: 'n', position: { x: 0, y: 0, z: 0 }, size, color, visible: true, blockStyle: style });
    out[`${style} ${size.x}x${size.y}x${size.z} ${color} "${label}"`] = fingerprint(fig.object);
  }
  const robot = (look: string | undefined, color: string): EntityView => ({
    id: 'r',
    kind: 'robot',
    ownerNodeId: 'body',
    position: { x: 1, y: 0.12, z: 2 },
    size: { x: 0.9, y: 0.24, z: 0.9 },
    color,
    ...(look ? { look } : {}),
    visible: true,
    robot: { length: 0.9, width: 0.7, speed: 0, heading: 0.3, turnRate: 0, wheels: [1, -1].flatMap((f) => [1, -1].map((s) => ({ forward: f * 0.261, side: s * 0.385, radius: 0.085, spin: 0.5 }))) },
  }) as EntityView;
  for (const [name, view] of [['robot classic', robot(undefined, '#3b82f6')], ['robot agv', robot(AGV_LOOK, '#3b82f6')], ['robot agv green', robot(AGV_LOOK, '#22c55e')]] as const) {
    const scene = new SceneView();
    scene.setMode('3d');
    scene.sync([view]);
    const figure = scene.scene.getObjectsByProperty('type', 'Group').find((g) => g.userData.ownerNodeId === 'body');
    out[name] = figure ? fingerprint(figure) : 'missing';
    scene.dispose();
  }
  return out;
}

describe('the looks that were there before the warehouse looks', () => {
  it('are built vertex for vertex as they were', () => {
    const now = all();
    expect(Object.keys(now)).toHaveLength(BLOCKS.length + 3);
    expect(now).toEqual(BEFORE);
  });
});
