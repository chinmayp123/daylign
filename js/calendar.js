// ========== Calendar (v3, spec 6) ==========
// Month is a grid plus ONE day: the day you selected, drawn as the same
// `.dl-line` Today uses (js/line.js renderLine takes a date and a host), so a
// day in the calendar reads exactly like the day you are living.
//
// Week is two different screens on purpose. A phone gets an agenda by day —
// seven columns of hours at 390px is unreadable. Desktop gets the hour grid,
// with an "any time" strip of that day's undated tasks along the top that you
// can drag onto an hour to schedule.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The day the month grid has selected. Null means "today, if it is in view".
let calSelected = null;

// Hours the desktop week grid draws. Outside these an event is pinned to the
// edge rather than growing the grid to 24 rows nobody looks at.
const CALW_START = 6;
const CALW_END = 23;

function calSelectedDate() {
  if (calSelected) return calSelected;
  const today = getTodayStr();
  const viewing = toLocalDateStr(calendarDate);
  if (calViewMode === 'month') {
    if (viewing.slice(0, 7) === today.slice(0, 7)) return today;
    return viewing.slice(0, 8) + '01';
  }
  const ws = calWeekStart();
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  if (today >= toLocalDateStr(ws) && today <= toLocalDateStr(we)) return today;
  return toLocalDateStr(ws);
}

function calWeekStart() {
  const d = new Date(calendarDate);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

// The dot colour for a day: an event's own colour token, or a task's priority.
// Priority is the only thing about a task that outranks its category here —
// "what is urgent this month" is the question a month grid is asked.
const CAL_PRIO_COLOR = { high: 'var(--red)', medium: 'var(--c-habit)', low: 'var(--c-water)' };

function calEventColor(ev) {
  const c = ev && ev.color;
  if (CATEGORY_COLOR_KEYS.indexOf(c) !== -1) return 'var(--c-' + c + ')';
  // Events saved by the v2 modal hold one of ten hexes. They still render as
  // themselves; only new ones use the six tokens.
  if (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) return c;
  return 'var(--c-meet)';
}

function renderCalendar() {
  const monthView = document.getElementById('calMonthView');
  const weekView = document.getElementById('calWeekView');
  const agenda = document.getElementById('calAgenda');
  if (!monthView || !weekView) return;

  document.querySelectorAll('#calMonthBtn, #calWeekBtn').forEach(b => {
    const on = (b.id === 'calMonthBtn') === (calViewMode === 'month');
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  if (calViewMode === 'month') {
    monthView.hidden = false;
    weekView.hidden = true;
    if (agenda) { agenda.hidden = true; agenda.innerHTML = ''; }
    renderCalendarMonth();
  } else {
    monthView.hidden = true;
    weekView.hidden = false;
    renderCalendarWeek();
    renderCalAgenda();
  }
}

// ---------- Month ----------
function renderCalendarMonth() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const label = document.getElementById('calMonth');
  if (label) label.textContent = `${MONTH_NAMES[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getTodayStr();
  const selected = calSelectedDate();
  const holidays = (typeof getUSHolidays === 'function') ? getUSHolidays(year) : [];

  let html = DAY_ABBR.map(d => `<span class="cal-dow">${d[0]}</span>`).join('');
  for (let i = 0; i < firstDay; i++) html += '<span class="cal-cell pad"></span>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const events = (state.events || []).filter(e => e.date === dateStr);
    const tasks = (state.tasks || []).filter(t => t.dueDate === dateStr && t.status !== 'done');
    const holiday = holidays.find(h => h.date === dateStr);
    const dots = []
      .concat(events.map(calEventColor))
      .concat(tasks.map(t => CAL_PRIO_COLOR[t.priority] || 'var(--text-muted)'))
      .slice(0, 4);
    html += `
      <button type="button" class="cal-cell${dateStr === today ? ' today' : ''}${dateStr === selected ? ' sel' : ''}"
              data-date="${dateStr}" aria-pressed="${dateStr === selected}">
        <span class="cal-n">${d}</span>
        <span class="cal-dots">${dots.map(c => `<i style="background:${c}"></i>`).join('')}</span>
        ${holiday ? `<span class="cal-hol">${esc(holiday.name)}</span>` : ''}
      </button>`;
  }
  const grid = document.getElementById('calGrid');
  if (grid) grid.innerHTML = html;

  // The grid is rewritten on every render, so these die with it.
  if (grid) grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => { calSelected = cell.dataset.date; renderCalendar(); });
    cell.addEventListener('dblclick', () => openEventModal(cell.dataset.date));
  });

  renderCalDayPanel(selected);
}

function renderCalDayPanel(dateStr) {
  const title = document.getElementById('calDayTitle');
  if (title) {
    const d = new Date(dateStr + 'T00:00:00');
    title.textContent = dateStr === getTodayStr()
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  const isToday = dateStr === getTodayStr();
  if (typeof renderLine === 'function') renderLine(dateStr, 'calDayLine', { logged: !isToday });
  const lineHost = document.getElementById('calDayLine');

  // Tasks due this day with no time are not on the line (it is a timeline),
  // but the month grid shows their dots, so the day has to show them too.
  const clockOf = (t) => (typeof taskClockTime === 'function' ? taskClockTime(t) : t.time);
  const untimed = (state.tasks || []).filter(t => t && t.dueDate === dateStr && !clockOf(t) &&
    !(typeof isArchived === 'function' && isArchived(t)));
  const dueHost = document.getElementById('calDayDue');
  if (dueHost) {
    dueHost.hidden = !untimed.length;
    dueHost.innerHTML = untimed.length ? `
      <h4 class="cal-due-h">Due, no time</h4>
      ${untimed.map(t => {
        const cat = (state.categories || []).find(c => c.id === t.category);
        return `<button type="button" class="cal-due-row${t.status === 'done' ? ' is-done' : ''}" data-cal-task="${esc(t.id)}">
          <span class="dl-dot" style="--c:${taxColor(cat)}"></span>
          <span class="cal-due-name">${esc(t.name)}</span>
          ${t.status === 'done' ? '<span class="cal-due-state">done</span>' : ''}
        </button>`;
      }).join('')}` : '';
    if (!dueHost._bound) {
      dueHost._bound = true;
      dueHost.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cal-task]');
        if (b && typeof openTaskSheet === 'function') openTaskSheet(b.dataset.calTask);
      });
    }
  }
  const empty = document.getElementById('calDayEmpty');
  if (empty) empty.hidden = !!(lineHost && lineHost.innerHTML.trim()) || untimed.length > 0;
}

// ---------- Week: desktop hour grid ----------
function renderCalendarWeek() {
  const ws = calWeekStart();
  const we = new Date(ws); we.setDate(ws.getDate() + 6);
  const label = document.getElementById('calMonth');
  if (label) {
    label.textContent = ws.getMonth() === we.getMonth()
      ? `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${we.getFullYear()}`
      : `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
  }

  const today = getTodayStr();
  const holidays = [].concat(
    (typeof getUSHolidays === 'function') ? getUSHolidays(ws.getFullYear()) : [],
    (ws.getFullYear() !== we.getFullYear() && typeof getUSHolidays === 'function') ? getUSHolidays(we.getFullYear()) : []);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(ws.getDate() + i);
    days.push(toLocalDateStr(d));
  }

  const minsOf = (s) => {
    const m = String(s || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const rows = CALW_END - CALW_START + 1;
  const topPct = (min) => ((Math.min(Math.max(min, CALW_START * 60), CALW_END * 60 + 59) - CALW_START * 60) / (rows * 60)) * 100;

  // header
  let head = '<span class="calw-corner"></span>' + days.map((ds, i) => {
    const hol = holidays.find(h => h.date === ds);
    return `<span class="calw-dh${ds === today ? ' today' : ''}" data-date="${ds}">
      <em>${DAY_ABBR[i]}</em><b>${Number(ds.slice(8))}</b>
      ${hol ? `<i class="calw-hol">${esc(hol.name)}</i>` : ''}</span>`;
  }).join('');

  // "any time" strip: this day's undated-in-the-clock-sense tasks. Drag one
  // onto an hour below and it gets that time.
  let strip = '<span class="calw-striplabel">any time</span>' + days.map(ds => {
    const loose = (state.tasks || []).filter(t => t.dueDate === ds && !taskTimeOf(t) && t.status !== 'done');
    return `<span class="calw-strip" data-date="${ds}">
      ${loose.map(t => {
        const cat = (state.categories || []).find(c => c.id === t.category);
        return `<span class="calw-loose" draggable="true" data-id="${esc(t.id)}" style="--c:${taxColor(cat)}">${esc(t.name)}</span>`;
      }).join('')}
    </span>`;
  }).join('');

  let hours = '';
  for (let h = CALW_START; h <= CALW_END; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    hours += `<span class="calw-hl">${h12}${h < 12 ? 'a' : 'p'}</span>`;
  }

  const cols = days.map(ds => {
    const blocks = [];
    (state.events || []).filter(e => e.date === ds).forEach(ev => {
      const min = minsOf(ev.time);
      const end = minsOf(ev.endTime);
      blocks.push({
        min: min == null ? CALW_START * 60 : min,
        len: (min != null && end != null && end > min) ? Math.max(30, end - min) : 60,
        c: calEventColor(ev),
        name: ev.name || 'Event', time: ev.time || '', kind: 'event', id: ev.id,
      });
    });
    (state.tasks || []).filter(t => t.dueDate === ds && taskTimeOf(t)).forEach(t => {
      const cat = (state.categories || []).find(c => c.id === t.category);
      blocks.push({
        min: minsOf(taskTimeOf(t)), len: Math.max(30, (Number(t.duration) || 1) * 60),
        c: taxColor(cat), name: t.name, time: taskTimeOf(t), kind: 'task', id: t.id,
      });
    });
    blocks.sort((a, b) => a.min - b.min || b.len - a.len);
    // Blocks that overlap in time share the column side by side, each in its
    // own lane, instead of all spanning the full width and hiding each other.
    // A cluster is a run of blocks linked by overlap; each block takes the
    // first lane that is free by its start, and the whole cluster is split
    // into as many lanes as it needed.
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const lanes = [];
      cluster.forEach(b => {
        let i = lanes.findIndex(end => end <= b.min);
        if (i === -1) { i = lanes.length; lanes.push(0); }
        lanes[i] = b.min + b.len;
        b.lane = i;
      });
      cluster.forEach(b => { b.lanes = lanes.length; });
      cluster = [];
    };
    blocks.forEach(b => {
      if (cluster.length && b.min >= clusterEnd) flush();
      cluster.push(b);
      clusterEnd = Math.max(clusterEnd, b.min + b.len);
    });
    if (cluster.length) flush();
    return `<span class="calw-col${ds === today ? ' today' : ''}" data-date="${ds}">
      ${Array.from({ length: rows }, (_, i) => `<i class="calw-slot" data-hour="${CALW_START + i}"></i>`).join('')}
      ${blocks.map(b => `
        <span class="calw-ev" data-kind="${b.kind}" data-id="${esc(b.id)}"
              style="--c:${b.c};--lane:${b.lane};--lanes:${b.lanes};top:${topPct(b.min).toFixed(2)}%;height:${((b.len / (rows * 60)) * 100).toFixed(2)}%">
          <b>${esc(b.name)}</b>${b.time ? `<em>${esc(b.time)}</em>` : ''}
        </span>`).join('')}
    </span>`;
  }).join('');

  const host = document.getElementById('calWeekGrid');
  if (!host) return;
  host.style.setProperty('--calw-rows', rows);
  host.innerHTML = `
    <div class="calw-head">${head}</div>
    <div class="calw-striprow">${strip}</div>
    <div class="calw-body">
      <div class="calw-hours">${hours}</div>
      <div class="calw-cols">${cols}</div>
    </div>`;

  bindCalWeek(host);
}

function bindCalWeek(host) {
  host.querySelectorAll('.calw-ev').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (el.dataset.kind === 'task') { openTaskSheet(el.dataset.id); return; }
    const ev = (state.events || []).find(x => x.id === el.dataset.id);
    if (ev) openEventModal(ev.date, ev);
  }));

  host.querySelectorAll('.calw-loose').forEach(el => {
    el.addEventListener('click', () => openTaskSheet(el.dataset.id));
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', el.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  });

  // Drop an "any time" task onto an hour to schedule it. The columns are
  // rewritten on every render, so these listeners go with them.
  host.querySelectorAll('.calw-col').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    col.addEventListener('dragenter', () => col.classList.add('drop-over'));
    col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop-over'); });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drop-over');
      const id = e.dataTransfer.getData('text/plain');
      const task = (state.tasks || []).find(t => t.id === id);
      if (!task) return;
      const slot = e.target.closest('.calw-slot');
      const rect = col.getBoundingClientRect();
      const hour = slot ? Number(slot.dataset.hour)
        : Math.min(CALW_END, Math.max(CALW_START,
            CALW_START + Math.floor(((e.clientY - rect.top) / rect.height) * (CALW_END - CALW_START + 1))));
      task.dueDate = col.dataset.date;
      task.time = String(hour).padStart(2, '0') + ':00';
      task.scheduledHour = hour;
      if (!task.duration) { task.duration = 1; task.estimate = taskLengthLabel(1); }
      saveData(state);
      render();
    });
    // Double-click an empty slot to add an event at that hour.
    col.addEventListener('dblclick', (e) => {
      if (e.target.closest('.calw-ev')) return;
      const slot = e.target.closest('.calw-slot');
      openEventModal(col.dataset.date, null, slot ? String(slot.dataset.hour).padStart(2, '0') + ':00' : '');
    });
  });

  host.querySelectorAll('.calw-dh').forEach(el => el.addEventListener('dblclick', () => openEventModal(el.dataset.date)));
}

// ---------- Week: phone agenda ----------
// One card per day of the week, empty days included — the gap in a week is
// information, and a list that silently skips Thursday hides it.
function renderCalAgenda() {
  const host = document.getElementById('calAgenda');
  if (!host) return;
  host.hidden = false;
  const ws = calWeekStart();
  const today = getTodayStr();
  const holidays = (typeof getUSHolidays === 'function') ? getUSHolidays(ws.getFullYear()) : [];

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws); d.setDate(ws.getDate() + i);
    const ds = toLocalDateStr(d);
    const events = (state.events || []).filter(e => e.date === ds)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    const tasks = (state.tasks || []).filter(t => t.dueDate === ds && t.status !== 'done')
      .sort((a, b) => String(taskTimeOf(a) || 'z').localeCompare(String(taskTimeOf(b) || 'z')));
    const hol = holidays.find(h => h.date === ds);

    const rows = []
      .concat(hol ? [`<div class="ag-row" style="--c:var(--c-habit)"><span class="ag-name">${esc(hol.name)}</span></div>`] : [])
      .concat(events.map(e => `
        <div class="ag-row" data-event-id="${esc(e.id)}" style="--c:${calEventColor(e)}">
          <span class="ag-name">${esc(e.name)}</span>
          ${e.time ? `<span class="ag-sub">${esc(e.time)}</span>` : ''}
        </div>`))
      .concat(tasks.map(t => {
        const cat = (state.categories || []).find(c => c.id === t.category);
        return `
        <div class="ag-row" data-id="${esc(t.id)}" style="--c:${CAL_PRIO_COLOR[t.priority] || taxColor(cat)}">
          <span class="ag-name">${esc(t.name)}</span>
          <span class="ag-sub">${taskTimeOf(t) ? esc(taskTimeOf(t)) : 'due'}</span>
        </div>`;
      }));

    html += `
      <div class="ag-day${ds === today ? ' today' : ''}${ds < today ? ' past' : ''}">
        <div class="ag-head">
          <span class="ag-dow">${ds === today ? 'Today' : DAY_ABBR[d.getDay()]}</span>
          <span class="ag-date">${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}</span>
          <button type="button" class="ag-add" data-ag-add="${ds}" aria-label="Add event"><span class="ms" aria-hidden="true">add</span></button>
        </div>
        ${rows.length ? rows.join('') : '<p class="ag-empty">Nothing on this day.</p>'}
      </div>`;
  }
  host.innerHTML = html;

  host.querySelectorAll('.ag-row[data-id]').forEach(el =>
    el.addEventListener('click', () => openTaskSheet(el.dataset.id)));
  host.querySelectorAll('.ag-row[data-event-id]').forEach(el =>
    el.addEventListener('click', () => {
      const ev = (state.events || []).find(x => x.id === el.dataset.eventId);
      if (ev) openEventModal(ev.date, ev);
    }));
  host.querySelectorAll('[data-ag-add]').forEach(b =>
    b.addEventListener('click', () => openEventModal(b.dataset.agAdd)));
}

// ========== Event sheet (spec 6) ==========
// Colour is one of the six category tokens now, not one of ten arbitrary hexes,
// so a calendar dot and a task chip in the same colour mean the same thing.
let evEditingId = '';

function openEventModal(date, existingEvent, presetTime) {
  const wrap = document.getElementById('eventSheet');
  if (!wrap) return;
  const body = wrap.querySelector('.ev-body');
  if (!body) return;

  const ev = existingEvent || {};
  const isEdit = !!(existingEvent && existingEvent.id);
  // Google Calendar events are mirrored in, not ours — they open read only.
  const readOnly = !!(ev.external || ev.source === 'google');
  evEditingId = isEdit ? ev.id : '';

  const titleEl = wrap.querySelector('#eventSheetTitle');
  if (titleEl) titleEl.textContent = readOnly ? 'Event' : (isEdit ? 'Event' : 'New event');

  const curColor = CATEGORY_COLOR_KEYS.indexOf(ev.color) !== -1 ? ev.color : 'meet';

  if (readOnly) {
    body.innerHTML = `
      <p class="ev-ro-name">${esc(ev.name || 'Event')}</p>
      <p class="ev-ro-meta">${esc(formatDate(ev.date || date))}${ev.time ? ' · ' + esc(ev.time) : ''}</p>
      ${ev.description ? `<p class="ev-ro-desc">${esc(ev.description)}</p>` : ''}
      <p class="ev-ro-note">From your Google Calendar — edit it there.</p>
      <div class="ts-actions sheet-foot"><span class="ts-spacer"></span>
        <button type="button" class="dl-btn" id="evCancel">Close</button></div>`;
  } else {
    body.innerHTML = `
      <div class="ts-title">
        <input type="text" id="evName" placeholder="What is it?" value="${esc(ev.name || '')}" autocomplete="off">
      </div>
      <div class="ts-row">
        <label class="dl-field ts-f"><span class="dl-field-label">Date</span>
          <input type="date" id="evDate" value="${esc(ev.date || date || getTodayStr())}"></label>
      </div>
      <div class="ts-row">
        <label class="dl-field ts-f"><span class="dl-field-label">Starts</span>
          <input type="time" id="evTime" value="${esc(ev.time || presetTime || '')}"></label>
        <label class="dl-field ts-f"><span class="dl-field-label">Ends</span>
          <input type="time" id="evEnd" value="${esc(ev.endTime || '')}"></label>
      </div>
      <div class="ts-group">
        <span class="ts-label">Colour</span>
        <div class="ev-colors" id="evColors">
          ${CATEGORY_COLOR_KEYS.map(k => `
            <button type="button" class="ev-sw${k === curColor ? ' on' : ''}" data-color="${k}"
                    style="--c:var(--c-${k})" aria-label="${k}" aria-pressed="${k === curColor}"></button>`).join('')}
        </div>
      </div>
      <div class="ts-group">
        <span class="ts-label">Notes</span>
        <textarea id="evDesc" rows="3" placeholder="Anything worth keeping with it...">${esc(ev.description || '')}</textarea>
      </div>
      <div class="ts-actions sheet-foot">
        ${isEdit ? '<button type="button" class="dl-btn danger" id="evDelete">Delete</button>' : ''}
        <span class="ts-spacer"></span>
        <button type="button" class="dl-btn" id="evCancel">Cancel</button>
        <button type="button" class="dl-btn primary" id="evSave">Save</button>
      </div>`;
  }

  // Everything below is bound to nodes this call just created.
  const colors = document.getElementById('evColors');
  if (colors) colors.addEventListener('click', (e) => {
    const sw = e.target.closest('.ev-sw');
    if (!sw) return;
    colors.querySelectorAll('.ev-sw').forEach(s => { s.classList.remove('on'); s.setAttribute('aria-pressed', 'false'); });
    sw.classList.add('on');
    sw.setAttribute('aria-pressed', 'true');
  });
  const cancel = document.getElementById('evCancel');
  if (cancel) cancel.addEventListener('click', closeEventSheet);
  const save = document.getElementById('evSave');
  if (save) save.addEventListener('click', saveEventFromSheet);
  const del = document.getElementById('evDelete');
  if (del) del.addEventListener('click', deleteEventFromSheet);

  openDlSheet(wrap);
  setTimeout(() => { const n = document.getElementById('evName'); if (n && !isEdit) n.focus(); }, 80);
}

function closeEventSheet() {
  closeDlSheet(document.getElementById('eventSheet'));
}

function saveEventFromSheet() {
  const nameEl = document.getElementById('evName');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (nameEl) { nameEl.classList.add('is-missing'); nameEl.focus(); }
    if (typeof showToast === 'function') showToast('Give it a name first');
    return;
  }
  if (!state.events) state.events = [];
  const on = document.querySelector('#evColors .ev-sw.on');
  const data = {
    id: evEditingId || 'evt-' + Date.now(),
    name,
    date: (document.getElementById('evDate') || {}).value || getTodayStr(),
    time: (document.getElementById('evTime') || {}).value || '',
    endTime: (document.getElementById('evEnd') || {}).value || '',
    description: (document.getElementById('evDesc') || {}).value.trim(),
    color: on ? on.dataset.color : 'meet',
  };
  const idx = evEditingId ? state.events.findIndex(e => e.id === evEditingId) : -1;
  if (idx >= 0) state.events[idx] = data;
  else state.events.push(data);

  saveData(state);
  closeEventSheet();
  render();
}

// No confirm(): the delete undoes from the toast, like every other delete.
function deleteEventFromSheet() {
  if (!evEditingId) return;
  const list = state.events || [];
  const at = list.findIndex(e => e.id === evEditingId);
  if (at === -1) return;
  const gone = list[at];
  state.events = list.filter(e => e !== gone);
  saveData(state);
  closeEventSheet();
  render();
  showToast(`Deleted ${gone.name || 'event'} · Undo`, () => {
    state.events = state.events || [];
    state.events.splice(Math.min(at, state.events.length), 0, gone);
    saveData(state);
    render();
  });
}
