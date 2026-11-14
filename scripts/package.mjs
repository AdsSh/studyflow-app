import { rm, mkdir, copyFile, cp, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const source = path.join(root, 'StudyFlow.html');
const target = path.join(dist, 'index.html');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(source, target);

for (const entry of await readdir(publicDir, { withFileTypes: true })) {
  await cp(path.join(publicDir, entry.name), path.join(dist, entry.name), { recursive: true });
}

await writeFile(path.join(dist, '.nojekyll'), '', 'utf8');

const html = await readFile(target, 'utf8');
const required = [
  'id="viewInner"',
  'StudyFlow — data',
  '<style>',
  'id="programsOverlay"'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error('Packaged HTML is missing: ' + marker);
}
if (html.includes('href="styles.css"') || html.includes('src="app.js"')) {
  throw new Error('Packaged HTML still references external source files');
}

const size = (await stat(target)).size;
console.log(`Packaged dist/index.html — ${(size / 1024).toFixed(1)} KB`);
