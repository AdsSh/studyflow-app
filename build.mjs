import { readFile, writeFile } from 'node:fs/promises';

const src = 'src';
const read = file => readFile(`${src}/${file}`, 'utf8');
const [template, base, views, data, render, app] = await Promise.all([
  read('index.html'),
  read('styles.css'),
  read('views.css'),
  read('data.js'),
  read('render.js'),
  read('app.js')
]);

const css = `/* StudyFlow — bundled styles */\n${base}\n\n${views}`;
const js = `/* StudyFlow — bundled application */\n${data}\n\n${render}\n\n${app}`;
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const styleTag = '<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="views.css">';
const scriptTag = '<script src="data.js"></script>\n<script src="render.js"></script>\n<script src="app.js"></script>';

if (!template.includes(styleTag) || !template.includes(scriptTag)) {
  throw new Error('Build placeholders not found in src/index.html');
}

let html = template
  .replace(styleTag, () => `<style>\n${css}\n</style>`)
  .replace(scriptTag, () => `<script>\n${js}\n</script>`)
  .replace('<head>', `<head>\n<!-- StudyFlow build · ${stamp} · single-file, offline-ready -->`);

await writeFile('StudyFlow.html', html, 'utf8');
console.log(`Built StudyFlow.html — ${(html.length / 1024).toFixed(1)} KB`);
