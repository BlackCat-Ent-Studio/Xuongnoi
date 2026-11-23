// Builds the self-contained index.html: inlines the real "before" screenshot into index.src.html as a data URL.
import fs from 'node:fs';
const dir = new URL('..', import.meta.url);
const png = fs.readFileSync('D:/workspace/GameBuilder/plans/reports/shots-w2-traction/3d-on-2500ms.png');
const src = fs.readFileSync(new URL('index.src.html', dir), 'utf8');
if (!src.includes('__BEFORE_PNG__')) throw new Error('placeholder missing');
fs.writeFileSync(new URL('index.html', dir), src.replace('__BEFORE_PNG__', 'data:image/png;base64,' + png.toString('base64')));
console.log('index.html written,', Math.round(fs.statSync(new URL('index.html', dir)).size / 1024), 'KB');
