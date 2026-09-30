// ========== Today: the tray, Due soon and This week (spec 4.4, 4.6) ==========
// What is left of the two-lane "Today plan" after the line took over. The
// Scheduled lane became the line itself (js/line.js); the Anytime lane became
// the tray, a dashed box that sits directly under the now marker — work with no
// clock time belongs at "now", not in a card of its own further down the page.
// The triage nudge moved inside the tray with it.
//
// Nothing here writes during a render. Every save is behind a click.

const TRIAGE_SHEET_LIMIT = 12;

// The task model stores an hour (`scheduledHour`, 6..21) rather than a clock
// string; the line also reads a v3 `time` if one is ever set. A task with
// neither is what the tray holds.
function taskClockTime(t) {
  if (!t) return null;
  if (t.time) return String(t.time);
  if (t.scheduledHour != null && t.scheduledHour !== '') {
    return String(t.scheduledHour).padStart(2, '0') + ':00';
  }
  return null;
}

// `duration` is in hours (the modal's field). Shown the way you'd say it.
function taskEstimateText(t) {
  const d = Number(t && t.duration);
  if (!d || d <= 0) return '';
  const mins = Math.round(d * 60);
  return mins >= 60 ? Math.round(mins / 60 * 10) / 10 + 'h' : mins + 'm';
}

function trayTasks() {
  const today = getTodayStr();
  return (state.tasks || []).filter(t =>
    t && t.dueDate === today && !taskClockTime(t) &&
    (t.status !== 'done' || t.completedAt === today));
}

function datelessTasks() {
  return (state.tasks || []).filter(t => t && !t.dueDate && t.status !== 'done' && !taskClockTime(t));
}

// ---------- the tray ----------
// Rendered INTO the line, right after the now marker, so it reads as part of
// the day rather than a separate card. It cannot own a persistent host element
// for that reason: renderLine() rewrites the line's innerHTML, which would
// destroy anything living inside it. So the tray is built fresh each render and
// its clicks are delegated from #dashboardView (bound once, below).
function renderTray() {
  const lineHost = document.getElementById('dayLine');
  if (!lineHost) return;
  document.querySelectorAll('.today-tray').forEach(el => el.remove());
  // The tray is today's undated-time work and sits at "now"; another day has
  // no now to sit at.
  if (typeof lineViewDate !== 'undefined' && lineViewDate) return;

  const tasks = trayTasks();
  const dateless = datelessTasks();
  // Empty tray hides — but the triage nudge lives inside it, so a day with
  // nothing committed and a pile of undated work still needs the box to sit in.
  if (!tasks.length && !dateless.length) return;

  const left = tasks.filter(t => t.status !== 'done').length;
  const rows = tasks.map(t => {
    const done = t.status === 'done';
    const est = taskEstimateText(t);
    return `
    <div class="tray-task${done ? ' is-done' : ''}" draggable="${done ? 'false' : 'true'}" data-tray-task="${t.id}">
      <button type="button" class="tray-cb${done ? ' on' : ''}" data-tray-toggle="${t.id}"
              role="checkbox" aria-checked="${done}" aria-label="${done ? 'Completed' : 'Complete'}: ${esc(t.name)}"></button>
      <span class="tray-name" data-tray-open="${t.id}">${esc(t.name)}</span>
      ${est ? `<span class="tray-est">${est}</span>` : ''}
      <button type="button" class="tray-clock" data-tray-clock="${t.id}" aria-label="Give ${esc(t.name)} a time">
        <span class="ms">schedule</span>
      </button>
    </div>`;
  }).join('');

  const nudge = dateless.length ? `
    <div class="tray-triage">
      <b>${dateless.length}</b> task${dateless.length === 1 ? '' : 's'} ha${dateless.length === 1 ? 's' : 've'} no date.
      <button type="button" class="tray-triage-open" data-triage-open>Pull into today</button>
    </div>` : '';

  const html = `
    <div class="today-tray">
      <h6>No time needed <em>${left} left</em></h6>
      ${rows}
      ${nudge}
    </div>`;

  const marker = document.getElementById('dlNowMarker');
  if (marker && marker.parentElement) {
    marker.insertAdjacentHTML('afterend', html);
  } else {
    // No line to sit in (a day with nothing on it at all): the tray becomes the
    // only thing there rather than disappearing with the line.
    lineHost.hidden = false;
    lineHost.insertAdjacentHTML('beforeend', html);
  }
}

// ---------- triage sheet ----------
function renderTriageSheet() {
  const host = document.getElementById('triageBody');
  if (!host) return;
  const dateless = datelessTasks();

  if (!dateless.length) {
    host.innerHTML = '<p class="arr-foot">Nothing is waiting for a date. Good place to be.</p>';
    return;
  }

  host.innerHTML =
    dateless.slice(0, TRIAGE_SHEET_LIMIT).map(t => `
      <div class="triage-row">
        <span class="triage-name">${esc(t.name)}</span>
        ${taskCatChip(t)}
        <button type="button" class="dl-btn triage-add" data-triage-add="${t.id}">+ Today</button>
      </div>`).join('') +
    `<button type="button" class="dl-btn full" data-triage-all>See all ${dateless.length}</button>`;
}

function openTriageSheet() {
  renderTriageSheet();
  if (typeof openDlSheet === 'function') openDlSheet(document.getElementById('triageSheet'));
}

// ---------- Due soon (spec 4.6) ----------
// Replaces the My Tasks board and the Deadlines card: overdue first, then the
// next seven days. One list, dates in mono, category as a tinted chip.
function taskCatChip(t) {
  const cat = (state.categories || []).find(c => c.id === t.category);
  if (!cat) return '';
  const key = (typeof CATEGORY_COLOR_KEYS !== 'undefined' && CATEGORY_COLOR_KEYS.indexOf(cat.color) !== -1) ? cat.color : '';
  return `<em class="dl-chip${key ? ' c-' + key : ''}">${esc(cat.name)}</em>`;
}

function renderDueSoon() {
  const host = document.getElementById('todayDue');
  if (!host) return;
  const today = getTodayStr();
  const horizon = offsetDateStr(today, 7);

  const items = (state.tasks || [])
    .filter(t => t && t.status !== 'done' && t.dueDate && t.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  if (!items.length) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;

  host.innerHTML = `
    <h2 class="today-sec-t">Due soon</h2>
    ${items.map(t => {
      const overdue = t.dueDate < today;
      return `
      <div class="due-row" data-due-open="${t.id}">
        <span class="due-date${overdue ? ' is-over' : ''}">${esc(formatDate(t.dueDate))}</span>
        <span class="due-name">${esc(t.name)}</span>
        ${taskCatChip(t)}
      </div>`;
    }).join('')}`;
}

// ---------- This week (spec 4.6, desktop right column) ----------
// Seven bars in the move colour: active energy per day, which is the one figure
// that covers lifting, cardio and walking in a single unit, so a bar is never
// empty for a reason the chart can't show. Today's bar is outlined in accent.
function renderWeekBars() {
  const host = document.getElementById('todayWeek');
  if (!host) return;
  const today = getTodayStr();

  // Monday-first week containing today, so the bars line up with the MTWTFSS
  // labels under them whatever day you open the app.
  const d = new Date(today + 'T00:00:00');
  const monday = offsetDateStr(today, -((d.getDay() + 6) % 7));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = offsetDateStr(monday, i);
    const watch = (typeof getExternalActiveEnergy === 'function') ? getExternalActiveEnergy(date) : null;
    const burn = watch !== null && watch !== undefined
      ? Math.round(watch)
      : ((typeof estimateBurnForDate === 'function') ? Math.round(estimateBurnForDate(date) || 0) : 0);
    days.push({ date, burn, future: date > today });
  }

  const max = Math.max(1, ...days.map(x => x.burn));
  const sessions = days.filter(x =>
    (typeof isFullSession === 'function' && isFullSession(x.date)) ||
    (state.cardio || []).some(c => c && c.date === x.date)).length;

  host.innerHTML = `
    <h2 class="today-sec-t">This week <em>kcal burned</em></h2>
    <div class="dl-bars c-move">
      ${days.map(x => `<i class="${x.date === today ? 'now' : (x.burn ? '' : 'empty')}" style="--h:${x.future ? 0 : Math.round((x.burn / max) * 100)}%" title="${x.date}: ${x.burn} kcal"></i>`).join('')}
    </div>
    <div class="week-labels">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(l => `<span>${l}</span>`).join('')}</div>
    <p class="week-note">${sessions} session${sessions === 1 ? '' : 's'} so far this week</p>`;
}

// ---------- one delegated binding for all three ----------
// #dashboardView survives every render, so this is bound once behind a guard.
// Everything inside it is rewritten constantly; nothing here binds per row.
let todayBound = false;
function bindTodaySurfaces() {
  const root = document.getElementById('dashboardView');
  if (!root || todayBound) return;
  todayBound = true;

  root.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-tray-toggle]');
    if (toggle) { e.stopPropagation(); toggleTaskDone(toggle.dataset.trayToggle); return; }

    const open = e.target.closest('[data-tray-open]');
    if (open) { e.stopPropagation(); if (typeof openModal === 'function') openModal(open.dataset.trayOpen); return; }

    // Touch path for scheduling: the task sheet with the time field focused.
    const clock = e.target.closest('[data-tray-clock]');
    if (clock) {
      e.stopPropagation();
      if (typeof openTaskSheet === 'function') openTaskSheet(clock.dataset.trayClock, { focus: 'time' });
      return;
    }

    if (e.target.closest('[data-triage-open]')) { openTriageSheet(); return; }

    const due = e.target.closest('[data-due-open]');
    if (due && typeof openModal === 'function') openModal(due.dataset.dueOpen);
  });

  // Desktop: drag a tray task onto a row of the line to take that row's time.
  // Touch never fires HTML5 drag events, which is what the clock button above
  // is for — the same reason the board has both.
  let dragId = null;
  root.addEventListener('dragstart', (e) => {
    const row = e.target.closest('[data-tray-task]');
    if (!row) return;
    dragId = row.dataset.trayTask;
    row.classList.add('is-dragging');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  root.addEventListener('dragend', (e) => {
    const row = e.target.closest('[data-tray-task]');
    if (row) row.classList.remove('is-dragging');
    dragId = null;
  });
  const line = document.getElementById('dayLine');
  if (line) {
    line.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      const row = e.target.closest('.dl-line-item');
      document.querySelectorAll('.dl-line-item.is-drop').forEach(el => el.classList.remove('is-drop'));
      if (row) row.classList.add('is-drop');
    });
    line.addEventListener('dragleave', () => {
      document.querySelectorAll('.dl-line-item.is-drop').forEach(el => el.classList.remove('is-drop'));
    });
    line.addEventListener('drop', (e) => {
      if (!dragId) return;
      e.preventDefault();
      document.querySelectorAll('.dl-line-item.is-drop').forEach(el => el.classList.remove('is-drop'));
      const task = (state.tasks || []).find(t => t.id === dragId);
      dragId = null;
      if (!task) return;
      const row = e.target.closest('.dl-line-item');
      const label = row && row.querySelector('.t') ? row.querySelector('.t').textContent : '';
      const m = String(label).match(/(\d{1,2}):(\d{2})/);
      // Dropped on empty space, or on the sleep row that has no clock time: the
      // next hour is the only honest guess.
      const hour = m ? Number(m[1]) : Math.min(23, new Date().getHours() + 1);
      task.scheduledHour = Math.max(0, Math.min(23, hour));
      // `time` is what the task sheet edits; scheduledHour is derived from it
      // there, so both are written here to keep the two in step.
      task.time = String(task.scheduledHour).padStart(2, '0') + ':00';
      task.dueDate = task.dueDate || getTodayStr();
      saveData(state);
      if (typeof showToast === 'function') showToast('Scheduled for ' + task.scheduledHour + ':00');
      render();
    });
  }

  // Triage sheet lives outside #dashboardView, so it gets its own delegation.
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-triage-add]');
    if (add) {
      const task = (state.tasks || []).find(t => t.id === add.dataset.triageAdd);
      if (!task) return;
      task.dueDate = getTodayStr();
      saveData(state);
      if (typeof showToast === 'function') showToast('"' + task.name + '" pulled into today');
      render();
      renderTriageSheet();
      return;
    }
    if (e.target.closest('[data-triage-all]')) {
      if (typeof closeDlSheet === 'function') closeDlSheet(document.getElementById('triageSheet'));
      // Tasks groups by when, so "filtered to No date" is the No date group of
      // the list: make sure it is the list showing, then bring that group up.
      if (typeof setTasksMode === 'function') setTasksMode('list', true);
      if (typeof switchView === 'function') switchView('tasks');
      const group = document.querySelector('[data-tk-group="none"]');
      if (group) group.scrollIntoView({ block: 'start' });
    }
  });
}
