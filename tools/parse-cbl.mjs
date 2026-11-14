import fs from 'node:fs';

const src = 'ref-extract/new-syllabus-20261114/DeepSeek_interpret,extractand_20261114-1612.md';
const out = 'ref-extract/new-syllabus-20261114/cbl-chapters.json';
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const chapters = [];
let current = null;

function clean(value) {
  return value
    .replace(/\.{3,}\s*\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function finish(chapter) {
  if (!chapter) return;
  const extras = [];
  if (chapter.review) extras.push('Chapter review');
  if (chapter.examples) extras.push('worked examples');
  const topics = chapter.topics.slice();
  if (extras.length) topics.push(extras.join(' & '));
  chapters.push({ no: chapter.no, title: chapter.title, topics });
}

for (const line of lines) {
  const heading = line.match(/^###\s+(\d+)\.\s+(.+?)\s*$/);
  if (heading) {
    finish(current);
    current = { no: Number(heading[1]), title: clean(heading[2]), topics: [], review: false, examples: false };
    continue;
  }
  if (/^###\s+Appendices/.test(line)) {
    finish(current);
    current = null;
    continue;
  }
  if (!current) continue;
  const sub = line.match(/^\*\s+\*\*(\d+)\.(\d+)\*\*\s+(.+)$/);
  if (!sub) continue;
  const subNo = Number(sub[2]);
  const title = clean(sub[3]);
  if (subNo <= 2) continue;
  if (/^chapter review/i.test(title)) { current.review = true; continue; }
  if (/^worked examples/i.test(title)) { current.examples = true; continue; }
  if (title) current.topics.push(title);
}
finish(current);

fs.writeFileSync(out, JSON.stringify(chapters, null, 2));
console.log('chapters:', chapters.length);
for (const chapter of chapters) {
  console.log(String(chapter.no).padStart(2), chapter.title, '—', chapter.topics.length, 'topics');
}
console.log('total topics:', chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0));
