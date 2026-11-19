import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { listNodeDefs } from '../../src/engine/registry';
import type { ParamDef } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';

/**
 * Spike 3: every param of every registered node kind, and which of them hold a place or a direction in the world.
 * The registry gives the complete list; the class of each param is written by hand below after reading the node's code.
 * A vec3 param with no class is printed as UNCLASSIFIED, so a new param cannot slip through.
 * Output: out/s3-all-params.tsv (everything), out/s3-candidates.md (vec3 + keyword hits), out/s3-placement-table.md (the reviewed table).
 */
const OUT = new URL('./out/', import.meta.url);

const KEYWORDS = /pos|point|center|centre|origin|target|dest|heading|angle|dir|yaw|rot|facing|orient|corner|from|to$|route|path|x$|y$|z$|vị trí|hướng|góc|tâm|điểm|toạ độ|tọa độ|đích/i;

type Cls = 'world-position' | 'world-direction' | 'relative' | 'other';
type Rule = [match: RegExp, cls: Cls, note: string];

/** `kind.param` -> class. First match wins. */
const RULES: Rule[] = [
  // --- places in the world
  [/^(block|character|item|vehicle|robot-body|portal|rotating-platform)\.position$/, 'world-position', 'where the body is created'],
  [/^moving-platform\.(position|to)$/, 'world-position', 'end points A and B of the travel, both absolute'],
  [/^patrol\.point[AB]$/, 'world-position', 'absolute patrol ends'],
  [/^route-follow\.p\d+$/, 'world-position', 'absolute route point (fallback when "Lấy điểm từ vật" is on and the port is unwired)'],
  [/^line-track\.center$/, 'world-position', 'x, z = middle of the preset shapes; y = floor height for every shape'],
  [/^line-track\.p\d+$/, 'world-position', 'absolute x, z of a hand-drawn point (NOT relative to "Tâm")'],
  [/^zone\.center$/, 'world-position', 'absolute; becomes an OFFSET from the object when input "follow" is wired (zone-sensor.ts:146-156)'],
  [/^spawner\.position$/, 'world-position', 'absolute; becomes an OFFSET from the object when input "at" is wired (spawner.ts:110-114)'],
  [/^camera\.point$/, 'world-position', 'absolute in mode "fixed"; an OFFSET from the target in mode "follow"'],
  [/^linear-actuator\.position$/, 'world-position', 'absolute; ignored when input "base" is wired (linear-actuator.ts:226)'],
  [/^teleport\.position$/, 'world-position', 'absolute; ignored when input "dest" is wired (teleport.ts:42)'],
  [/^go-to\.targetPos$/, 'world-position', 'absolute; ignored when input "target" is wired (go-to.ts:92)'],
  // --- directions in the world
  [/^robot-body\.heading$/, 'world-direction', 'degrees, 0 = +x, 90 = +z'],
  [/^linear-actuator\.direction$/, 'world-direction', 'degrees on the ground plane; relative to the mount frame when "base" is wired'],
  [/^linear-actuator\.orient$/, 'world-direction', 'select ground / up / down (world vertical; unchanged by a move or a turn about the vertical)'],
  [/^block\.beltDir$/, 'world-direction', 'select x / -x / z / -z: a world axis'],
  // --- sizes and offsets relative to the piece itself or to what it is mounted on
  [/^(?!shooter\.).*\.(size|colliderSize|colliderOffset)$/, 'relative', 'extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z)'],
  [/^(joint|linear-actuator)\.mount$/, 'relative', 'offset in the frame of what it is mounted on (along / up / sideways)'],
  [/^motor\.(side|forward)$/, 'relative', 'wheel place on the chassis'],
  [/^line-sensor\.(side|forward)$/, 'relative', 'sensor place on the chassis'],
  [/^ahead-sensor\.(mountSide|mountForward|lookAngle)$/, 'relative', 'sensor place / turn on the body'],
  [/^joint\.(start|min|max)$/, 'relative', 'joint angle against what it is mounted on'],
  [/^line-track\.(length|breadth)$/, 'relative', 'preset shape: length along world x, breadth along world z'],
  [/^vision-sensor\.angle$/, 'other', 'width of the view cone'],
  [/^camera\.view$/, 'other', 'camera pitch preset'],
  // --- values that name something shared between cards (not a card id)
  [/^portal\.pair$/, 'other', 'TEXT KEY: two portals with the same code are linked (world/teleport.ts:125); copies of a group would share the code'],
  [/^(item\.tag|cargo\.loadType|cargo\.unloadType|zone\.goods|nearest-item\.goods)$/, 'other', 'TEXT KEY: goods type name matched by text; shared between copies (usually wanted)'],
];

function classify(kind: string, p: ParamDef): { cls: Cls | 'UNCLASSIFIED'; note: string } | null {
  const key = `${kind}.${p.id}`;
  for (const [re, cls, note] of RULES) if (re.test(key)) return { cls, note };
  return p.kind === 'vec3' ? { cls: 'UNCLASSIFIED', note: '' } : null;
}

it('dumps every param of every node kind and the reviewed placement table', () => {
  registerAllNodes();
  const defs = listNodeDefs().sort((a, b) => a.kind.localeCompare(b.kind));
  const all: string[] = ['kind\tparam\tparamKind\tdefault\tadvanced\tlabel'];
  const cand: string[] = ['| kind | param | kind | default | label |', '|---|---|---|---|---|'];
  let params = 0;
  let vec3 = 0;
  const byKind: Record<string, number> = {};
  const noParams: string[] = [];
  const rows: { kind: string; ids: string[]; pkind: string; cls: string; note: string }[] = [];
  const counts: Record<string, number> = {};
  const vecCounts: Record<string, number> = {};
  for (const d of defs) {
    if (d.params.length === 0) noParams.push(d.kind);
    for (const p of d.params as ParamDef[]) {
      params++;
      byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
      const dv = typeof p.default === 'object' ? `${p.default.x},${p.default.y},${p.default.z}` : String(p.default);
      all.push([d.kind, p.id, p.kind, dv, p.advanced ? 'adv' : '', p.label].join('\t'));
      const hit = p.kind === 'vec3' || ((p.kind === 'number' || p.kind === 'text') && (KEYWORDS.test(p.id) || KEYWORDS.test(p.label)));
      if (p.kind === 'vec3') vec3++;
      if (hit) cand.push(`| ${d.kind} | ${p.id} | ${p.kind} | ${dv} | ${p.label.replace(/\|/g, '/')} |`);
      const c = classify(d.kind, p);
      if (!c) continue;
      counts[c.cls] = (counts[c.cls] ?? 0) + 1;
      if (p.kind === 'vec3') vecCounts[c.cls] = (vecCounts[c.cls] ?? 0) + 1;
      // Numbered points of one card (p1, p2, ...) share a row.
      const last = rows[rows.length - 1];
      if (last && last.kind === d.kind && last.cls === c.cls && last.note === c.note && last.pkind === p.kind) last.ids.push(p.id);
      else rows.push({ kind: d.kind, ids: [p.id], pkind: p.kind, cls: c.cls, note: c.note });
    }
  }
  const head = `node kinds ${defs.length}, params ${params}, by kind ${JSON.stringify(byKind)}, vec3 ${vec3}, kinds without params ${noParams.length}: ${noParams.join(' ')}`;
  writeFileSync(new URL('s3-all-params.tsv', OUT), all.join('\n'));
  writeFileSync(new URL('s3-candidates.md', OUT), `${head}\n\n${cand.join('\n')}\n`);
  writeFileSync(new URL('s3-kinds.txt', OUT), defs.map((d) => `${d.kind}\t${d.label}\tin:${d.inputs.map((i) => `${i.id}:${i.type}`).join(',')}\tout:${d.outputs.map((i) => `${i.id}:${i.type}`).join(',')}`).join('\n'));
  const span = (ids: string[]): string => (ids.length > 2 ? `${ids[0]} .. ${ids[ids.length - 1]} (${ids.length})` : ids.join(', '));
  const table = ['| node kind | param | param kind | class | note |', '|---|---|---|---|---|', ...rows.map((r) => `| ${r.kind} | ${span(r.ids)} | ${r.pkind} | ${r.cls} | ${r.note} |`)];
  const kindsWithWorld = new Set(rows.filter((r) => r.cls === 'world-position' || r.cls === 'world-direction').map((r) => r.kind));
  const tail = [
    '',
    head,
    `classified params: ${JSON.stringify(counts)}; of the ${vec3} vec3 params: ${JSON.stringify(vecCounts)}`,
    `node kinds with at least one world-position / world-direction param: ${kindsWithWorld.size} of ${defs.length}: ${[...kindsWithWorld].join(', ')}`,
    `node kinds with no param that holds a place or direction: ${defs.length - kindsWithWorld.size}`,
  ];
  writeFileSync(new URL('s3-placement-table.md', OUT), [...table, ...tail].join('\n'));
  console.log([...tail].join('\n'));
});
