import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView, ViewMode } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { createRuntime } from '../../src/engine/runtime';
import { listSamples, parseBoard, serializeBoard } from '../../src/io';
import { CHARACTER_STYLES, resolveLook } from '../../src/render/character-styles';
import { jellySize } from '../../src/render/character-styles/jelly';
import { Humanoid } from '../../src/render/humanoid-model';
import { SceneView } from '../../src/render/scene-view';

const LOOKS = Object.keys(CHARACTER_STYLES);
const EPS = 1e-6;

function view(over: Partial<EntityView> = {}): EntityView {
  return {
    id: 'c1',
    kind: 'character',
    ownerNodeId: 'n1',
    position: { x: 0, y: 0.5, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    color: '#ff8800',
    visible: true,
    ...over,
  };
}

/** Lowest/highest y and the widest horizontal reach (from the entity center) over every box corner. */
function extent(h: Humanoid, cx: number, cz: number) {
  h.object.updateMatrixWorld(true);
  let minY = Infinity;
  let maxY = -Infinity;
  let reach = 0;
  const v = new THREE.Vector3();
  h.object.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5).applyMatrix4(o.matrixWorld);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      reach = Math.max(reach, Math.hypot(v.x - cx, v.z - cz));
    }
  });
  return { minY, maxY, reach };
}

describe('character styles', () => {
  it('offers the six looks the character node lists, and falls back to human for unknown ids', () => {
    registerAllNodes();
    const opts = getNodeDef('character')!.params.find((p) => p.id === 'look')!.options!.map((o) => o.value);
    expect([...opts].sort()).toEqual([...LOOKS].sort());
    expect(LOOKS).toHaveLength(6);
    expect(resolveLook(undefined)).toBe('human');
    expect(resolveLook('does-not-exist')).toBe('human');
    expect(resolveLook('toString')).toBe('human');
    expect(resolveLook('cat')).toBe('cat');
  });

  for (const look of LOOKS) {
    describe(look, () => {
      it('rests with its base exactly on the box floor and inside the box', () => {
        const h = new Humanoid('#3366ff', '2d-side', look);
        h.update(view({ position: { x: 4, y: 3, z: 1 }, size: { x: 1, y: 1.6, z: 1 } }), 0);
        const e = extent(h, 4, 1);
        expect(e.minY).toBeCloseTo(3 - 0.8, 4);
        expect(e.maxY).toBeLessThanOrEqual(3 + 0.8 + EPS);
        expect(e.reach).toBeLessThanOrEqual(0.5 + EPS);
        h.dispose();
      });

      for (const mode of ['2d-side', '3d'] as ViewMode[]) {
        it(`stays inside the box at any yaw while idle, running both ways and jumping (${mode})`, () => {
          const h = new Humanoid('#3366ff', mode, look);
          const size = { x: 1.2, y: 1.6, z: 0.9 };
          const half = 0.5 * Math.min(size.x, size.z);
          let x = 0;
          let y = 0.8;
          let z = 0;
          let step = 0;
          const frame = (dx: number, dy: number, dz: number): void => {
            x += dx;
            y += dy;
            z += dz;
            h.update(view({ position: { x, y, z }, size }), 1 / 60);
            const e = extent(h, x, z);
            const label = `${look} ${mode} frame ${step++}`;
            expect(e.minY, label).toBeGreaterThanOrEqual(y - 0.8 - EPS);
            expect(e.maxY, label).toBeLessThanOrEqual(y + 0.8 + EPS);
            expect(e.reach, label).toBeLessThanOrEqual(half + EPS);
          };
          for (let i = 0; i < 40; i++) frame(0, 0, 0);
          for (let i = 0; i < 120; i++) frame(0.09, 0, 0);
          for (let i = 0; i < 60; i++) frame(-0.09, 0, 0);
          for (let i = 0; i < 60; i++) frame(0, 0, -0.09);
          for (let i = 0; i < 30; i++) frame(0.05, 0.12, 0);
          for (let i = 0; i < 30; i++) frame(0.05, -0.12, 0);
          for (let i = 0; i < 40; i++) frame(0, 0, 0);
          h.dispose();
        });
      }

      it('keeps the base on the floor when standing still after walking', () => {
        const h = new Humanoid('#3366ff', '2d-side', look);
        let x = 0;
        for (let i = 0; i < 90; i++) {
          x += 0.08;
          h.update(view({ position: { x, y: 0.5, z: 0 } }), 1 / 60);
        }
        for (let i = 0; i < 240; i++) h.update(view({ position: { x, y: 0.5, z: 0 } }), 1 / 60);
        expect(extent(h, x, 0).minY).toBeCloseTo(0, 2);
        h.dispose();
      });

      it('tags every mesh with the owner node and recolors the main material', () => {
        const h = new Humanoid('#3366ff', '3d', look);
        h.update(view({ ownerNodeId: 'node-7', color: '#00ff00' }), 0);
        let meshes = 0;
        let recolored = 0;
        h.object.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          meshes++;
          expect(o.userData.ownerNodeId).toBe('node-7');
          if ((o.material as THREE.MeshLambertMaterial).color.getHexString() === '00ff00') recolored++;
        });
        expect(meshes).toBeGreaterThan(5);
        expect(recolored).toBeGreaterThan(0);
        h.dispose();
      });
    });
  }

  it('jelly keeps volume-ish squash limits inside the unit box', () => {
    for (const s of [-1, -0.5, 0, 0.5, 1]) {
      const { w, h } = jellySize(s);
      expect(h).toBeLessThanOrEqual(1);
      expect(w * Math.SQRT2).toBeLessThanOrEqual(1);
    }
    expect(jellySize(-1).h).toBeLessThan(jellySize(1).h);
    expect(jellySize(-1).w).toBeGreaterThan(jellySize(1).w);
  });

  it('different looks produce different figures', () => {
    const counts = new Set(
      LOOKS.map((look) => {
        const h = new Humanoid('#3366ff', '2d-side', look);
        let n = 0;
        h.object.traverse((o) => {
          if (o instanceof THREE.Mesh) n++;
        });
        h.dispose();
        return n;
      }),
    );
    expect(counts.size).toBeGreaterThan(3);
  });
});

describe('look pass-through', () => {
  function boardWithLook(look?: string) {
    const board = structuredClone(listSamples()[0]!.board);
    const node = board.graph.nodes.find((n) => n.kind === 'character')!;
    if (look === undefined) delete node.params.look;
    else node.params.look = look;
    return board;
  }

  it('the character node hands its look to the spawned entity', () => {
    registerAllNodes();
    for (const look of ['robot', 'dino']) {
      const board = boardWithLook(look);
      const world = createWorld(board.mode);
      createRuntime(board.graph, world, board.mode);
      const ch = world.entities().find((e) => e.kind === 'character')!;
      expect(ch.look).toBe(look);
    }
  });

  it('old boards without a look parse and default to human', () => {
    const text = serializeBoard(boardWithLook());
    expect(JSON.parse(text).graph.nodes.some((n: { kind: string; params: Record<string, unknown> }) => n.kind === 'character' && 'look' in n.params)).toBe(false);
    const res = parseBoard(text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const node = res.board.graph.nodes.find((n) => n.kind === 'character')!;
    expect(node.params.look).toBe('human');
    const world = createWorld(res.board.mode);
    createRuntime(res.board.graph, world, res.board.mode);
    expect(world.entities().find((e) => e.kind === 'character')!.look).toBe('human');
  });

  it('a look survives a save round-trip', () => {
    const res = parseBoard(serializeBoard(boardWithLook('cat')));
    expect(res.ok && res.board.graph.nodes.find((n) => n.kind === 'character')!.params.look).toBe('cat');
  });

  it('SceneView rebuilds a character when its look changes', () => {
    const sv = new SceneView();
    sv.sync([view({ look: 'robot' })]);
    const count = (): number => sv.scene.getObjectsByProperty('type', 'Mesh').length;
    const robot = count();
    sv.sync([view({ look: 'jelly' })]);
    expect(count()).not.toBe(robot);
    sv.sync([view()]);
    const human = count();
    sv.sync([view({ look: 'not-a-look' })]);
    expect(count()).toBe(human);
    sv.dispose();
  });
});
