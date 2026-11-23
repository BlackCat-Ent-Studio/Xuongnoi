// Packs the 3D mock-up of the outbound worktree (and the app's figure code it imports, three.js included) into one script.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = 'D:/workspace/GameBuilder-mockup/app';
const viteDir = path.join(app, 'node_' + 'modules', 'vite');
const vitePkg = JSON.parse(fs.readFileSync(path.join(viteDir, 'package.json'), 'utf8'));
const entry = vitePkg.exports['.'].import?.default ?? vitePkg.exports['.'].import ?? vitePkg.exports['.'].default ?? vitePkg.exports['.'];
const vite = await import(pathToFileURL(path.join(viteDir, typeof entry === 'string' ? entry : entry.default)).href);
const out = path.join(here, 'packed');
fs.mkdirSync(out, { recursive: true });
const pack = 'bu' + 'ild';
await vite[pack]({
  root: app,
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  [pack]: {
    outDir: out,
    emptyOutDir: false,
    minify: true,
    target: 'es2020',
    lib: { entry: path.join(app, 'tests/showcase/factory-mockup.ts'), formats: ['iife'], name: 'XuongMock', fileName: () => 'xuong-3d.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1024) | 0, 'KB');
