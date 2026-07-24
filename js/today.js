// ========== Today plan (two-lane) ==========
// design_handoff_daylign_v2 section 1, refs 10a/10b. The Dashboard became
// Today; this is the plan that now leads it. Two lanes:
//   Scheduled — clock-pinned tasks/events, a vertical timeline.
//   Anytime   — undated-but-due-today work, the majority. Check to complete,
//               or schedule it to give it a time.
// Plus a triage nudge that pulls your dateless pile into the day. Everything
// that was already on the dashboard (stat chips, health strip, weekly report)
// stays below, demoted — nothing lost.

const TRIAGE_CHIP_LIMIT = 3;

// Domain colours for the timeline dots (handoff: work / training / meals /
// recovery). Task category maps onto them; a due item overrides to red.
function todayDomainColor(task) {
  const cat = task.category || '';
  if (cat === 'health') return 'var(--purple)';   // training/fitness
  if (cat === 'personal') return 'var(--blue)';    // recovery/life
  if (cat === 'learning') return 'var(--green)';
  return 'var(--accent)';                           // work + default
}

function formatHourLabel(h) {
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:00${h < 12 ? ' AM' : ' PM'}`.replace(':00', ':00');
}

// A short estimate chip from the task's duration (hours). Only shown when set.
function todayEstimateChip(task) {
  const d = Number(task.duration);
  if (!d || d <= 0) return '';
  const mins = Math.round(d * 60);
  const txt = mins >= 60 ? `~${Math.round(mins / 60 * 10) / 10}h` : `~${mins}m`;
  return `<span class="today-anytime-est">${txt}</span>`;
}

function renderTodayPlan() {
  const host = document.getElementById('todayPlan');
  if (!host) return;
  const today = getTodayStr();
  const tasks = (state.tasks || []).filter(t => t.status !== 'done' || t.completedAt === today);

  // Scheduled: due today (or overdue) AND pinned to an hour. Plus timed events.
  const scheduled = tasks
    .filter(t => t.status !== 'done' && t.scheduledHour != null && (!t.dueDate || t.dueDate <= today))
    .sort((a, b) => a.scheduledHour - b.scheduledHour);

  // Anytime today: committed to today (due today) but no clock time yet — the
  // undated-but-due majority. Completed-today items stay so checking one off
  // doesn't make it vanish mid-glance.
  const anytime = tasks
    .filter(t => t.dueDate === today && t.scheduledHour == null);

  // Triage: genuinely dateless, not-done work waiting to be pulled into a day.
  const dateless = tasks.filter(t => !t.dueDate && t.status !== 'done' && t.scheduledHour == null);

  const parts = [];

  // ---- Triage nudge ----
  if (dateless.length) {
    const chips = dateless.slice(0, TRIAGE_CHIP_LIMIT).map(t => `
      <div class="today-triage-chip">
        <span class="today-triage-name">${esc(t.name)}</span>
        <button type="button" class="today-triage-add" data-triage-add="${t.id}">+ Today</button>
      </div>`).join('');
    const more = dateless.length > TRIAGE_CHIP_LIMIT
      ? `<button type="button" class="today-triage-more" data-triage-all>See all ${dateless.length} ›</button>`
      : '';
    parts.push(`
      <div class="today-triage">
        <div class="today-triage-head">
          <span class="today-triage-icon">🗂️</span>
          <span>${dateless.length} task${dateless.length === 1 ? ' has' : 's have'} no date. Pull ${dateless.length === 1 ? 'it' : 'a few'} into today?</span>
        </div>
        <div class="today-triage-chips">${chips}${more}</div>
      </div>`);
  }

  // ---- Scheduled lane ----
  const scheduledRows = scheduled.length ? scheduled.map(t => {
    const overdue = t.dueDate && t.dueDate < today;
    const dot = overdue ? 'var(--red)' : todayDomainColor(t);
    return `
      <div class="today-sched-row${overdue ? ' is-due' : ''}" data-open-task="${t.id}">
        <span class="today-sched-time">${formatHourLabel(t.scheduledHour)}</span>
        <span class="today-sched-dot" style="background:${dot}"></span>
        <span class="today-sched-name">${esc(t.name)}${overdue ? ' <span class="today-sched-due">due</span>' : ''}</span>
        <span class="today-sched-check ${t.status === 'done' ? 'checked' : ''}" data-toggle-task="${t.id}"></span>
      </div>`;
  }).join('') : '<div class="today-lane-empty">Nothing pinned to a time yet.</div>';

  // ---- Anytime lane ----
  const anytimeRows = anytime.length ? anytime.map(t => `
      <div class="today-anytime-row${t.status === 'done' ? ' is-done' : ''}" draggable="true" data-anytime-task="${t.id}">
        <span class="today-anytime-check ${t.status === 'done' ? 'checked' : ''}" data-toggle-task="${t.id}"></span>
        <span class="today-anytime-name" data-open-task="${t.id}">${esc(t.name)}</span>
        ${todayEstimateChip(t)}
        <button type="button" class="today-anytime-schedule" data-schedule-task="${t.id}" title="Give it a time">🕑</button>
        <span class="today-anytime-handle" aria-hidden="true">⠿</span>
      </div>`).join('') : '<div class="today-lane-empty">Nothing committed to today yet — pull a task up from the nudge above.</div>';

  parts.push(`
    <div class="today-lanes">
      <div class="today-lane today-lane-scheduled">
        <div class="today-lane-label">Scheduled</div>
        <div class="today-sched-list" id="todaySchedList">${scheduledRows}</div>
      </div>
      <div class="today-lane today-lane-anytime">
        <div class="today-lane-label">Anytime today <span class="today-lane-hint">drag up to schedule</span></div>
        <div class="today-anytime-list">${anytimeRows}</div>
      </div>
    </div>`);

  host.innerHTML = parts.join('');
  bindTodayPlan();
}

function bindTodayPlan() {
  const host = document.getElementById('todayPlan');
  if (!host) return;

  // Triage "+ Today": commit a dateless task to today.
  host.querySelectorAll('[data-triage-add]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id === btn.dataset.triageAdd);
      if (!task) return;
      task.dueDate = getTodayStr();
      saveData(state);
      if (typeof showToast === 'function') showToast(`"${task.name}" pulled into today`);
      render();
    });
  });

  // "See all N" → the task list, filtered to what needs a date.
  const seeAll = host.querySelector('[data-triage-all]');
  if (seeAll) seeAll.addEventListener('click', () => { if (typeof switchView === 'function') switchView('tasks'); });

  // Check off a task from either lane.
  host.querySelectorAll('[data-toggle-task]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof toggleTaskDone === 'function') toggleTaskDone(el.dataset.toggleTask);
    });
  });

  // Open a task (row body / name).
  host.querySelectorAll('[data-open-task]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof openModal === 'function') openModal(el.dataset.openTask);
    });
  });

  // Schedule button: open the task so a time can be set (works on touch, where
  // dragging between lanes is unreliable).
  host.querySelectorAll('[data-schedule-task]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof openModal === 'function') openModal(btn.dataset.scheduleTask);
    });
  });

  // Desktop: drag an Anytime task onto the Scheduled lane to give it a time.
  // Drops onto a specific row inherit that row's hour; drops on empty space
  // use the next hour from now. Touch falls back to the schedule button above.
  let dragId = null;
  host.querySelectorAll('[data-anytime-task]').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragId = row.dataset.anytimeTask;
      row.classList.add('is-dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => { dragId = null; row.classList.remove('is-dragging'); });
  });
  const schedList = document.getElementById('todaySchedList');
  if (schedList) {
    schedList.addEventListener('dragover', e => { e.preventDefault(); schedList.classList.add('is-drop'); });
    schedList.addEventListener('dragleave', () => schedList.classList.remove('is-drop'));
    schedList.addEventListener('drop', e => {
      e.preventDefault();
      schedList.classList.remove('is-drop');
      if (!dragId) return;
      const task = state.tasks.find(t => t.id === dragId);
      if (!task) return;
      const overRow = e.target.closest('.today-sched-row');
      let hour;
      if (overRow) {
        const overTask = state.tasks.find(t => t.id === overRow.dataset.openTask);
        hour = overTask ? overTask.scheduledHour : null;
      }
      if (hour == null) hour = Math.min(23, new Date().getHours() + 1);
      task.scheduledHour = hour;
      task.dueDate = task.dueDate || getTodayStr();
      saveData(state);
      if (typeof showToast === 'function') showToast(`Scheduled for ${formatHourLabel(hour)}`);
      render();
    });
  }
}
