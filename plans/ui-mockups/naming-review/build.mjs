// Builds naming-proposal.json and index.html from the live node-names.ts + new-names.mjs.
// Run: node build.mjs   (Node 22+ strips the TypeScript types on import)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { NEW_NAMES, NOTES } from './new-names.mjs';

const ROOT = 'D:/workspace/GameBuilder';
const HERE = `${ROOT}/plans/ui-mockups/naming-review`;
const { NODE_NAMES } = await import(pathToFileURL(`${ROOT}/app/src/nodes/node-names.ts`).href);

// Category per node kind, read from the node definition files.
const category = {};
const dir = `${ROOT}/app/src/nodes/`;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.ts') || f === 'node-names.ts') continue;
  const s = fs.readFileSync(dir + f, 'utf8');
  for (const m of s.matchAll(/kind: '([a-z-]+)',\s*label: '[^']*',\s*category: '(\w+)'/g)) category[m[1]] = m[2];
}

const resolveNote = (n) => (n ? NOTES[n] ?? n : '');
const PULSE_RE = /^(Khi|Bắt đầu|Kết thúc)\b/;
const out = [];
const unknown = [];

for (const [kind, old] of Object.entries(NODE_NAMES)) {
  const ov = NEW_NAMES[kind] ?? {};
  if (!category[kind]) unknown.push(`no category: ${kind}`);
  const nodeNew = ov.vi ? { vi: ov.vi[0], en: ov.vi[1] } : { vi: old.vi, en: old.en };
  const ports = [];
  for (const dirKey of ['in', 'out']) {
    const table = old.ports[dirKey] ?? {};
    const over = ov[dirKey] ?? {};
    for (const id of Object.keys(over)) if (!(id in table)) unknown.push(`${kind}.${dirKey}.${id} not in node-names`);
    for (const [id, o] of Object.entries(table)) {
      const n = over[id];
      const next = n ? [n[0], n[1]] : [...o];
      const changed = next[0] !== o[0] || next[1] !== o[1];
      const pulse = dirKey === 'out' && PULSE_RE.test(next[0]);
      ports.push({
        dir: dirKey,
        id,
        old: [...o],
        new: next,
        ...(pulse ? { signal: 'pulse' } : {}),
        note: changed ? resolveNote(n?.[2]) : 'giữ',
      });
    }
  }
  out.push({
    kind,
    category: category[kind],
    nodeOld: { vi: old.vi, en: old.en },
    nodeNew,
    nodeNote: ov.vi ? resolveNote(ov.vi[2]) : 'giữ',
    ports,
  });
}
for (const k of Object.keys(NEW_NAMES)) if (!NODE_NAMES[k]) unknown.push(`unknown node ${k}`);
if (unknown.length) { console.error(unknown.join('\n')); process.exit(1); }

fs.writeFileSync(`${HERE}/naming-proposal.json`, JSON.stringify(out, null, 2));

const nodesChanged = out.filter((n) => n.nodeNew.vi !== n.nodeOld.vi || n.nodeNew.en !== n.nodeOld.en).length;
const allPorts = out.flatMap((n) => n.ports);
const portsChanged = allPorts.filter((p) => p.new[0] !== p.old[0] || p.new[1] !== p.old[1]).length;
const viChanged = allPorts.filter((p) => p.new[0] !== p.old[0]).length;
const enChanged = allPorts.filter((p) => p.new[1] !== p.old[1]).length;
console.log({ nodes: out.length, nodesChanged, ports: allPorts.length, portsChanged, viChanged, enChanged });

const tpl = fs.readFileSync(`${HERE}/template.html`, 'utf8');
const cardCss = fs.readFileSync(`${ROOT}/app/src/editor/graph/node-cards.css`, 'utf8');
fs.writeFileSync(`${HERE}/index.html`, tpl.replace('/*__CARDCSS__*/', () => cardCss).replace('/*__DATA__*/[]', () => JSON.stringify(out)));
