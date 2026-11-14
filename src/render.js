/* ==========================================================================
   StudyFlow — rendering
   ========================================================================== */

const timer = { mode: 25, remaining: 25 * 60, running: false, taskId: null, programId: null, endAt: 0, interval: 0 };
const BASE_TITLE = 'StudyFlow — Daily Study Tracker';
const VIEWS = ['plan', 'syllabus', 'library', 'analytics'];

function currentView() {
  const hash = String(location.hash || '').replace(/^#\/?/, '');
  return VIEWS.indexOf(hash) >= 0 ? hash : 'plan';
}
function fmtGoal(hours) {
  const h = Number(hours) || 0;
  return 'Goal ' + (h % 1 ? h.toFixed(1) : String(h)) + 'h';
}
function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
}
function pctText(ratio) { return Math.round(clamp(ratio, 0, 1) * 100) + '%'; }
function timerRatioLeft() {
  const total = timer.mode * 60;
  return total > 0 ? clamp(timer.remaining / total, 0, 1) : 0;
}
function timerTask() {
  return timer.taskId ? state.tasks.find(t => t.id === timer.taskId) : null;
}
function timerTaskLabel() {
  const task = timerTask();
  if (!task) return icon('info', 'icon-sm') + '<span>Free focus session</span>';
  return icon('book', 'icon-sm') + '<span>Ch ' + task.chapter + ' · ' + esc(task.title) + '</span>';
}
function syncTimerUI() {
  const digits = $('#timerDigits');
  if (digits) digits.textContent = mmss(timer.remaining);
  const label = $('#timerModeLabel');
  if (label) label.textContent = timer.running ? 'Deep work' : (timer.remaining < timer.mode * 60 ? 'Paused' : 'Ready');
  const circle = $('#timerProgress');
  if (circle) {
    const c = 2 * Math.PI * 19;
    circle.setAttribute('stroke-dashoffset', (c * (1 - timerRatioLeft())).toFixed(2));
  }
  const toggle = $('#timerToggle');
  if (toggle) {
    toggle.innerHTML = timer.running ? icon('pause') + '<span>Pause</span>' : icon('play') + '<span>Start</span>';
    toggle.setAttribute('aria-label', timer.running ? 'Pause focus timer' : 'Start focus timer');
  }
  const taskEl = $('#timerTask');
  if (taskEl) taskEl.innerHTML = timerTaskLabel();
  $$('.timer-mode').forEach(btn => btn.classList.toggle('is-active', Number(btn.dataset.mode) === timer.mode));
  const topTimer = document.getElementById('topTimer');
  if (topTimer) {
    let cardVisible = false;
    const card = document.getElementById('timerCard');
    if (card) {
      const rect = card.getBoundingClientRect();
      cardVisible = rect.bottom > 8 && rect.top < window.innerHeight - 8;
    }
    const active = timer.running || timer.remaining < timer.mode * 60;
    topTimer.hidden = !(active && !cardVisible);
    const topDigits = document.getElementById('topTimerDigits');
    if (topDigits) topDigits.textContent = mmss(timer.remaining);
  }
  document.title = timer.running ? mmss(timer.remaining) + ' · StudyFlow' : BASE_TITLE;
}

/* ---------- toasts ---------- */
function toast(message, options) {
  const opts = Object.assign({ duration: 4200, tone: 'info' }, options || {});
  const wrap = $('#toasts');
  if (!wrap) return;
  while (wrap.children.length >= 3) wrap.removeChild(wrap.firstElementChild);
  const el = document.createElement('div');
  el.className = 'toast' + (opts.tone === 'done' ? ' is-done' : '');
  el.innerHTML =
    icon(opts.icon || (opts.tone === 'done' ? 'check-circle' : 'info'), 'toast-icon') +
    '<span class="toast-msg">' + esc(message) + '</span>' +
    (opts.action ? '<button type="button" class="toast-btn">' + esc(opts.action) + '</button>' : '') +
    '<button type="button" class="toast-close" aria-label="Dismiss notification">' + icon('x') + '</button>';
  const dismiss = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity .18s, transform .18s';
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector('.toast-close').addEventListener('click', dismiss);
  if (opts.action) {
    el.querySelector('.toast-btn').addEventListener('click', () => {
      dismiss();
      if (typeof opts.onAction === 'function') opts.onAction();
    });
  }
  wrap.appendChild(el);
  if (opts.duration > 0) setTimeout(dismiss, opts.duration);
}

/* ---------- root render ---------- */
function render() {
  if (!state) return;
  ui.view = currentView();
  const view = $('#view');
  const inner = $('#viewInner');
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.focus : null;
  const keepScroll = view ? view.scrollTop : 0;
  const animate = !!ui.animate;
  ui.animate = false;

  renderChrome();
  const markup = ui.view === 'syllabus' ? viewSyllabus(animate)
    : ui.view === 'library' ? viewLibrary(animate)
    : ui.view === 'analytics' ? viewAnalytics(animate)
    : viewPlan(animate);
  if (inner) inner.innerHTML = markup;
  document.body.dataset.view = ui.view;
  if (view) view.scrollTop = animate ? 0 : keepScroll;

  if (focusKey && inner) {
    const next = inner.querySelector('[data-focus="' + focusKey + '"]');
    if (next) next.focus({ preventScroll: true });
  }
  if (ui.lastChecked && inner) {
    const row = inner.querySelector('.check-row[data-task="' + ui.lastChecked.task + '"][data-index="' + ui.lastChecked.index + '"]');
    if (row) {
      row.classList.add('just-checked');
      setTimeout(() => row.classList.remove('just-checked'), 380);
    }
    ui.lastChecked = null;
  }

  $$('.nav-link').forEach(link => {
    const on = link.dataset.nav === ui.view;
    link.classList.toggle('is-active', on);
    if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $$('.tab').forEach(tab => {
    const on = tab.dataset.tab === ui.view;
    tab.classList.toggle('is-active', on);
    if (on) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  });

  syncTimerUI();
  updateSearchChrome();
}
function updateSearchChrome() {
  const clear = $('.search-clear');
  if (clear) clear.hidden = !ui.query;
  const search = $('#search');
  if (!search) return;
  const library = ui.view === 'library';
  const compact = window.innerWidth < 520;
  search.placeholder = library
    ? (compact ? 'Search library…' : 'Search library resources…')
    : (compact ? 'Search topics…' : 'Search topics, chapters, steps…');
  search.setAttribute('aria-label', library ? 'Search the library' : 'Search study topics and chapters');
}
function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}
function renderChrome() {
  const program = activeProgram();
  const student = state.student || 'Student';
  const today = dayStats(todayKey());
  const streak = streakInfo();
  const exam = examDaysLeft();
  const targetMin = Math.round((Number(program && program.targetHours) || 0) * 60);
  const goalPct = targetMin ? clamp((today.logged / targetMin) * 100, 0, 100) : 0;

  setText('programName', program ? program.name : 'No program');
  setText('programSub', program ? program.course : 'Add a program to begin');
  setText('profileName', student);
  setText('profileSub', program ? program.name : 'StudyFlow');
  setText('profileAvatar', initials(student));
  setText('navCount', String(today.count));
  setText('libraryCount', String(activeResources().length));
  setText('railFocusValue', fmtDuration(today.logged));
  setText('railSteps', today.done + ' of ' + today.steps + ' steps');
  setText('railGoal', fmtGoal(program ? program.targetHours : 3.5));
  setText('railStreak', streak.count ? streak.count + ' day' + (streak.count === 1 ? '' : 's') + ' streak' : 'Start a streak');
  const railBar = document.getElementById('railFocusBar');
  if (railBar) railBar.style.width = goalPct.toFixed(1) + '%';

  const weekBar = $('#railStreakWeek');
  if (weekBar) {
    const monday = mondayOf(new Date());
    weekBar.innerHTML = Array.from({ length: 7 }).map((_, i) => {
      const key = dateKey(addDays(monday, i));
      const cls = dayStats(key).done > 0 ? 'is-done' : '';
      const todayCls = key === todayKey() ? 'is-today' : '';
      return '<i class="' + cls + ' ' + todayCls + '"></i>';
    }).join('');
  }

  setText('topExamDays', exam > 0 ? exam + (exam === 1 ? ' day' : ' days') : (exam === 0 ? 'Exam day' : 'Exam passed'));
  setText('topStreak', String(streak.count));
}

/* ---------- plan view ---------- */
function viewPlan(animate) {
  const key = ui.date;
  const isToday = key === todayKey();
  const all = tasksOn(key);
  const visible = searchTasks(all, ui.query);
  const stats = dayStats(key);
  const label = relativeDayLabel(key);
  const heading = (ui.query ? 'Matching sessions' : (isToday ? "Today's sessions" : label + "'s sessions"));
  const meta = ui.query
    ? visible.length + ' of ' + all.length + ' sessions'
    : (stats.count ? stats.count + ' session' + (stats.count === 1 ? '' : 's') + ' · ' + fmtDuration(stats.planned) + ' planned' : 'Nothing planned yet');

  return '<div class="page" ' + (animate ? 'data-animate="1"' : '') + '>' +
    heroHTML(key, stats, isToday) +
    weekbarHTML() +
    (isToday && !ui.query ? carryHTML() : '') +
    '<div class="plan-grid">' +
      '<section class="schedule" aria-labelledby="sessionsHeading">' +
        '<div class="section-head">' +
          '<h2 id="sessionsHeading"><span class="head-icon">' + icon('calendar-check') + '</span>' + esc(heading) + '</h2>' +
          '<div class="section-tools">' +
            (!ui.query && stats.count ? '<button type="button" class="btn btn-quiet" data-action="copy-day" data-date="' + key + '" title="Copy this day\'s sessions to tomorrow">' + icon('copy') + '<span>Copy day</span></button>' : '') +
            '<span class="section-meta">' + esc(meta) + '</span>' +
          '</div>' +
        '</div>' +
        (ui.query ? searchBanner(visible.length, all.length, 'sessions') : '') +
        (visible.length ? visible.map(sessionHTML).join('') : emptyPlanHTML(key, all.length, isToday)) +
        (visible.length ? '<button type="button" class="add-session" data-action="new-task">' + icon('plus') + ' Schedule a study session</button>' : '') +
      '</section>' +
      '<aside class="side" aria-label="Study tools">' + timerCardHTML() + examCardHTML() + consistencyCardHTML() + '</aside>' +
    '</div>' +
  '</div>';
}

function carryHTML() {
  if (ui.carryDismissed === todayKey()) return '';
  const items = unfinishedTasks(7);
  if (!items.length) return '';
  const shown = items.slice(0, 4);
  const today = todayKey();
  const open = !!ui.carryOpen;
  return '<section class="carry-card' + (open ? ' is-open' : '') + '" aria-labelledby="carryTitle">' +
    '<div class="carry-head">' +
      '<span class="carry-icon" aria-hidden="true">' + icon('rotate') + '</span>' +
      '<div class="carry-copy">' +
        '<h2 id="carryTitle">' + items.length + ' unfinished session' + (items.length === 1 ? '' : 's') + '</h2>' +
        '<p>From the last 7 days. Bring them forward or leave them in the log.</p>' +
      '</div>' +
      '<div class="carry-actions">' +
        '<button type="button" class="btn btn-primary" data-action="carry-all" aria-label="Move all unfinished sessions to today">' + icon('arrow-right') + '<span>Move all</span></button>' +
        '<button type="button" class="icon-btn" data-action="toggle-carry" aria-expanded="' + open + '" aria-label="' + (open ? 'Hide unfinished sessions' : 'Review unfinished sessions') + '">' + icon(open ? 'chevron-down' : 'chevron-right') + '</button>' +
        '<button type="button" class="icon-btn" data-action="dismiss-carry" aria-label="Hide carry-over suggestions">' + icon('x') + '</button>' +
      '</div>' +
    '</div>' +
    (open ? '<div class="carry-list">' + shown.map(task => {
      const chapter = chapterOf(task.chapter);
      const counts = stepCounts(task);
      return '<div class="carry-item">' +
        '<span class="carry-date">' + fmtMedium(parseKey(task.date)) + '</span>' +
        '<span class="carry-main"><b>' + esc(task.title) + '</b><span>' +
          (chapter ? 'Ch ' + chapter.no + ' · ' : '') + timeRange(task.start, task.end) + ' · ' + counts.done + '/' + counts.total + ' steps' +
        '</span></span>' +
        '<button type="button" class="btn btn-outline" data-action="move-task" data-task="' + task.id + '" data-target="' + today + '" aria-label="Move ' + esc(task.title) + ' to today">' +
          icon('arrow-right') + '<span>Today</span>' +
        '</button>' +
      '</div>';
    }).join('') + '</div>' : '') +
    (open && items.length > shown.length ? '<button type="button" class="carry-more" data-action="carry-all">+' + (items.length - shown.length) + ' more — move all to today</button>' : '') +
  '</section>';
}

function heroHTML(key, stats, isToday) {
  const date = parseKey(key);
  const program = activeProgram();
  const target = Math.round((Number(program && program.targetHours) || 0) * 60);
  const goalPct = target ? Math.round((stats.logged / target) * 100) : 0;
  const barPct = clamp(goalPct, 0, 100);
  const complete = stats.count > 0 && stats.done === stats.steps && stats.steps > 0;
  const sub = stats.count
    ? '<span><b>' + stats.complete + '</b> of ' + stats.count + ' sessions complete</span><span class="dot"></span><span><b>' + stats.done + '</b> of ' + stats.steps + ' steps checked</span><span class="dot"></span><span>' + fmtDuration(stats.planned) + ' planned</span>'
    : '<span>No sessions scheduled for this day yet</span>';

  return '<section class="hero' + (complete ? ' is-complete' : '') + '" aria-labelledby="dayHeading">' +
    '<div class="hero-grid">' +
      '<div>' +
        '<div class="hero-eyebrow">' +
          '<span class="hero-badge">' + esc(program ? program.name : 'StudyFlow') + '</span>' +
          '<span class="hero-course">' + esc(program ? program.course : 'Study program') + '</span>' +
          (!isToday ? '<span class="chip is-soft">' + esc(relativeDayLabel(key)) + '</span>' : '') +
        '</div>' +
        '<h1 id="dayHeading">' + fmtLong(date) + '</h1>' +
        '<p class="hero-sub">' + sub + '</p>' +
      '</div>' +
      '<div class="hero-actions">' +
        '<button type="button" class="btn btn-primary" data-action="new-task">' + icon('plus') + '<span>Schedule session</span></button>' +
        '<button type="button" class="btn btn-outline" data-action="focus-free">' + icon('timer') + '<span>Focus timer</span></button>' +
        '<button type="button" class="btn btn-quiet" data-action="export-day" aria-label="Export the daily study log">' + icon('download') + '<span>Export log</span></button>' +
      '</div>' +
    '</div>' +
    '<div class="goal">' +
      '<div class="goal-row">' +
        '<div class="goal-label"><span class="eyebrow">Daily goal</span><span class="goal-figure">' + fmtDuration(stats.logged) + ' / ' + fmtDuration(target) + '</span></div>' +
        '<span class="goal-pct" aria-label="' + goalPct + ' percent of daily goal">' + goalPct + '%</span>' +
      '</div>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + barPct + '" aria-label="Daily focus goal"><i style="width:' + barPct + '%"></i></div>' +
      '<div class="goal-foot"><span>' + stats.done + ' of ' + stats.steps + ' steps checked</span><span>' + stats.complete + ' of ' + stats.count + ' sessions complete</span></div>' +
    '</div>' +
  '</section>';
}

function weekbarHTML() {
  const start = parseKey(ui.weekStart);
  const end = addDays(start, 6);
  const todaySelected = ui.date === todayKey();  const days = Array.from({ length: 7 }).map((_, i) => {
    const day = addDays(start, i);
    const key = dateKey(day);
    const ds = dayStats(key);
    const selected = key === ui.date;
    const today = key === todayKey();
    const cls = ['day'];
    if (selected) cls.push('is-selected');
    if (today) cls.push('is-today');
    if (ds.done > 0) cls.push('has-done');
    return '<button type="button" class="' + cls.join(' ') + '" data-action="select-day" data-date="' + key + '" data-focus="day-' + key + '" aria-pressed="' + selected + '" aria-label="' + fmtLong(day) + ', ' + ds.done + ' of ' + ds.steps + ' steps complete">' +
      '<span class="day-name">' + DAY_SHORT[day.getDay()] + '</span>' +
      '<span class="day-num">' + day.getDate() + '</span>' +
      '<span class="day-mark" aria-hidden="true"></span>' +
      (ds.count ? '<span class="day-count" aria-hidden="true"></span>' : '') +
    '</button>';
  }).join('');

  return '<div class="weekbar">' +
    '<div class="weekbar-head">' +
      '<div class="weekbar-id"><span class="eyebrow">Week</span><span class="week-range">' + fmtMonthRange(start, end) + '</span></div>' +
      '<div class="week-tools">' +
        '<button type="button" class="today-btn" data-action="this-week" ' + (todaySelected ? 'disabled' : '') + '>Today</button>' +
        '<div class="week-nav">' +
          '<button type="button" data-action="prev-week" aria-label="Previous week">' + icon('chevron-left') + '</button>' +
          '<button type="button" data-action="next-week" aria-label="Next week">' + icon('chevron-right') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="days" role="group" aria-label="Choose a day">' + days + '</div>' +
  '</div>';
}

function sessionHTML(task) {
  const status = statusOf(task);
  const counts = stepCounts(task);
  const chapter = chapterOf(task.chapter) || { no: task.chapter, title: 'Chapter ' + task.chapter, topics: [] };
  const section = sectionOf(task.chapter) || { id: '—', weight: 0 };
  const kind = sessionKind(task.start);
  const priority = priorityMeta(task.priority);

  return '<article class="session is-' + status + '" data-task="' + task.id + '">' +
    '<div class="session-head">' +
      '<div class="session-when">' + icon('clock') + timeRange(task.start, task.end) +
        '<span class="dot"></span><span class="session-kind">' + icon(kind.icon) + kind.label + '</span>' +
      '</div>' +
      '<span class="state is-' + status + '">' + (status === 'live' ? '<i class="pulse"></i>' : '') + statusLabel(status, task.date) + '</span>' +
    '</div>' +
    '<h3 class="session-title">' + esc(task.title) + '</h3>' +
    '<div class="session-meta">' +
      '<span class="chip">' + icon('book') + 'Ch ' + chapter.no + ' · ' + esc(chapter.title) + '</span>' +
      '<span class="chip is-soft">' + icon('clock') + fmtDuration(taskMinutes(task)) + '</span>' +
      '<span class="chip is-soft">' + esc(section.id) + ' · ' + section.weight + '% weight</span>' +
      '<span class="chip is-soft">' + icon(priority.icon) + priority.label + '</span>' +
    '</div>' +
    (task.note ? '<div class="session-note">' + icon('sparkle') + '<span>' + esc(task.note) + '</span></div>' : '') +
    '<div class="checks" role="group" aria-label="Checklist for ' + esc(task.title) + '">' +
      '<span class="checks-label">Checklist · ' + counts.done + ' of ' + counts.total + '</span>' +
      task.steps.map((step, index) =>
        '<button type="button" class="check-row" data-action="toggle-step" data-task="' + task.id + '" data-index="' + index + '" data-focus="step-' + task.id + '-' + index + '" aria-pressed="' + !!step.done + '">' +
          '<span class="check-box" aria-hidden="true">' + icon('check') + '</span>' +
          '<span class="check-text">' + esc(step.text) + '</span>' +
        '</button>'
      ).join('') +
    '</div>' +
    '<div class="session-foot">' +
      '<span class="session-progress"><span class="mini-meter" aria-hidden="true"><i style="width:' + Math.round(counts.ratio * 100) + '%"></i></span>' + counts.done + ' / ' + counts.total + ' steps</span>' +
      '<div class="session-btns">' +
        (counts.done < counts.total ? '<button type="button" class="btn btn-quiet" data-action="complete-all" data-task="' + task.id + '" aria-label="Mark every step complete">' + icon('check-circle') + '<span>Mark all</span></button>' : '') +
        '<button type="button" class="btn btn-outline" data-action="focus-task" data-task="' + task.id + '" title="Start a focus sprint on this session" aria-label="Start a focus sprint on this session">' + icon('timer') + '<span>Focus</span></button>' +
        '<button type="button" class="icon-btn" data-action="task-menu" data-task="' + task.id + '" aria-label="Session options" aria-haspopup="menu">' + icon('more') + '</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function searchBanner(found, total, noun) {
  if (!ui.query) return '';
  const label = noun || 'sessions';
  const verb = found === 1 ? 'matches' : 'match';
  return '<div class="search-banner">' + icon('search') +
    '<span><b>' + found + '</b> of ' + total + ' ' + label + ' ' + verb + ' “' + esc(ui.query) + '”</span>' +
    '<button type="button" class="link" data-action="clear-search">Clear search</button></div>';
}

function emptyPlanHTML(key, totalOnDay, isToday) {
  if (ui.query) {
    return '<div class="empty"><svg class="empty-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="42" cy="42" r="24"/><path d="m59 59 16 16"/><path d="M33 42h18M42 33v18" opacity=".35"/></svg>' +
      '<h3>No sessions match “' + esc(ui.query) + '”</h3>' +
      '<p>Search across session titles, chapters, notes and checklist steps — or clear the search to see the full plan.</p>' +
      '<div class="empty-actions"><button type="button" class="btn btn-outline" data-action="clear-search">' + icon('x') + 'Clear search</button>' +
      '<button type="button" class="btn btn-primary" data-action="new-task">' + icon('plus') + 'Schedule a session</button></div></div>';
  }
  const prev = dateKey(addDays(parseKey(key), -1));
  const prevStats = dayStats(prev);
  const anyTasks = state.tasks.length > 0;
  const title = isToday ? 'A clear day. Make it count.' : 'Nothing planned for ' + relativeDayLabel(key).toLowerCase();
  const copy = isToday
    ? 'Choose a topic, block out the time and break the work into small checklist steps. Progress follows the plan.'
    : 'Build the plan for ' + fmtLong(parseKey(key)) + ' — or copy a previous day and adjust it.';
  const actions = '<button type="button" class="btn btn-primary" data-action="new-task">' + icon('plus') + 'Schedule a session</button>' +
    (prevStats.tasks.length ? '<button type="button" class="btn btn-outline" data-action="repeat-day" data-date="' + prev + '">' + icon('rotate') + 'Copy ' + relativeDayLabel(prev).toLowerCase() + '’s plan</button>' : '') +
    (!anyTasks ? '<button type="button" class="btn btn-quiet" data-action="load-sample">Load the sample plan</button>' : '');
  return '<div class="empty"><svg class="empty-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="22" y="18" width="52" height="64" rx="10"/><path d="M36 18v-4a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v4"/><path d="M34 40h28M34 52h20M34 64h12"/>' +
    '<circle cx="71" cy="69" r="14" fill="#fff"/><path d="m64.5 69 4.5 4.5L78 65" stroke="#2563EB"/></svg>' +
    '<h3>' + esc(title) + '</h3><p>' + esc(copy) + '</p><div class="empty-actions">' + actions + '</div></div>';
}

/* ---------- side widgets ---------- */
function timerCardHTML() {
  const circumference = 2 * Math.PI * 19;
  const offset = circumference * (1 - timerRatioLeft());
  const focus = focusToday();
  return '<div class="card timer-card" id="timerCard">' +
    '<div class="card-head"><span class="card-title">' + icon('timer') + ' Focus timer</span>' +
      '<div class="timer-modes" role="group" aria-label="Timer length" id="timerModes">' +
        '<button type="button" class="timer-mode ' + (timer.mode === 25 ? 'is-active' : '') + '" data-action="timer-mode" data-mode="25" aria-pressed="' + (timer.mode === 25) + '">25m</button>' +
        '<button type="button" class="timer-mode ' + (timer.mode === 50 ? 'is-active' : '') + '" data-action="timer-mode" data-mode="50" aria-pressed="' + (timer.mode === 50) + '">50m</button>' +
      '</div>' +
    '</div>' +
    '<div class="timer-display">' +
      '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="timer-track" cx="22" cy="22" r="19"></circle><circle class="timer-progress" id="timerProgress" cx="22" cy="22" r="19" stroke-dasharray="' + circumference.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"></circle></svg>' +
      '<div class="timer-center"><span class="timer-digits" id="timerDigits">' + mmss(timer.remaining) + '</span><span class="timer-mode-label" id="timerModeLabel">' + (timer.running ? 'Deep work' : (timer.remaining < timer.mode * 60 ? 'Paused' : 'Ready')) + '</span></div>' +
    '</div>' +
    '<div class="timer-task" id="timerTask">' + timerTaskLabel() + '</div>' +
    '<div class="timer-actions">' +
      '<button type="button" class="btn btn-primary" id="timerToggle" data-action="timer-toggle">' + (timer.running ? icon('pause') + '<span>Pause</span>' : icon('play') + '<span>Start</span>') + '</button>' +
      '<button type="button" class="icon-btn" data-action="timer-reset" aria-label="Reset timer" title="Reset timer">' + icon('rotate') + '</button>' +
    '</div>' +
    '<div class="timer-foot"><span>Sprints today <b>' + focus.count + '</b></span><span>' + (focus.minutes ? fmtDuration(focus.minutes) + ' focused' : 'Ready to begin') + '</span></div>' +
  '</div>';
}

function examCardHTML() {
  const program = activeProgram();
  const days = examDaysLeft();
  const overall = overallStats();
  const examDate = parseKey(program ? program.examDate : todayKey());
  const sections = activeSections();
  const spec = sections.map(section => {
    const st = sectionStats(section.id);
    const width = Math.round(clamp(st.mastery, 0, 1) * 100);
    return '<div class="spec-row"><span>' + section.id + ' · ' + esc(section.short || section.name) + '</span><b>' + (st.started ? width + '%' : '—') + '</b>' +
      '<div class="bar"><i style="width:' + (st.started ? width : 0) + '%"></i></div></div>';
  }).join('');
  return '<div class="card exam-card">' +
    '<div class="card-head"><span class="card-title">Exam countdown</span><span class="eyebrow">' + esc(program ? program.examLabel : 'Exam') + '</span></div>' +
    '<div class="exam-top">' +
      '<div class="exam-days"><b>' + (days > 0 ? days : '—') + '</b><span>' + (days === 1 ? 'day left' : 'days left') + '</span></div>' +
      '<span class="exam-label">' + fmtMedium(examDate) + '<br>' + examDate.getFullYear() + '</span>' +
    '</div>' +
    '<div class="mastery-block">' +
      '<div class="ring" role="img" aria-label="' + pctText(overall.ratio) + ' of the plan complete">' + ringSVG(overall.ratio) + '<span class="ring-label">' + pctText(overall.ratio) + '</span></div>' +
      '<div class="mastery-copy"><strong>Plan completion</strong><span>' + overall.chaptersStarted + ' of ' + overall.chaptersTotal + ' chapters practised · ' + overall.done + ' steps</span></div>' +
    '</div>' +
    '<div class="spec-list">' + spec + '</div>' +
  '</div>';
}

function consistencyCardHTML() {
  const streak = streakInfo();
  const days = lastNDays(7);
  const stats = statsForRange(days[0], days[6]);
  const heat = days.map(key => {
    const day = parseKey(key);
    const ds = dayStats(key);
    const hours = Math.round((ds.logged / 60) * 10) / 10;
    const label = ds.logged > 0 ? Number(hours.toFixed(1)) + 'h' : '';
    return '<div class="heat-day"><span>' + DAY_SHORT[day.getDay()].slice(0, 1) + '</span>' +
      '<div class="heat-cell ' + (ds.logged > 0 ? 'has-value' : '') + (key === todayKey() ? ' is-today' : '') + '" title="' + fmtLong(day) + ' — ' + fmtDuration(ds.logged) + ' focused">' +
        label +
      '</div></div>';
  }).join('');
  return '<div class="card consistency-card">' +
    '<div class="card-head"><span class="card-title">Consistency</span>' +
      '<span class="consistency-streak">' + icon('flame') + streak.count + 'd streak</span>' +
    '</div>' +
    '<div class="heat" role="img" aria-label="Focus hours over the last seven days">' + heat + '</div>' +
    '<p class="consistency-note"><b>' + fmtDuration(stats.logged) + '</b> focused in the last 7 days · ' + stats.activeDays + ' active days.</p>' +
  '</div>';
}

/* ---------- syllabus view ---------- */
function weightedSyllabusMastery() {
  const sections = activeSections();
  const total = sections.reduce((sum, section) => sum + (Number(section.weight) || 0), 0) || 1;
  return sections.reduce((sum, section) => sum + sectionStats(section.id).mastery * (Number(section.weight) || 0), 0) / total;
}
function curriculumHeroHTML(overall, mastery, exam) {
  const pct = Math.round(clamp(mastery, 0, 1) * 100);
  const sections = activeSections();
  const strip = sections.map(section => {
    const st = sectionStats(section.id);
    const sectionPct = Math.round(clamp(st.mastery, 0, 1) * 100);
    return '<button type="button" class="spec-seg" style="flex:' + Math.max(1, Number(section.weight) || 0) + ' 1 0" data-action="jump-section" data-section="' + section.id + '" aria-label="' +
      section.id + ' · ' + esc(section.name) + ' · ' + section.weight + ' percent weight · ' + sectionPct + ' percent mastered">' +
      '<span class="spec-fill" style="height:' + sectionPct + '%" aria-hidden="true"></span>' +
      '<span class="spec-letter" aria-hidden="true">' + section.id + '</span>' +
      '<span class="spec-pct" aria-hidden="true">' + sectionPct + '%</span>' +
    '</button>';
  }).join('');
  return '<section class="curriculum-hero" aria-labelledby="curriculumTitle">' +
    '<div class="curriculum-top">' +
      '<div class="curriculum-ring" role="img" aria-label="' + pct + ' percent weighted syllabus mastery">' +
        ringSVG(clamp(mastery, 0, 1)) +
        '<span class="curriculum-ring-label">' + pct + '%</span>' +
      '</div>' +
      '<div class="curriculum-copy">' +
        '<span class="eyebrow on-dark">Exam-weighted progress</span>' +
        '<h2 id="curriculumTitle">Syllabus mastery</h2>' +
        '<p>Weighted by exam section · ' + overall.done + ' of ' + overall.steps + ' scheduled steps complete</p>' +
      '</div>' +
      '<div class="curriculum-stats">' +
        '<div><b>' + overall.chaptersStarted + '<small> / ' + overall.chaptersTotal + '</small></b><span>Chapters started</span></div>' +
        '<div><b>' + fmtDuration(overall.logged) + '</b><span>Focus logged</span></div>' +
        '<div><b>' + (exam > 0 ? exam : '—') + '</b><span>Days to exam</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="curriculum-spec">' +
      '<div class="spec-head"><span class="eyebrow on-dark">Specification grid</span><span class="spec-hint">Width = exam weight · fill = mastery · click to jump</span></div>' +
      '<div class="spec-strip" role="group" aria-label="Exam sections by weight">' + strip + '</div>' +
    '</div>' +
  '</section>';
}
function sectionHTML(section, chapters) {
  const st = sectionStats(section.id);
  const totalChapters = activeChapters().filter(c => c.section === section.id).length;
  const mastery = Math.round(clamp(st.mastery, 0, 1) * 100);
  const stepText = st.steps ? st.done + ' of ' + st.steps + ' steps checked' : 'not scheduled yet';
  return '<section class="section-block" id="section-' + section.id + '" aria-labelledby="sec-' + section.id + '">' +
    '<div class="section-card-head">' +
      '<span class="sec-letter" aria-hidden="true">' + section.id + '</span>' +
      '<div class="sec-title-block">' +
        '<h2 class="sec-name" id="sec-' + section.id + '">' + esc(section.name) + '</h2>' +
        '<p class="sec-sub">' + totalChapters + ' chapter' + (totalChapters === 1 ? '' : 's') + ' · ' + stepText + '</p>' +
      '</div>' +
      '<div class="sec-right">' +
        '<span class="sec-weight">' + section.weight + '% weight</span>' +
        '<span class="sec-mastery"><b>' + mastery + '%</b><span>mastered</span></span>' +
      '</div>' +
    '</div>' +
    '<div class="sec-meter" aria-hidden="true"><i style="width:' + mastery + '%"></i></div>' +
    '<div class="chapter-list">' + chapters.map(chapter => chapterHTML(chapter)).join('') + '</div>' +
  '</section>';
}
function syllabusEmptyHTML(query) {
  return '<div class="empty">' +
    '<svg class="empty-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M22 20h18a10 10 0 0 1 10 10v48a8 8 0 0 0-8-8H22z"/><path d="M74 20H56a10 10 0 0 0-10 10v48a8 8 0 0 1 8-8h20z"/><path d="m40 46 5 5 10-11" stroke="#2563EB"/>' +
    '</svg>' +
    '<h3>No chapters match “' + esc(query) + '”</h3><p>Search chapter titles or syllabus topics, for example “variances”, “EOQ” or “budget”.</p>' +
    '<div class="empty-actions"><button type="button" class="btn btn-outline" data-action="clear-search">' + icon('x') + 'Clear search</button></div>' +
  '</div>';
}
function viewSyllabus(animate) {
  const program = activeProgram();
  const overall = overallStats();
  const exam = examDaysLeft();
  const mastery = weightedSyllabusMastery();
  const q = ui.query.trim();
  const programChapters = activeChapters();
  const pageHead =
    '<div class="page-head">' +
      '<div>' +
        '<span class="eyebrow">' + esc(program ? program.name : 'Study program') + '</span>' +
        '<h1>Syllabus map</h1>' +
        '<p>' + (programChapters.length ? programChapters.length + ' chapters across ' + activeSections().length + ' weighted section' + (activeSections().length === 1 ? '' : 's') + '. Open a chapter to schedule its topics, or plan it across several days.' : 'Add sections and chapters to this program, then start scheduling topics.') + '</p>' +
      '</div>' +
      '<div class="page-actions">' +
        '<button type="button" class="icon-btn" data-action="export-json" aria-label="Export backup" title="Export backup">' + icon('download') + '</button>' +
        '<button type="button" class="btn btn-outline" data-action="new-task">' + icon('plus') + 'Schedule topic</button>' +
        '<button type="button" class="btn btn-primary" data-action="plan-chapter">' + icon('calendar') + 'Plan a chapter</button>' +
      '</div>' +
    '</div>';

  if (!programChapters.length) {
    return '<div class="page syllabus-page" ' + (animate ? 'data-animate="1"' : '') + '>' +
      pageHead +
      '<div class="empty empty-program">' +
        '<svg class="empty-art" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M22 20h18a10 10 0 0 1 10 10v48a8 8 0 0 0-8-8H22z"/><path d="M74 20H56a10 10 0 0 0-10 10v48a8 8 0 0 1 8-8h20z"/><path d="M37 48h18M46 39v18" stroke="#2563EB"/>' +
        '</svg>' +
        '<h3>This program has no chapters yet</h3>' +
        '<p>Add a few sections and chapters to <b>' + esc(program ? program.name : 'this program') + '</b>, then build its daily study plan.</p>' +
        '<div class="empty-actions">' +
          '<button type="button" class="btn btn-primary" data-action="edit-program" data-program="' + (program ? program.id : '') + '">' + icon('edit') + 'Add chapters</button>' +
          '<button type="button" class="btn btn-outline" data-action="open-programs">' + icon('layers') + 'Switch program</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  let sectionsHTML = '';
  let matches = 0;
  activeSections().forEach(section => {
    const chapters = programChapters.filter(c => c.section === section.id && matchChapter(c, q));
    if (!chapters.length) return;
    matches += chapters.length;
    sectionsHTML += sectionHTML(section, chapters);
  });

  if (!sectionsHTML) sectionsHTML = syllabusEmptyHTML(q);

  return '<div class="page syllabus-page" ' + (animate ? 'data-animate="1"' : '') + '>' +
    pageHead +
    curriculumHeroHTML(overall, mastery, exam) +
    (q ? searchBanner(matches, programChapters.length, 'chapters') : '') +
    '<div class="syllabus">' + sectionsHTML + '</div>' +
  '</div>';
}

function kpiHTML(label, value, sub) {
  return '<div class="kpi"><span class="kpi-label">' + label + '</span><span class="kpi-value">' + value + '</span><span class="kpi-sub">' + esc(sub) + '</span></div>';
}

function chapterState(stats) {
  if (!stats.steps) return { key: 'empty', label: 'Not started' };
  if (stats.done >= stats.steps) return { key: 'done', label: 'Complete' };
  if (!stats.done) return { key: 'scheduled', label: 'Scheduled' };
  return { key: 'active', label: 'In progress' };
}
function chapterHTML(chapter) {
  const st = chapterStats(chapter.no);
  const open = ui.openChapters.has(chapter.no) || (!!ui.query.trim() && matchChapter(chapter, ui.query.trim()));
  const pct = st.steps ? Math.round(clamp(st.ratio, 0, 1) * 100) : 0;
  const state = chapterState(st);
  const meta = st.tasks
    ? chapter.topics.length + ' topics · ' + st.tasks + ' session' + (st.tasks === 1 ? '' : 's') + ' · ' + st.done + '/' + st.steps + ' steps'
    : chapter.topics.length + ' topics · not scheduled';
  const body = open
    ? '<div class="chapter-body">' +
        '<div class="topic-list" role="group" aria-label="Topics in ' + esc(chapter.title) + '">' +
          chapter.topics.map(topic =>
            '<button type="button" class="topic" data-action="schedule-topic" data-chapter="' + chapter.no + '" data-topic="' + esc(topic) + '">' +
              '<span class="topic-plus" aria-hidden="true">' + icon('plus') + '</span>' +
              '<span class="topic-text">' + esc(topic) + '</span>' +
            '</button>'
          ).join('') +
        '</div>' +
        '<div class="chapter-actions">' +
          '<button type="button" class="btn btn-primary" data-action="schedule-chapter" data-chapter="' + chapter.no + '">' + icon('calendar') + 'Plan this chapter</button>' +
          '<span class="chapter-hint">Tap a topic to schedule it individually</span>' +
        '</div>' +
      '</div>'
    : '';
  return '<article class="chapter' + (open ? ' is-open' : '') + (state.key === 'done' ? ' is-done' : '') + '" data-chapter="' + chapter.no + '">' +
    '<button type="button" class="chapter-row" data-action="toggle-chapter" data-chapter="' + chapter.no + '" aria-expanded="' + open + '" data-focus="chapter-' + chapter.no + '">' +
      '<span class="chapter-no">' + pad2(chapter.no) + '</span>' +
      '<span class="chapter-main">' +
        '<span class="chapter-title">' + esc(chapter.title) + '</span>' +
        '<span class="chapter-sub">' + esc(meta) + '</span>' +
        '<span class="chapter-meter" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
      '</span>' +
      '<span class="chapter-state is-' + state.key + '">' + state.label + '</span>' +
      '<span class="chapter-pct">' + (st.steps ? pct + '%' : '—') + '</span>' +
      '<span class="chapter-chev" aria-hidden="true">' + icon('chevron-down') + '</span>' +
    '</button>' + body +
  '</article>';
}

/* ---------- library view ---------- */
function libraryFilteredResources() {
  let list = activeResources().filter(resource => resourceMatches(resource, ui.query));
  if (ui.libraryFormat !== 'all') list = list.filter(resource => normalizeFormatId(resource.format) === ui.libraryFormat);
  if (ui.libraryStatus !== 'all') list = list.filter(resource => resource.status === ui.libraryStatus);
  if (ui.librarySort === 'title') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else if (ui.librarySort === 'chapter') {
    list.sort((a, b) => (Number(a.chapter) || 0) - (Number(b.chapter) || 0) || a.title.localeCompare(b.title));
  } else {
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.title.localeCompare(b.title));
  }
  return list;
}
function libraryHasFilters() {
  return !!ui.query || ui.libraryFormat !== 'all' || ui.libraryStatus !== 'all';
}
function resourceAction(resource) {
  const format = normalizeFormatId(resource.format);
  const url = safeUrl(resource.url);
  if (resource.fileId) {
    return {
      kind: 'preview',
      label: format === 'video' ? 'Play video' : format === 'audio' ? 'Listen now' : format === 'image' ? 'View image' : 'View file',
      url: url
    };
  }
  if (!url) return { kind: 'edit', label: 'Review resource', url: '' };
  const source = previewSource(resource);
  if (source.kind === 'external') {
    return {
      kind: 'external',
      label: format === 'video' ? 'Open video' : format === 'audio' ? 'Open audio' : format === 'image' ? 'Open image' : format === 'link' ? 'Open link' : 'Open document',
      url: url
    };
  }
  return {
    kind: 'preview',
    label: format === 'video' ? 'Play video' : format === 'audio' ? 'Listen now' : format === 'image' ? 'View image' : 'View document',
    url: url
  };
}
function resourcePreviewMediaHTML(resource) {
  const format = libraryFormat(resource.format);
  const source = previewSource(resource);
  const domain = resourceDomain(resource.url);
  if (source.kind === 'youtube' || source.kind === 'vimeo') {
    return '<div class="preview-embed"><iframe src="' + esc(source.src) + '" title="' + esc(resource.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
  }
  if (source.kind === 'video') {
    return '<video class="preview-video" controls playsinline preload="metadata" src="' + esc(source.src) + '"></video>';
  }
  if (source.kind === 'image') {
    return '<img class="preview-image" src="' + esc(source.src) + '" alt="' + esc(resource.title) + '" loading="lazy">';
  }
  if (source.kind === 'audio') {
    return '<div class="preview-audio">' +
      '<div class="preview-audio-art">' + icon('headphones') + '</div>' +
      '<div class="preview-audio-body">' +
        '<span class="preview-audio-kicker">' + icon('headphones') + 'Audio</span>' +
        '<h3>' + esc(resource.title) + '</h3>' +
        '<audio controls preload="metadata" src="' + esc(source.src) + '"></audio>' +
      '</div>' +
    '</div>';
  }
  if (source.kind === 'pdf') {
    return '<iframe class="preview-pdf" src="' + esc(source.src) + '" title="' + esc(resource.title) + '" loading="lazy"></iframe>';
  }
  const external = source.external
    ? '<a class="btn btn-primary" href="' + esc(source.external) + '" target="_blank" rel="noopener noreferrer">Open original ' + icon('arrow-up-right') + '</a>'
    : '';
  return '<div class="preview-fallback">' +
    '<span class="preview-fallback-icon">' + icon(format.icon) + '</span>' +
    '<h3>' + (source.external ? 'Preview unavailable' : 'Offline resource') + '</h3>' +
    '<p>' + (source.external
      ? 'This ' + format.label.toLowerCase() + ' opens on ' + esc(domain || 'the original site') + '. Use the button below to continue.'
      : 'No link is saved for this resource. Use the notes below to work with it.') + '</p>' +
    external +
  '</div>';
}
function resourceFileMediaHTML(resource, objectUrl) {
  const format = normalizeFormatId(resource.format);
  const mime = String(resource.fileType || '').toLowerCase();
  const name = resource.fileName || resource.title;
  const size = fileSizeLabel(resource.fileSize);
  if (format === 'image' || mime.startsWith('image/')) {
    return '<img class="preview-image" src="' + esc(objectUrl) + '" alt="' + esc(resource.title) + '">';
  }
  if (format === 'video' || mime.startsWith('video/')) {
    return '<video class="preview-video" controls playsinline preload="metadata" src="' + esc(objectUrl) + '"></video>';
  }
  if (format === 'audio' || mime.startsWith('audio/')) {
    return '<div class="preview-audio">' +
      '<div class="preview-audio-art">' + icon('headphones') + '</div>' +
      '<div class="preview-audio-body">' +
        '<span class="preview-audio-kicker">' + icon('headphones') + 'Audio file</span>' +
        '<h3>' + esc(resource.title) + '</h3>' +
        '<p class="preview-audio-file">' + esc(name) + ' · ' + size + '</p>' +
        '<audio controls preload="metadata" src="' + esc(objectUrl) + '"></audio>' +
      '</div>' +
    '</div>';
  }
  if (isPdf(name) || mime === 'application/pdf') {
    return '<iframe class="preview-pdf" src="' + esc(objectUrl) + '" title="' + esc(resource.title) + '"></iframe>';
  }
  return '<div class="preview-fallback">' +
    '<span class="preview-fallback-icon">' + icon(format === 'document' ? 'file-text' : format.icon) + '</span>' +
    '<h3>Preview unavailable</h3>' +
    '<p>' + esc(name) + ' (' + size + ') is attached. Download it to open with the matching app on your device.</p>' +
    '<a class="btn btn-primary" href="' + esc(objectUrl) + '" download="' + esc(name) + '">Download file ' + icon('download') + '</a>' +
  '</div>';
}
function libraryFeatureHTML() {
  const list = activeResources().slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const resource = list.find(item => item.status === 'reading') ||
    list.find(item => item.status === 'to-read') ||
    list[0];
  if (!resource) return '';
  const format = libraryFormat(resource.format);
  const status = libraryStatus(resource.status);
  const kicker = resource.status === 'reading' ? 'Continue reading' :
    resource.status === 'to-read' ? 'Up next in your library' : 'From your library';
  const note = resource.note || 'A saved resource for ' + resourceChapterLabel(resource).toLowerCase() + '.';
  const action = resourceAction(resource);
  return '<article class="featured-card">' +
    '<div class="featured-top">' +
      '<span class="featured-kicker">' + icon('sparkle') + kicker + '</span>' +
      '<div class="featured-top-actions">' +
        '<span class="resource-type is-on-dark">' + icon(format.icon) + '<span>' + format.label + '</span></span>' +
        '<button type="button" class="icon-btn" data-action="edit-resource" data-resource="' + resource.id + '" aria-label="Edit ' + esc(resource.title) + '">' + icon('edit') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="featured-body">' +
      '<div class="featured-copy">' +
        '<h2>' + esc(resource.title) + '</h2>' +
        '<p class="featured-meta">' + icon('bookmark') + esc(resourceChapterLabel(resource)) + '</p>' +
        (resource.fileId ? '<p class="featured-file">' + icon('paperclip') + esc(resource.fileName || 'Attached file') + ' · ' + fileSizeLabel(resource.fileSize) + '</p>' : '') +
        '<p class="featured-note">' + esc(note) + '</p>' +
      '</div>' +
      '<div class="featured-art" aria-hidden="true">' + icon(format.icon) + '</div>' +
    '</div>' +
    '<div class="featured-foot">' +
      '<span class="status-pill is-' + status.id + '">' + status.label + '</span>' +
      '<div class="featured-actions">' +
        (action.kind === 'external'
          ? '<a class="btn btn-light" href="' + esc(action.url) + '" target="_blank" rel="noopener noreferrer">' + action.label + ' ' + icon('arrow-up-right') + '</a>'
          : '<button type="button" class="btn btn-light" ' + (action.kind === 'preview' ? 'data-action="open-resource" data-resource="' + resource.id + '"' : 'data-action="edit-resource" data-resource="' + resource.id + '"') + '>' + action.label + ' ' + icon('arrow-right') + '</button>') +
      '</div>' +
    '</div>' +
  '</article>';
}
function libraryCollectionHTML(stats) {
  const finishedPct = stats.total ? Math.round((stats.finished / stats.total) * 100) : 0;
  const coveragePct = stats.chapterTotal ? Math.round((stats.chaptersCovered / stats.chapterTotal) * 100) : 0;
  const rows = [
    { label: 'Reading', count: stats.reading, cls: 'is-reading' },
    { label: 'To read', count: stats.toRead, cls: 'is-to-read' },
    { label: 'Reference', count: stats.reference, cls: 'is-reference' }
  ].map(row =>
    '<div class="collection-row"><span><i class="' + row.cls + '"></i>' + row.label + '</span><b>' + row.count + '</b></div>'
  ).join('');
  return '<aside class="library-summary" aria-labelledby="collectionTitle">' +
    '<div class="summary-head"><div><span class="eyebrow">Collection</span><h2 id="collectionTitle">This program</h2></div><span class="chip is-soft">' + stats.total + ' items</span></div>' +
    '<div class="collection-figure"><b>' + stats.finished + '</b><span>of ' + stats.total + ' finished</span></div>' +
    '<div class="collection-meter" role="img" aria-label="' + finishedPct + ' percent of resources finished"><i style="width:' + finishedPct + '%"></i></div>' +
    '<div class="collection-rows">' + rows + '</div>' +
    '<div class="collection-coverage">' +
      '<div class="collection-coverage-head"><span>Chapters covered</span><b>' + stats.chaptersCovered + ' <em>/ ' + stats.chapterTotal + '</em></b></div>' +
      '<div class="collection-meter is-coverage" role="img" aria-label="' + stats.chaptersCovered + ' of ' + stats.chapterTotal + ' chapters have resources"><i style="width:' + coveragePct + '%"></i></div>' +
    '</div>' +
  '</aside>';
}
function libraryToolbarHTML(stats, filtered) {
  const hasFilters = libraryHasFilters();
  const typeChips = [{ id: 'all', label: 'All', count: stats.total }].concat(
    LIBRARY_FORMATS
      .map(format => ({ id: format.id, label: format.plural, count: stats.byFormat[format.id] || 0 }))
      .filter(format => format.count > 0 || ui.libraryFormat === format.id)
  ).map(format =>
    '<button type="button" class="type-chip' + (ui.libraryFormat === format.id ? ' is-active' : '') + '" data-action="library-format" data-format="' + format.id + '" aria-pressed="' + (ui.libraryFormat === format.id) + '">' +
      format.label + '<span>' + format.count + '</span>' +
    '</button>'
  ).join('');
  const statusOptions = '<option value="all">All</option>' + LIBRARY_STATUSES.map(status =>
    '<option value="' + status.id + '"' + (ui.libraryStatus === status.id ? ' selected' : '') + '>' + status.label + '</option>'
  ).join('');
  const sortOptions = [
    { id: 'recent', label: 'Newest' },
    { id: 'chapter', label: 'Chapter' },
    { id: 'title', label: 'Title' }
  ].map(sort =>
    '<option value="' + sort.id + '"' + (ui.librarySort === sort.id ? ' selected' : '') + '>' + sort.label + '</option>'
  ).join('');
  const resultLabel = ui.query
    ? '<b>' + filtered.length + '</b> of ' + stats.total + ' resources match “' + esc(ui.query) + '”'
    : '<b>' + filtered.length + '</b> of ' + stats.total + ' resources shown';
  return '<section class="library-toolbar" aria-label="Library filters">' +
    '<div class="library-types" role="group" aria-label="Filter by content format">' + typeChips + '</div>' +
    '<div class="library-controls">' +
      '<label class="mini-select"><span>Status</span><select data-library-filter="status" aria-label="Filter by status">' + statusOptions + '</select></label>' +
      '<label class="mini-select"><span>Sort</span><select data-library-filter="sort" aria-label="Sort resources">' + sortOptions + '</select></label>' +
    '</div>' +
    '<div class="library-resultline" aria-live="polite">' +
      '<span>' + resultLabel + '</span>' +
      (hasFilters ? '<button type="button" class="link" data-action="clear-library-filters">Clear filters</button>' : '') +
    '</div>' +
  '</section>';
}
function resourceCardHTML(resource) {
  const format = libraryFormat(resource.format);
  const status = libraryStatus(resource.status);
  const action = resourceAction(resource);
  const options = LIBRARY_STATUSES.map(item =>
    '<option value="' + item.id + '"' + (item.id === resource.status ? ' selected' : '') + '>' + item.label + '</option>'
  ).join('');
  return '<article class="resource-card format-' + format.id + '">' +
    '<div class="resource-card-head">' +
      '<span class="resource-type">' + icon(format.icon) + '<span>' + format.label + '</span></span>' +
      '<button type="button" class="icon-btn" data-action="edit-resource" data-resource="' + resource.id + '" aria-label="Edit ' + esc(resource.title) + '">' + icon('edit') + '</button>' +
    '</div>' +
    '<h3>' + esc(resource.title) + '</h3>' +
    '<p class="resource-meta">' + icon('bookmark') + '<span>' + esc(resourceChapterLabel(resource)) + '</span></p>' +
    (resource.fileId ? '<p class="resource-file">' + icon('paperclip') + '<span>' + esc(resource.fileName || 'Attached file') + '</span><em>' + fileSizeLabel(resource.fileSize) + '</em></p>' : '') +
    (resource.note ? '<p class="resource-note">' + esc(resource.note) + '</p>' : '') +
    '<div class="resource-foot">' +
      '<select class="resource-status is-' + status.id + '" data-resource-status="' + resource.id + '" aria-label="Status for ' + esc(resource.title) + '">' + options + '</select>' +
      (action.kind === 'external'
        ? '<a class="resource-link" href="' + esc(action.url) + '" target="_blank" rel="noopener noreferrer">' + action.label + ' ' + icon('arrow-up-right') + '</a>'
        : '<button type="button" class="resource-link" ' + (action.kind === 'preview' ? 'data-action="open-resource" data-resource="' + resource.id + '"' : 'data-action="edit-resource" data-resource="' + resource.id + '"') + '>' + action.label + ' ' + icon('arrow-right') + '</button>') +
    '</div>' +
  '</article>';
}
function libraryEmptyHTML(filtered) {
  const isFiltered = filtered || libraryHasFilters();
  if (isFiltered) {
    const title = ui.query ? 'No resources match “' + esc(ui.query) + '”' : 'No resources in this view';
    return '<div class="empty library-empty">' +
      '<div class="library-empty-art">' + icon('search') + '</div>' +
      '<h3>' + title + '</h3>' +
      '<p>Try another type or status, or clear the filters to see the full collection.</p>' +
      '<div class="empty-actions">' +
        '<button type="button" class="btn btn-outline" data-action="clear-library-filters">' + icon('x') + 'Clear filters</button>' +
        '<button type="button" class="btn btn-primary" data-action="new-resource">' + icon('plus') + 'Add resource</button>' +
      '</div>' +
    '</div>';
  }
  const hints = LIBRARY_FORMATS.map(format => '<span class="type-hint">' + icon(format.icon) + format.label + '</span>').join('');
  return '<div class="empty library-empty">' +
    '<div class="library-empty-art">' + icon('library') + '</div>' +
    '<h3>Start your study library</h3>' +
    '<p>Keep documents, images, videos, audio and links for <b>' + esc(activeProgram() ? activeProgram().name : 'this program') + '</b> beside the chapters they support.</p>' +
    '<div class="library-empty-types">' + hints + '</div>' +
    '<div class="empty-actions"><button type="button" class="btn btn-primary" data-action="new-resource">' + icon('plus') + 'Add your first resource</button></div>' +
  '</div>';
}
function viewLibrary(animate) {
  const program = activeProgram();
  const all = activeResources();
  const stats = libraryStats();
  const filtered = libraryFilteredResources();
  const hasFilters = libraryHasFilters();
  const pageHead =
    '<div class="page-head library-head">' +
      '<div>' +
        '<span class="eyebrow">' + esc(program ? program.name : 'Study program') + ' · Library</span>' +
        '<h1>Study library</h1>' +
        '<p>Documents, images, videos, audio and links for this program — kept beside the chapters they support.</p>' +
      '</div>' +
      '<div class="page-actions">' +
        (all.length ? '<button type="button" class="icon-btn" data-action="export-library" aria-label="Export reading list" title="Export reading list">' + icon('download') + '</button>' : '') +
        '<button type="button" class="btn btn-primary" data-action="new-resource">' + icon('plus') + 'Add resource</button>' +
      '</div>' +
    '</div>';

  if (!all.length) {
    return '<div class="page library-page" ' + (animate ? 'data-animate="1"' : '') + '>' + pageHead + libraryEmptyHTML(false) + '</div>';
  }

  return '<div class="page library-page" ' + (animate ? 'data-animate="1"' : '') + '>' +
    pageHead +
    (!hasFilters ? '<div class="library-top">' + libraryFeatureHTML() + libraryCollectionHTML(stats) + '</div>' : '') +
    libraryToolbarHTML(stats, filtered) +
    (filtered.length ? '<div class="resource-grid">' + filtered.map(resourceCardHTML).join('') + '</div>' : libraryEmptyHTML(true)) +
  '</div>';
}

/* ---------- analytics view ---------- */
function viewAnalytics(animate) {
  const days = lastNDays(14);
  const program = activeProgram();
  const sections = activeSections();
  const chapters = activeChapters();
  const week = statsForRange(days[0], days[13]);
  const prevWeek = statsForRange(dateKey(addDays(new Date(), -13)), dateKey(addDays(new Date(), -7)));
  const thisWeek = statsForRange(days[7], days[13]);
  const overall = overallStats();
  const streak = streakInfo();
  const target = Math.round((Number(program && program.targetHours) || 0) * 60);
  const weekTarget = Math.max(1, target * 7);
  const weekPct = clamp(thisWeek.logged / weekTarget, 0, 1);
  const weekAvg = thisWeek.logged / 7;
  const maxMinutes = Math.max(target, 60, ...days.map(key => Math.round(dayStats(key).logged)));
  const chart = days.map(key => {
    const day = parseKey(key);
    const ds = dayStats(key);
    const logged = Math.round(ds.logged);
    const height = maxMinutes ? (logged / maxMinutes) * 100 : 0;
    const isToday = key === todayKey();
    return '<div class="bar-col ' + (logged > 0 ? 'has-value' : 'is-zero') + (isToday ? ' is-today' : '') + '" title="' + fmtLong(day) + ' — ' + fmtDuration(logged) + '">' +
      '<div class="bar-fill" style="height:' + (logged > 0 ? Math.max(3, height).toFixed(2) : 0) + '%"></div>' +
      '<span class="bar-label">' + day.getDate() + '</span>' +
    '</div>';
  }).join('');
  const bestDay = days.slice(7).map(key => ({ key: key, stats: dayStats(key) })).reduce((a, b) => b.stats.logged > a.stats.logged ? b : a, { key: days[13], stats: dayStats(days[13]) });
  let deltaLabel;
  if (!prevWeek.logged && !thisWeek.logged) deltaLabel = 'No focus logged yet';
  else if (!prevWeek.logged) deltaLabel = 'First focus week on record';
  else {
    const diff = thisWeek.logged - prevWeek.logged;
    deltaLabel = diff >= 0
      ? fmtDuration(diff) + ' more than the previous 7 days'
      : fmtDuration(Math.abs(diff)) + ' less than the previous 7 days';
  }
  const chapterRows = chapters.length ? chapters.map(chapter => {
    const st = chapterStats(chapter.no);
    const width = Math.round(clamp(st.ratio, 0, 1) * 100);
    return '<div class="ct-row ' + (st.steps ? '' : 'is-empty') + '">' +
      '<span class="ct-no">' + pad2(chapter.no) + '</span>' +
      '<span class="ct-name">' + esc(chapter.title) + '</span>' +
      '<span class="bar" aria-hidden="true"><i style="width:' + width + '%"></i></span>' +
      '<b>' + (st.steps ? width + '%' : '—') + '</b>' +
    '</div>';
  }).join('') : '<div class="panel-empty">No chapters in this program yet.</div>';
  const masteryRows = sections.length ? sections.map(section => {
    const st = sectionStats(section.id);
    const width = Math.round(clamp(st.mastery, 0, 1) * 100);
    return '<div class="mastery-row"><span class="m-name">' + section.id + ' · ' + esc(section.short || section.name) + ' <em>(' + section.weight + '%)</em></span>' +
      '<b>' + (st.started ? width + '%' : '—') + '</b>' +
      '<span class="bar" aria-hidden="true"><i style="width:' + (st.started ? width : 0) + '%"></i></span></div>';
  }).join('') : '<div class="panel-empty">No sections in this program yet.</div>';
  const programSessions = state.focusSessions.filter(session => program && session.programId === program.id);
  const focusLog = programSessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.at).localeCompare(String(a.at))).slice(0, 6);
  const logHTML = focusLog.length
    ? focusLog.map(session => {
        const day = parseKey(session.date);
        return '<div class="log-item"><span class="log-badge">' + icon('timer') + '</span>' +
          '<span class="log-main"><b>' + session.minutes + ' minute focus sprint</b><span>' + fmtMedium(day) + ' · ' + relativeDayLabel(session.date) + '</span></span>' +
          '<span class="log-mins">' + session.minutes + 'm</span></div>';
      }).join('')
    : '<div class="panel-empty">No focus sprints logged yet.<br>Start the timer on the daily plan.</div>';

  return '<div class="page" ' + (animate ? 'data-animate="1"' : '') + '>' +
    '<div class="page-head">' +
      '<div><span class="eyebrow">' + esc(program ? program.name : 'Study program') + ' · Progress · last 14 days</span><h1>Study analytics</h1>' +
      '<p>Focus time, checklist throughput and syllabus coverage — measured against the exam weighting.</p></div>' +
      '<div class="page-actions"><button type="button" class="btn btn-outline" data-action="export-today">' + icon('download') + 'Export today</button>' +
        '<button type="button" class="btn btn-primary" data-action="new-task">' + icon('plus') + 'Schedule session</button></div>' +
    '</div>' +
    '<div class="kpi-row">' +
      kpiHTML('Focus · 7 days', fmtDuration(thisWeek.logged), deltaLabel) +
      kpiHTML('Steps checked', overall.done + '<small> / ' + overall.steps + '</small>', pctText(overall.ratio) + ' of everything scheduled') +
      kpiHTML('Active days', week.activeDays + '<small> / 14</small>', 'Current streak ' + streak.count + ' day' + (streak.count === 1 ? '' : 's')) +
      kpiHTML('Chapters started', overall.chaptersStarted + '<small> / ' + overall.chaptersTotal + '</small>', 'Across ' + sections.length + ' weighted section' + (sections.length === 1 ? '' : 's')) +
    '</div>' +
    '<div class="analytics-grid">' +
      '<section class="panel" aria-labelledby="chartTitle">' +
        '<div class="panel-head"><h2 id="chartTitle">Daily focus minutes</h2><span class="chip is-soft">14 days</span></div>' +
        '<div class="chart-wrap">' +
          '<div class="chart-y" aria-hidden="true"><span>' + fmtDuration(maxMinutes) + '</span><span>0</span></div>' +
          '<div class="chart-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
          (target ? '<div class="chart-goal" style="top:' + ((1 - target / maxMinutes) * 100) + '%"><span>' + fmtDuration(target) + ' goal</span></div>' : '') +
          '<div class="chart" role="img" aria-label="Focus minutes for the last fourteen days">' + chart + '</div>' +
        '</div>' +
        '<div class="chart-legend"><span><i class="l-blue"></i>Focus logged</span><span><i class="l-ink"></i>Today</span><span style="margin-left:auto">' + fmtDuration(week.logged) + ' total</span></div>' +
      '</section>' +
      '<section class="panel" aria-labelledby="masteryTitle">' +
        '<div class="panel-head"><h2 id="masteryTitle">Section mastery</h2><span class="chip is-soft">Weighted</span></div>' +
        '<div class="mastery-list">' + masteryRows + '</div>' +
      '</section>' +
      '<section class="panel" aria-labelledby="chaptersTitle">' +
        '<div class="panel-head"><h2 id="chaptersTitle">Chapter progress</h2><span class="chip is-soft">' + overall.done + '/' + overall.steps + ' steps</span></div>' +
        '<div class="chapter-table">' + chapterRows + '</div>' +
      '</section>' +
      '<div class="analytics-side">' +
      '<section class="panel panel-log" aria-labelledby="logTitle">' +
        '<div class="panel-head"><h2 id="logTitle">Focus log</h2><span class="chip is-soft">' + programSessions.length + ' sprints</span></div>' +
        '<div class="log-list">' + logHTML + '</div>' +
      '</section>' +
      '<section class="panel week-panel" aria-labelledby="weekTitle">' +
        '<div class="panel-head"><h2 id="weekTitle">Last 7 days</h2><span class="chip is-soft">' + thisWeek.activeDays + '/7 active</span></div>' +
        '<div class="week-target">' +
          '<div class="ring" role="img" aria-label="' + pctText(weekPct) + ' of the weekly focus target">' + ringSVG(weekPct) + '<span class="ring-label">' + pctText(weekPct) + '</span></div>' +
          '<div class="mastery-copy"><strong>' + fmtDuration(thisWeek.logged) + '</strong><span>of ' + fmtDuration(weekTarget) + ' weekly target</span></div>' +
        '</div>' +
        '<div class="bar" aria-hidden="true"><i style="width:' + (weekPct * 100).toFixed(1) + '%"></i></div>' +
        '<div class="week-stats">' +
          '<div><span>Avg / day</span><b>' + fmtDuration(weekAvg) + '</b></div>' +
          '<div><span>Best day</span><b>' + fmtDuration(bestDay.stats.logged) + '</b></div>' +
          '<div><span>Sessions</span><b>' + overall.complete + ' done</b></div>' +
        '</div>' +
      '</section>' +
      '</div>' +
    '</div>' +
  '</div>';
}
