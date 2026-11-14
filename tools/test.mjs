import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

function playwrightChromium() {
  const root = process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'ms-playwright') : '';
  if (!root) return '';
  try {
    const versions = readdirSync(root)
      .filter(name => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const name of versions) {
      const candidate = resolve(root, name, 'chrome-win64', 'chrome.exe');
      if (existsSync(candidate)) return candidate;
    }
  } catch (err) { /* no Playwright cache */ }
  return '';
}

const CANDIDATES = process.platform === 'win32'
  ? [
      playwrightChromium(),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : ''
    ].filter(Boolean)
  : process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      ];

const CHROME = process.env.CHROME || CANDIDATES.find(file => file && existsSync(file)) || '';
const PORT = 9444;
const PROFILE = resolve('.test-profile');
const PAGE = 'file:///' + resolve('StudyFlow.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!CHROME || !existsSync(CHROME)) {
  console.error('Chrome/Chromium not found. Set CHROME to a browser executable, then run again.');
  console.error('Checked: ' + (CANDIDATES.length ? CANDIDATES.join(', ') : '(no platform candidates)'));
  process.exit(2);
}

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log('PASS  ' + label);
  else { failures++; console.log('FAIL  ' + label + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}

async function waitForDevtools() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch (err) { /* retry */ }
    await sleep(250);
  }
  throw new Error('DevTools endpoint did not start');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.console = [];
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolvePromise, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolvePromise(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.console.push({ type: msg.params.type, text: msg.params.args.map(a => a.value || a.description || '').join(' ') });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        this.console.push({ type: 'exception', text: msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text });
      }
    });
  }
  send(method, params, sessionId) {
    const id = ++this.id;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('CDP timeout: ' + method));
      }, 20000);
      this.pending.set(id, { resolvePromise, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

async function main() {
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-breakpad',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    ...(process.env.CI ? ['--no-sandbox'] : []),
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--window-size=1440,1200', 'about:blank'
  ], { stdio: 'ignore' });

  try {
    const info = await waitForDevtools();
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const cdp = new CDP(ws);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);

    const evaluate = async expression => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const go = async (hash, width, height, mobile) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: !!mobile, screenWidth: width, screenHeight: height }, sessionId);
      await cdp.send('Page.navigate', { url: PAGE + '#' + hash }, sessionId);
      await sleep(700);
    };
    const snapshotState = async () => await evaluate(`localStorage.getItem('studyflow.v1')`);
    const reloadPage = async () => {
      await cdp.send('Page.reload', {}, sessionId);
      for (let i = 0; i < 50; i++) {
        await sleep(150);
        try {
          const ready = await evaluate(`document.readyState`);
          if (ready === 'complete') { await sleep(250); return; }
        } catch (err) {
          if (String(err && err.message).includes('CDP timeout')) throw err;
        }
      }
      throw new Error('Page did not finish reloading');
    };
    const restoreState = async snapshot => {
      await evaluate(`localStorage.setItem('studyflow.v1', ${JSON.stringify(snapshot)}); localStorage.removeItem('studyflow.timer.v1');`);
      await reloadPage();
    };

    await go('plan', 1440, 1200, false);
    await evaluate('localStorage.clear();');
    await reloadPage();

    // 1 — first load
    let r = await evaluate(`({sessions: document.querySelectorAll('.session').length, h1: document.querySelector('h1').textContent, expected: fmtLong(new Date()), tasks: state.tasks.length, today: state.tasks.filter(t=>t.date===todayKey()).length})`);
    check('Plan renders seeded sessions', r.sessions === 4 && r.today === 4, r);
    check('Hero date is correct', r.h1 === r.expected, r);

    // 2 — toggle checklist
    r = await evaluate(`({before: document.querySelectorAll('.check-row[aria-pressed="true"]').length})`);
    const before = r.before;
    await evaluate(`document.querySelector('.check-row[aria-pressed="false"]').click();`); await sleep(350);
    r = await evaluate(`({after: document.querySelectorAll('.check-row[aria-pressed="true"]').length, live: document.querySelector('#live').textContent})`);
    check('Checklist step toggles', r.after === before + 1, r);
    check('Live region announces progress', /steps complete/.test(r.live), r.live);

    // 3 — persistence
    await reloadPage();
    r = await evaluate(`({checked: document.querySelectorAll('.check-row[aria-pressed="true"]').length, stored: JSON.parse(localStorage.getItem('studyflow.v1')).tasks.length})`);    check('Checkbox state persists after reload', r.checked === before + 1, r);
    check('localStorage holds state', r.stored === 13, r.stored);

    // 3b — persistence failure is surfaced, and recovers on the next good save
    r = await evaluate(`(function(){
      const original = Storage.prototype.setItem;
      const task = state.tasks[0];
      const note = task.note;
      Storage.prototype.setItem = function(){ throw new DOMException('quota', 'QuotaExceededError'); };
      task.note = (note || '') + ' probe';
      saveState();
      const shown = !document.querySelector('#saveAlert').hidden;
      const text = document.querySelector('#saveAlertMsg').textContent;
      Storage.prototype.setItem = original;
      task.note = note;
      saveState();
      return {shown: shown, text: text, cleared: document.querySelector('#saveAlert').hidden};
    })()`);
    check('Save failure shows a persistent warning', r.shown && /not being saved/.test(r.text), r);
    check('Warning clears after a successful save', r.cleared, r);

    // 3c — an external write raises a non-destructive sync notice
    r = await evaluate(`(function(){
      window.dispatchEvent(new StorageEvent('storage', {key: 'studyflow.v1', newValue: '{"marker":1}'}));
      const shown = !document.querySelector('#syncAlert').hidden;
      document.querySelector('[data-action="dismiss-sync-alert"]').click();
      return {shown: shown, hidden: document.querySelector('#syncAlert').hidden};
    })()`);
    check('External tab change shows a sync notice', r.shown, r);
    check('Sync notice can be dismissed', r.hidden, r);

    // 4 — create session
    await evaluate(`document.querySelector('[data-action="new-task"]').click();`);
    await sleep(250);
    r = await evaluate(`({open: !document.querySelector('#sessionOverlay').hidden, heading: document.querySelector('#sessionHeading').textContent})`);
    check('Schedule modal opens', r.open && /Schedule a study session/.test(r.heading), r);
    await evaluate(`(function(){ document.querySelector('#fTitle').value='Mitigating risk in data mining'; document.querySelector('#fSteps').value='Read 4.11 notes\\nTwo exam questions'; document.querySelector('#fNote').value='Verification note'; document.querySelector('#sessionSubmit').click(); })()`);
    await sleep(400);
    r = await evaluate(`({open: !document.querySelector('#sessionOverlay').hidden, found: state.tasks.filter(t=>t.title==='Mitigating risk in data mining').length, toast: document.querySelector('.toast-msg')?.textContent, h1: document.querySelector('h1').textContent})`);
    check('Session is created', !r.open && r.found === 1, r);
    check('Creation toast confirmed', /Scheduled for/.test(r.toast || ''), r.toast);

    // 5 — re-render after reload includes new session
    await reloadPage();
    r = await evaluate(`({found: state.tasks.filter(t=>t.title==='Mitigating risk in data mining').length})`);
    check('Created session survives reload', r.found === 1, r);

    // 6 — menu / edit / delete + undo
    await evaluate(`document.querySelector('.session [data-action="task-menu"]').click();`); await sleep(200);
    r = await evaluate(`({open: !document.querySelector('#taskMenu').hidden, items: document.querySelectorAll('#taskMenu button').length})`);
    check('Task menu opens with actions', r.open && r.items === 5, r);
    await evaluate(`document.querySelector('#taskMenu [data-action="edit-task"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#sessionOverlay').hidden, heading: document.querySelector('#sessionHeading').textContent, title: document.querySelector('#fTitle').value})`);
    check('Edit modal pre-fills the session', r.open && /Edit study session/.test(r.heading) && r.title.length > 0, r);
    await evaluate(`document.querySelector('#fTitle').value='Edited cost behaviour'; document.querySelector('#sessionSubmit').click();`); await sleep(350);
    r = await evaluate(`({found: state.tasks.filter(t=>t.title==='Edited cost behaviour').length, closed: document.querySelector('#sessionOverlay').hidden})`);
    check('Edit saves the session', r.found === 1 && r.closed, r);
    await evaluate(`document.querySelector('.session [data-action="task-menu"]').click();`); await sleep(200);
    await evaluate(`document.querySelector('#taskMenu [data-action="delete-task"]').click();`); await sleep(350);
    r = await evaluate(`({count: state.tasks.length, toast: document.querySelector('.toast-btn')?.textContent})`);
    check('Session deletes with undo affordance', r.count === 13, r);
    await evaluate(`document.querySelector('.toast-btn').click();`); await sleep(350);
    r = await evaluate(`({count: state.tasks.length})`);
    check('Undo restores the session', r.count === 14, r);

    // 7 — search
    await evaluate(`(function(){ const s=document.querySelector('#search'); s.value='variance'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await sleep(350);
    r = await evaluate(`({sessions: document.querySelectorAll('.session').length, banner: !!document.querySelector('.search-banner')})`);
    check('Search filters the plan', r.sessions === 1 && r.banner, r);
    await evaluate(`document.querySelector('[data-action="clear-search"]').click();`); await sleep(300);
    r = await evaluate(`({sessions: document.querySelectorAll('.session').length})`);
    check('Clear search restores the plan', r.sessions === 5, r);

    // 8 — timer
    await evaluate(`document.querySelector('[data-action="timer-toggle"]').click();`); await sleep(1300);
    r = await evaluate(`({digits: document.querySelector('#timerDigits').textContent, title: document.title, running: document.querySelector('#timerModeLabel').textContent})`);
    check('Focus timer counts down', /^24:5\d$/.test(r.digits) && r.running === 'Deep work', r);
    await evaluate(`document.querySelector('[data-action="timer-toggle"]').click();`); await sleep(200);
    r = await evaluate(`({label: document.querySelector('#timerModeLabel').textContent})`);
    check('Focus timer pauses', r.label === 'Paused', r);
    await evaluate(`document.querySelector('[data-action="timer-reset"]').click();`); await sleep(200);
    r = await evaluate(`({digits: document.querySelector('#timerDigits').textContent})`);
    check('Focus timer resets', r.digits === '25:00', r);

    // 9 — day navigation + empty state + copy plan
    await evaluate(`(function(){ const d=new Date(); d.setDate(d.getDate()+1); const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); document.querySelector('[data-date="'+key+'"]').click(); })()`);
    await sleep(400);
    r = await evaluate(`({sessions: document.querySelectorAll('.session').length, empty: !!document.querySelector('.empty'), copy: !!document.querySelector('[data-action="repeat-day"]')})`);
    check('Future day shows empty state', r.sessions === 0 && r.empty && r.copy, r);
    await evaluate(`document.querySelector('[data-action="repeat-day"]').click();`); await sleep(400);
    r = await evaluate(`({sessions: document.querySelectorAll('.session').length, empty: !!document.querySelector('.empty')})`);
    check('Copy previous plan duplicates sessions', r.sessions > 0 && !r.empty, r);

    // 10 — syllabus accordion + topic prefill
    await go('syllabus', 1440, 1200, false);
    r = await evaluate(`({chapters: document.querySelectorAll('.chapter').length, sections: document.querySelectorAll('.section-block').length})`);
    check('Syllabus lists 17 chapters in 6 sections', r.chapters === 17 && r.sections === 6, r);
    r = await evaluate(`({segs: document.querySelectorAll('.spec-seg').length, ring: document.querySelector('.curriculum-ring-label')?.textContent, hero: !!document.querySelector('.curriculum-hero'), blocks: document.querySelectorAll('.section-block[id^="section-"]').length})`);
    check('Syllabus overview renders the spec grid', r.segs === 6 && /%/.test(r.ring || '') && r.hero && r.blocks === 6, r);
    await evaluate(`document.querySelector('[data-action="jump-section"][data-section="C"]').click();`); await sleep(700);
    r = await evaluate(`({top: document.getElementById('section-C').getBoundingClientRect().top, target: document.getElementById('section-C').classList.contains('is-target')})`);
    check('Spec grid jumps to a section', r.top < 260 && r.target, r);
    await evaluate(`document.querySelector('#view').scrollTop = 0;`); await sleep(200);
    await evaluate(`document.querySelector('[data-action="plan-chapter"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#chapterOverlay').hidden, chapter: Number(document.querySelector('#pChapter').value)})`);
    check('Plan a chapter shortcut opens the planner', r.open && r.chapter > 0, r);
    await evaluate(`document.querySelector('#chapterOverlay [data-action="close-modal"]').click();`); await sleep(200);
    await evaluate(`document.querySelector('.chapter .chapter-row').click();`); await sleep(300);
    r = await evaluate(`({open: !!document.querySelector('.chapter.is-open'), expanded: document.querySelector('.chapter-row').getAttribute('aria-expanded')})`);
    check('Chapter accordion opens', r.open && r.expanded === 'true', r);
    await evaluate(`document.querySelector('.chapter.is-open .topic').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#sessionOverlay').hidden, title: document.querySelector('#fTitle').value, chapter: document.querySelector('#fChapter').value})`);
    check('Topic pre-fills the schedule modal', r.open && r.title.length > 0 && r.chapter === '1', r);
    await evaluate(`document.querySelector('#sessionOverlay [data-action="close-modal"]').click();`); await sleep(200);

    // 11 — analytics
    await go('analytics', 1440, 1200, false);
    r = await evaluate(`({bars: document.querySelectorAll('.bar-col').length, rows: document.querySelectorAll('.ct-row').length, kpis: document.querySelectorAll('.kpi').length, sprints: document.querySelectorAll('.log-item').length})`);
    check('Analytics renders charts and tables', r.bars === 14 && r.rows === 17 && r.kpis === 4 && r.sprints === 3, r);

    // 12 — settings
    await evaluate(`document.querySelector('[data-action="open-settings"]').click();`); await sleep(250);
    r = await evaluate(`({open: !document.querySelector('#settingsOverlay').hidden, name: document.querySelector('#sName').value})`);
    check('Settings modal opens with profile', r.open && r.name === 'Tadiwa A.', r);
    await evaluate(`(function(){ document.querySelector('#sName').value='Tadiwa Ndlovu'; document.querySelector('#sTarget').value='4'; document.querySelector('#settingsForm').requestSubmit(); })()`);
    await sleep(400);
    r = await evaluate(`({name: document.querySelector('#profileName').textContent, sub: document.querySelector('#railGoal').textContent, open: !document.querySelector('#settingsOverlay').hidden})`);
    check('Settings save updates the profile', r.name === 'Tadiwa Ndlovu' && r.sub === 'Goal 4h' && !r.open, r);
    await reloadPage();
    r = await evaluate(`({name: document.querySelector('#profileName').textContent, target: activeProgram().targetHours})`);
    check('Settings persist after reload', r.name === 'Tadiwa Ndlovu' && Number(r.target) === 4, r);

    // 13 — carry-over tray
    await go('plan', 1440, 1200, false);
    r = await evaluate(`({title: document.querySelector('#carryTitle')?.textContent, items: document.querySelectorAll('.carry-item').length, unfinished: unfinishedTasks(7).length, before: state.tasks.filter(t=>t.date===todayKey()).length})`);
    check('Carry-over tray detects unfinished work', /unfinished session/.test(r.title || '') && r.items === 0 && r.unfinished > 0, r);
    const carryBefore = r.before;
    const carryCount = r.unfinished;
    await evaluate(`document.querySelector('[data-action="toggle-carry"]').click();`); await sleep(300);
    r = await evaluate(`({items: document.querySelectorAll('.carry-item').length, expanded: document.querySelector('[data-action="toggle-carry"]').getAttribute('aria-expanded')})`);
    check('Carry-over tray expands', r.items === Math.min(4, carryCount) && r.expanded === 'true', r);
    await evaluate(`document.querySelector('#toasts').innerHTML=''; document.querySelector('[data-action="carry-all"]').click();`); await sleep(450);
    r = await evaluate(`({today: state.tasks.filter(t=>t.date===todayKey()).length, tray: !!document.querySelector('#carryTitle'), toast: Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')})`);
    check('Move all carry-over updates today', r.today === carryBefore + carryCount && !r.tray, r);
    check('Carry-over toast confirms the move', /Moved \d+ sessions? to today/.test(r.toast || ''), r.toast);
    await evaluate(`document.querySelector('.toast-btn').click();`); await sleep(450);
    r = await evaluate(`({today: state.tasks.filter(t=>t.date===todayKey()).length, title: document.querySelector('#carryTitle')?.textContent})`);
    check('Carry-over undo restores the original days', r.today === carryBefore && /unfinished session/.test(r.title || ''), r);

    // 14 — reschedule from the session menu
    await evaluate(`document.querySelector('#toasts').innerHTML=''; document.querySelector('.session [data-action="task-menu"]').click();`); await sleep(220);
    r = await evaluate(`({items: document.querySelectorAll('#taskMenu button').length})`);
    check('Session options include reschedule', r.items === 5, r);
    const moveInfo = await evaluate(`(function(){ const btn=document.querySelector('#taskMenu [data-action="move-task"]'); const task=state.tasks.find(t=>t.id===btn.dataset.task); return {id: task.id, from: task.date, target: btn.dataset.target}; })()`);
    await evaluate(`document.querySelector('#taskMenu [data-action="move-task"]').click();`); await sleep(400);
    r = await evaluate(`(function(){ const task=state.tasks.find(t=>t.id==='${moveInfo.id}'); return {date: task.date, toast: Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')}; })()`);
    check('Reschedule moves the session', r.date === moveInfo.target, r);
    check('Reschedule toast confirms', /Moved to/.test(r.toast || ''), r.toast);
    await evaluate(`document.querySelector('.toast-btn').click();`); await sleep(350);
    r = await evaluate(`({date: state.tasks.find(t=>t.id==='${moveInfo.id}').date})`);
    check('Reschedule undo restores the date', r.date === moveInfo.from, r);

    // 15 — repeat scheduling
    const beforeRepeat = await snapshotState();
    await go('plan', 1440, 1200, false);
    await evaluate(`document.querySelector('[data-action="new-task"]').click();`); await sleep(250);
    await evaluate(`(function(){ const s=document.querySelector('#fRepeat'); s.value='daily'; s.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#fTitle').value='Repeat check'; })()`);
    r = await evaluate(`({hint: document.querySelector('#repeatHint').textContent, submit: document.querySelector('#sessionSubmit').innerText.trim()})`);
    check('Repeat control previews the series', /Creates 5 sessions/.test(r.hint) && /Schedule 5 sessions/.test(r.submit), r);
    await evaluate(`document.querySelector('#sessionSubmit').click();`); await sleep(550);
    r = await evaluate(`(function(){ const list=state.tasks.filter(t=>t.title==='Repeat check'); return {count:list.length, dates:new Set(list.map(t=>t.date)).size, steps:list.every(t=>t.steps.length===1 && !t.steps[0].done), toast:Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')}; })()`);
    check('Repeat creates five independent sessions', r.count === 5 && r.dates === 5 && r.steps, r);
    check('Repeat toast summarises the series', /Scheduled 5 sessions/.test(r.toast || ''), r.toast);
    await restoreState(beforeRepeat);

    // 16 — bulk chapter planner
    const beforeChapter = await snapshotState();
    await go('syllabus', 1440, 1200, false);
    await evaluate(`document.querySelector('.chapter .chapter-row').click();`); await sleep(300);
    await evaluate(`document.querySelector('.chapter.is-open [data-action="schedule-chapter"]').click();`); await sleep(350);
    r = await evaluate(`({open: !document.querySelector('#chapterOverlay').hidden, parts: document.querySelectorAll('.plan-part').length, summary: document.querySelector('#pSummary').textContent})`);
    check('Chapter planner opens with a preview', r.open && r.parts > 0 && /sessions/.test(r.summary), r);
    await evaluate(`(function(){ const s=document.querySelector('#pSessions'); s.value='3'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`); await sleep(300);
    r = await evaluate(`({parts: document.querySelectorAll('.plan-part').length, submit: document.querySelector('#pSubmit').innerText.trim()})`);
    check('Chapter planner rebalances the preview', r.parts === 3 && /Plan 3 sessions/.test(r.submit), r);
    await evaluate(`document.querySelector('#chapterForm').requestSubmit();`); await sleep(550);
    r = await evaluate(`(function(){ const list=state.tasks.filter(t=>t.note.startsWith('Chapter plan')); return {count:list.length, dates:list.map(t=>t.date), steps:list.map(t=>t.steps.length), chapters:new Set(list.map(t=>t.chapter)).size, toast:Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')}; })()`);
    check('Chapter planner creates consecutive sessions', r.count === 3 && new Set(r.dates).size === 3 && r.chapters === 1 && r.steps.every(n => n > 0), r);
    check('Chapter planner toast confirms', /3 sessions planned/.test(r.toast || ''), r.toast);
    await restoreState(beforeChapter);

    // 17 — copy a day forward
    const beforeCopy = await snapshotState();
    await go('plan', 1440, 1200, false);
    r = await evaluate(`(function(){ const d=new Date(); d.setDate(d.getDate()+1); const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); return {today: state.tasks.filter(t=>t.date===todayKey()).length, tomorrow: state.tasks.filter(t=>t.date===key).length, key:key}; })()`);
    const copyCounts = r;
    await evaluate(`document.querySelector('[data-action="copy-day"]').click();`); await sleep(450);
    r = await evaluate(`({tomorrow: state.tasks.filter(t=>t.date==='${copyCounts.key}').length, toast: Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')})`);
    check('Copy day duplicates the plan to tomorrow', r.tomorrow === copyCounts.tomorrow + copyCounts.today, r);
    check('Copy day toast confirms', /copied to tomorrow/.test(r.toast || ''), r.toast);
    await restoreState(beforeCopy);

    // 18 — focus timer survives reloads
    await go('plan', 1440, 1200, false);
    await evaluate(`localStorage.removeItem('studyflow.timer.v1'); timerReset(); timer.remaining = 8; timerStart();`);
    await sleep(250);
    await reloadPage(); await sleep(1000);
    r = await evaluate(`({running: timer.running, digits: document.querySelector('#timerDigits')?.textContent, label: document.querySelector('#timerModeLabel')?.textContent, stored: !!localStorage.getItem('studyflow.timer.v1')})`);
    check('Focus timer resumes after reload', r.running === true && /^00:0[0-7]$/.test(r.digits || '') && r.label === 'Deep work' && r.stored, r);
    await evaluate(`timerReset(); localStorage.removeItem('studyflow.timer.v1');`);
    const focusBefore = await evaluate(`state.focusSessions.length`);
    await evaluate(`timer.remaining = 1; timerStart();`); await sleep(100);
    await reloadPage(); await sleep(2200);
    r = await evaluate(`({count: state.focusSessions.length, toast: Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')})`);
    check('Sprint completed while away is logged', r.count === focusBefore + 1, r);
    check('Away-completion toast informs the user', /sprint (completed while|logged)/.test(r.toast || ''), r.toast);
    await evaluate(`timerReset(); clearTimerState();`);

    // 19 — add a program
    const beforePrograms = await snapshotState();
    await go('plan', 1440, 1200, false);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#programsOverlay').hidden, rows: document.querySelectorAll('#programList .program-row').length, active: document.querySelectorAll('#programList .program-row.is-active').length, cbl: Array.from(document.querySelectorAll('#programList .program-copy b')).some(node=>/Corporate & Business Law/.test(node.textContent)), fa: Array.from(document.querySelectorAll('#programList .program-copy b')).some(node=>/Financial Accounting/.test(node.textContent))})`);
    check('Program switcher opens with the bundled programs', r.open && r.rows === 3 && r.active === 1 && r.cbl && r.fa, r);
    await evaluate(`document.querySelector('#programList [data-action="switch-program"][data-program="icaz-cbl"]').click();`); await sleep(500);
    r = await evaluate(`({active: activeProgram().name, course: activeProgram().course, chapters: activeChapters().length, sections: activeSections().length, sessions: tasksOn(todayKey()).length, empty: !!document.querySelector('.empty')})`);
    check('Corporate & Business Law program is seeded', /Corporate & Business Law/.test(r.active || '') && r.course === 'Corporate and Business Law' && r.chapters === 18 && r.sections === 1 && r.sessions === 0 && r.empty, r);
    await evaluate(`location.hash='#syllabus';`); await sleep(700);
    r = await evaluate(`({chapters: document.querySelectorAll('.chapter').length, sections: document.querySelectorAll('.section-block').length, copy: document.querySelector('.page-head p').textContent})`);
    check('Corporate & Business Law syllabus renders', r.chapters === 18 && r.sections === 1 && /1 weighted section/.test(r.copy || ''), r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    await evaluate(`document.querySelector('#programList [data-action="switch-program"][data-program="icaz-fin"]').click();`); await sleep(500);
    r = await evaluate(`({active: activeProgram().name, course: activeProgram().course, chapters: activeChapters().length, sections: activeSections().length})`);
    check('Financial Accounting program is seeded', /Financial Accounting/.test(r.active || '') && r.course === 'Financial Accounting' && r.chapters === 19 && r.sections === 1, r);
    await evaluate(`location.hash='#syllabus';`); await sleep(700);
    r = await evaluate(`({chapters: document.querySelectorAll('.chapter').length, copy: document.querySelector('.page-head p').textContent})`);
    check('Financial Accounting syllabus renders', r.chapters === 19 && /19 chapters/.test(r.copy || ''), r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    await evaluate(`document.querySelector('#programList [data-action="switch-program"][data-program="icaz-ma"]').click();`); await sleep(500);
    r = await evaluate(`({active: activeProgram().name, sessions: tasksOn(todayKey()).length})`);
    check('Switching back restores Management Accounting', /ICAZ 2026 · Foundation/.test(r.active) && r.sessions >= 4, r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    await evaluate(`document.querySelector('[data-action="new-program"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#programOverlay').hidden, sections: document.querySelectorAll('.builder-section').length, chapters: document.querySelectorAll('.builder-chapter').length})`);
    check('Program builder starts with a section and chapter', r.open && r.sections === 1 && r.chapters === 1, r);
    await evaluate(`(function(){
      document.querySelector('#prName').value='ICAZ 2026 · Financial Accounting';
      document.querySelector('#prCourse').value='Financial Accounting';
      document.querySelector('#prExamLabel').value='ICAZ 2026 Core';
      const section=document.querySelector('.builder-section');
      section.querySelector('.builder-section-name').value='Financial reporting';
      section.querySelector('.builder-section-weight').value='100';
      const chapter=section.querySelector('.builder-chapter');
      chapter.querySelector('.builder-chapter-title').value='Conceptual framework';
      chapter.querySelector('.builder-chapter-topics').value='Objective of financial statements; Qualitative characteristics';
    })()`);
    await evaluate(`document.querySelector('.builder-section .builder-add-chapter').click();`); await sleep(150);
    r = await evaluate(`({chapters: document.querySelectorAll('.builder-chapter').length})`);
    check('Builder adds another chapter', r.chapters === 2, r);
    await evaluate(`(function(){ const chapter=document.querySelectorAll('.builder-chapter')[1]; chapter.querySelector('.builder-chapter-title').value='Presentation of financial statements'; chapter.querySelector('.builder-chapter-topics').value='Statement of financial position; Statement of profit or loss'; })()`);
    await evaluate(`document.querySelector('#programForm').requestSubmit();`); await sleep(650);
    r = await evaluate(`({programs: state.programs.length, active: activeProgram().name, chapters: activeChapters().length, sections: activeSections().length, rail: document.querySelector('#programName').textContent, empty: !!document.querySelector('.empty'), tasks: state.tasks.filter(t=>t.programId===state.activeProgramId).length})`);
    check('New program is created and activated', r.programs === 4 && /Financial Accounting/.test(r.active) && r.chapters === 2 && r.sections === 1, r);
    check('New program starts with an empty plan', r.empty && r.tasks === 0, r);
    check('Rail reflects the active program', /Financial Accounting/.test(r.rail), r.rail);
    await evaluate(`location.hash='#syllabus';`); await sleep(700);
    r = await evaluate(`({chapters: document.querySelectorAll('.chapter').length, title: document.querySelector('.chapter-title')?.textContent, sections: document.querySelectorAll('.section-block').length})`);
    check('New program syllabus uses its own chapters', r.chapters === 2 && /Conceptual framework/.test(r.title || '') && r.sections === 1, r);
    await evaluate(`location.hash='#library';`); await sleep(700);
    r = await evaluate(`({empty: !!document.querySelector('.library-empty'), resources: state.resources.filter(x=>x.programId===state.activeProgramId).length, add: !!document.querySelector('[data-action="new-resource"]')})`);
    check('New program starts with an empty library', r.empty && r.resources === 0 && r.add, r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    r = await evaluate(`({rows: document.querySelectorAll('#programList .program-row').length, active: document.querySelector('#programList .program-row.is-active .program-copy b')?.textContent})`);
    check('Program switcher lists all programs', r.rows === 4 && /Financial Accounting/.test(r.active || ''), r);
    await evaluate(`document.querySelector('#programList [data-action="switch-program"][data-program="icaz-ma"]').click();`); await sleep(500);
    r = await evaluate(`({active: activeProgram().name, sessions: tasksOn(todayKey()).length, rail: document.querySelector('#programName').textContent})`);
    check('Switching programs swaps the plan', /ICAZ 2026 · Foundation/.test(r.active) && r.sessions >= 4, r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    await evaluate(`(function(){ const row=Array.from(document.querySelectorAll('#programList .program-row')).find(node=>/ICAZ 2026 · Financial Accounting/.test(node.textContent)); row.querySelector('[data-action="edit-program"]').click(); })()`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#programOverlay').hidden, heading: document.querySelector('#programFormHeading').textContent, name: document.querySelector('#prName').value, copyHidden: document.querySelector('#prCopy').hidden, deleteHidden: document.querySelector('#prDelete').hidden})`);
    check('Program editor opens prefilled', r.open && r.heading === 'Edit program' && /ICAZ 2026 · Financial Accounting/.test(r.name) && r.copyHidden && !r.deleteHidden, r);
    await evaluate(`(function(){ document.querySelector('#prName').value='ICAZ 2026 · Financial Accounting (Revised)'; document.querySelector('.builder-section-name').value='Financial reporting & analysis'; document.querySelector('#programForm').requestSubmit(); })()`); await sleep(650);
    r = await evaluate(`(function(){ const program=state.programs.find(p=>/Revised/.test(p.name)); return {name:program?.name, section:program?.sections[0]?.name, programs:state.programs.length}; })()`);
    check('Program details and sections can be edited', r.programs === 4 && /Revised/.test(r.name || '') && /analysis/.test(r.section || ''), r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(300);
    await evaluate(`(function(){ const row=Array.from(document.querySelectorAll('#programList .program-row')).find(node=>/Revised/.test(node.textContent)); row.querySelector('[data-action="edit-program"]').click(); })()`); await sleep(300);
    await evaluate(`document.querySelector('#prDelete').click();`); await sleep(150);
    await evaluate(`document.querySelector('#prDelete').click();`); await sleep(550);
    r = await evaluate(`({programs: state.programs.length, active: activeProgram().name, tasks: state.tasks.length, allActive: state.tasks.every(t=>t.programId===state.activeProgramId)})`);
    check('Deleting a program removes only its data', r.programs === 3 && /ICAZ 2026 · Foundation/.test(r.active) && r.allActive, r);
    await restoreState(beforePrograms);

    // 20 — library
    const beforeLibrary = await snapshotState();
    await go('library', 1440, 1200, false);
    r = await evaluate(`({view: document.body.dataset.view, cards: document.querySelectorAll('.resource-card').length, featured: !!document.querySelector('.featured-card'), summary: !!document.querySelector('.library-summary'), nav: document.querySelector('#libraryCount')?.textContent, placeholder: document.querySelector('#search').placeholder, resources: state.resources.length, chips: Array.from(document.querySelectorAll('.type-chip')).map(item=>item.textContent.trim())})`);
    check('Library renders the seeded collection', r.view === 'library' && r.cards === 8 && r.featured && r.summary && r.nav === '8', r);
    check('Library exposes every content format', r.chips.length === 5 && /Documents/.test(r.chips.join(' ')) && /Videos/.test(r.chips.join(' ')) && /Audio/.test(r.chips.join(' ')) && /Links/.test(r.chips.join(' ')), r.chips);
    check('Library updates the search context', /library/i.test(r.placeholder || ''), r.placeholder);
    await evaluate(`(function(){ const s=document.querySelector('#search'); s.value='budget'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(450);
    r = await evaluate(`({cards: document.querySelectorAll('.resource-card').length, top: !!document.querySelector('.library-top'), query: ui.query})`);
    check('Library search filters resources', r.cards === 1 && r.query === 'budget' && !r.top, r);
    await evaluate(`document.querySelector('[data-action="clear-search"]').click();`); await sleep(300);
    r = await evaluate(`({cards: document.querySelectorAll('.resource-card').length, top: !!document.querySelector('.library-top')})`);
    check('Clearing search restores the collection', r.cards === 8 && r.top, r);
    await evaluate(`document.querySelector('[data-action="library-format"][data-format="document"]').click();`); await sleep(250);
    r = await evaluate(`({cards: document.querySelectorAll('.resource-card').length, active: document.querySelector('.type-chip.is-active')?.dataset.format, top: !!document.querySelector('.library-top')})`);
    check('Library document filter narrows the grid', r.cards === 4 && r.active === 'document' && !r.top, r);
    await evaluate(`document.querySelector('[data-action="clear-library-filters"]').click();`); await sleep(250);
    await evaluate(`document.querySelector('[data-action="library-format"][data-format="video"]').click();`); await sleep(250);
    r = await evaluate(`({cards: document.querySelectorAll('.resource-card').length, active: document.querySelector('.type-chip.is-active')?.dataset.format})`);
    check('Library video filter finds the video', r.cards === 1 && r.active === 'video', r);
    await evaluate(`document.querySelector('[data-action="clear-library-filters"]').click();`); await sleep(250);
    await evaluate(`(function(){ const s=document.querySelector('[data-library-filter="status"]'); s.value='reading'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`); await sleep(250);
    r = await evaluate(`({cards: document.querySelectorAll('.resource-card').length, status: ui.libraryStatus})`);
    check('Library status filter narrows the grid', r.cards === 2 && r.status === 'reading', r);
    await evaluate(`document.querySelector('[data-action="clear-library-filters"]').click();`); await sleep(250);

    const beforeAdd = await evaluate(`state.resources.length`);
    await evaluate(`document.querySelector('.page-actions [data-action="new-resource"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#resourceOverlay').hidden, options: document.querySelector('#rChapter').options.length, formats: document.querySelector('#rFormat').options.length, deleteHidden: document.querySelector('#rDelete').hidden, heading: document.querySelector('#resourceFormHeading').textContent})`);
    check('Resource modal opens with format and chapter choices', r.open && r.options >= 2 && r.formats === 5 && r.deleteHidden && r.heading === 'Add resource', r);
    await evaluate(`(function(){ document.querySelector('#rTitle').value='Bad link'; document.querySelector('#rUrl').value='javascript:alert(1)'; document.querySelector('#resourceForm').requestSubmit(); })()`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#resourceOverlay').hidden, error: document.querySelector('#rError').textContent, count: state.resources.length})`);
    check('Invalid resource links are rejected', r.open && /valid link/.test(r.error || '') && r.count === beforeAdd, r);
    await evaluate(`(function(){
      document.querySelector('#rTitle').value='Audio — variance recap';
      document.querySelector('#rFormat').value='audio';
      document.querySelector('#rStatus').value='reading';
      document.querySelector('#rChapter').value='14';
      document.querySelector('#rUrl').value='https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3';
      document.querySelector('#rNote').value='Listen back to the variance explanation before the next practice paper.';
      document.querySelector('#resourceForm').requestSubmit();
    })()`); await sleep(650);
    r = await evaluate(`(function(){ const resource=state.resources.find(item=>item.title==='Audio — variance recap'); return {count: state.resources.length, title: resource?.title, program: resource?.programId, active: state.activeProgramId, format: resource?.format, url: resource?.url, nav: document.querySelector('#libraryCount')?.textContent, cards: document.querySelectorAll('.resource-card').length}; })()`);
    check('Resource is added to the active library', r.count === beforeAdd + 1 && !!r.title && r.program === r.active && r.format === 'audio' && r.url === 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', r);
    check('Library count includes the new resource', String(r.nav) === String(beforeAdd + 1) && r.cards === beforeAdd + 1, r);
    await reloadPage(); await sleep(900);
    r = await evaluate(`({view: document.body.dataset.view, count: state.resources.length, title: !!state.resources.find(item=>item.title==='Audio — variance recap'), placeholder: document.querySelector('#search').placeholder})`);
    check('Library resources survive reload', r.view === 'library' && r.count === beforeAdd + 1 && r.title, r);
    const libraryResourceId = await evaluate(`state.resources.find(item=>item.title==='Audio — variance recap').id`);
    await evaluate(`document.querySelector('[data-action="open-resource"][data-resource="${libraryResourceId}"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#previewOverlay').hidden, audio: !!document.querySelector('#previewMedia audio'), src: document.querySelector('#previewMedia audio')?.getAttribute('src'), heading: document.querySelector('#previewHeading').textContent, external: !document.querySelector('#previewExternal').hidden})`);
    check('Audio resources open an inline player', r.open && r.audio && /SoundHelix-Song-2\.mp3$/.test(r.src || '') && /Audio — variance recap/.test(r.heading || '') && r.external, r);
    await evaluate(`document.querySelector('#previewOverlay .modal-head [data-action="close-modal"]').click();`); await sleep(200);
    await evaluate(`document.querySelector('[data-action="edit-resource"][data-resource="${libraryResourceId}"]').click();`); await sleep(300);
    r = await evaluate(`({open: !document.querySelector('#resourceOverlay').hidden, heading: document.querySelector('#resourceFormHeading').textContent, title: document.querySelector('#rTitle').value, format: document.querySelector('#rFormat').value, deleteHidden: document.querySelector('#rDelete').hidden})`);
    check('Resource editor opens prefilled', r.open && r.heading === 'Edit resource' && /Audio — variance recap/.test(r.title) && r.format === 'audio' && !r.deleteHidden, r);
    await evaluate(`(function(){ document.querySelector('#rTitle').value='Audio — variance recap (updated)'; document.querySelector('#rStatus').value='done'; document.querySelector('#resourceForm').requestSubmit(); })()`); await sleep(500);
    r = await evaluate(`(function(){ const resource=state.resources.find(item=>item.id==='${libraryResourceId}'); return {title: resource?.title, status: resource?.status, format: resource?.format}; })()`);
    check('Resource edits are saved', /updated/.test(r.title || '') && r.status === 'done' && r.format === 'audio', r);
    await evaluate(`(function(){ const select=document.querySelector('[data-resource-status="${libraryResourceId}"]'); select.value='reference'; select.dispatchEvent(new Event('change',{bubbles:true})); })()`); await sleep(350);
    r = await evaluate(`state.resources.find(item=>item.id==='${libraryResourceId}')?.status`);
    check('Resource status can change from the card', r === 'reference', r);
    await evaluate(`document.querySelector('[data-action="edit-resource"][data-resource="${libraryResourceId}"]').click();`); await sleep(250);
    await evaluate(`document.querySelector('#rDelete').click();`); await sleep(150);
    await evaluate(`document.querySelector('#rDelete').click();`); await sleep(500);
    r = await evaluate(`({count: state.resources.length, gone: !state.resources.some(item=>item.id==='${libraryResourceId}'), nav: document.querySelector('#libraryCount')?.textContent})`);
    check('Resource delete removes it from the library', r.count === beforeAdd && r.gone && String(r.nav) === String(beforeAdd), r);
    await evaluate(`(function(){ window.__download=null; window.downloadFile=function(name,text){ window.__download={name:name,text:text}; }; exportLibrary(); return {has: !!window.__download, name: window.__download && window.__download.name, text: window.__download && window.__download.text.slice(0,80)}; })()`);
    r = await evaluate(`({has: !!window.__download, name: window.__download && window.__download.name, text: window.__download && window.__download.text})`);
    check('Library export produces a reading list', r.has && /\.md$/.test(r.name) && /# Study library/.test(r.text || '') && /## Documents/.test(r.text || '') && /## Audio/.test(r.text || ''), { name: r.name, text: (r.text || '').slice(0, 120) });
    await evaluate(`(function(){ const s=document.querySelector('#search'); s.value='zzzz'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(450);
    r = await evaluate(`({cards: document.querySelectorAll('.resource-card').length, empty: !!document.querySelector('.library-empty'), text: document.querySelector('.library-empty h3')?.textContent})`);
    check('Library has an empty search state', r.cards === 0 && r.empty && /zzzz/.test(r.text || ''), r);
    await evaluate(`document.querySelector('[data-action="clear-library-filters"]').click();`); await sleep(250);

    await evaluate(`document.querySelector('.page-actions [data-action="new-resource"]').click();`); await sleep(300);
    r = await evaluate(`(function(){
      const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII=';
      const bytes=Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
      const file=new File([bytes],'break-even-chart.png',{type:'image/png'});
      const dt=new DataTransfer(); dt.items.add(file);
      const input=document.querySelector('#rFile'); input.files=dt.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      return {format: document.querySelector('#rFormat').value, info: !document.querySelector('#rFileInfo').hidden, name: document.querySelector('#rFileName').textContent, size: document.querySelector('#rFileSize').textContent, pending: !!ui.pendingFile};
    })()`);
    check('File selection detects image format', r.format === 'image' && r.info && /png/.test(r.name || '') && r.pending, r);
    await evaluate(`(function(){ document.querySelector('#rTitle').value='Image — break-even chart'; document.querySelector('#rNote').value='Uploaded chart for break-even revision.'; document.querySelector('#resourceForm').requestSubmit(); })()`); await sleep(1000);
    r = await evaluate(`(function(){ const res=state.resources.find(x=>x.title==='Image — break-even chart'); return {count: state.resources.length, id:res?.id, format:res?.format, fileId:res?.fileId, fileName:res?.fileName, fileSize:res?.fileSize, cards:document.querySelectorAll('.resource-card').length, imageChip: !!document.querySelector('[data-action="library-format"][data-format="image"]')}; })()`);
    check('Uploaded files are stored with the resource', r.count === 9 && r.format === 'image' && !!r.fileId && r.fileName === 'break-even-chart.png' && r.fileSize > 0 && r.cards === 9 && r.imageChip, r);
    const fileResourceId = r.id;
    const fileBlobId = r.fileId;
    r = await evaluate(`(function(){
      const base={fileSize:1024,title:'File'};
      const image=resourceFileMediaHTML(Object.assign({},base,{format:'image',fileType:'image/png',fileName:'chart.png'}),'blob:test');
      const video=resourceFileMediaHTML(Object.assign({},base,{format:'video',fileType:'video/mp4',fileName:'clip.mp4'}),'blob:test');
      const audio=resourceFileMediaHTML(Object.assign({},base,{format:'audio',fileType:'audio/mpeg',fileName:'lecture.mp3'}),'blob:test');
      const pdf=resourceFileMediaHTML(Object.assign({},base,{format:'document',fileType:'application/pdf',fileName:'notes.pdf'}),'blob:test');
      const doc=resourceFileMediaHTML(Object.assign({},base,{format:'document',fileType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',fileName:'notes.docx'}),'blob:test');
      return {image:image.includes('<img'),video:video.includes('<video'),audio:audio.includes('<audio'),pdf:pdf.includes('preview-pdf'),doc:doc.includes('Download file')};
    })()`);
    check('File previews cover video, audio, images and PDF', r.image && r.video && r.audio && r.pdf && r.doc, r);
    await evaluate(`document.querySelector('[data-action="open-resource"][data-resource="${fileResourceId}"]').click();`); await sleep(700);
    r = await evaluate(`({open: !previewOverlay.hidden, image: !!previewMedia.querySelector('img'), src: previewMedia.querySelector('img')?.getAttribute('src'), download: previewExternal.getAttribute('download'), file: !!previewMeta.querySelector('.preview-file')})`);
    check('Uploaded images preview from browser storage', r.open && r.image && /^blob:/.test(r.src || '') && r.download === 'break-even-chart.png' && r.file, r);
    await evaluate(`document.querySelector('#previewOverlay .modal-head [data-action="close-modal"]').click();`); await sleep(200);
    await reloadPage(); await sleep(900);
    r = await evaluate(`(async function(){ const res=state.resources.find(x=>x.id==='${fileResourceId}'); const record=await getFileBlob('${fileBlobId}'); return {exists:!!res, hasBlob:!!(record&&record.blob), size:record?.size, format:res?.format, fileId:res?.fileId}; })()`);
    check('Uploaded files survive reload', r.exists && r.hasBlob && r.size > 0 && r.format === 'image' && r.fileId === fileBlobId, r);
    const savedState = await evaluate(`localStorage.getItem('studyflow.v1')`);
    await evaluate(`localStorage.setItem('studyflow.v1','{broken')`);
    await reloadPage(); await sleep(900);
    r = await evaluate(`(async function(){ const record=await getFileBlob('${fileBlobId}'); return {blob:!!(record&&record.blob), seeded: state.resources.length}; })()`);
    check('Corrupt app state does not delete stored files', r.blob, r);
    r = await evaluate(`(function(){ const key=Object.keys(localStorage).find(k=>k.indexOf('studyflow.v1.recovery.')===0)||''; return {open: !document.querySelector('#recoveryAlert').hidden, key: key, raw: key?localStorage.getItem(key):''}; })()`);
    check('Corrupt state is preserved for recovery', r.open && /recovery/.test(r.key) && r.raw === '{broken', r);
    r = await evaluate(`(function(){ let captured=null; const original=window.downloadFile; window.downloadFile=function(name,text){ captured={name:name,text:text}; }; downloadRecoveryCopy(); window.downloadFile=original; return {captured: !!captured, name: captured && captured.name, text: captured && captured.text}; })()`);
    check('Recovery copy can be downloaded', r.captured && /\.json$/.test(r.name) && r.text === '{broken', r);
    await evaluate(`localStorage.setItem('studyflow.v1', ${JSON.stringify(savedState)})`);
    await reloadPage(); await sleep(900);
    await evaluate(`deleteFileBlob('${fileBlobId}')`); await sleep(250);
    await evaluate(`document.querySelector('[data-action="open-resource"][data-resource="${fileResourceId}"]').click();`); await sleep(600);
    r = await evaluate(`({open: !previewOverlay.hidden, text: previewMedia.textContent, reattach: !!previewMedia.querySelector('[data-action="edit-resource"]')})`);
    check('Missing attached files show a recovery state', r.open && /File unavailable/.test(r.text || '') && r.reattach, r);
    await evaluate(`document.querySelector('#previewOverlay .modal-head [data-action="close-modal"]').click();`); await sleep(200);
    await evaluate(`document.querySelector('[data-action="edit-resource"][data-resource="${fileResourceId}"]').click();`); await sleep(300);
    await evaluate(`document.querySelector('#rDelete').click();`); await sleep(150);
    await evaluate(`document.querySelector('#rDelete').click();`); await sleep(700);
    r = await evaluate(`(async function(){ const exists=state.resources.some(x=>x.id==='${fileResourceId}'); const record=await getFileBlob('${fileBlobId}'); return {exists, record:!!record, count:state.resources.length}; })()`);
    check('Deleting a file resource removes its stored file', !r.exists && !r.record && r.count === 8, r);
    await restoreState(beforeLibrary);

    // 21 — mobile drawer + layout
    await go('plan', 390, 844, true);
    r = await evaluate(`({width: innerWidth, railToggle: getComputedStyle(document.querySelector('.rail-toggle')).display, tabbar: getComputedStyle(document.querySelector('.tabbar')).display, scrollWidth: document.documentElement.scrollWidth})`);
    check('Mobile shows drawer button and tabbar', r.railToggle === 'grid' && r.tabbar === 'grid', r);
    check('Mobile plan has no horizontal overflow', r.scrollWidth <= r.width + 1, r);
    await evaluate(`document.querySelector('.rail-toggle').click();`); await sleep(350);
    r = await evaluate(`({open: document.querySelector('#app').classList.contains('rail-open'), scrim: !document.querySelector('#railScrim').hidden})`);
    check('Mobile navigation drawer opens', r.open && r.scrim, r);
    await evaluate(`document.querySelector('#railScrim').click();`); await sleep(300);
    r = await evaluate(`({open: document.querySelector('#app').classList.contains('rail-open')})`);
    check('Drawer closes from the scrim', !r.open, r);
    await go('library', 390, 844, true);
    r = await evaluate(`({view: document.body.dataset.view, cards: document.querySelectorAll('.resource-card').length, tabs: document.querySelectorAll('.tab').length, top: !!document.querySelector('.library-top'), scrollWidth: document.documentElement.scrollWidth, width: innerWidth})`);
    check('Mobile library fits the viewport', r.view === 'library' && r.cards === 8 && r.tabs === 5 && r.top && r.scrollWidth <= r.width + 1, r);

    // 14 — mobile analytics and syllabus stay within the viewport
    await go('analytics', 390, 844, true);
    r = await evaluate(`({view: document.body.dataset.view, scrollWidth: document.documentElement.scrollWidth, width: innerWidth, panels: document.querySelectorAll('.analytics-grid .panel').length})`);
    check('Mobile analytics fits the viewport', r.view === 'analytics' && r.scrollWidth <= r.width + 1 && r.panels === 5, r);

    // 15 — export
    await go('plan', 390, 844, true);
    r = await evaluate(`(function(){ window.__download=null; window.downloadFile=function(name,text){ window.__download={name:name,text:text}; }; exportDayLog(todayKey()); return {has: !!window.__download, name: window.__download && window.__download.name, text: window.__download && window.__download.text.slice(0,80)}; })()`);
    check('Daily log export produces markdown', r.has && /\.md$/.test(r.name) && /# Study log/.test(r.text), r);

    // 16 — import backup
    await evaluate(`document.querySelector('#toasts').innerHTML='';`);
    const beforeImport = await evaluate(`({name: state.student, tasks: state.tasks.length})`);
    await evaluate(`(function(){ const b=JSON.parse(JSON.stringify(state)); b.tasks=b.tasks.slice(0,2); b.student='Import Test'; importJSONFile(new File([JSON.stringify(b)],'backup.json',{type:'application/json'})); })()`);
    await sleep(700);
    r = await evaluate(`({name: document.querySelector('#profileName').textContent, tasks: state.tasks.length, toast: Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | ')})`);
    check('Backup import replaces state', r.name === 'Import Test' && r.tasks === 2, r);
    check('Import toast confirms restore', /Backup imported/.test(r.toast || ''), r.toast);
    await evaluate(`document.querySelector('#toasts .toast-btn').click();`); await sleep(600);
    r = await evaluate(`({name: state.student, tasks: state.tasks.length})`);
    check('Import can be undone', r.name === beforeImport.name && r.tasks === beforeImport.tasks, r);
    await evaluate(`(function(){ const b=JSON.parse(JSON.stringify(state)); b.tasks=b.tasks.slice(0,2); b.student='Import Test'; importJSONFile(new File([JSON.stringify(b)],'backup.json',{type:'application/json'})); })()`);
    await sleep(600);

    // 17 — two-step reset
    await evaluate(`document.querySelector('[data-action="open-settings"]').click();`); await sleep(250);
    await evaluate(`document.querySelector('[data-action="reset-data"]').click();`); await sleep(200);
    r = await evaluate(`({armed: document.querySelector('[data-action="reset-data"]').dataset.armed, tasks: state.tasks.length})`);
    check('Reset requires a second confirmation', r.armed === '1' && r.tasks === 2, r);
    await evaluate(`document.querySelector('[data-action="reset-data"]').click();`); await sleep(500);
    r = await evaluate(`({tasks: state.tasks.length, empty: !!document.querySelector('.empty'), modalClosed: document.querySelector('#settingsOverlay').hidden})`);
    check('Confirmed reset clears data and closes settings', r.tasks === 0 && r.empty && r.modalClosed, r);

    // 18 — focus sprint completion logs a session
    await go('plan', 390, 844, true);
    await evaluate(`document.querySelector('#toasts').innerHTML='';`);
    const beforeSprints = await evaluate(`state.focusSessions.length`);
    await evaluate(`timer.remaining = 2; timerStart();`);
    await sleep(2700);
    r = await evaluate(`({count: state.focusSessions.length, toast: Array.from(document.querySelectorAll('.toast-msg')).map(n=>n.textContent).join(' | '), digits: document.querySelector('#timerDigits')?.textContent})`);
    check('A completed sprint is logged', r.count === beforeSprints + 1, r);
    check('Sprint completion notifies and resets timer', /focus sprint logged/.test(r.toast || '') && r.digits === '25:00', r);

    // 19 — legacy single-program data migrates
    const beforeMigration = await snapshotState();
    await evaluate(`(function(){
      const legacy={
        version:3,
        profile:{name:'Legacy Student',program:'Legacy Program',course:'Legacy Course',examLabel:'Legacy Exam',examDate:'2026-12-31',targetHours:2.5},
        tasks:[{id:'legacy-task',chapter:3,title:'Legacy session',date:todayKey(),start:'09:00',end:'10:00',priority:'core',note:'',steps:[{id:'legacy-step',text:'Legacy step',done:false}],createdAt:new Date().toISOString()}],
        focusSessions:[{id:'legacy-focus',date:todayKey(),minutes:30,at:new Date().toISOString()}]
      };
      localStorage.setItem('studyflow.v1',JSON.stringify(legacy));
    })()`);
    await reloadPage(); await sleep(900);
    r = await evaluate(`({version: state.version, programs: state.programs.length, student: state.student, active: activeProgram().name, course: activeProgram().course, taskProgram: state.tasks[0]?.programId, focusProgram: state.focusSessions[0]?.programId, activeId: state.activeProgramId, rail: document.querySelector('#programName').textContent, resources: state.resources.length, resourceProgram: state.resources[0]?.programId})`);
    check('Legacy profile and tasks migrate to a program', r.version === 9 && r.programs === 3 && r.student === 'Legacy Student' && r.active === 'Legacy Program' && r.course === 'Legacy Course', r);
    check('Migrated tasks and focus logs keep the program link', r.taskProgram === r.activeId && r.focusProgram === r.activeId && r.rail === 'Legacy Program', r);
    check('Legacy data receives a starter library', r.resources > 0 && r.resourceProgram === r.activeId, r);
    await restoreState(beforeMigration);

    const beforeFormats = await snapshotState();
    await evaluate(`(function(){
      const b=JSON.parse(JSON.stringify(state)); b.version=5;
      b.resources=[
        {id:'legacy-video',programId:b.activeProgramId,title:'Legacy video',type:'video',chapter:5,status:'to-read',url:'',note:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},
        {id:'legacy-notes',programId:b.activeProgramId,title:'Legacy notes',type:'notes',chapter:1,status:'reading',url:'',note:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
      ];
      localStorage.setItem('studyflow.v1',JSON.stringify(b));
    })()`);
    await reloadPage(); await sleep(900);
    r = await evaluate(`({version: state.version, resources: state.resources.map(item=>({title:item.title, format:item.format, type:item.type}))})`);
    check('Legacy resource types migrate to formats', r.version === 9 && r.resources[0].format === 'video' && r.resources[1].format === 'document' && !r.resources[0].type, r);
    await restoreState(beforeFormats);

    // 21 — keyboard, focus and cross-view search
    await go('plan', 1440, 1200, false);
    await evaluate(`(function(){ const s=document.querySelector('#search'); s.value='cost'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`); await sleep(350);
    await evaluate(`document.querySelector('a[href="#syllabus"]').click();`); await sleep(700);
    r = await evaluate(`({view: document.body.dataset.view, query: ui.query, value: document.querySelector('#search').value, placeholder: document.querySelector('#search').placeholder})`);
    check('Search clears when the view changes', r.view === 'syllabus' && !r.query && !r.value && !/library/i.test(r.placeholder), r);
    await go('plan', 1440, 1200, false);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))`); await sleep(200);
    r = await evaluate(`({active: document.activeElement.id})`);
    check('Ctrl K focuses the search field', r.active === 'search', r);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(250);
    await evaluate(`(function(){ const h=document.querySelector('#programsHeading'); h.focus(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true})); })()`); await sleep(150);
    r = await evaluate(`({inside: document.querySelector('#programsOverlay').contains(document.activeElement), action: document.activeElement.dataset.action})`);
    check('Shift+Tab wraps inside an open dialog', r.inside && r.action === 'new-program', r);
    await evaluate(`closeModal()`); await sleep(150);
    await evaluate(`document.querySelector('[data-action="open-programs"]').click();`); await sleep(200);
    await evaluate(`document.querySelector('[data-action="new-program"]').click();`); await sleep(250);
    await evaluate(`document.querySelector('#prCopy').click();`); await sleep(250);
    r = await evaluate(`({chapters: document.querySelectorAll('.builder-chapter').length, sections: document.querySelectorAll('.builder-section').length, name: document.querySelector('#prName').value})`);
    check('Copying a program fills the builder structure', r.chapters === 17 && r.sections === 6, r);
    await evaluate(`closeModal()`); await sleep(150);

    // 22 — markup hygiene
    r = await evaluate(`(function(){ const ids=[...document.querySelectorAll('[id]')].map(n=>n.id); const dupes=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))]; const nameless=[...document.querySelectorAll('button')].filter(b=>!b.innerText.trim() && !b.getAttribute('aria-label') && !b.title).length; return {dupes:dupes, nameless:nameless}; })()`);
    check('No duplicate element IDs', r.dupes.length === 0, r);
    check('Every button has an accessible name', r.nameless === 0, r);

    const errors = cdp.console.filter(entry => entry.type === 'exception' || entry.type === 'error');
    check('No console errors during the whole run', errors.length === 0, errors);

    ws.close();
  } finally {
    if (process.platform === 'win32') {
      try { spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (err) { chrome.kill(); }
    } else {
      chrome.kill('SIGTERM');
    }
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
  process.exitCode = failures ? 1 : 0;
}

main().catch(err => {
  console.error('HARNESS FAILED:', err);
  process.exitCode = 1;
});
