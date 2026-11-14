import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Users\\USER\\AppData\\Local\\ms-playwright\\chromium-1254\\chrome-win64\\chrome.exe';
const PORT = Number(process.env.PORT || 9333);
const ROOT = resolve('.');
const PROFILE = resolve('.shots-profile');
const PAGE = 'file:///' + resolve('StudyFlow.html').replace(/\\/g, '/');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch (err) { /* not ready */ }
    await sleep(250);
  }
  throw new Error('DevTools endpoint did not start');
}

function connect(url) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolvePromise(ws), { once: true });
    ws.addEventListener('error', err => reject(err), { once: true });
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.console = [];
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolvePromise, reject } = this.pending.get(msg.id);
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
      this.pending.set(id, { resolvePromise, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {}, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const view = args[0] || 'plan';
  const width = Number(args[1] || 1440);
  const height = Number(args[2] || 1200);
  const out = args[3] || `shots/${view}-${width}.png`;
  const mobile = width < 600;

  await mkdir('shots', { recursive: true });
  await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-breakpad',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--window-size=' + width + ',' + height, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    const info = await waitForDevtools();
    const ws = await connect(info.webSocketDebuggerUrl);
    const cdp = new CDP(ws);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height
    }, sessionId);
    await cdp.send('Page.navigate', { url: PAGE + '#' + view }, sessionId);
    await sleep(1500);

    if (process.env.SETUP) {
      await cdp.send('Runtime.evaluate', { expression: process.env.SETUP, returnByValue: true, awaitPromise: true }, sessionId);
      await sleep(450);
    }
    const summary = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        title: document.title,
        ready: document.readyState,
        sessions: document.querySelectorAll('.session').length,
        view: document.querySelector('#viewInner')?.innerText?.slice(0, 160),
        tasks: (typeof state !== 'undefined' && state.tasks) ? state.tasks.length : 'no-state',
        today: (typeof state !== 'undefined' && state.tasks) ? state.tasks.filter(t => t.date === todayKey()).length : 'n/a',
        innerHTML: document.querySelector('#viewInner')?.innerHTML?.length || 0,
        h1: document.querySelector('h1')?.textContent,
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        appView: document.querySelector('#app')?.dataset.view,
        bodyView: document.body.dataset.view,
        menu: (() => { const m = document.getElementById('taskMenu'); return m ? { hidden: m.hidden, len: m.innerHTML.length, rect: Object.assign({}, m.getBoundingClientRect().toJSON()) } : null; })(),
        fabDisplay: (() => { const f = document.querySelector('.fab'); return f ? getComputedStyle(f).display : 'absent'; })(),
        railToggle: (() => { const b = document.querySelector('.rail-toggle'); return b ? getComputedStyle(b).display : 'missing'; })()
      })`, returnByValue: true
    }, sessionId);
    console.log('SUMMARY:', summary.result.value);
    const errors = cdp.console.filter(entry => entry.type === 'exception' || entry.type === 'error');
    if (errors.length) console.log('CONSOLE:', JSON.stringify(errors.slice(0, 10), null, 2));
    else console.log('CONSOLE: clean');

    const metrics = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
    const viewportOnly = process.env.VIEWPORT_ONLY === '1';
    const pageHeight = viewportOnly ? height : Math.min(Math.ceil(metrics.cssContentSize.height), 5000);
    const pageWidth = Math.ceil(metrics.cssContentSize.width);
    const shot = viewportOnly
      ? await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId)
      : await cdp.send('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: pageWidth, height: pageHeight, scale: 1 }
        }, sessionId);
    await writeFile(out, Buffer.from(shot.data, 'base64'));
    console.log(`SHOT: ${out} (${pageWidth}x${pageHeight})`);

    if (process.env.INTERACT === '1') {
      const run = async (expression, label) => {
        const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        console.log('TEST ' + label + ':', JSON.stringify(result.result.value));
      };
      await run(`document.querySelector('.check-row')?.click(); 'clicked'`, 'toggle-step');
      await sleep(350);
      await run(`({checked: document.querySelectorAll('.check-row[aria-pressed="true"]').length, hero: document.querySelector('.goal-pct')?.textContent, title: document.title})`, 'after-toggle');
      await run(`(function(){ const b=document.querySelector('[data-action="new-task"]'); b.click(); return {open: !document.querySelector('#sessionOverlay').hidden, active: document.activeElement.id}; })()`, 'open-modal');
      await sleep(250);
      await run(`(function(){ document.querySelector('#fTitle').value='Verification session'; document.querySelector('#fSteps').value='Step one\\nStep two'; document.querySelector('#sessionSubmit').click(); return 'submitted'; })()`, 'submit-modal');
      await sleep(350);
      await run(`({modalClosed: document.querySelector('#sessionOverlay').hidden, count: state.tasks.filter(t => t.title==='Verification session').length, toast: document.querySelector('.toast-msg')?.textContent})`, 'after-submit');
      await run(`(function(){ const s=document.querySelector('#search'); s.value='variance'; s.dispatchEvent(new Event('input',{bubbles:true})); return 'typed'; })()`, 'search');
      await sleep(500);
      await run(`({sessions: document.querySelectorAll('.session').length, banner: document.querySelector('.search-banner')?.innerText})`, 'search-result');
      await run(`(function(){ document.querySelector('.search-clear')?.click(); return 'cleared'; })()`, 'clear-search');
      await run(`(function(){ document.querySelector('[data-action="timer-toggle"]').click(); return document.querySelector('#timerDigits').textContent; })()`, 'timer-start');
      await sleep(1400);
      await run(`({digits: document.querySelector('#timerDigits')?.textContent, title: document.title})`, 'timer-running');
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exitCode = 1;
});
