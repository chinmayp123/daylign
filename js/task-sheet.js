// ========== Task sheet (v3, spec 5) ==========
// One sheet for every way into a task: a list row, a board card, a calendar
// dot, a node on the line, Ctrl K, voice, the + button. It replaces the
// #taskModal form-and-view pair in js/modal.js, which had two panes (read then
// edit) and no way to set a priority at all.
//
// The sheet's body is rebuilt on every open, so the listeners bound at the end
// of buildTaskSheet die with the nodes they were bound to — nothing
// accumulates. The wrapper is persistent and is handled by openDlSheet's
// delegated backdrop / Esc / swipe handlers in js/utils.js.
//
// Two fields are new to the UI:
//   task.time      "HH:MM" — the time on your day. This is what puts a task on
//                  the line: js/line.js already reads `time`.
//   task.priority  '' | 'low' | 'medium' | 'high' — the calendar dots, the
//                  agenda border and the line's card treatment already read it.
// `scheduledHour`, `duration` and `estimate` are DERIVED from time + length on
// save, so every v2 surface that reads them (Today's plan, the schedule lane,
// the week grid, the line's value column) keeps working without a migration.

const TASK_LENGTHS = [
  { v: '', label: 'No length' },
  { v: '0.25', label: '15 min' },
  { v: '0.5', label: '30 min' },
  { v: '0.75', label: '45 min' },
  { v: '1', label: '1 hour' },
  { v: '1.5', label: '1.5 hours' },
  { v: '2', label: '2 hours' },
  { v: '3', label: '3 hours' },
  { v: '4', label: '4 hours' },
];

const TASK_PRIORITIES = [
  { v: '', label: 'None' },
  { v: 'low', label: 'Low' },
  { v: 'medium', label: 'Medium' },
  { v: 'high', label: 'High' },
];

const TASK_STATUSES = [
  { v: 'todo', label: 'To do' },
  { v: 'in-progress', label: 'Doing' },
  { v: 'done', label: 'Done' },
];

// The id of the task the open sheet is editing; '' for a new one.
let tsEditingId = '';
let tsSteps = [];

// "1h 30m" from 1.5. Stored on the task as `estimate` so the line and the list
// row can show a length without re-deriving it everywhere.
function taskLengthLabel(hours) {
  const h = Number(hours);
  if (!h || !isFinite(h) || h <= 0) return '';
  const mins = Math.round(h * 60);
  if (mins < 60) return mins + 'm';
  if (mins % 60 === 0) return (mins / 60) + 'h';
  return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
}

// A v2 task has scheduledHour but no time. Read one as the other so opening an
// old task shows the time it was actually scheduled for.
function taskTimeOf(t) {
  if (!t) return '';
  if (t.time) {
    const m = String(t.time).match(/^(\d{1,2}):(\d{2})/);
    if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];
  }
  if (t.scheduledHour != null && t.scheduledHour !== '') {
    return String(t.scheduledHour).padStart(2, '0') + ':00';
  }
  return '';
}

function taskSheetWrap() {
  return document.getElementById('taskSheet');
}

// opts: { time, dueDate, status, project, category, focus }
// focus: 'time' lands in the time field — the tray's clock button on Today.
function openTaskSheet(taskId, opts) {
  const wrap = taskSheetWrap();
  if (!wrap) return;
  const o = opts || {};
  const task = taskId ? (state.tasks || []).find(t => t.id === taskId) : null;
  if (taskId && !task) return;

  tsEditingId = task ? task.id : '';
  tsSteps = task && task.subtasks ? task.subtasks.map(s => ({ ...s })) : [];

  const draft = task ? {
    name: task.name || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: TASK_PRIORITIES.some(p => p.v === task.priority) ? task.priority : '',
    category: task.category || '',
    project: task.project || '',
    dueDate: task.dueDate || '',
    time: taskTimeOf(task),
    duration: task.duration != null && task.duration !== '' ? String(task.duration) : '',
    created: task.created || '',
  } : {
    name: '', description: '', status: o.status || 'todo', priority: '',
    category: o.category || ((state.categories[0] && state.categories[0].id) || ''),
    project: o.project || activeProject || '',
    dueDate: o.dueDate || '', time: o.time || '',
    duration: o.time ? '1' : '', created: '',
  };
  // A time with no date would sit on no day at all.
  if (draft.time && !draft.dueDate) draft.dueDate = getTodayStr();

  buildTaskSheet(draft, !!task);
  openDlSheet(wrap);
  setTimeout(() => {
    const el = document.getElementById('tsName');
    // Focusing the title on an existing task would put the cursor in a field
    // you probably opened the sheet to read, and pops the phone keyboard up
    // over the rest of it. Only a new task starts in the title.
    if (el && !task) el.focus();
    const timeEl = document.getElementById('tsTime');
    if (o.focus === 'time' && timeEl) timeEl.focus();
  }, 80);
}

function closeTaskSheet() {
  closeDlSheet(taskSheetWrap());
}

function buildTaskSheet(d, isEdit) {
  const wrap = taskSheetWrap();
  const body = wrap.querySelector('.ts-body');
  if (!body) return;

  const seg = (name, opts, cur) => `
    <div class="dl-seg full ts-seg" role="group" data-ts-seg="${name}">
      ${opts.map(o => `<button type="button" data-v="${esc(o.v)}"${o.v === cur ? ' aria-pressed="true"' : ''}>${esc(o.label)}</button>`).join('')}
    </div>`;

  const cats = (state.categories || []).map(c =>
    `<option value="${esc(c.id)}"${c.id === d.category ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const projs = (state.projects || []).map(p =>
    `<option value="${esc(p.id)}"${p.id === d.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('');

  const titleEl = wrap.querySelector('#taskSheetTitle');
  if (titleEl) titleEl.textContent = isEdit ? 'Task' : 'New task';

  // Compact, as in the mockup: what almost every task needs sits above the
  // fold, and the rest folds under More. More opens by itself when the task
  // already has something in it, so opening a task never hides its notes.
  const moreHasSomething = isEdit && (d.status !== 'todo' || !!d.project || !!d.description.trim() || tsSteps.length > 0);

  body.innerHTML = `
    <div class="ts-title">
      <input type="text" id="tsName" placeholder="What needs to be done?" value="${esc(d.name)}"
             autocomplete="off" enterkeyhint="done" aria-label="Task name">
      <div class="ts-suggest" id="tsSuggest" hidden></div>
    </div>

    <div class="ts-row">
      <label class="dl-field ts-f"><span class="dl-field-label">Category</span>
        <select id="tsCategory">${cats}</select></label>
      <label class="dl-field ts-f"><span class="dl-field-label">Due</span>
        <input type="date" id="tsDue" value="${esc(d.dueDate)}"></label>
    </div>

    <div class="ts-row ts-when" title="A time puts this task on your day line">
      <label class="dl-field ts-f"><span class="dl-field-label">Time on your day</span>
        <input type="time" id="tsTime" value="${esc(d.time)}"></label>
      <label class="dl-field ts-f"><span class="dl-field-label">Length</span>
        <select id="tsLen">${TASK_LENGTHS.map(l =>
          `<option value="${l.v}"${l.v === d.duration ? ' selected' : ''}>${l.label}</option>`).join('')}</select></label>
    </div>
    <button type="button" class="ts-clear" id="tsClearTime"${d.time ? '' : ' hidden'}>Take it off the line</button>

    <div class="ts-group">
      <span class="ts-label">Priority</span>
      ${seg('priority', TASK_PRIORITIES, d.priority)}
    </div>

    <details class="ts-more" id="tsMore"${moreHasSomething ? ' open' : ''}>
      <summary><span>More</span><em>status, project, notes, steps</em><span class="ms" aria-hidden="true">expand_more</span></summary>
      <div class="ts-more-body">
        <div class="ts-group">
          <span class="ts-label">Status</span>
          ${seg('status', TASK_STATUSES, d.status)}
        </div>

        <label class="dl-field ts-f ts-projectf" id="tsProjectRow"><span class="dl-field-label">Project</span>
          <select id="tsProject"><option value="">None</option>${projs}</select></label>

        <div class="ts-group">
          <span class="ts-label">Notes</span>
          <textarea id="tsNotes" rows="3" placeholder="Anything worth keeping with it...">${esc(d.description)}</textarea>
        </div>

        <div class="ts-group">
          <span class="ts-label">Steps <em id="tsStepCount"></em></span>
          <div id="tsSteps"></div>
          <div class="ts-stepadd">
            <input type="text" id="tsStepInput" placeholder="Add a step..." autocomplete="off" aria-label="Add a step">
            <button type="button" id="tsStepAdd" aria-label="Add step"><span class="ms">add</span></button>
          </div>
        </div>

        ${d.created ? `<p class="ts-stamp">Created ${esc(formatDate(d.created))}</p>` : ''}
      </div>
    </details>

    <div class="ts-actions">
      ${isEdit ? '<button type="button" class="dl-btn danger" id="tsDelete">Delete</button>' : ''}
      <span class="ts-spacer"></span>
      <button type="button" class="dl-btn" id="tsCancel">Cancel</button>
      <button type="button" class="dl-btn primary" id="tsSave">Save</button>
    </div>`;

  renderTaskSteps();
  tsSyncProjectRow();
  bindTaskSheetBody();
}

function tsSyncProjectRow() {
  const row = document.getElementById('tsProjectRow');
  const cat = document.getElementById('tsCategory');
  const proj = document.getElementById('tsProject');
  if (!row || !cat) return;
  // Projects belong to Work in this app (the sidebar lists them under it), and
  // a task already carrying one keeps its row visible whatever its category.
  const show = cat.value === 'work' || (proj && proj.value);
  row.hidden = !show;
  if (!show && proj) proj.value = '';
}

function renderTaskSteps() {
  const host = document.getElementById('tsSteps');
  if (!host) return;
  const count = document.getElementById('tsStepCount');
  if (count) count.textContent = tsSteps.length ? tsSteps.filter(s => s.done).length + '/' + tsSteps.length : '';
  host.innerHTML = tsSteps.map((s, i) => `
    <div class="ts-step">
      <input type="checkbox" id="tsStep${i}" data-step="${i}" ${s.done ? 'checked' : ''}>
      <label for="tsStep${i}" class="${s.done ? 'done' : ''}">${esc(s.text)}</label>
      <button type="button" class="ts-step-x" data-step-x="${i}" aria-label="Remove step"><span class="ms">close</span></button>
    </div>`).join('');

  host.querySelectorAll('[data-step]').forEach(cb => cb.addEventListener('change', () => {
    tsSteps[Number(cb.dataset.step)].done = cb.checked;
    renderTaskSteps();
  }));
  host.querySelectorAll('[data-step-x]').forEach(b => b.addEventListener('click', () => {
    tsSteps.splice(Number(b.dataset.stepX), 1);
    renderTaskSteps();
  }));
}

function tsAddStep() {
  const input = document.getElementById('tsStepInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  tsSteps.push({ text, done: false });
  input.value = '';
  renderTaskSteps();
  input.focus();
}

// Bound to nodes that buildTaskSheet has just created, so they are replaced
// wholesale on the next open — nothing to guard against.
function bindTaskSheetBody() {
  const wrap = taskSheetWrap();

  wrap.querySelectorAll('[data-ts-seg]').forEach(group => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-v]');
      if (!btn) return;
      group.querySelectorAll('button').forEach(b => b.removeAttribute('aria-pressed'));
      btn.setAttribute('aria-pressed', 'true');
    });
  });

  const cat = document.getElementById('tsCategory');
  if (cat) cat.addEventListener('change', tsSyncProjectRow);

  const time = document.getElementById('tsTime');
  const clear = document.getElementById('tsClearTime');
  if (time) time.addEventListener('change', () => {
    if (clear) clear.hidden = !time.value;
    const due = document.getElementById('tsDue');
    if (time.value && due && !due.value) due.value = getTodayStr();
    const len = document.getElementById('tsLen');
    if (time.value && len && !len.value) len.value = '1';
  });
  if (clear) clear.addEventListener('click', () => {
    if (time) time.value = '';
    clear.hidden = true;
  });

  const add = document.getElementById('tsStepAdd');
  if (add) add.addEventListener('click', tsAddStep);
  const stepInput = document.getElementById('tsStepInput');
  if (stepInput) stepInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); tsAddStep(); }
  });

  const notes = document.getElementById('tsNotes');
  const name = document.getElementById('tsName');
  if (notes) {
    tsGrowNotes();
    notes.addEventListener('input', () => {
      tsGrowNotes();
      if (name && !name.value.trim()) tsSuggestTitle();
    });
  }
  if (name) {
    name.addEventListener('input', () => {
      name.classList.remove('is-missing');
      const s = document.getElementById('tsSuggest');
      if (s && name.value.trim()) { s.hidden = true; s.innerHTML = ''; }
    });
    // A pasted note is a whole task: first line titles it, the rest is notes.
    name.addEventListener('paste', (e) => {
      const cd = e.clipboardData || window.clipboardData;
      const text = cd && cd.getData ? cd.getData('text') : '';
      if (!text || text.trim().indexOf('\n') === -1) return;
      e.preventDefault();
      const lines = text.replace(/\r/g, '').split('\n');
      const first = (lines.shift() || '').trim();
      name.value = first.length > TASK_TITLE_MAX ? titleFromText(first) : first;
      const rest = lines.join('\n').trim();
      if (rest && notes) notes.value = notes.value ? notes.value + '\n' + rest : rest;
      tsGrowNotes();
    });
  }

  const del = document.getElementById('tsDelete');
  if (del) del.addEventListener('click', deleteTaskFromSheet);
  const cancel = document.getElementById('tsCancel');
  if (cancel) cancel.addEventListener('click', closeTaskSheet);
  const save = document.getElementById('tsSave');
  if (save) save.addEventListener('click', saveTaskFromSheet);
}

function tsGrowNotes() {
  const el = document.getElementById('tsNotes');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 360) + 'px';
}

function tsSuggestTitle() {
  const wrap = document.getElementById('tsSuggest');
  const name = document.getElementById('tsName');
  const notes = document.getElementById('tsNotes');
  if (!wrap || !name || !notes) return;
  const guess = titleFromText(notes.value);
  if (!guess || name.value.trim()) { wrap.hidden = true; wrap.innerHTML = ''; return; }
  wrap.hidden = false;
  wrap.innerHTML = '<button type="button" class="ts-suggest-chip" id="tsSuggestChip">Title it: ' + esc(guess) + '</button>';
  const chip = document.getElementById('tsSuggestChip');
  if (chip) chip.addEventListener('click', () => {
    name.value = guess;
    name.classList.remove('is-missing');
    wrap.hidden = true;
    wrap.innerHTML = '';
    name.focus();
  });
}

function tsSegValue(name) {
  const group = document.querySelector(`[data-ts-seg="${name}"]`);
  if (!group) return '';
  const on = group.querySelector('button[aria-pressed="true"]');
  return on ? on.dataset.v : '';
}

function saveTaskFromSheet() {
  const name = document.getElementById('tsName');
  const title = name ? name.value.trim() : '';
  if (!title) {
    if (name) { name.classList.add('is-missing'); name.focus(); }
    tsSuggestTitle();
    if (typeof showToast === 'function') showToast('Give it a title first');
    return;
  }

  const time = (document.getElementById('tsTime') || {}).value || '';
  const lenRaw = (document.getElementById('tsLen') || {}).value || '';
  const length = lenRaw ? parseFloat(lenRaw) : null;
  const category = (document.getElementById('tsCategory') || {}).value || '';
  const projectEl = document.getElementById('tsProject');
  const dueEl = document.getElementById('tsDue');
  let dueDate = dueEl ? dueEl.value : '';
  if (time && !dueDate) dueDate = getTodayStr();

  const data = {
    name: title,
    description: (document.getElementById('tsNotes') || {}).value.trim(),
    status: tsSegValue('status') || 'todo',
    priority: tsSegValue('priority') || '',
    category,
    project: projectEl && !document.getElementById('tsProjectRow').hidden ? (projectEl.value || null) : null,
    dueDate,
    time,
    // Derived, so every v2 reader of these keeps working.
    scheduledHour: time ? parseInt(time.slice(0, 2), 10) : null,
    duration: length,
    estimate: taskLengthLabel(length),
    subtasks: tsSteps.map(s => ({ ...s })),
  };

  if (tsEditingId) {
    const task = (state.tasks || []).find(t => t.id === tsEditingId);
    if (task) {
      if (data.status === 'done' && task.status !== 'done') data.completedAt = getTodayStr();
      else if (data.status !== 'done') data.completedAt = null;
      Object.assign(task, data);
    }
  } else {
    state.tasks.push(Object.assign({ id: Date.now().toString() }, data, {
      created: getTodayStr(),
      completedAt: data.status === 'done' ? getTodayStr() : null,
    }));
  }

  saveData(state);
  closeTaskSheet();
  if (typeof haptic === 'function') haptic('light');
  render();
}

// No confirm(): the delete undoes from the toast, like every other delete.
function deleteTaskFromSheet() {
  if (!tsEditingId) return;
  const at = (state.tasks || []).findIndex(t => t.id === tsEditingId);
  if (at === -1) return;
  const gone = state.tasks[at];
  state.tasks = state.tasks.filter(t => t !== gone);
  saveData(state);
  closeTaskSheet();
  render();
  showToast(`Deleted ${gone.name || 'task'} · Undo`, () => {
    state.tasks.splice(Math.min(at, state.tasks.length), 0, gone);
    saveData(state);
    render();
  });
}

// ---- The old entry points, kept as names so nothing has to know this moved ----
// openModal(id, scheduledHour, mode) was called from nine places.
function openModal(taskId = null, scheduledHour = null) {
  const opts = {};
  if (scheduledHour != null && scheduledHour !== '') {
    opts.time = String(scheduledHour).padStart(2, '0') + ':00';
    opts.dueDate = getTodayStr();
  }
  openTaskSheet(taskId, opts);
}
function closeModal() { closeTaskSheet(); }
// js/line.js taps a task node through this one.
function openTaskView(taskId) { openTaskSheet(taskId); }
