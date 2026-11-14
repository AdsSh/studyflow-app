/* ==========================================================================
   StudyFlow — interactions, timer, persistence
   ========================================================================== */

const els = {
  app: document.getElementById('app'),
  view: document.getElementById('view'),
  inner: document.getElementById('viewInner'),
  search: document.getElementById('search'),
  scrim: document.getElementById('railScrim'),
  menu: document.getElementById('taskMenu'),
  sessionOverlay: document.getElementById('sessionOverlay'),
  chapterOverlay: document.getElementById('chapterOverlay'),
  settingsOverlay: document.getElementById('settingsOverlay'),
  programsOverlay: document.getElementById('programsOverlay'),
  programOverlay: document.getElementById('programOverlay'),
  resourceOverlay: document.getElementById('resourceOverlay'),
  previewOverlay: document.getElementById('previewOverlay'),
  sessionForm: document.getElementById('sessionForm'),
  chapterForm: document.getElementById('chapterForm'),
  settingsForm: document.getElementById('settingsForm'),
  programForm: document.getElementById('programForm'),
  resourceForm: document.getElementById('resourceForm'),
  programList: document.getElementById('programList'),
  sessionHeading: document.getElementById('sessionHeading'),
  sessionEyebrow: document.getElementById('sessionEyebrow'),
  sessionSubmit: document.getElementById('sessionSubmit'),
  fChapter: document.getElementById('fChapter'),
  fDate: document.getElementById('fDate'),
  fPriority: document.getElementById('fPriority'),
  fRepeat: document.getElementById('fRepeat'),
  repeatHint: document.getElementById('repeatHint'),
  fTitle: document.getElementById('fTitle'),
  fStart: document.getElementById('fStart'),
  fEnd: document.getElementById('fEnd'),
  fSteps: document.getElementById('fSteps'),
  fNote: document.getElementById('fNote'),
  stepCount: document.getElementById('stepCount'),
  formError: document.getElementById('formError'),
  pChapter: document.getElementById('pChapter'),
  pDate: document.getElementById('pDate'),
  pSessions: document.getElementById('pSessions'),
  pStart: document.getElementById('pStart'),
  pLength: document.getElementById('pLength'),
  pPreview: document.getElementById('pPreview'),
  pSummary: document.getElementById('pSummary'),
  pError: document.getElementById('pError'),
  pSubmit: document.getElementById('pSubmit'),
  sName: document.getElementById('sName'),
  sProgram: document.getElementById('sProgram'),
  sCourse: document.getElementById('sCourse'),
  sExamLabel: document.getElementById('sExamLabel'),
  sExamDate: document.getElementById('sExamDate'),
  sTarget: document.getElementById('sTarget'),
  prName: document.getElementById('prName'),
  prCourse: document.getElementById('prCourse'),
  prExamLabel: document.getElementById('prExamLabel'),
  prExamDate: document.getElementById('prExamDate'),
  prTarget: document.getElementById('prTarget'),
  prSections: document.getElementById('prSections'),
  prError: document.getElementById('prError'),
  prSubmit: document.getElementById('prSubmit'),
  prCopy: document.getElementById('prCopy'),
  prClear: document.getElementById('prClear'),
  prDelete: document.getElementById('prDelete'),
  programFormHeading: document.getElementById('programFormHeading'),
  programFormEyebrow: document.getElementById('programFormEyebrow'),
  rTitle: document.getElementById('rTitle'),
  rFormat: document.getElementById('rFormat'),
  rStatus: document.getElementById('rStatus'),
  rChapter: document.getElementById('rChapter'),
  rUrl: document.getElementById('rUrl'),
  rLinkHint: document.getElementById('rLinkHint'),
  rFile: document.getElementById('rFile'),
  rFilePicker: document.getElementById('rFilePicker'),
  rFileInfo: document.getElementById('rFileInfo'),
  rFileName: document.getElementById('rFileName'),
  rFileSize: document.getElementById('rFileSize'),
  rFileHint: document.getElementById('rFileHint'),
  rNote: document.getElementById('rNote'),
  rError: document.getElementById('rError'),
  rSubmit: document.getElementById('rSubmit'),
  rDelete: document.getElementById('rDelete'),
  resourceFormHeading: document.getElementById('resourceFormHeading'),
  resourceEyebrow: document.getElementById('resourceEyebrow'),
  previewHeading: document.getElementById('previewHeading'),
  previewEyebrow: document.getElementById('previewEyebrow'),
  previewMedia: document.getElementById('previewMedia'),
  previewMeta: document.getElementById('previewMeta'),
  previewNotes: document.getElementById('previewNotes'),
  previewEdit: document.getElementById('previewEdit'),
  previewExternal: document.getElementById('previewExternal'),
  importFile: document.getElementById('importFile'),
  saveAlert: document.getElementById('saveAlert'),
  saveAlertMsg: document.getElementById('saveAlertMsg'),
  recoveryAlert: document.getElementById('recoveryAlert'),
  syncAlert: document.getElementById('syncAlert'),
  live: document.getElementById('live')
};

let lastFocusBeforeModal = null;
let searchTimer = 0;
let dayMarker = todayKey();
let armedTimers = {};

/* ---------- local file storage ---------- */
const FILE_DB_NAME = 'studyflow.files.v1';
const FILE_STORE = 'files';
let fileDbPromise = null;
function openFileDb() {
  if (fileDbPromise) return fileDbPromise;
  fileDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('File storage is not available'));
      return;
    }
    const request = indexedDB.open(FILE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('File storage is not available'));
    request.onblocked = () => reject(new Error('File storage is blocked'));
  });
  return fileDbPromise;
}
async function putFileBlob(record) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error || new Error('Could not store the file'));
    tx.onabort = () => reject(tx.error || new Error('Could not store the file'));
  });
}
async function getFileBlob(id) {
  if (!id) return null;
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly');
    const request = tx.objectStore(FILE_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read the file'));
  });
}
async function deleteFileBlob(id) {
  if (!id) return;
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not delete the file'));
  });
}
async function pruneFileBlobs(validIds) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    const store = tx.objectStore(FILE_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      (request.result || []).forEach(key => {
        if (!validIds.has(String(key))) store.delete(key);
      });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not tidy file storage'));
  });
}
async function clearFileBlobs() {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not clear file storage'));
  });
}
function pruneFilesSoon() {
  const valid = new Set(state.resources.map(resource => resource.fileId).filter(Boolean).map(String));
  pruneFileBlobs(valid).catch(() => {});
}
function releasePreviewObjectUrl() {
  if (ui.previewObjectUrl) {
    try { URL.revokeObjectURL(ui.previewObjectUrl); } catch (err) { /* noop */ }
    ui.previewObjectUrl = '';
  }
}

/* ---------- timer persistence ---------- */
function saveTimerState() {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      mode: timer.mode,
      remaining: timer.remaining,
      running: timer.running,
      endAt: timer.endAt,
      taskId: timer.taskId,
      programId: timer.programId,
      savedAt: Date.now()
    }));
  } catch (err) { /* storage may be unavailable */ }
}
function clearTimerState() {
  try { localStorage.removeItem(TIMER_KEY); } catch (err) { /* noop */ }
}
function restoreTimerState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); } catch (err) { raw = null; }
  if (!raw || typeof raw !== 'object') return;
  timer.mode = Number(raw.mode) === 50 ? 50 : 25;
  timer.taskId = raw.taskId && state.tasks.some(t => t.id === raw.taskId) ? raw.taskId : null;
  timer.programId = raw.programId && state.programs.some(p => p.id === raw.programId) ? raw.programId : state.activeProgramId;
  if (raw.running && Number.isFinite(Number(raw.endAt))) {
    const endAt = Number(raw.endAt);
    const secondsLeft = Math.ceil((endAt - Date.now()) / 1000);
    if (secondsLeft > 0) {
      timer.running = true;
      timer.endAt = endAt;
      timer.remaining = secondsLeft;
      clearInterval(timer.interval);
      timer.interval = setInterval(timerTick, 250);
      toast('Focus timer resumed · ' + mmss(secondsLeft) + ' left', { icon: 'timer', duration: 2800 });
      return;
    }
    if (Date.now() - endAt < 24 * 3600 * 1000) {
      const ended = new Date(endAt);
      state.focusSessions.push({
        id: uid('focus'),
        programId: timer.programId && state.programs.some(p => p.id === timer.programId) ? timer.programId : state.activeProgramId,
        date: dateKey(ended),
        minutes: timer.mode,
        at: ended.toISOString()
      });
      saveState();
      toast(timer.mode + ' minute sprint completed while you were away', { tone: 'done', icon: 'check-circle', duration: 5200 });
    }
    timer.running = false;
    timer.remaining = timer.mode * 60;
    clearTimerState();
    return;
  }
  timer.running = false;
  timer.remaining = clamp(Number(raw.remaining) || timer.mode * 60, 0, timer.mode * 60);
  if (timer.remaining <= 0) timer.remaining = timer.mode * 60;
}

/* ---------- timer ---------- */
function timerTick() {
  const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  if (remaining !== timer.remaining) {
    timer.remaining = remaining;
    syncTimerUI();
  }
  if (remaining <= 0) timerFinish();
}
function timerStart() {
  if (timer.running) return;
  if (!timer.programId) timer.programId = state.activeProgramId;
  if (timer.remaining <= 0) timer.remaining = timer.mode * 60;
  timer.running = true;
  timer.endAt = Date.now() + timer.remaining * 1000;
  clearInterval(timer.interval);
  timer.interval = setInterval(timerTick, 250);
  timer.remaining = Math.max(1, Math.ceil((timer.endAt - Date.now()) / 1000));
  syncTimerUI();
  saveTimerState();
}
function timerPause() {
  if (!timer.running) return;
  clearInterval(timer.interval);
  timer.interval = 0;
  timer.running = false;
  timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  syncTimerUI();
  saveTimerState();
}
function timerReset() {
  clearInterval(timer.interval);
  timer.interval = 0;
  timer.running = false;
  timer.remaining = timer.mode * 60;
  syncTimerUI();
  saveTimerState();
}
function timerFinish() {
  clearInterval(timer.interval);
  timer.interval = 0;
  timer.running = false;
  const minutes = timer.mode;
  const task = timerTask();
  const programId = timer.programId && state.programs.some(program => program.id === timer.programId)
    ? timer.programId
    : state.activeProgramId;
  timer.remaining = minutes * 60;
  state.focusSessions.push({ id: uid('focus'), programId: programId, date: todayKey(), minutes: minutes, at: new Date().toISOString() });
  timer.taskId = null;
  timer.programId = null;
  saveState();
  saveTimerState();
  render();
  toast(minutes + ' minute focus sprint logged' + (task ? ' · Ch ' + task.chapter : ''), { tone: 'done', icon: 'check-circle', duration: 5200 });
}
function setTimerMode(mode) {
  const next = Number(mode) === 50 ? 50 : 25;
  clearInterval(timer.interval);
  timer.interval = 0;
  timer.running = false;
  timer.mode = next;
  timer.remaining = next * 60;
  render();
  saveTimerState();
  toast(next + ' minute interval selected', { icon: 'timer', duration: 2000 });
}
function focusFree() {
  if (timer.running) {
    const runningCard = document.getElementById('timerCard');
    if (runningCard) runningCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Focus timer is already running', { icon: 'timer', duration: 2200 });
    return;
  }
  timer.taskId = null;
  timer.programId = state.activeProgramId;
  timerStart();
  syncTimerUI();
  saveTimerState();
  toast('Focus timer started · ' + timer.mode + ' minutes', { icon: 'timer', duration: 2400 });
}
function focusTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  timer.taskId = task.id;
  timer.programId = task.programId || state.activeProgramId;
  if (!timer.running) timerStart();
  syncTimerUI();
  saveTimerState();
  const chapter = chapterOf(task.chapter);
  toast('Focus sprint · ' + (chapter ? 'Ch ' + chapter.no + ' ' : '') + task.title, { icon: 'timer', duration: 3200 });
}

/* ---------- modal helpers ---------- */
function modalsOpen() {
  return !els.sessionOverlay.hidden || !els.chapterOverlay.hidden || !els.settingsOverlay.hidden ||
    !els.programsOverlay.hidden || !els.programOverlay.hidden || !els.resourceOverlay.hidden || !els.previewOverlay.hidden;
}
function restoreFocus() {
  if (lastFocusBeforeModal && lastFocusBeforeModal.isConnected) {
    try { lastFocusBeforeModal.focus({ preventScroll: true }); } catch (err) { /* noop */ }
  }
  lastFocusBeforeModal = null;
}
function closeModal() {
  const wasOpen = modalsOpen();
  els.sessionOverlay.hidden = true;
  els.chapterOverlay.hidden = true;
  els.settingsOverlay.hidden = true;
  els.programsOverlay.hidden = true;
  els.programOverlay.hidden = true;
  els.resourceOverlay.hidden = true;
  els.previewOverlay.hidden = true;
  document.body.classList.remove('is-modal-open');
  ui.editingId = null;
  ui.builderProgramId = null;
  ui.editingResourceId = null;
  ui.previewResourceId = null;
  ui.pendingFile = null;
  ui.fileRemoved = false;
  releasePreviewObjectUrl();
  if (wasOpen) restoreFocus();
}
function openOverlay(overlay) {
  closeTaskMenu();
  lastFocusBeforeModal = document.activeElement;
  els.sessionOverlay.hidden = true;
  els.chapterOverlay.hidden = true;
  els.settingsOverlay.hidden = true;
  els.programsOverlay.hidden = true;
  els.programOverlay.hidden = true;
  els.resourceOverlay.hidden = true;
  els.previewOverlay.hidden = true;
  overlay.hidden = false;
  document.body.classList.add('is-modal-open');
}

function defaultSlot(key) {
  const isToday = key === todayKey();
  let start = 9 * 60;
  if (isToday) {
    const now = nowMinutes();
    start = Math.ceil((now + 10) / 30) * 30;
    if (start < 8 * 60 || start > 21 * 60) start = 9 * 60;
  }
  const end = Math.min(start + 90, 23 * 60 + 30);
  return { start: minToTime(start), end: minToTime(end) };
}

function populateChapterSelect() {
  const sections = activeSections();
  const chapters = activeChapters();
  const options = sections.map(section =>
    '<optgroup label="' + section.id + ' · ' + esc(section.name) + ' (' + section.weight + '%)">' +
      chapters.filter(chapter => chapter.section === section.id).map(chapter =>
        '<option value="' + chapter.no + '">Ch ' + pad2(chapter.no) + ' — ' + esc(chapter.title) + '</option>'
      ).join('') +
    '</optgroup>'
  ).join('');
  els.fChapter.innerHTML = options;
  if (els.pChapter) els.pChapter.innerHTML = options;
}
function updateChapterHint() {
  const chapter = chapterOf(Number(els.fChapter.value));
  if (chapter) {
    els.fTitle.placeholder = 'e.g. ' + chapter.topics[0];
    ui.lastChapter = chapter.no;
  }
}
function updateStepCount() {
  const lines = els.fSteps.value.split('\n').map(line => line.trim()).filter(Boolean);
  els.stepCount.textContent = lines.length + (lines.length === 1 ? ' step' : ' steps');
}
function updateRepeatHint() {
  if (els.fRepeat.disabled) {
    els.repeatHint.textContent = 'Editing one session at a time.';
    return;
  }
  const date = els.fDate.value || ui.date;
  const mode = els.fRepeat.value;
  const count = repeatDates(date, mode).length;
  els.repeatHint.textContent = repeatDescription(date, mode);
  if (!ui.editingId) {
    els.sessionSubmit.innerHTML = icon('plus') + '<span>' + (count > 1 ? 'Schedule ' + count + ' sessions' : 'Schedule session') + '</span>';
  }
}
function openSessionModal(options) {
  if (!activeChapters().length) {
    toast('Add chapters to this program before scheduling', { icon: 'info' });
    const program = activeProgram();
    if (program) openProgramBuilder(program.id);
    return;
  }
  const opts = options || {};
  const task = opts.task || null;
  const chapterNo = task ? task.chapter : (opts.chapter || ui.lastChapter || 1);
  const date = task ? task.date : (opts.date || ui.date);
  const slot = defaultSlot(date);
  const steps = task ? task.steps.map(s => s.text) : (opts.steps || []);

  ui.editingId = task ? task.id : null;
  populateChapterSelect();
  els.fChapter.value = String(chapterNo);
  els.fDate.value = date;
  els.fPriority.value = task ? task.priority : 'core';
  els.fRepeat.value = 'once';
  els.fRepeat.disabled = !!task;
  els.fTitle.value = task ? task.title : (opts.title || '');
  els.fStart.value = task ? task.start : slot.start;
  els.fEnd.value = task ? task.end : slot.end;
  els.fSteps.value = steps.join('\n');
  els.fNote.value = task ? task.note : '';
  els.formError.hidden = true;
  els.formError.textContent = '';
  updateChapterHint();
  updateStepCount();

  els.sessionHeading.textContent = task ? 'Edit study session' : 'Schedule a study session';
  els.sessionEyebrow.textContent = task ? 'Refine the plan' : 'Plan a session';
  els.sessionSubmit.innerHTML = icon(task ? 'check' : 'plus') + '<span>' + (task ? 'Save changes' : 'Schedule session') + '</span>';
  updateRepeatHint();
  openOverlay(els.sessionOverlay);
  setTimeout(() => {
    if (task) els.fTitle.focus();
    else els.fChapter.focus();
  }, 40);
}

function openSettings() {
  const program = activeProgram();
  els.sName.value = state.student || 'Student';
  els.sProgram.value = program ? program.name : '';
  els.sCourse.value = program ? program.course : '';
  els.sExamLabel.value = program ? program.examLabel : '';
  els.sExamDate.value = program ? program.examDate : '';
  els.sTarget.value = program ? program.targetHours : 3.5;
  openOverlay(els.settingsOverlay);
  setTimeout(() => els.sName.focus(), 40);
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = false;
  els.formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- task operations ---------- */
function toggleStep(taskId, index) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.steps[index]) return;
  task.steps[index].done = !task.steps[index].done;
  saveState();
  ui.lastChecked = { task: taskId, index: index };
  const counts = stepCounts(task);
  if (els.live) els.live.textContent = task.title + ': ' + counts.done + ' of ' + counts.total + ' steps complete.';
  render();
  if (taskIsDone(task)) toast('Session complete — ' + task.title, { tone: 'done', duration: 3000 });
}
function completeAll(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const allDone = taskIsDone(task);
  task.steps.forEach(step => { step.done = !allDone; });
  saveState();
  render();
  toast(allDone ? 'Checklist reset' : 'All steps checked', { tone: 'done', icon: allDone ? 'rotate' : 'check-circle', duration: 2400 });
}
function deleteTask(taskId) {
  const index = state.tasks.findIndex(t => t.id === taskId);
  if (index < 0) return;
  const removed = state.tasks.splice(index, 1)[0];
  if (timer.taskId === removed.id) {
    timer.taskId = null;
    saveTimerState();
  }
  saveState();
  render();
  toast('Session deleted — ' + removed.title, {
    action: 'Undo',
    duration: 6500,
    onAction: () => {
      state.tasks.splice(index, 0, removed);
      saveState();
      ui.animate = false;
      render();
      toast('Session restored', { tone: 'done', duration: 2200 });
    }
  });
}
function repeatDay(sourceKey) {
  const source = tasksOn(sourceKey);
  if (!source.length) { toast('Nothing scheduled on that day', { icon: 'info' }); return; }
  source.forEach(task => {
    state.tasks.push({
      id: uid('task'),
      programId: task.programId || state.activeProgramId,
      chapter: task.chapter,
      title: task.title,
      date: ui.date,
      start: task.start,
      end: task.end,
      priority: task.priority,
      note: task.note,
      steps: task.steps.map(step => ({ id: uid('step'), text: step.text, done: false })),
      createdAt: new Date().toISOString()
    });
  });
  saveState();
  ui.animate = true;
  render();
  toast(source.length + ' session' + (source.length === 1 ? '' : 's') + ' copied to ' + relativeDayLabel(ui.date).toLowerCase(), { tone: 'done' });
}
function moveTask(taskId, targetKey) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(String(targetKey || '')) || task.date === targetKey) return;
  const from = task.date;
  task.date = targetKey;
  ui.carryDismissed = null;
  saveState();
  ui.animate = false;
  render();
  toast('Moved to ' + relativeDayLabel(targetKey).toLowerCase() + ' · ' + task.title, {
    action: 'Undo',
    duration: 5200,
    onAction: () => {
      task.date = from;
      saveState();
      ui.animate = false;
      render();
    }
  });
}
function carryAllUnfinished() {
  const items = unfinishedTasks(7);
  if (!items.length) { toast('Nothing left to carry over', { icon: 'check-circle', tone: 'done' }); return; }
  const today = todayKey();
  const moves = items.map(task => ({ task: task, from: task.date }));
  moves.forEach(move => { move.task.date = today; });
  ui.carryDismissed = null;
  ui.carryOpen = false;
  saveState();
  ui.animate = false;
  render();
  toast('Moved ' + moves.length + ' session' + (moves.length === 1 ? '' : 's') + ' to today', {
    action: 'Undo',
    duration: 6200,
    onAction: () => {
      moves.forEach(move => { move.task.date = move.from; });
      saveState();
      ui.animate = false;
      render();
      toast('Carry-over reverted', { icon: 'rotate', duration: 2200 });
    }
  });
}
function copyDayToNext(key) {
  const tasks = tasksOn(key);
  if (!tasks.length) { toast('Nothing scheduled to copy', { icon: 'info' }); return; }
  const target = dateKey(addDays(parseKey(key), 1));
  const created = tasks.map(task => ({
    id: uid('task'),
    programId: task.programId || state.activeProgramId,
    chapter: task.chapter,
    title: task.title,
    date: target,
    start: task.start,
    end: task.end,
    priority: task.priority,
    note: task.note,
    steps: task.steps.map(step => ({ id: uid('step'), text: step.text, done: false })),
    createdAt: new Date().toISOString()
  }));
  state.tasks.push.apply(state.tasks, created);
  saveState();
  ui.animate = false;
  render();
  toast(created.length + ' session' + (created.length === 1 ? '' : 's') + ' copied to ' + relativeDayLabel(target).toLowerCase(), {
    tone: 'done',
    duration: 4400,
    action: 'View',
    onAction: () => selectDay(target)
  });
}
function reconcileTimerTask() {
  if (timer.taskId && !state.tasks.some(task => task.id === timer.taskId)) {
    timer.taskId = null;
    saveTimerState();
  }
}

/* ---------- task menu ---------- */
function openTaskMenu(taskId, anchor) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !anchor) return;
  const chapter = chapterOf(task.chapter);
  const allDone = taskIsDone(task);
  const moveTarget = task.date < todayKey() ? todayKey() : dateKey(addDays(parseKey(task.date), 1));
  const moveLabel = task.date < todayKey() ? 'Move to today' : 'Move to tomorrow';
  els.menu.innerHTML =
    '<div class="menu-label">' + (chapter ? 'Ch ' + chapter.no + ' · ' : '') + timeRange(task.start, task.end) + '</div>' +
    '<button type="button" role="menuitem" data-action="focus-task" data-task="' + task.id + '">' + icon('timer') + 'Start ' + timer.mode + 'm focus</button>' +
    '<button type="button" role="menuitem" data-action="complete-all" data-task="' + task.id + '">' + icon('check-circle') + (allDone ? 'Reset checklist' : 'Mark all complete') + '</button>' +
    '<button type="button" role="menuitem" data-action="edit-task" data-task="' + task.id + '">' + icon('edit') + 'Edit session</button>' +
    '<button type="button" role="menuitem" data-action="move-task" data-task="' + task.id + '" data-target="' + moveTarget + '">' + icon('calendar') + moveLabel + '</button>' +
    '<hr class="menu-sep">' +
    '<button type="button" role="menuitem" class="is-danger" data-action="delete-task" data-task="' + task.id + '">' + icon('trash') + 'Delete session</button>';
  els.menu.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const width = els.menu.offsetWidth;
  const height = els.menu.offsetHeight;
  let left = Math.min(rect.right - width, window.innerWidth - width - 10);
  left = Math.max(10, left);
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 10) top = rect.top - height - 6;
  top = Math.max(10, top);
  els.menu.style.left = left + 'px';
  els.menu.style.top = top + 'px';
  const first = els.menu.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function closeTaskMenu() {
  if (els.menu && !els.menu.hidden) {
    els.menu.hidden = true;
    els.menu.innerHTML = '';
  }
}

/* ---------- programs ---------- */
function examDaysFor(program) {
  if (!program) return 0;
  return Math.ceil((startOfDay(parseKey(program.examDate)) - startOfDay(new Date())) / 86400000);
}
function openPrograms() {
  renderProgramList();
  openOverlay(els.programsOverlay);
  setTimeout(() => {
    const heading = document.getElementById('programsHeading');
    if (heading) heading.focus({ preventScroll: true });
  }, 40);
}
function programInitials(program) {
  const words = String(program && (program.course || program.name) || '').split(/\s+/)
    .filter(word => word && !/^(and|&|of|the|for)$/i.test(word));
  return initials(words.join(' '));
}
function renderProgramList() {
  els.programList.innerHTML = state.programs.map(program => {
    const tasks = state.tasks.filter(task => task.programId === program.id);
    let steps = 0, done = 0;
    tasks.forEach(task => { const counts = stepCounts(task); steps += counts.total; done += counts.done; });
    const pct = steps ? Math.round((done / steps) * 100) : 0;
    const days = examDaysFor(program);
    const active = program.id === state.activeProgramId;
    return '<div class="program-row' + (active ? ' is-active' : '') + '">' +
      '<button type="button" class="program-main" data-action="switch-program" data-program="' + program.id + '">' +
        '<span class="program-badge" aria-hidden="true">' + programInitials(program) + '</span>' +
        '<span class="program-copy"><b>' + esc(program.name) + '</b><span>' + esc(program.course) + ' · ' + program.chapters.length + ' chapters</span></span>' +
        '<span class="program-meta"><b>' + pct + '%</b><span>' + (days > 0 ? days + ' days' : 'Exam passed') + '</span></span>' +
        (active ? '<span class="program-check" aria-label="Active program">' + icon('check') + '</span>' : '') +
      '</button>' +
      '<button type="button" class="icon-btn" data-action="edit-program" data-program="' + program.id + '" aria-label="Edit ' + esc(program.name) + '">' + icon('edit') + '</button>' +
    '</div>';
  }).join('');
}
function switchProgram(programId) {
  if (programId === state.activeProgramId) { closeModal(); return; }
  const program = state.programs.find(item => item.id === programId);
  if (!program) return;
  state.activeProgramId = program.id;
  saveState();
  ui.date = todayKey();
  ui.weekStart = dateKey(mondayOf(new Date()));
  ui.query = '';
  ui.openChapters.clear();
  ui.carryDismissed = null;
  ui.carryOpen = false;
  ui.lastChapter = null;
  ui.libraryFormat = 'all';
  ui.libraryStatus = 'all';
  ui.librarySort = 'recent';
  if (els.search) els.search.value = '';
  updateSearchChrome();
  closeModal();
  ui.animate = true;
  render();
  toast('Switched to ' + program.name, { tone: 'done', duration: 2400 });
}
function builderChapterHTML(chapter, lockedCount) {
  const locked = Number(lockedCount) > 0;
  return '<div class="builder-chapter" data-chapter-no="' + chapter.no + '" data-locked="' + (locked ? 1 : 0) + '">' +
    '<span class="builder-chapter-no">' + pad2(chapter.no) + '</span>' +
    '<div class="builder-chapter-fields">' +
      '<input type="text" class="builder-chapter-title" value="' + esc(chapter.title || '') + '" placeholder="Chapter title" maxlength="120" aria-label="Chapter title">' +
      '<input type="text" class="builder-chapter-topics" value="' + esc((chapter.topics || []).join('; ')) + '" placeholder="Topics, separated by semicolons" maxlength="600" aria-label="Chapter topics">' +
    '</div>' +
    (locked
      ? '<span class="builder-lock" title="' + lockedCount + ' scheduled session' + (lockedCount === 1 ? '' : 's') + '">' + icon('check-circle') + lockedCount + '</span>'
      : '<button type="button" class="icon-btn" data-action="remove-program-chapter" aria-label="Remove chapter">' + icon('x') + '</button>') +
  '</div>';
}
function builderSectionHTML(section, chapters, lockedCounts) {
  const list = chapters || [];
  return '<section class="builder-section" data-section-id="' + esc(section.id) + '">' +
    '<div class="builder-section-head">' +
      '<span class="builder-letter" aria-hidden="true">' + esc(section.id) + '</span>' +
      '<input type="text" class="builder-section-name" value="' + esc(section.name || '') + '" placeholder="Section name" maxlength="60" aria-label="Section name">' +
      '<label class="builder-weight"><input type="number" class="builder-section-weight" min="0" max="100" step="1" value="' + (Number(section.weight) || 0) + '" aria-label="Section weight">%</label>' +
      '<button type="button" class="icon-btn" data-action="remove-program-section" aria-label="Remove section">' + icon('x') + '</button>' +
    '</div>' +
    '<div class="builder-chapters">' +
      list.map(chapter => builderChapterHTML(chapter, lockedCounts ? lockedCounts[Number(chapter.no)] : 0)).join('') +
    '</div>' +
    '<button type="button" class="builder-add-chapter" data-action="add-program-chapter">' + icon('plus') + ' Add chapter</button>' +
  '</section>';
}
function nextSectionLetter() {
  const used = new Set(Array.from(els.prSections.querySelectorAll('.builder-section')).map(section => section.dataset.sectionId));
  for (let i = 0; i < LETTERS.length; i++) {
    if (!used.has(LETTERS[i])) return LETTERS[i];
  }
  return 'S' + (used.size + 1);
}
function nextBuilderChapterNo() {
  const numbers = Array.from(els.prSections.querySelectorAll('.builder-chapter'))
    .map(chapter => Number(chapter.dataset.chapterNo) || 0);
  return Math.max(0, ...numbers) + 1;
}
function addProgramSection() {
  const id = nextSectionLetter();
  const chapterNo = nextBuilderChapterNo();
  els.prSections.insertAdjacentHTML('beforeend', builderSectionHTML(
    { id: id, name: 'New section', weight: 0 },
    [{ no: chapterNo, title: '', topics: [] }],
    {}
  ));
  const sections = els.prSections.querySelectorAll('.builder-section');
  const last = sections[sections.length - 1];
  const name = last.querySelector('.builder-section-name');
  if (name) { name.focus(); name.select(); }
}
function addProgramChapter(section) {
  if (!section) return;
  const chapterNo = nextBuilderChapterNo();
  section.querySelector('.builder-chapters').insertAdjacentHTML('beforeend', builderChapterHTML({ no: chapterNo, title: '', topics: [] }, 0));
  const chapters = section.querySelectorAll('.builder-chapter');
  const last = chapters[chapters.length - 1];
  const title = last.querySelector('.builder-chapter-title');
  if (title) title.focus();
}
function removeProgramSection(section) {
  if (!section) return;
  if (section.querySelector('.builder-chapter[data-locked="1"]')) {
    toast('This section has chapters with scheduled sessions and cannot be removed', { icon: 'info' });
    return;
  }
  section.remove();
  if (!els.prSections.querySelector('.builder-section')) {
    els.prSections.innerHTML = builderSectionHTML(
      { id: 'A', name: 'General', weight: 100 },
      [{ no: 1, title: '', topics: [] }],
      {}
    );
  }
}
function removeProgramChapter(row) {
  if (!row) return;
  if (row.dataset.locked === '1') {
    toast('This chapter has scheduled sessions and cannot be removed', { icon: 'info' });
    return;
  }
  row.remove();
}
function copyProgramStructure() {
  const source = activeProgram();
  if (!source) return;
  const locked = {};
  els.prSections.innerHTML = source.sections.map(section =>
    builderSectionHTML(section, source.chapters.filter(chapter => chapter.section === section.id), locked)
  ).join('');
  toast('Structure copied from ' + source.name, { icon: 'copy', duration: 2600 });
}
function clearProgramStructure() {
  els.prSections.innerHTML = builderSectionHTML(
    { id: 'A', name: 'General', weight: 100 },
    [{ no: 1, title: '', topics: [] }],
    {}
  );
}
function openProgramBuilder(programId) {
  const editing = programId ? state.programs.find(program => program.id === programId) : null;
  ui.builderProgramId = editing ? editing.id : null;
  els.prName.value = editing ? editing.name : '';
  els.prCourse.value = editing ? editing.course : '';
  els.prExamLabel.value = editing ? editing.examLabel : 'Exam';
  els.prExamDate.value = editing ? editing.examDate : dateKey(addDays(new Date(), 30));
  els.prTarget.value = editing ? editing.targetHours : 3.5;
  els.prError.hidden = true;
  els.prError.textContent = '';
  els.programFormEyebrow.textContent = editing ? 'Program settings' : 'New program';
  els.programFormHeading.textContent = editing ? 'Edit program' : 'Create a program';
  els.prSubmit.textContent = editing ? 'Save program' : 'Create program';
  els.prCopy.hidden = !!editing;
  els.prClear.hidden = !!editing;
  els.prDelete.hidden = !editing || state.programs.length <= 1;
  els.prDelete.dataset.program = editing ? editing.id : '';
  const lockedCounts = {};
  if (editing) {
    state.tasks.filter(task => task.programId === editing.id).forEach(task => {
      const no = Number(task.chapter);
      lockedCounts[no] = (lockedCounts[no] || 0) + 1;
    });
  }
  const sections = editing ? editing.sections : [{ id: 'A', name: 'General', weight: 100 }];
  const chapters = editing ? editing.chapters : [{ no: 1, section: 'A', title: '', topics: [] }];
  els.prSections.innerHTML = sections.map(section =>
    builderSectionHTML(section, chapters.filter(chapter => chapter.section === section.id), lockedCounts)
  ).join('');
  openOverlay(els.programOverlay);
  setTimeout(() => els.prName.focus(), 40);
}
function showProgramError(message) {
  els.prError.textContent = message;
  els.prError.hidden = false;
  els.prError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function submitProgramForm(event) {
  event.preventDefault();
  const name = els.prName.value.trim();
  const course = els.prCourse.value.trim();
  const examDate = els.prExamDate.value;
  if (!name || !course || !examDate) {
    showProgramError('Add a program name, course and exam date before saving.');
    return;
  }
  const sectionEls = Array.from(els.prSections.querySelectorAll('.builder-section'));
  if (!sectionEls.length) {
    showProgramError('Add at least one section to the curriculum.');
    return;
  }
  const currentProgram = ui.builderProgramId ? state.programs.find(program => program.id === ui.builderProgramId) : null;
  const sections = [];
  const sectionIds = new Map();
  sectionEls.forEach((element, index) => {
    let id = element.dataset.sectionId || LETTERS[index] || 'S' + (index + 1);
    let unique = id;
    let suffix = 1;
    while (sections.some(section => section.id === unique)) { unique = id + suffix; suffix++; }
    const sectionName = element.querySelector('.builder-section-name').value.trim() || 'Section ' + (index + 1);
    const weight = clamp(Number(element.querySelector('.builder-section-weight').value) || 0, 0, 100);
    const existing = currentProgram ? currentProgram.sections.find(section => section.id === element.dataset.sectionId) : null;
    sections.push({ id: unique, name: sectionName, short: existing ? existing.short : sectionName, weight: weight });
    sectionIds.set(element, unique);
  });
  const chapters = [];
  sectionEls.forEach(element => {
    const sectionId = sectionIds.get(element);
    element.querySelectorAll('.builder-chapter').forEach(row => {
      const title = row.querySelector('.builder-chapter-title').value.trim();
      if (!title) return;
      let no = Number(row.dataset.chapterNo) || chapters.length + 1;
      while (chapters.some(chapter => Number(chapter.no) === no)) no++;
      const topics = row.querySelector('.builder-chapter-topics').value
        .split(';').map(topic => topic.trim()).filter(Boolean).slice(0, 30);
      chapters.push({ no: no, section: sectionId, title: title.slice(0, 120), topics: topics });
    });
  });
  if (!chapters.length) {
    showProgramError('Add at least one chapter with a title so the program has something to schedule.');
    return;
  }
  const existing = ui.builderProgramId ? state.tasks.filter(task => task.programId === ui.builderProgramId) : [];
  if (existing.some(task => !chapters.some(chapter => Number(chapter.no) === Number(task.chapter)))) {
    showProgramError('Keep chapters that already have scheduled sessions — they cannot be removed.');
    return;
  }
  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0);
  if (totalWeight <= 0) {
    const even = Math.round(100 / sections.length);
    sections.forEach(section => { section.weight = even; });
  }
  const details = {
    name: name.slice(0, 60),
    course: course.slice(0, 60),
    examLabel: els.prExamLabel.value.trim() || 'Exam',
    examDate: examDate,
    targetHours: clamp(Number(els.prTarget.value) || 3.5, 0.5, 12),
    sections: sections,
    chapters: chapters
  };
  if (ui.builderProgramId) {
    const program = state.programs.find(item => item.id === ui.builderProgramId);
    if (!program) { showProgramError('That program no longer exists.'); return; }
    Object.assign(program, details);
    saveState();
    closeModal();
    ui.animate = false;
    render();
    toast('Program updated · ' + program.name, { tone: 'done', duration: 2800 });
  } else {
    const program = makeProgram(Object.assign({ id: uid('program'), createdAt: new Date().toISOString() }, details));
    state.programs.push(program);
    state.activeProgramId = program.id;
    saveState();
    ui.date = todayKey();
    ui.weekStart = dateKey(mondayOf(new Date()));
    ui.query = '';
    ui.openChapters.clear();
    ui.lastChapter = null;
    ui.libraryFormat = 'all';
    ui.libraryStatus = 'all';
    ui.librarySort = 'recent';
    if (els.search) els.search.value = '';
    updateSearchChrome();
    closeModal();
    if (location.hash !== '#plan') location.hash = '#plan';
    ui.animate = true;
    render();
    toast('Program created · ' + program.chapters.length + ' chapters', { tone: 'done', duration: 3200 });
  }
}
function deleteProgram(programId) {
  if (!programId || state.programs.length <= 1) {
    toast('Keep at least one program in your workspace', { icon: 'info' });
    return;
  }
  const program = state.programs.find(item => item.id === programId);
  if (!program) return;
  state.programs = state.programs.filter(item => item.id !== programId);
  state.tasks = state.tasks.filter(task => task.programId !== programId);
  state.resources = state.resources.filter(resource => resource.programId !== programId);
  state.focusSessions = state.focusSessions.filter(session => session.programId !== programId);
  if (state.activeProgramId === programId) state.activeProgramId = state.programs[0].id;
  ui.libraryFormat = 'all';
  ui.libraryStatus = 'all';
  ui.librarySort = 'recent';
  if (timer.programId === programId) {
    timer.programId = state.activeProgramId;
    if (timer.taskId && !state.tasks.some(task => task.id === timer.taskId)) timer.taskId = null;
    saveTimerState();
  }
  saveState();
  pruneFilesSoon();
  closeModal();
  ui.date = todayKey();
  ui.weekStart = dateKey(mondayOf(new Date()));
  ui.query = '';
  if (els.search) els.search.value = '';
  updateSearchChrome();
  ui.animate = true;
  render();
  toast('Deleted program · ' + program.name, { tone: 'done', icon: 'trash', duration: 2800 });
}

/* ---------- library ---------- */
function populateResourceChapterSelect(selected) {
  const options = ['<option value="0">General · all chapters</option>'];
  activeSections().forEach(section => {
    const chapters = activeChapters().filter(chapter => chapter.section === section.id);
    if (!chapters.length) return;
    options.push('<optgroup label="' + section.id + ' · ' + esc(section.name) + '">');
    chapters.forEach(chapter => {
      options.push('<option value="' + chapter.no + '">Ch ' + pad2(chapter.no) + ' — ' + esc(chapter.title) + '</option>');
    });
    options.push('</optgroup>');
  });
  els.rChapter.innerHTML = options.join('');
  els.rChapter.value = String(selected || 0);
}
function updateResourceFormatHint() {
  if (!els.rFormat || !els.rLinkHint) return;
  const format = libraryFormat(els.rFormat.value);
  const hints = {
    document: 'Paste a PDF or document URL. PDFs preview inside StudyFlow; other documents open in a new tab.',
    video: 'Paste a YouTube, Vimeo or direct video URL. Supported videos play inside StudyFlow.',
    audio: 'Paste a direct audio URL (MP3, WAV, OGG) to listen inside StudyFlow. Other pages open in a new tab.',
    image: 'Paste an image URL to preview it inside StudyFlow, or attach a file below.',
    link: 'Paste any web address. Links open in a new tab.'
  };
  const placeholders = {
    document: 'https://example.com/notes.pdf',
    video: 'https://youtube.com/watch?v=…',
    audio: 'https://example.com/lecture.mp3',
    image: 'https://example.com/diagram.png',
    link: 'https://example.com/reference'
  };
  els.rLinkHint.textContent = hints[format.id] || hints.document;
  els.rUrl.placeholder = placeholders[format.id] || placeholders.document;
}
function showAttachedFile(name, size) {
  els.rFileName.textContent = name || 'Attached file';
  els.rFileSize.textContent = fileSizeLabel(size);
  els.rFileInfo.hidden = false;
  const picker = els.rFilePicker.querySelector('span');
  if (picker) picker.textContent = 'Replace file';
}
function hideAttachedFile() {
  els.rFileInfo.hidden = true;
  els.rFileName.textContent = '';
  els.rFileSize.textContent = '';
  els.rFile.value = '';
  const picker = els.rFilePicker.querySelector('span');
  if (picker) picker.textContent = 'Choose a file';
}
function resetAttachedFile() {
  ui.pendingFile = null;
  ui.fileRemoved = false;
  hideAttachedFile();
  if (els.rFileHint) els.rFileHint.textContent = 'Files stay in this browser. You can attach a file or paste a link.';
}
function handleFileSelected() {
  const file = els.rFile.files && els.rFile.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    showResourceError('That file is larger than the 250 MB limit. Choose a smaller file.');
    els.rFile.value = '';
    return;
  }
  const format = formatForFile(file);
  if (!format) {
    showResourceError('Unsupported file. Choose a video, audio file, image, PDF or document.');
    els.rFile.value = '';
    return;
  }
  ui.pendingFile = file;
  ui.fileRemoved = false;
  els.rFormat.value = format;
  updateResourceFormatHint();
  showAttachedFile(file.name, file.size);
  if (els.rFileHint) els.rFileHint.textContent = 'This file will be saved in this browser when you save the resource.';
  els.rError.hidden = true;
}
function clearAttachedFile() {
  if (ui.pendingFile) {
    ui.pendingFile = null;
    if (ui.editingResourceId) {
      const resource = state.resources.find(item => item.id === ui.editingResourceId);
      if (resource && resource.fileId && !ui.fileRemoved) {
        showAttachedFile(resource.fileName || 'Attached file', resource.fileSize);
      } else {
        hideAttachedFile();
      }
    } else {
      hideAttachedFile();
    }
    if (els.rFileHint) els.rFileHint.textContent = 'Files stay in this browser. You can attach a file or paste a link.';
    return;
  }
  if (ui.editingResourceId) ui.fileRemoved = true;
  hideAttachedFile();
  if (els.rFileHint) els.rFileHint.textContent = 'The attached file will be removed when you save.';
}
function openResourceModal(resource) {
  const editing = resource ? state.resources.find(item => item.id === resource.id) : null;
  if (resource && !editing) {
    toast('That resource no longer exists', { icon: 'info' });
    return;
  }
  ui.editingResourceId = editing ? editing.id : null;
  ui.pendingFile = null;
  ui.fileRemoved = false;
  releasePreviewObjectUrl();
  ui.previewResourceId = null;
  populateResourceChapterSelect(editing ? editing.chapter : 0);
  els.rTitle.value = editing ? editing.title : '';
  els.rFormat.value = editing ? normalizeFormatId(editing.format) : 'document';
  els.rStatus.value = editing ? editing.status : 'to-read';
  els.rUrl.value = editing ? editing.url : '';
  els.rNote.value = editing ? editing.note : '';
  hideAttachedFile();
  if (els.rFileHint) els.rFileHint.textContent = 'Files stay in this browser. You can attach a file or paste a link.';
  if (editing && editing.fileId) showAttachedFile(editing.fileName || 'Attached file', editing.fileSize);
  updateResourceFormatHint();
  els.rError.hidden = true;
  els.rError.textContent = '';
  els.resourceFormHeading.textContent = editing ? 'Edit resource' : 'Add resource';
  els.resourceEyebrow.textContent = editing ? 'Resource details' : 'Library';
  els.rSubmit.textContent = editing ? 'Save resource' : 'Add resource';
  els.rDelete.hidden = !editing;
  openOverlay(els.resourceOverlay);
  setTimeout(() => els.rTitle.focus(), 40);
}
function showResourceError(message) {
  els.rError.textContent = message;
  els.rError.hidden = false;
  els.rError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function submitResource(event) {
  event.preventDefault();
  if (els.rSubmit.disabled) return;
  const title = els.rTitle.value.trim();
  if (!title) {
    showResourceError('Give this resource a title so you can find it later.');
    els.rTitle.focus();
    return;
  }
  const rawUrl = els.rUrl.value.trim();
  const url = safeUrl(rawUrl);
  if (rawUrl && !url) {
    showResourceError('Enter a valid link starting with http:// or https://.');
    els.rUrl.focus();
    return;
  }
  let format = LIBRARY_FORMATS.some(item => item.id === els.rFormat.value) ? els.rFormat.value : 'document';
  const status = LIBRARY_STATUSES.some(item => item.id === els.rStatus.value) ? els.rStatus.value : 'to-read';
  const chapter = Number(els.rChapter.value) || 0;
  const note = els.rNote.value.trim().slice(0, 600);
  const now = new Date().toISOString();
  const editing = ui.editingResourceId ? state.resources.find(resource => resource.id === ui.editingResourceId) : null;
  const oldFileId = editing ? editing.fileId || '' : '';
  let fileMeta = {
    fileId: editing ? editing.fileId || '' : '',
    fileName: editing ? editing.fileName || '' : '',
    fileType: editing ? editing.fileType || '' : '',
    fileSize: editing ? Number(editing.fileSize) || 0 : 0
  };
  if (ui.fileRemoved) {
    fileMeta = { fileId: '', fileName: '', fileType: '', fileSize: 0 };
  }
  if (ui.pendingFile) {
    const file = ui.pendingFile;
    const detected = formatForFile(file);
    if (!detected) {
      showResourceError('Unsupported file. Choose a video, audio file, image, PDF or document.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showResourceError('That file is larger than the 250 MB limit. Choose a smaller file.');
      return;
    }
    format = detected;
    els.rFormat.value = detected;
    const fileId = uid('file');
    els.rSubmit.disabled = true;
    els.rSubmit.textContent = 'Saving file…';
    try {
      await putFileBlob({
        id: fileId,
        blob: file,
        name: file.name,
        type: file.type || '',
        size: file.size,
        programId: state.activeProgramId,
        createdAt: now
      });
    } catch (err) {
      els.rSubmit.disabled = false;
      els.rSubmit.textContent = editing ? 'Save resource' : 'Add resource';
      showResourceError('Could not save that file in this browser. Try a smaller file or use a link instead.');
      return;
    }
    els.rSubmit.disabled = false;
    els.rSubmit.textContent = editing ? 'Save resource' : 'Add resource';
    fileMeta = {
      fileId: fileId,
      fileName: file.name.slice(0, 180),
      fileType: file.type || '',
      fileSize: file.size
    };
  }
  if (!ui.pendingFile && fileMeta.fileId) {
    const storedFormat = formatForFile({ name: fileMeta.fileName, type: fileMeta.fileType });
    if (storedFormat) {
      format = storedFormat;
      els.rFormat.value = storedFormat;
    }
  }
  if (editing) {
    editing.title = title.slice(0, 120);
    editing.format = format;
    editing.status = status;
    editing.chapter = chapter;
    editing.url = url;
    editing.note = note;
    editing.updatedAt = now;
    editing.fileId = fileMeta.fileId;
    editing.fileName = fileMeta.fileName;
    editing.fileType = fileMeta.fileType;
    editing.fileSize = fileMeta.fileSize;
    saveState();
    closeModal();
    ui.animate = false;
    render();
    if (oldFileId && oldFileId !== fileMeta.fileId) deleteFileBlob(oldFileId).catch(() => {});
    toast('Resource updated', { tone: 'done', icon: 'check-circle' });
    return;
  }
  state.resources.push({
    id: uid('res'),
    programId: state.activeProgramId,
    title: title.slice(0, 120),
    format: format,
    chapter: chapter,
    url: url,
    note: note,
    status: status,
    favorite: false,
    fileId: fileMeta.fileId,
    fileName: fileMeta.fileName,
    fileType: fileMeta.fileType,
    fileSize: fileMeta.fileSize,
    createdAt: now,
    updatedAt: now
  });
  ui.libraryFormat = 'all';
  ui.libraryStatus = 'all';
  ui.librarySort = 'recent';
  ui.query = '';
  if (els.search) els.search.value = '';
  updateSearchChrome();
  saveState();
  closeModal();
  ui.animate = false;
  render();
  toast('Resource added · ' + libraryFormat(format).label + (fileMeta.fileId ? ' · file attached' : ''), { tone: 'done', icon: 'check-circle' });
}
function updateResourceStatus(resourceId, statusId) {
  const resource = state.resources.find(item => item.id === resourceId);
  const status = LIBRARY_STATUSES.find(item => item.id === statusId);
  if (!resource || !status || resource.status === statusId) return;
  resource.status = status.id;
  resource.updatedAt = new Date().toISOString();
  saveState();
  ui.animate = false;
  render();
  toast('Marked “' + resource.title + '” as ' + status.label, { icon: 'check-circle', duration: 2400 });
}
function deleteResource(resourceId) {
  const resource = state.resources.find(item => item.id === resourceId);
  if (!resource) return;
  const fileId = resource.fileId;
  state.resources = state.resources.filter(item => item.id !== resourceId);
  saveState();
  closeModal();
  ui.animate = false;
  render();
  if (fileId) deleteFileBlob(fileId).catch(() => {});
  toast('Resource removed', { tone: 'done', icon: 'trash', duration: 2400 });
}
function fileMediaKind(resource) {
  const mime = String(resource.fileType || '').toLowerCase();
  const name = String(resource.fileName || '');
  const format = normalizeFormatId(resource.format);
  if (format === 'image' || mime.startsWith('image/')) return 'image';
  if (format === 'video' || mime.startsWith('video/')) return 'video';
  if (format === 'audio' || mime.startsWith('audio/')) return 'audio';
  if (isPdf(name) || mime === 'application/pdf') return 'pdf';
  return 'none';
}
async function openResourcePreview(resourceId) {
  const resource = state.resources.find(item => item.id === resourceId);
  if (!resource) {
    toast('That resource no longer exists', { icon: 'info' });
    return;
  }
  releasePreviewObjectUrl();
  const format = libraryFormat(resource.format);
  const status = libraryStatus(resource.status);
  const source = previewSource(resource);
  ui.previewResourceId = resource.id;
  els.previewEyebrow.textContent = 'Library · ' + format.label;
  els.previewHeading.textContent = resource.title;
  const mediaKind = source.kind === 'youtube' || source.kind === 'vimeo' ? 'video' : source.kind;
  els.previewMeta.innerHTML =
    '<span class="resource-type">' + icon(format.icon) + '<span>' + format.label + '</span></span>' +
    '<span class="preview-chapter">' + icon('bookmark') + esc(resourceChapterLabel(resource)) + '</span>' +
    '<span class="status-pill is-' + status.id + '">' + status.label + '</span>' +
    (resource.fileId ? '<span class="preview-file">' + icon('paperclip') + esc(resource.fileName || 'Attached file') + ' · ' + fileSizeLabel(resource.fileSize) + '</span>' : '');
  els.previewNotes.textContent = resource.note || 'No notes saved for this resource yet.';
  els.previewEdit.dataset.resource = resource.id;

  if (resource.fileId) {
    els.previewMedia.className = 'preview-media is-file';
    els.previewMedia.innerHTML = '<div class="preview-loading">' + icon('paperclip') + '<span>Loading file…</span></div>';
    els.previewExternal.hidden = true;
    openOverlay(els.previewOverlay);
    setTimeout(() => {
      const heading = document.getElementById('previewHeading');
      if (heading) heading.focus({ preventScroll: true });
    }, 40);
    try {
      const record = await getFileBlob(resource.fileId);
      if (ui.previewResourceId !== resource.id || els.previewOverlay.hidden) return;
      if (!record || !record.blob) throw new Error('File not found');
      const objectUrl = URL.createObjectURL(record.blob);
      ui.previewObjectUrl = objectUrl;
      const kind = fileMediaKind(resource);
      els.previewMedia.className = 'preview-media is-' + kind + (kind === 'pdf' ? ' is-document' : '');
      els.previewMedia.innerHTML = resourceFileMediaHTML(resource, objectUrl);
      els.previewExternal.href = objectUrl;
      els.previewExternal.download = resource.fileName || resource.title;
      els.previewExternal.textContent = 'Download file';
      els.previewExternal.hidden = false;
    } catch (err) {
      els.previewMedia.className = 'preview-media is-none';
      els.previewMedia.innerHTML = '<div class="preview-fallback">' +
        '<span class="preview-fallback-icon">' + icon('file-text') + '</span>' +
        '<h3>File unavailable</h3>' +
        '<p>This attached file is not in this browser\'s storage. Edit the resource to attach it again.</p>' +
        '<button type="button" class="btn btn-outline" data-action="edit-resource" data-resource="' + resource.id + '">Reattach file</button>' +
      '</div>';
      els.previewExternal.hidden = true;
    }
    return;
  }

  els.previewMedia.className = 'preview-media is-' + mediaKind + (format.id === 'document' ? ' is-document' : '');
  els.previewMedia.innerHTML = resourcePreviewMediaHTML(resource);
  const external = safeUrl(resource.url);
  if (external) {
    els.previewExternal.href = external;
    els.previewExternal.removeAttribute('download');
    els.previewExternal.textContent = 'Open original';
    els.previewExternal.hidden = false;
  } else {
    els.previewExternal.hidden = true;
    els.previewExternal.removeAttribute('href');
    els.previewExternal.removeAttribute('download');
  }
  openOverlay(els.previewOverlay);
  setTimeout(() => {
    const heading = document.getElementById('previewHeading');
    if (heading) heading.focus({ preventScroll: true });
  }, 40);
}
function setLibraryFormat(format) {
  if (format !== 'all' && !LIBRARY_FORMATS.some(item => item.id === format)) return;
  ui.libraryFormat = format;
  ui.animate = false;
  render();
}
function setLibraryStatus(status) {
  if (status !== 'all' && !LIBRARY_STATUSES.some(item => item.id === status)) return;
  ui.libraryStatus = status;
  ui.animate = false;
  render();
}
function setLibrarySort(sort) {
  if (!['recent', 'chapter', 'title'].includes(sort)) return;
  ui.librarySort = sort;
  ui.animate = false;
  render();
}
function clearLibraryFilters() {
  ui.libraryFormat = 'all';
  ui.libraryStatus = 'all';
  ui.librarySort = 'recent';
  ui.query = '';
  if (els.search) els.search.value = '';
  updateSearchChrome();
  ui.animate = false;
  render();
}
function exportLibrary() {
  const program = activeProgram();
  const resources = activeResources().slice().sort((a, b) => {
    const formatOrder = LIBRARY_FORMATS.findIndex(format => format.id === normalizeFormatId(a.format)) -
      LIBRARY_FORMATS.findIndex(format => format.id === normalizeFormatId(b.format));
    return formatOrder || a.title.localeCompare(b.title);
  });
  if (!resources.length) {
    toast('Add a resource before exporting the library', { icon: 'info' });
    return;
  }
  const lines = ['# Study library — ' + (program ? program.name : 'Study program'), ''];
  lines.push(resources.length + ' resource' + (resources.length === 1 ? '' : 's') + ' · exported ' + fmtLong(new Date()));
  LIBRARY_FORMATS.forEach(format => {
    const group = resources.filter(resource => normalizeFormatId(resource.format) === format.id);
    if (!group.length) return;
    lines.push('');
    lines.push('## ' + format.plural);
    group.forEach(resource => {
      lines.push('');
      lines.push('### ' + resource.title);
      lines.push('- **Status:** ' + libraryStatus(resource.status).label);
      lines.push('- **Format:** ' + libraryFormat(resource.format).label);
      lines.push('- **Chapter:** ' + resourceChapterLabel(resource));
      if (resource.url) lines.push('- **Link:** ' + resource.url);
      if (resource.note) lines.push('> ' + resource.note);
    });
  });
  lines.push('');
  lines.push('_Exported from StudyFlow._');
  downloadFile('studyflow-library-' + todayKey() + '.md', lines.join('\n'), 'text/markdown;charset=utf-8');
  toast('Reading list exported', { tone: 'done', icon: 'download' });
}

/* ---------- persistence warnings ---------- */
function showSaveAlert(reason) {
  if (!els.saveAlert) return;
  if (els.saveAlertMsg) {
    els.saveAlertMsg.textContent = reason === 'quota'
      ? 'Storage is full — recent changes are not being saved. Export a backup, then remove old sessions or library files.'
      : 'Changes are not being saved in this browser. Export a backup before you close this tab.';
  }
  els.saveAlert.hidden = false;
}
function hideSaveAlert() {
  if (els.saveAlert) els.saveAlert.hidden = true;
}
function showRecoveryAlert() {
  if (els.recoveryAlert) els.recoveryAlert.hidden = false;
}
function hideRecoveryAlert() {
  if (els.recoveryAlert) els.recoveryAlert.hidden = true;
}
function downloadRecoveryCopy() {
  const key = recoveryCopyKey();
  let raw = '';
  try { raw = key ? localStorage.getItem(key) || '' : ''; } catch (err) { raw = ''; }
  if (!raw) {
    toast('The recovery copy is no longer available', { icon: 'info' });
    return;
  }
  downloadFile('studyflow-recovery-' + todayKey() + '.json', raw, 'application/json');
  toast('Recovery copy downloaded', { tone: 'done' });
}
function showSyncAlert() {
  if (els.syncAlert) els.syncAlert.hidden = false;
}

/* ---------- settings / data ---------- */
function exportJSON() {
  downloadFile('studyflow-backup-' + todayKey() + '.json', JSON.stringify(state, null, 2), 'application/json');
  toast('Backup exported', { tone: 'done' });
}
function exportDayLog(key) {
  const date = parseKey(key);
  const stats = dayStats(key);
  const tasks = tasksOn(key);
  const lines = [];
  lines.push('# Study log — ' + fmtLong(date));
  lines.push('');
  const program = activeProgram();
  lines.push('**' + (program ? program.name : 'Study program') + '** · ' + (program ? program.course : ''));
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | --- |');
  lines.push('| Sessions complete | ' + stats.complete + ' of ' + stats.count + ' |');
  lines.push('| Checklist steps | ' + stats.done + ' of ' + stats.steps + ' |');
  lines.push('| Focus logged | ' + fmtDuration(stats.logged) + ' of ' + fmtDuration(stats.planned) + ' planned |');
  lines.push('');
  if (!tasks.length) {
    lines.push('_No sessions scheduled for this day._');
  } else {
    lines.push('## Sessions');
    tasks.forEach(task => {
      const chapter = chapterOf(task.chapter);
      lines.push('');
      lines.push('### ' + timeRange(task.start, task.end) + ' — ' + task.title);
      lines.push((chapter ? 'Chapter ' + chapter.no + ': ' + chapter.title + ' · ' : '') + fmtDuration(taskMinutes(task)) + ' · ' + priorityMeta(task.priority).label);
      if (task.note) lines.push('> ' + task.note);
      task.steps.forEach(step => lines.push('- [' + (step.done ? 'x' : ' ') + '] ' + step.text));
    });
  }
  const focus = sessionsFor(key);
  if (focus.length) {
    lines.push('');
    lines.push('## Focus sprints');
    focus.forEach(session => lines.push('- ' + session.minutes + ' minutes'));
  }
  lines.push('');
  lines.push('_Exported from StudyFlow on ' + fmtLong(new Date()) + '._');
  downloadFile('studyflow-log-' + key + '.md', lines.join('\n'), 'text/markdown;charset=utf-8');
  toast('Daily log exported', { tone: 'done' });
}
function importJSONFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.tasks)) throw new Error('Invalid backup');
      const previous = JSON.stringify(state);
      state = normalizeState(parsed);
      saveState();
      reconcileTimerTask();
      closeModal();
      ui.date = todayKey();
      ui.weekStart = dateKey(mondayOf(new Date()));
      ui.query = '';
      ui.libraryFormat = 'all';
      ui.libraryStatus = 'all';
      ui.librarySort = 'recent';
      if (els.search) els.search.value = '';
      updateSearchChrome();
      ui.animate = true;
      render();
      pruneFilesSoon();
      toast('Backup imported — ' + state.tasks.length + ' sessions restored', {
        tone: 'done',
        duration: 9000,
        action: 'Undo',
        onAction: () => {
          try {
            state = normalizeState(JSON.parse(previous));
          } catch (err) {
            toast('Could not undo the import', { icon: 'info' });
            return;
          }
          saveState();
          reconcileTimerTask();
          ui.date = todayKey();
          ui.weekStart = dateKey(mondayOf(new Date()));
          ui.animate = true;
          render();
          pruneFilesSoon();
          toast('Previous plan restored', { tone: 'done', duration: 2600 });
        }
      });
    } catch (err) {
      toast('That file is not a StudyFlow backup', { icon: 'info' });
    } finally {
      els.importFile.value = '';
    }
  };
  reader.readAsText(file);
}
function armDanger(button, key, run) {
  const now = Date.now();
  if (button.dataset.armed === '1' && now - Number(button.dataset.armedAt) < 4000) {
    button.dataset.armed = '0';
    button.innerHTML = button.dataset.label || 'Confirm';
    button.classList.remove('is-armed');
    run();
    return;
  }
  button.dataset.armed = '1';
  button.dataset.armedAt = String(now);
  if (!button.dataset.label) button.dataset.label = button.innerHTML;
  button.innerHTML = 'Click again to confirm';
  button.classList.add('is-armed');
  clearTimeout(armedTimers[key]);
  armedTimers[key] = setTimeout(() => {
    if (button.dataset.armed === '1') {
      button.dataset.armed = '0';
      button.innerHTML = button.dataset.label || 'Confirm';
      button.classList.remove('is-armed');
    }
  }, 4200);
}
function loadSamplePlan() {
  const sample = buildSeed();
  const sampleProgram = sample.programs[0];
  const otherPrograms = state.programs.filter(program => program.id !== DEFAULT_PROGRAM_ID);
  const otherTasks = state.tasks.filter(task => task.programId !== DEFAULT_PROGRAM_ID);
  const otherFocus = state.focusSessions.filter(session => session.programId !== DEFAULT_PROGRAM_ID);
  const otherResources = state.resources.filter(resource => resource.programId !== DEFAULT_PROGRAM_ID);
  const defaultResources = state.resources.filter(resource => resource.programId === DEFAULT_PROGRAM_ID);
  state.student = state.student || sample.student;
  state.programs = [sampleProgram].concat(otherPrograms);
  state.activeProgramId = DEFAULT_PROGRAM_ID;
  state.tasks = sample.tasks.concat(otherTasks);
  state.resources = otherResources.concat(defaultResources.length ? defaultResources : sample.resources);
  state.focusSessions = sample.focusSessions.concat(otherFocus);
  reconcileTimerTask();
  saveState();
  ui.date = todayKey();
  ui.weekStart = dateKey(mondayOf(new Date()));
  ui.openChapters.clear();
  ui.libraryFormat = 'all';
  ui.libraryStatus = 'all';
  ui.librarySort = 'recent';
  closeModal();
  ui.animate = true;
  render();
  pruneFilesSoon();
  toast('Sample ICAZ plan restored', { tone: 'done' });
}
function resetAllData() {
  timerReset();
  clearTimerState();
  state.tasks = [];
  state.resources = [];
  state.focusSessions = [];
  ui.libraryFormat = 'all';
  ui.libraryStatus = 'all';
  ui.librarySort = 'recent';
  saveState();
  ui.date = todayKey();
  ui.weekStart = dateKey(mondayOf(new Date()));
  closeModal();
  ui.animate = true;
  render();
  clearFileBlobs().catch(() => {});
  toast('All study data cleared', { tone: 'done', icon: 'trash' });
}

/* ---------- navigation ---------- */
function toggleRail(force) {
  const open = typeof force === 'boolean' ? force : !els.app.classList.contains('rail-open');
  els.app.classList.toggle('rail-open', open);
  if (els.scrim) els.scrim.hidden = !open;
  const toggle = $('.rail-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}
function selectDay(key) {
  ui.date = key;
  ui.weekStart = dateKey(mondayOf(parseKey(key)));
  ui.animate = true;
  closeTaskMenu();
  render();
}
function shiftWeek(direction) {
  const current = parseKey(ui.weekStart);
  const offset = clamp(Math.round((parseKey(ui.date) - current) / 86400000), 0, 6);
  const next = addDays(current, direction * 7);
  ui.weekStart = dateKey(next);
  ui.date = dateKey(addDays(next, offset));
  ui.animate = true;
  closeTaskMenu();
  render();
}
function clearSearch() {
  ui.query = '';
  els.search.value = '';
  updateSearchChrome();
  ui.animate = false;
  render();
  els.search.focus();
}
function jumpToTimer() {
  if (location.hash !== '#plan') location.hash = '#plan';
  setTimeout(() => {
    const card = document.getElementById('timerCard');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
}

/* ---------- form submit ---------- */
function submitSession(event) {
  event.preventDefault();
  const chapterNo = Number(els.fChapter.value);
  const date = els.fDate.value;
  const title = els.fTitle.value.trim();
  const start = els.fStart.value;
  const end = els.fEnd.value;
  const priority = els.fPriority.value;
  const note = els.fNote.value.trim();

  if (!chapterNo || !date || !title || !start || !end) {
    showFormError('Add a chapter, date, topic and time range before scheduling.');
    return;
  }
  const startMin = timeToMin(start);
  const endMin = timeToMin(end);
  if (isNaN(startMin) || isNaN(endMin)) {
    showFormError('Use a valid start and end time.');
    return;
  }
  if (endMin <= startMin) {
    showFormError('The end time must be after the start time.');
    return;
  }
  if (endMin - startMin < 10) {
    showFormError('Give the session at least 10 minutes.');
    return;
  }

  const rawLines = els.fSteps.value.split('\n').map(line => line.trim()).filter(Boolean);
  const lines = rawLines.slice(0, 14);
  let defaulted = false;
  if (!lines.length) {
    lines.push('Complete this session');
    defaulted = true;
  }

  const editing = ui.editingId ? state.tasks.find(t => t.id === ui.editingId) : null;
  const previous = editing ? new Map(editing.steps.map(step => [step.text, step])) : new Map();
  const steps = lines.map(text => {
    const old = previous.get(text);
    return { id: old ? old.id : uid('step'), text: text, done: old ? old.done : false };
  });
  let createdDates = [date];

  if (editing) {
    editing.chapter = chapterNo;
    editing.date = date;
    editing.title = title;
    editing.start = start;
    editing.end = end;
    editing.priority = priority;
    editing.note = note;
    editing.steps = steps;
  } else {
    createdDates = repeatDates(date, els.fRepeat.value);
    createdDates.forEach(taskDate => {
      state.tasks.push({
        id: uid('task'),
        programId: state.activeProgramId,
        chapter: chapterNo,
        title: title,
        date: taskDate,
        start: start,
        end: end,
        priority: priority,
        note: note,
        steps: steps.map(step => ({ id: uid('step'), text: step.text, done: false })),
        createdAt: new Date().toISOString()
      });
    });
  }
  saveState();
  closeModal();
  const focusDate = createdDates[0] || date;
  ui.date = focusDate;
  ui.weekStart = dateKey(mondayOf(parseKey(focusDate)));
  ui.animate = true;
  render();
  const chapter = chapterOf(chapterNo) || { no: chapterNo, title: 'Chapter ' + chapterNo };
  if (editing) {
    toast('Session updated · Ch ' + chapter.no + (defaulted ? ' · default step added' : ''), { tone: 'done', duration: 3600 });
  } else if (createdDates.length > 1) {
    toast('Scheduled ' + createdDates.length + ' sessions · ' +
      fmtMonthRange(parseKey(createdDates[0]), parseKey(createdDates[createdDates.length - 1])) +
      ' · Ch ' + chapter.no + (defaulted ? ' · default step added' : ''), { tone: 'done', duration: 4600 });
  } else {
    toast('Scheduled for ' + fmtMedium(parseKey(date)) + ' · Ch ' + chapter.no + (defaulted ? ' · default step added' : ''), { tone: 'done', duration: 3600 });
  }
}

/* ---------- bulk chapter planner ---------- */
function fillPlannerSessions(chapterNo) {
  const chapter = chapterOf(Number(chapterNo)) || activeChapters()[0];
  if (!chapter) return;
  const max = Math.max(1, Math.min(5, chapter.topics.length));
  const counts = [];
  for (let n = 2; n <= max; n++) counts.push(n);
  if (!counts.length) counts.push(1);
  els.pSessions.innerHTML = counts.map(n => '<option value="' + n + '">' + n + ' sessions</option>').join('');
  const preferred = Math.min(4, max);
  els.pSessions.value = String(counts.indexOf(preferred) >= 0 ? preferred : counts[0]);
}
function updateChapterPreview() {
  const chapter = chapterOf(Number(els.pChapter.value));
  if (!chapter) return;
  const startKey = els.pDate.value || todayKey();
  const groups = chunkTopics(chapter.topics, Number(els.pSessions.value) || 3);
  const start = parseKey(startKey);
  const startTime = els.pStart.value || '09:00';
  const length = Number(els.pLength.value) || 90;
  const startMin = timeToMin(startTime);
  const end = minToTime(Math.min(startMin + length, 23 * 60 + 59));
  els.pPreview.innerHTML = groups.map((group, index) =>
    '<div class="plan-part">' +
      '<span class="plan-part-no">' + pad2(index + 1) + '</span>' +
      '<div class="plan-part-body">' +
        '<span class="plan-part-date">' + fmtMedium(addDays(start, index)) + ' · ' + startTime + ' – ' + end + '</span>' +
        '<span class="plan-part-topics">' + group.map(topic => esc(topic)).join(' · ') + '</span>' +
      '</div>' +
    '</div>'
  ).join('');
  els.pSummary.textContent = groups.length + ' sessions · ' + fmtDuration(length * groups.length);
  const label = els.pSubmit.querySelector('span');
  if (label) label.textContent = 'Plan ' + groups.length + ' sessions';
}
function openChapterPlanner(chapterNo) {
  ui.editingId = null;
  populateChapterSelect();
  const chapter = chapterOf(Number(chapterNo)) || chapterOf(ui.lastChapter) || activeChapters()[0];
  if (!chapter) {
    toast('Add chapters to this program before planning', { icon: 'info' });
    const program = activeProgram();
    if (program) openProgramBuilder(program.id);
    return;
  }
  els.pChapter.value = String(chapter.no);
  els.pDate.value = ui.date >= todayKey() ? ui.date : todayKey();
  els.pStart.value = '09:00';
  els.pLength.value = '90';
  fillPlannerSessions(chapter.no);
  els.pError.hidden = true;
  els.pError.textContent = '';
  updateChapterPreview();
  openOverlay(els.chapterOverlay);
  setTimeout(() => els.pSessions.focus(), 40);
}
function showPlannerError(message) {
  els.pError.textContent = message;
  els.pError.hidden = false;
  els.pError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function submitChapterPlan(event) {
  event.preventDefault();
  const chapter = chapterOf(Number(els.pChapter.value));
  const startKey = els.pDate.value;
  const startTime = els.pStart.value;
  const length = Number(els.pLength.value) || 90;
  const startMin = timeToMin(startTime);
  if (!chapter || !startKey || !startTime || isNaN(startMin)) {
    showPlannerError('Choose a chapter, start date and time before planning.');
    return;
  }
  if (startMin + length > 23 * 60 + 59) {
    showPlannerError('That session would run past midnight — choose an earlier start time.');
    return;
  }
  const groups = chunkTopics(chapter.topics, Number(els.pSessions.value) || 3);
  if (!groups.length) {
    showPlannerError('This chapter has no topics to plan.');
    return;
  }
  const start = parseKey(startKey);
  const end = minToTime(startMin + length);
  const created = groups.map((group, index) => ({
    id: uid('task'),
    programId: state.activeProgramId,
    chapter: chapter.no,
    title: group.length === 1 ? group[0] : (group.length === 2 ? group[0] + ' & ' + group[1] : group[0] + ' +' + (group.length - 1)),
    date: dateKey(addDays(start, index)),
    start: startTime,
    end: end,
    priority: 'core',
    note: 'Chapter plan · Part ' + (index + 1) + ' of ' + groups.length,
    steps: group.map(topic => ({ id: uid('step'), text: topic, done: false })),
    createdAt: new Date().toISOString()
  }));
  state.tasks.push.apply(state.tasks, created);
  ui.lastChapter = chapter.no;
  saveState();
  closeModal();
  ui.date = created[0].date;
  ui.weekStart = dateKey(mondayOf(parseKey(created[0].date)));
  ui.animate = true;
  render();
  toast(groups.length + ' sessions planned · Ch ' + chapter.no + ' · ' +
    fmtMonthRange(parseKey(created[0].date), parseKey(created[created.length - 1].date)), { tone: 'done', duration: 4800 });
}

function submitSettings(event) {
  event.preventDefault();
  const active = activeProgram();
  if (!active) {
    toast('No active program to update', { icon: 'info' });
    return;
  }
  const name = els.sName.value.trim() || 'Student';
  const programName = els.sProgram.value.trim() || 'Study program';
  const course = els.sCourse.value.trim() || 'Study program';
  const examLabel = els.sExamLabel.value.trim() || 'Exam';
  const examDate = els.sExamDate.value;
  if (!examDate) {
    toast('Choose an exam date first', { icon: 'info' });
    els.sExamDate.focus();
    return;
  }
  const targetHours = clamp(Number(els.sTarget.value) || 3.5, 0.5, 12);
  state.student = name;
  active.name = programName;
  active.course = course;
  active.examLabel = examLabel;
  active.examDate = examDate;
  active.targetHours = targetHours;
  saveState();
  closeModal();
  ui.animate = false;
  render();
  toast('Settings saved', { tone: 'done' });
}

/* ---------- global events ---------- */
function handleAction(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return false;
  const action = trigger.dataset.action;
  const taskId = trigger.dataset.task;

  switch (action) {
    case 'new-task':
      event.preventDefault();
      openSessionModal({ date: ui.date });
      return true;
    case 'edit-task':
      closeTaskMenu();
      openSessionModal({ task: state.tasks.find(t => t.id === taskId) });
      return true;
    case 'move-task':
      closeTaskMenu();
      moveTask(taskId, trigger.dataset.target);
      return true;
    case 'delete-task':
      closeTaskMenu();
      deleteTask(taskId);
      return true;
    case 'task-menu':
      event.preventDefault();
      if (!els.menu.hidden && els.menu.dataset.task === taskId) { closeTaskMenu(); return true; }
      els.menu.dataset.task = taskId;
      openTaskMenu(taskId, trigger);
      return true;
    case 'toggle-step':
      toggleStep(taskId, Number(trigger.dataset.index));
      return true;
    case 'complete-all':
      closeTaskMenu();
      completeAll(taskId);
      return true;
    case 'focus-task':
      closeTaskMenu();
      focusTask(taskId);
      return true;
    case 'focus-free':
      focusFree();
      return true;
    case 'timer-toggle':
      if (timer.running) timerPause(); else timerStart();
      return true;
    case 'timer-reset':
      timerReset();
      toast('Timer reset', { icon: 'rotate', duration: 1800 });
      return true;
    case 'timer-mode':
      setTimerMode(trigger.dataset.mode);
      return true;
    case 'jump-timer':
      jumpToTimer();
      return true;
    case 'select-day':
      selectDay(trigger.dataset.date);
      return true;
    case 'prev-week':
      shiftWeek(-1);
      return true;
    case 'next-week':
      shiftWeek(1);
      return true;
    case 'this-week':
      selectDay(todayKey());
      return true;
    case 'repeat-day':
      repeatDay(trigger.dataset.date);
      return true;
    case 'copy-day':
      copyDayToNext(trigger.dataset.date || ui.date);
      return true;
    case 'carry-all':
      carryAllUnfinished();
      return true;
    case 'toggle-carry':
      ui.carryOpen = !ui.carryOpen;
      ui.animate = false;
      render();
      return true;
    case 'dismiss-carry':
      ui.carryDismissed = todayKey();
      ui.carryOpen = false;
      render();
      return true;
    case 'plan-chapter': {
      const candidates = activeChapters().map(chapter => ({ no: chapter.no, stats: chapterStats(chapter.no) }));
      const next = candidates.find(item => item.stats.tasks === 0) ||
        candidates.slice().sort((a, b) => a.stats.ratio - b.stats.ratio)[0];
      if (next) openChapterPlanner(next.no);
      else {
        const program = activeProgram();
        if (program) openProgramBuilder(program.id);
      }
      return true;
    }
    case 'jump-section': {
      const section = document.getElementById('section-' + String(trigger.dataset.section || ''));
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section.classList.add('is-target');
        setTimeout(() => section.classList.remove('is-target'), 1500);
      }
      return true;
    }
    case 'toggle-chapter': {
      const no = Number(trigger.dataset.chapter);
      if (ui.openChapters.has(no)) ui.openChapters.delete(no); else ui.openChapters.add(no);
      ui.animate = false;
      render();
      return true;
    }
    case 'schedule-chapter': {
      const chapter = chapterOf(Number(trigger.dataset.chapter));
      if (!chapter) return true;
      openChapterPlanner(chapter.no);
      return true;
    }
    case 'schedule-topic': {
      const chapter = chapterOf(Number(trigger.dataset.chapter));
      const topic = trigger.dataset.topic || '';
      if (!chapter) return true;
      openSessionModal({
        chapter: chapter.no,
        title: topic,
        steps: ['Read & annotate: ' + topic, 'Worked example on ' + topic, 'Exam-style practice: ' + topic],
        date: ui.date
      });
      return true;
    }
    case 'clear-search':
      clearSearch();
      return true;
    case 'export-day':
      exportDayLog(ui.date);
      return true;
    case 'export-today':
      exportDayLog(todayKey());
      return true;
    case 'export-json':
      exportJSON();
      return true;
    case 'dismiss-save-alert':
      hideSaveAlert();
      return true;
    case 'download-recovery':
      downloadRecoveryCopy();
      return true;
    case 'dismiss-recovery-alert':
      hideRecoveryAlert();
      return true;
    case 'reload-app':
      location.reload();
      return true;
    case 'dismiss-sync-alert':
      if (els.syncAlert) els.syncAlert.hidden = true;
      return true;
    case 'import-json':
      els.importFile.click();
      return true;
    case 'load-sample':
      if (trigger.closest('#settingsOverlay')) armDanger(trigger, 'sample', loadSamplePlan);
      else loadSamplePlan();
      return true;
    case 'reset-data':
      armDanger(trigger, 'reset', resetAllData);
      return true;
    case 'open-settings':
      openSettings();
      return true;
    case 'new-resource':
      openResourceModal(null);
      return true;
    case 'edit-resource': {
      const resource = state.resources.find(item => item.id === trigger.dataset.resource);
      if (!resource) {
        toast('That resource no longer exists', { icon: 'info' });
        return true;
      }
      openResourceModal(resource);
      return true;
    }
    case 'choose-file':
      els.rFile.click();
      return true;
    case 'clear-file':
      clearAttachedFile();
      return true;
    case 'delete-resource':
      if (ui.editingResourceId) armDanger(trigger, 'delete-resource', () => deleteResource(ui.editingResourceId));
      return true;
    case 'library-format':
      setLibraryFormat(trigger.dataset.format);
      return true;
    case 'open-resource':
      openResourcePreview(trigger.dataset.resource);
      return true;
    case 'clear-library-filters':
      clearLibraryFilters();
      return true;
    case 'export-library':
      exportLibrary();
      return true;
    case 'open-programs':
      openPrograms();
      return true;
    case 'new-program':
      openProgramBuilder(null);
      return true;
    case 'edit-program':
      openProgramBuilder(trigger.dataset.program);
      return true;
    case 'switch-program':
      switchProgram(trigger.dataset.program);
      return true;
    case 'add-program-section':
      addProgramSection();
      return true;
    case 'add-program-chapter':
      addProgramChapter(trigger.closest('.builder-section'));
      return true;
    case 'remove-program-section':
      removeProgramSection(trigger.closest('.builder-section'));
      return true;
    case 'remove-program-chapter':
      removeProgramChapter(trigger.closest('.builder-chapter'));
      return true;
    case 'copy-program-structure':
      copyProgramStructure();
      return true;
    case 'clear-program-structure':
      clearProgramStructure();
      return true;
    case 'delete-program': {
      const programId = ui.builderProgramId || trigger.dataset.program;
      armDanger(trigger, 'delete-program', () => deleteProgram(programId));
      return true;
    }
    case 'close-modal':
      closeModal();
      return true;
    case 'suggest-steps': {
      const chapter = chapterOf(Number(els.fChapter.value));
      if (!chapter) return true;
      els.fSteps.value = chapter.topics.join('\n');
      if (!els.fTitle.value.trim()) els.fTitle.value = chapter.title;
      updateStepCount();
      els.fSteps.focus();
      return true;
    }
    case 'toggle-rail':
      toggleRail();
      return true;
    case 'clear-search-top':
      clearSearch();
      return true;
    default:
      return false;
  }
}

function bindEvents() {
  document.addEventListener('click', event => {
    if (!els.menu.hidden && !event.target.closest('#taskMenu') && !event.target.closest('[data-action="task-menu"]')) {
      closeTaskMenu();
    }
    const handled = handleAction(event);
    if (!handled) return;
    if (modalsOpen() && !event.target.closest('.overlay')) {
      /* an action occurred outside a modal while it was open; keep state consistent */
    }
  });

  [els.scrim].forEach(node => {
    if (node) node.addEventListener('click', () => toggleRail(false));
  });

  $$('.nav-link, .brand').forEach(link => {
    link.addEventListener('click', () => toggleRail(false));
  });

  els.search.addEventListener('input', () => {
    ui.query = els.search.value.trim();
    updateSearchChrome();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      ui.animate = false;
      render();
      updateSearchChrome();
    }, 130);
  });
  els.search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (els.search.value) clearSearch(); else els.search.blur();
    }
  });

  document.addEventListener('change', event => {
    const filter = event.target.closest('[data-library-filter]');
    if (filter) {
      if (filter.dataset.libraryFilter === 'status') setLibraryStatus(filter.value);
      else if (filter.dataset.libraryFilter === 'sort') setLibrarySort(filter.value);
      return;
    }
    const status = event.target.closest('[data-resource-status]');
    if (status) {
      updateResourceStatus(status.dataset.resourceStatus, status.value);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!els.menu.hidden) { closeTaskMenu(); return; }
      if (modalsOpen()) { closeModal(); return; }
      if (els.app.classList.contains('rail-open')) { toggleRail(false); return; }
      if (document.activeElement === els.search) els.search.blur();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      if (modalsOpen()) return;
      event.preventDefault();
      els.search.focus();
      els.search.select();
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !modalsOpen() && !typingInField() && (event.key === 'n' || event.key === 'N')) {
      event.preventDefault();
      openSessionModal({ date: ui.date });
    }
  });

  [els.sessionOverlay, els.chapterOverlay, els.settingsOverlay, els.programsOverlay, els.programOverlay, els.resourceOverlay, els.previewOverlay].forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeModal();
    });
  });

  els.sessionForm.addEventListener('submit', submitSession);
  els.chapterForm.addEventListener('submit', submitChapterPlan);
  els.settingsForm.addEventListener('submit', submitSettings);
  els.programForm.addEventListener('submit', submitProgramForm);
  els.resourceForm.addEventListener('submit', submitResource);
  els.fSteps.addEventListener('input', updateStepCount);
  els.fChapter.addEventListener('change', updateChapterHint);
  els.rFormat.addEventListener('change', updateResourceFormatHint);
  els.rFile.addEventListener('change', handleFileSelected);
  els.fDate.addEventListener('change', updateRepeatHint);
  els.fRepeat.addEventListener('change', updateRepeatHint);
  els.pChapter.addEventListener('change', () => {
    fillPlannerSessions(els.pChapter.value);
    updateChapterPreview();
  });
  [els.pDate, els.pSessions, els.pStart, els.pLength].forEach(node => {
    node.addEventListener('change', updateChapterPreview);
    node.addEventListener('input', updateChapterPreview);
  });

  els.importFile.addEventListener('change', event => importJSONFile(event.target.files[0]));

  document.addEventListener('studyflow:save-failed', event => {
    showSaveAlert(event.detail && event.detail.reason);
  });
  document.addEventListener('studyflow:save-ok', hideSaveAlert);
  window.addEventListener('storage', event => {
    if (event.key !== STORE_KEY || !event.newValue) return;
    let current = '';
    try { current = JSON.stringify(state); } catch (err) { current = ''; }
    if (event.newValue === current) return;
    showSyncAlert();
  });

  window.addEventListener('beforeunload', saveTimerState);

  els.view.addEventListener('scroll', closeTaskMenu, { passive: true });
  window.addEventListener('resize', () => {
    closeTaskMenu();
    updateSearchPlaceholder();
    if (window.innerWidth > 1100) toggleRail(false);
  });
  window.addEventListener('hashchange', () => {
    const next = currentView();
    if (next !== ui.view) {
      ui.query = '';
      if (els.search) els.search.value = '';
    }
    ui.view = next;
    ui.animate = true;
    closeTaskMenu();
    toggleRail(false);
    render();
  });

  setInterval(() => {
    const key = todayKey();
    if (key === dayMarker) return;
    const previous = dayMarker;
    dayMarker = key;
    if (ui.date === previous) ui.date = key;
    ui.weekStart = dateKey(mondayOf(new Date()));
    ui.animate = true;
    render();
  }, 30000);
}

function typingInField() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
}
function updateSearchPlaceholder() {
  updateSearchChrome();
}
function trapFocus(event) {
  const overlay = !els.sessionOverlay.hidden ? els.sessionOverlay
    : !els.chapterOverlay.hidden ? els.chapterOverlay
    : !els.settingsOverlay.hidden ? els.settingsOverlay
    : !els.programsOverlay.hidden ? els.programsOverlay
    : !els.programOverlay.hidden ? els.programOverlay
    : !els.resourceOverlay.hidden ? els.resourceOverlay
    : !els.previewOverlay.hidden ? els.previewOverlay
    : null;
  if (!overlay) return;
  const focusables = $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', overlay)
    .filter(node => node.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const heading = overlay.querySelector('.modal-head h2[tabindex="-1"]');
  if (!overlay.contains(active)) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && (active === first || active === heading)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ---------- boot ---------- */
function init() {
  const loaded = loadState();
  const recovered = !!recoveryCopyKey();
  state = loaded || buildSeed();
  ui.date = todayKey();
  ui.weekStart = dateKey(mondayOf(new Date()));
  ui.view = currentView();
  dayMarker = todayKey();

  if (window.matchMedia && !navigator.platform.toLowerCase().includes('mac')) {
    const kbd = $('.search-kbd');
    if (kbd) kbd.textContent = 'Ctrl K';
  } else {
    const kbd = $('.search-kbd');
    if (kbd) kbd.textContent = '⌘ K';
  }

  bindEvents();
  populateChapterSelect();
  updateSearchPlaceholder();
  restoreTimerState();
  if (!loaded && !recovered) saveState();
  if (recovered) showRecoveryAlert();
  if (loaded) pruneFilesSoon();
  try {
    if (!location.hash) history.replaceState(null, '', '#plan');
  } catch (err) { /* file URLs may block history changes */ }
  render();
}

init();
