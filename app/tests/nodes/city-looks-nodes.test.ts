import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import {
  TICK_DT,
  type Graph,
  type GraphNode,
  type InputSnapshot,
  type Params,
  type PlayCameraCommand,
} from '../../src/engine/types';
import { BLOCK_STYLES, TRAFFIC_COLORS } from '../../src/engine/block-styles';
import { registerAllNodes } from '../../src/nodes';
import { blockNode } from '../../src/nodes/block';
import { cameraNode, viewPitch } from '../../src/nodes/camera';
import { itemNode } from '../../src/nodes/item';
import { CameraRig } from '../../src/render/cameras';
import { createWorld } from '../../src/world/world';
import { makeWorld } from './fake-world';

beforeAll(() => registerAllNodes());

type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

function sim(nodes: NodeSpec[], wires: WireSpec[] = []) {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld('3d');
  const rt = createRuntime(graph, world, '3d');
  const input: InputSnapshot = { keysDown: new Set() };
  return {
    world,
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        rt.tick(input);
        world.step(TICK_DT);
      }
    },
    entity: (index = 0) => world.entities().filter((e) => e.kind !== 'character')[index]!,
  };
}

describe('block look params', () => {
  const defaults = Object.fromEntries(blockNode.params.map((p) => [p.id, p.default]));

  it('defaults keep the plain box and add nothing visible', () => {
    expect(defaults.style).toBe('box');
    expect(defaults.signText).toBe('');
    expect(defaults.color1).toBe(TRAFFIC_COLORS[0]);
    expect(defaults.color2).toBe(TRAFFIC_COLORS[1]);
    expect(defaults.color3).toBe(TRAFFIC_COLORS[2]);
    const w = makeWorld();
    blockNode.create!({ world: w, nodeId: 'n1', dt: TICK_DT } as never, defaults as Params);
    expect(w.spawned[0]?.blockStyle).toBe('box');
    const s = sim([['b', 'block', {}]]);
    expect(s.entity().blockStyle).toBeUndefined();
    expect(s.entity().label).toBeUndefined();
  });

  it('lists every style in the select and rejects unknown values', () => {
    const style = blockNode.params.find((p) => p.id === 'style');
    expect(style?.options?.map((o) => o.value)).toEqual([...BLOCK_STYLES]);
    const s = sim([['b', 'block', { style: 'nonsense' }]]);
    expect(s.entity().blockStyle).toBeUndefined();
  });

  it('passes the style and sign text to the entity', () => {
    const s = sim([['b', 'block', { style: 'sign', signText: '  Cửa hàng A ' }]]);
    expect(s.entity().blockStyle).toBe('sign');
    expect(s.entity().label).toBe('Cửa hàng A');
  });

  it('keeps collision as the plain box whatever the style', () => {
    const s = sim([['b', 'block', { style: 'house', size: { x: 3, y: 3, z: 3 }, position: { x: 0, y: 1.5, z: 0 } }]]);
    expect(s.world.solidBoxes().some((b) => b.size.x === 3)).toBe(true);
  });
});

describe('colour change input', () => {
  it('applies Màu 1/2/3 when the number changes, ignores 0 and out-of-range', () => {
    const s = sim(
      [
        ['light', 'block', { style: 'trafficlight', color: '#ef4444', color2: '#ffff00', color3: '#00ff00' }],
        ['pick', 'const', { value: 2 }],
      ],
      [['pick', 'value', 'light', 'pick']],
    );
    s.step(2);
    expect(s.entity().color).toBe('#ffff00');
  });

  it('switches through the three colours as the number moves', () => {
    const w = makeWorld();
    const params = Object.fromEntries(blockNode.params.map((p) => [p.id, p.default])) as Params;
    const state = blockNode.create!({ world: w, nodeId: 'n1', dt: TICK_DT } as never, params);
    const id = (state as { id: string }).id;
    const color = () => w.entities.get(id)?.color;
    const tick = (pick: number) => blockNode.evaluate({ world: w, nodeId: 'n1', dt: TICK_DT } as never, { pick }, params, state);
    tick(0);
    expect(color()).toBe('#a3a3a3');
    tick(1);
    expect(color()).toBe(TRAFFIC_COLORS[0]);
    tick(3);
    expect(color()).toBe(TRAFFIC_COLORS[2]);
    tick(7);
    expect(color()).toBe(TRAFFIC_COLORS[2]);
    tick(2);
    expect(color()).toBe(TRAFFIC_COLORS[1]);
    tick(2.4);
    expect(color()).toBe(TRAFFIC_COLORS[1]);
  });
});

describe('item tag and new shapes', () => {
  it('stores "Loại hàng" and reads it back with tagOf', () => {
    const s = sim([
      ['i1', 'item', { tag: ' rau ', shape: 'veggie' }],
      ['i2', 'item', { shape: 'ore' }],
    ]);
    const [a, b] = [s.entity(0), s.entity(1)];
    expect(a.shape).toBe('veggie');
    expect(s.world.tagOf(a.id)).toBe('rau');
    expect(b.shape).toBe('ore');
    expect(s.world.tagOf(b.id)).toBe('');
    expect(s.world.tagOf('does-not-exist')).toBe('');
  });

  it('defaults the tag to empty', () => {
    expect(itemNode.params.find((p) => p.id === 'tag')?.default).toBe('');
    expect(itemNode.params.find((p) => p.id === 'shape')?.options?.map((o) => o.value)).toEqual(expect.arrayContaining(['veggie', 'ore']));
  });
});

describe('camera view preset', () => {
  it('maps presets to elevations; free leaves the orbit alone', () => {
    expect(viewPitch('free')).toEqual({});
    expect(viewPitch('unknown')).toEqual({});
    expect(viewPitch('tilted').pitch).toBeCloseTo(1.05, 2);
    expect(viewPitch('top').pitch).toBeGreaterThan(viewPitch('tilted').pitch!);
  });

  it('sends the pitch to the world only for a preset', () => {
    const sent: (PlayCameraCommand | null)[] = [];
    const w = makeWorld();
    w.setCamera = (_o, c) => void sent.push(c);
    const params = Object.fromEntries(cameraNode.params.map((p) => [p.id, p.default])) as Params;
    const state = cameraNode.create!({ world: w, nodeId: 'c', dt: TICK_DT } as never, params);
    const ev = (p: Params) => cameraNode.evaluate({ world: w, nodeId: 'c', dt: TICK_DT } as never, {}, p, state);
    ev(params);
    ev({ ...params, view: 'tilted' });
    expect(sent[0]?.pitch).toBeUndefined();
    expect(sent[1]?.pitch).toBeCloseTo(1.05, 2);
  });

  it('the 3D rig follows the requested elevation', () => {
    const rig = new CameraRig('3d');
    const cmd: PlayCameraCommand = { mode: 'follow', target: null, point: { x: 0, y: 0, z: 0 }, zoom: 1, smoothness: 0, shake: 0, pitch: 1.05 };
    rig.update([], 0.1, true, cmd);
    rig.update([], 0.1, true, cmd);
    expect(rig.pitch).toBeCloseTo(1.05, 1);
    const free = new CameraRig('3d');
    free.update([], 0.1, true, null);
    expect(free.pitch).toBeCloseTo(0.6, 5);
  });
});
