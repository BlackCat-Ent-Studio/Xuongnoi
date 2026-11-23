// One-off text patches to index.src.html (kept so the edits are reviewable). Usage: node patch-src.mjs <patch-file.json>
import fs from 'node:fs';
const f = new URL('../index.src.html', import.meta.url);
let s = fs.readFileSync(f, 'utf8');
const pairs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [a, b] of pairs) {
  if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80));
  s = s.replace(a, () => b);
}
fs.writeFileSync(f, s);
console.log('patched', pairs.length);
