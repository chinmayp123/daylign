// ========== Tasks (v3, spec 5) ==========
// One view, two faces. The List / Board choice is a device preference, not
// state, so it lives in daylign_prefs and is not synced — it describes this
// screen, not this person's data.
//
// The list groups by WHEN rather than sorting by it: Overdue, Today, This week,
// Later, No date. A flat sorted list made "what is late" something you had to
// work out from a column of dates; the groups say it outright. The triage line
// on No date exists because a dateless pile is the one group that only grows.

const ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // done tasks auto-archive after 1 week

function isArchived(t) {
  if (t.status !== 'done' || !t.completedAt) return false;
  const completed = new Date(t.completedAt + 'T00:00:00');
  return (Date.now() - completed.getTime()) >= ARCHIVE_AFTER_MS;
}

// ---- mode (List / Board) ----
function tasksMode() {
  try {
    const m = (typeof readPrefs === 'function') ? readPrefs().tasksMode : 'list';
    return m === 'board' ? 'board' : 'list';
  } catch (e) { return 'list'; }
}

// quiet: set by switchView('board'), where re-rendering mid-switch would be
// wasted work — switchView calls render() straight after.
function setTasksMode(mode, quiet) {
  const m = mode === 'board' ? 'board' : 'list';
  if (typeof readPrefs === 'function' && typeof writePrefs === 'function') {
    const p = readPrefs();
    if (p.tasksMode !== m) { p.tasksMode = m; writePrefs(p); }
  }
  applyTasksMode();
  if (!quiet) { renderTasksView(); renderBoard(); }
}

function applyTasksMode() {
  const m = tasksMode();
  const list = document.getElementById('tasksListPane');
  const board = document.getElementById('tasksBoardPane');
  if (list) list.hidden = m !== 'list';
  if (board) board.hidden = m !== 'board';
  document.querySelectorAll('[data-tasks-mode]').forEach(b => {
    const on = b.dataset.tasksMode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

// ---- filters (view state, not persisted: they are a momentary question) ----
let taskFilterStatus = 'open';   // open | all | todo | in-progress | done
let taskFilterCategory = 'all';
let taskSort = 'due';            // due | created | name

const TASK_STATUS_FILTERS = [
  { v: 'open', label: 'Open' },
  { v: 'all', label: 'All' },
  { v: 'in-progress', label: 'Doing' },
  { v: 'done', label: 'Done' },
];
const TASK_SORTS = [
  { v: 'due', label: 'Sort: date' },
  { v: 'created', label: 'Sort: newest' },
  { v: 'name', label: 'Sort: A-Z' },
];

// Monday-start week end, so "This week" means the rest of THIS week.
function endOfWeekStr(todayStr) {
  const d = new Date(todayStr + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;            // 0 = Monday
  d.setDate(d.getDate() + (6 - dow));
  return toLocalDateStr(d);
}

function renderTasksView() {
  applyTasksMode();
  const host = document.getElementById('tasksList');
  if (!host) return;

  const today = getTodayStr();
  const searchEl = document.getElementById('searchInput');
  const search = searchEl ? searchEl.value.trim().toLowerCase() : '';

  const active = [];
  const archived = [];
  (state.tasks || []).forEach(t => { (isArchived(t) ? archived : active).push(t); });

  let tasks = active;
  if (search) tasks = tasks.filter(t =>
    String(t.name || '').toLowerCase().includes(search) ||
    (t.description && String(t.description).toLowerCase().includes(search)));
  if (taskFilterStatus === 'open') tasks = tasks.filter(t => t.status !== 'done');
  else if (taskFilterStatus !== 'all') tasks = tasks.filter(t => t.status === taskFilterStatus);
  if (taskFilterCategory !== 'all') tasks = tasks.filter(t => t.category === taskFilterCategory);
  if (activeProject) tasks = tasks.filter(t => t.project === activeProject);

  renderTaskFilters(active);
  renderTaskProjectChips(active);

  const weekEnd = endOfWeekStr(today);
  const groups = [
    { key: 'overdue', label: 'Overdue', warn: true, items: [] },
    { key: 'today', label: 'Today', items: [] },
    { key: 'week', label: 'This week', items: [] },
    { key: 'later', label: 'Later', items: [] },
    { key: 'none', label: 'No date', items: [], triage: true },
  ];
  const at = k => groups.find(g => g.key === k);
  tasks.forEach(t => {
    const due = t.dueDate || '';
    if (!due) at('none').items.push(t);
    else if (due < today) at(t.status === 'done' ? 'later' : 'overdue').items.push(t);
    else if (due === today) at('today').items.push(t);
    else if (due <= weekEnd) at('week').items.push(t);
    else at('later').items.push(t);
  });

  const cmp = (a, b) => {
    // Done sinks inside its group whatever the sort — a finished thing is not
    // what you came to the list for.
    const ad = a.status === 'done' ? 1 : 0, bd = b.status === 'done' ? 1 : 0;
    if (ad !== bd) return ad - bd;
    if (taskSort === 'name') return String(a.name).localeCompare(String(b.name));
    if (taskSort === 'created') return String(b.created || '').localeCompare(String(a.created || ''));
    const byDate = String(a.dueDate || 'z').localeCompare(String(b.dueDate || 'z'));
    if (byDate) return byDate;
    return String(a.time || 'z').localeCompare(String(b.time || 'z'));
  };
  groups.forEach(g => g.items.sort(cmp));

  const filled = groups.filter(g => g.items.length);
  if (!filled.length) {
    host.innerHTML = emptyState({
      icon: 'search', title: 'No matches',
      hint: search || taskFilterCategory !== 'all' || activeProject
        ? 'Nothing here matches what you are filtering by.'
        : 'Nothing open. Add the next thing.',
      actionLabel: '+ New task', action: 'new-task',
    });
  } else {
    host.innerHTML = filled.map(g => `
      <div class="tk-group${g.warn ? ' warn' : ''}" data-tk-group="${g.key}">
        <div class="tk-group-h"><span>${g.label}</span><em>${g.items.length}</em></div>
        ${g.triage ? '<p class="tk-triage">Nothing schedules itself. Give these a date, or a time on your day.</p>' : ''}
        ${g.items.map(t => renderTaskRow(t, today)).join('')}
      </div>`).join('');
  }
  bindTaskRowEvents('#tasksList');
  renderArchivedRow(archived, today);
}

// One filter bar. The status is a segmented control, so it cannot be mistaken
// for a category; sort is a small select; categories and projects each sit on
// a line that says what they are. Clear appears only when something is
// narrowing the list, and puts every filter (and the search) back.
function tasksFiltered() {
  const searchEl = document.getElementById('searchInput');
  return taskFilterStatus !== 'open' || taskFilterCategory !== 'all' || taskSort !== 'due' ||
    !!activeProject || !!(searchEl && searchEl.value.trim());
}

function clearTaskFilters() {
  taskFilterStatus = 'open';
  taskFilterCategory = 'all';
  taskSort = 'due';
  activeProject = null;
  const searchEl = document.getElementById('searchInput');
  if (searchEl) searchEl.value = '';
  render();   // activeProject is shared with the sidebar
}

function renderTaskFilters(active) {
  const host = document.getElementById('tkFilters');
  if (!host) return;
  const cats = (state.categories || []).filter(c => active.some(t => t.category === c.id));
  const chip = (v, label, count, color) => `
    <button type="button" class="dl-chip tk-chip${v === taskFilterCategory ? ' on' : ''}" aria-pressed="${v === taskFilterCategory}"
            data-tk-filter="category" data-v="${esc(v)}"${color ? ` style="--c:${color}"` : ''}>
      ${color ? '<span class="dl-dot" style="--c:' + color + '"></span>' : ''}${esc(label)}${count != null ? `<em>${count}</em>` : ''}
    </button>`;
  host.innerHTML = `
    <div class="tk-bar">
      <div class="dl-seg tk-status" role="group" aria-label="Show">
        ${TASK_STATUS_FILTERS.map(f => `<button type="button" data-tk-filter="status" data-v="${f.v}" aria-pressed="${f.v === taskFilterStatus}">${f.label}</button>`).join('')}
      </div>
      <label class="tk-sort">
        <select data-tk-sort aria-label="Sort tasks">
          ${TASK_SORTS.map(sr => `<option value="${sr.v}"${sr.v === taskSort ? ' selected' : ''}>${sr.label}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="tk-chiprow" role="group" aria-labelledby="tkCatLabel">
      <span class="tk-grouplabel" id="tkCatLabel">Category</span>
      ${chip('all', 'All', active.length)}
      ${cats.map(c => chip(c.id, c.name, active.filter(t => t.category === c.id).length, taxColor(c))).join('')}
      <button type="button" class="tk-clear" data-tk-clear${tasksFiltered() ? '' : ' hidden'}><span class="ms" aria-hidden="true">close</span>Clear</button>
    </div>`;

  host.querySelectorAll('[data-tk-filter]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tkFilter === 'status') taskFilterStatus = b.dataset.v;
    else taskFilterCategory = b.dataset.v;
    renderTasksView();
  }));
  const sort = host.querySelector('[data-tk-sort]');
  if (sort) sort.addEventListener('change', () => { taskSort = sort.value; renderTasksView(); });
  const clear = host.querySelector('[data-tk-clear]');
  if (clear) clear.addEventListener('click', clearTaskFilters);
}

// The project filter lives here now — this is where Today's and the Board's
// copies were consolidated to. It shares `activeProject` with the sidebar, so
// the two never disagree.
function renderTaskProjectChips(active) {
  const host = document.getElementById('tkProjects');
  if (!host) return;
  const projects = (state.projects || []).filter(p => active.some(t => t.project === p.id));
  if (!projects.length) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  host.setAttribute('role', 'group');
  host.setAttribute('aria-labelledby', 'tkProjLabel');
  host.innerHTML = `
    <span class="tk-grouplabel" id="tkProjLabel">Project</span>
    <button type="button" class="dl-chip tk-chip${activeProject ? '' : ' on'}" aria-pressed="${!activeProject}" data-tk-proj="">All</button>
    ${projects.map(p => `
      <button type="button" class="dl-chip tk-chip${activeProject === p.id ? ' on' : ''}" aria-pressed="${activeProject === p.id}" data-tk-proj="${esc(p.id)}" style="--c:${taxColor(p)}">
        <span class="dl-dot" style="--c:${taxColor(p)}"></span>${esc(p.name)}<em>${active.filter(t => t.project === p.id && t.status !== 'done').length}</em>
      </button>`).join('')}`;

  host.querySelectorAll('[data-tk-proj]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.tkProj;
    activeProject = id || null;
    render();
  }));
}

function renderArchivedRow(archived, today) {
  const host = document.getElementById('tasksArchivedSection');
  if (!host) return;
  if (!archived.length) {
    host.innerHTML = taskFilterStatus === 'done'
      ? '<p class="tk-noarchive">Nothing archived yet. Finished tasks move here a week after you tick them.</p>'
      : '';
    return;
  }
  const open = host.classList.contains('open');
  host.innerHTML = `
    <button type="button" class="tk-archive-row" id="archivedToggle" aria-expanded="${open}">
      <span class="ms tk-archive-chev" aria-hidden="true">chevron_right</span>
      <span>Archived</span><em>${archived.length}</em>
    </button>
    <div class="tk-archive-list">
      ${archived.slice().sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')))
        .map(t => renderTaskRow(t, today)).join('')}
    </div>`;
  const btn = document.getElementById('archivedToggle');
  if (btn) btn.addEventListener('click', () => {
    const now = !host.classList.contains('open');
    host.classList.toggle('open', now);
    btn.setAttribute('aria-expanded', String(now));
  });
  bindTaskRowEvents('#tasksArchivedSection .tk-archive-list');
}

const TASK_PRIO_LABEL = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };

function renderTaskRow(t, today) {
  const cat = (state.categories || []).find(c => c.id === t.category);
  const proj = t.project ? (state.projects || []).find(p => p.id === t.project) : null;
  const done = t.status === 'done';
  const overdue = t.dueDate && t.dueDate < today && !done;
  const steps = (t.subtasks && t.subtasks.length)
    ? `<span class="tk-steps">${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>` : '';
  // `estimate` is written by the task sheet; a task last saved in v2 has only
  // `duration` (hours), so derive the label rather than show nothing.
  const estText = t.estimate || (typeof taskLengthLabel === 'function' ? taskLengthLabel(t.duration) : '');
  const est = estText ? `<span class="tk-est">${esc(estText)}</span>` : '';
  // taskTimeOf() also reads a v2 task's scheduledHour, so an old timed task
  // shows its time here before it has ever been through the sheet.
  const clock = (typeof taskTimeOf === 'function') ? taskTimeOf(t) : (t.time || '');
  const when = t.dueDate
    ? `<span class="tk-due${overdue ? ' od' : ''}">${esc(formatDate(t.dueDate))}${clock ? ' ' + esc(clock) : ''}</span>`
    : '';
  const flag = TASK_PRIO_LABEL[t.priority]
    ? `<span class="ms tk-flag p-${t.priority}" title="${TASK_PRIO_LABEL[t.priority]}" aria-label="${TASK_PRIO_LABEL[t.priority]}">flag</span>` : '';
  const catChip = cat
    ? `<span class="dl-chip tk-cat" style="--c:${taxColor(cat)};--c-ink:var(--c-${cat.color || 'none'}-ink)">${esc(cat.name)}</span>` : '';
  const projChip = proj
    ? `<span class="dl-chip tk-cat" style="--c:${taxColor(proj)};--c-ink:var(--c-${proj.color || 'none'}-ink)">${esc(proj.name)}</span>` : '';

  return `
    <div class="tk-row${done ? ' is-done' : ''}" data-id="${esc(t.id)}">
      <button type="button" class="tk-check${done ? ' on' : ''}" data-check="${esc(t.id)}"
              aria-label="${done ? 'Mark not done' : 'Mark done'}" aria-pressed="${done}">
        <span class="ms" aria-hidden="true">check</span>
      </button>
      <span class="tk-main">
        <span class="tk-name">${esc(t.name)}</span>
        <span class="tk-meta">${catChip}${projChip}${steps}${est}</span>
      </span>
      ${when}${flag}
    </div>`;
}

function bindTaskRowEvents(containerSel) {
  const host = document.querySelector(containerSel);
  if (!host) return;
  host.querySelectorAll('[data-check]').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); toggleTaskDone(el.dataset.check); });
  });
  host.querySelectorAll('.tk-row').forEach(el => {
    el.addEventListener('click', () => openTaskSheet(el.dataset.id));
  });
}
