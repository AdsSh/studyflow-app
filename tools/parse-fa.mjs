import fs from 'node:fs';

const src = 'ref-extract/new-syllabus-20261114-1649/DeepSeek_interpret,extractand_20261114-1649.md';
const out = 'ref-extract/new-syllabus-20261114-1649/fa-chapters.json';
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
  const topics = chapter.topics.slice();
  if (chapter.review) topics.push('Chapter review & end-of-chapter questions');
  chapters.push({ no: chapter.no, title: chapter.title, topics });
}

for (const line of lines) {
  const heading = line.match(/^###\s+(\d+)\.\s*(.*)$/);
  if (heading) {
    finish(current);
    current = { no: Number(heading[1]), title: clean(heading[2]), topics: [], review: false };
    continue;
  }
  if (!current) continue;
  const sub = line.match(/^\*\s+\*\*(\d+)\.(\d+)\*\*\s+(.+)$/);
  if (!sub) continue;
  const subNo = Number(sub[2]);
  const title = clean(sub[3]);
  if (subNo <= 1) continue;
  if (/^chapter review/i.test(title)) { current.review = true; continue; }
  if (/^end (of )?chapter questions/i.test(title)) { current.review = true; continue; }
  if (title) current.topics.push(title);
}
finish(current);

if (chapters[3] && !chapters[3].title) chapters[3].title = 'Books of prime entry and banking procedures';

fs.writeFileSync(out, JSON.stringify(chapters, null, 2));
console.log('chapters:', chapters.length);
for (const chapter of chapters) {
  console.log(String(chapter.no).padStart(2), chapter.title, '—', chapter.topics.length, 'topics');
}
console.log('total topics:', chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0));
